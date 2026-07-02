"""AI explainability service using attention weights and SHAP."""

from __future__ import annotations

from typing import Any

import numpy as np
import torch

from app.services.inference import inference_service


class ExplainabilityService:
    def explain(
        self,
        node_id: str,
        graph_snapshot: dict[str, Any],
    ) -> dict[str, Any]:
        if inference_service.model is None:
            raise RuntimeError("Model not loaded")

        x, edge_index = inference_service._prepare_tensors({}, graph_snapshot)

        inference_service.model.eval()
        with torch.no_grad():
            outputs = inference_service.model(x, edge_index)

        node_importance = inference_service._compute_node_importance(
            outputs["node_embeddings"],
            outputs.get("attention_weights"),
        )

        edge_importance = self._compute_edge_importance(
            graph_snapshot.get("edges", []),
            node_importance,
        )

        target_node = self._find_node(node_id, graph_snapshot.get("nodes", []))
        target_idx = self._find_node_index(node_id, graph_snapshot.get("nodes", []))

        integrated_grads = self._integrated_gradients(x, edge_index, target_idx)

        attack_probs = torch.softmax(outputs["attack_logits"], dim=-1).squeeze().cpu().numpy()
        stage_probs = torch.softmax(outputs["stage_logits"], dim=-1).squeeze().cpu().numpy()

        reasoning = self._generate_reasoning(
            target_node, node_importance, edge_importance, attack_probs, stage_probs,
        )

        return {
            "node_id": node_id,
            "target_node": target_node,
            "node_importance": node_importance,
            "edge_importance": edge_importance,
            "attention_weights": self._format_attention(outputs.get("attention_weights")),
            "integrated_gradients": integrated_grads,
            "shap_values": self._approximate_shap(x, edge_index),
            "reasoning": reasoning,
            "attack_probabilities": {
                str(i): round(float(p), 4) for i, p in enumerate(attack_probs)
            },
            "stage_probabilities": {
                str(i): round(float(p), 4) for i, p in enumerate(stage_probs)
            },
        }

    def _compute_edge_importance(
        self,
        edges: list[dict],
        node_importance: list[dict],
    ) -> list[dict[str, Any]]:
        node_scores = {n["node_index"]: n["importance"] for n in node_importance}
        edge_scores = []
        for i, edge in enumerate(edges[:50]):
            src_imp = node_scores.get(i, 0.1)
            score = src_imp * (edge.get("packets", 1) / max(edge.get("bytes", 1), 1))
            edge_scores.append({
                "edge_index": i,
                "source": edge.get("source"),
                "target": edge.get("target"),
                "protocol": edge.get("protocol"),
                "importance": round(float(score), 4),
                "type": "edge",
            })
        edge_scores.sort(key=lambda x: x["importance"], reverse=True)
        return edge_scores[:15]

    def _integrated_gradients(
        self,
        x: torch.Tensor,
        edge_index: torch.Tensor,
        target_idx: int,
        steps: int = 20,
    ) -> list[dict[str, Any]]:
        if inference_service.model is None:
            return []

        baseline = torch.zeros_like(x)
        grads = []
        for step in range(steps):
            alpha = step / steps
            interpolated = baseline + alpha * (x - baseline)
            interpolated.requires_grad_(True)
            outputs = inference_service.model(interpolated, edge_index)
            score = outputs["risk_score"].sum()
            score.backward()
            if interpolated.grad is not None:
                grads.append(interpolated.grad.detach())

        if not grads:
            return []

        avg_grads = torch.stack(grads).mean(dim=0)
        ig = (x - baseline) * avg_grads
        ig_np = ig.squeeze().cpu().numpy()

        feature_names = [
            "packets", "bytes", "connections", "failed_logins", "ports",
            "node_type", "avg_bytes", "conn_ratio", "f8", "f9",
            "f10", "f11", "f12", "f13", "f14", "f15",
        ]

        result = []
        for i, val in enumerate(ig_np[:len(feature_names)]):
            result.append({
                "feature": feature_names[i],
                "importance": round(float(val), 4),
                "method": "integrated_gradients",
            })
        result.sort(key=lambda x: abs(x["importance"]), reverse=True)
        return result

    def _approximate_shap(
        self,
        x: torch.Tensor,
        edge_index: torch.Tensor,
    ) -> list[dict[str, Any]]:
        if inference_service.model is None:
            return []

        baseline = torch.zeros_like(x)
        with torch.no_grad():
            base_out = inference_service.model(baseline, edge_index)
            base_score = base_out["risk_score"].item()

        shap_values = []
        feature_names = [
            "packets", "bytes", "connections", "failed_logins", "ports",
            "node_type", "avg_bytes", "conn_ratio",
        ]

        for i in range(min(8, x.size(-1))):
            perturbed = x.clone()
            perturbed[0, i] = 0
            with torch.no_grad():
                out = inference_service.model(perturbed, edge_index)
                delta = base_score - out["risk_score"].item()
            shap_values.append({
                "feature": feature_names[i] if i < len(feature_names) else f"feature_{i}",
                "shap_value": round(float(delta), 4),
                "method": "shap_approximation",
            })

        shap_values.sort(key=lambda x: abs(x["shap_value"]), reverse=True)
        return shap_values

    def _format_attention(self, attention: torch.Tensor | None) -> list[dict[str, Any]]:
        if attention is None:
            return []
        attn = attention.squeeze().cpu().numpy()
        if attn.ndim == 0:
            return [{"weight": round(float(attn), 4)}]
        flat = attn.flatten()
        return [
            {"head": i, "weight": round(float(w), 4)}
            for i, w in enumerate(flat[:8])
        ]

    def _find_node(self, node_id: str, nodes: list[dict]) -> dict | None:
        for node in nodes:
            if node.get("id") == node_id or node.get("ip") == node_id:
                return node
        return nodes[0] if nodes else None

    def _find_node_index(self, node_id: str, nodes: list[dict]) -> int:
        for i, node in enumerate(nodes):
            if node.get("id") == node_id or node.get("ip") == node_id:
                return i
        return 0

    def _generate_reasoning(
        self,
        target_node: dict | None,
        node_importance: list[dict],
        edge_importance: list[dict],
        attack_probs: np.ndarray,
        stage_probs: np.ndarray,
    ) -> str:
        top_node = node_importance[0] if node_importance else None
        top_edge = edge_importance[0] if edge_importance else None
        attack_idx = int(np.argmax(attack_probs))
        stage_idx = int(np.argmax(stage_probs))

        parts = [
            f"The model identified anomalous behavior with {attack_probs[attack_idx]*100:.1f}% attack confidence.",
            f"Current attack stage probability peaks at index {stage_idx} ({stage_probs[stage_idx]*100:.1f}%).",
        ]

        if target_node:
            parts.append(
                f"Target node {target_node.get('ip', 'unknown')} shows elevated "
                f"traffic: {target_node.get('packets', 0)} packets, "
                f"{target_node.get('connections', 0)} connections."
            )

        if top_node:
            parts.append(
                f"Highest node importance score ({top_node['importance']:.3f}) "
                f"at node index {top_node['node_index']} via GAT attention."
            )

        if top_edge:
            parts.append(
                f"Critical edge: {top_edge.get('source')} -> {top_edge.get('target')} "
                f"via {top_edge.get('protocol', 'unknown')} (importance: {top_edge['importance']:.3f})."
            )

        return " ".join(parts)


explainability_service = ExplainabilityService()
