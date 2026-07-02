"""Model inference service."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import numpy as np
import torch
import torch.nn.functional as F

from app.models.tgnn import TGNNModel, ATTACK_STAGES, ATTACK_TYPES, STAGE_TRANSITIONS

MODEL_DIR = Path(os.environ.get("MODEL_DIR", "./models"))

MITRE_MAP = {
    "DDoS": ("Impact", "T1498"),
    "Probe": ("Reconnaissance", "T1046"),
    "R2L": ("Initial Access", "T1078"),
    "U2R": ("Privilege Escalation", "T1068"),
    "Botnet": ("Command and Control", "T1071"),
    "Normal": ("None", "None"),
    "Generic": ("Execution", "T1204"),
    "Exploits": ("Initial Access", "T1190"),
    "Fuzzers": ("Discovery", "T1046"),
    "DoS": ("Impact", "T1499"),
    "Reconnaissance": ("Reconnaissance", "T1595"),
    "Brute Force": ("Credential Access", "T1110"),
    "Web Attack": ("Initial Access", "T1190"),
    "Infiltration": ("Lateral Movement", "T1021"),
}

THREAT_LEVELS = {
    "Normal": "low", "DDoS": "critical", "Probe": "medium", "R2L": "high",
    "U2R": "critical", "Botnet": "high", "Generic": "high", "Exploits": "high",
    "Fuzzers": "medium", "DoS": "critical", "Reconnaissance": "medium",
    "Brute Force": "high", "Web Attack": "high", "Infiltration": "critical",
}


class InferenceService:
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model: TGNNModel | None = None
        self.model_path = MODEL_DIR / "tgnn_model.pt"
        self._load_model()

    def _load_model(self) -> None:
        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        self.model = TGNNModel(node_features=16, hidden_dim=64, architecture="gat")
        if self.model_path.exists():
            checkpoint = torch.load(self.model_path, map_location=self.device, weights_only=False)
            self.model.load_state_dict(checkpoint["model_state"])
            print(f"[inference] Loaded model from {self.model_path}")
        else:
            print("[inference] No trained model found, using initialized weights")
        self.model.to(self.device)
        self.model.eval()

    @property
    def is_loaded(self) -> bool:
        return self.model is not None and self.model_path.exists()

    def predict(
        self,
        features: dict[str, Any],
        graph_snapshot: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if self.model is None:
            raise RuntimeError("Model not initialized")

        x, edge_index = self._prepare_tensors(features, graph_snapshot)

        with torch.no_grad():
            outputs = self.model(x, edge_index)

        attack_probs = F.softmax(outputs["attack_logits"], dim=-1).squeeze().cpu().numpy()
        stage_probs = F.softmax(outputs["stage_logits"], dim=-1).squeeze().cpu().numpy()
        next_stage_probs = F.softmax(outputs["next_stage_logits"], dim=-1).squeeze().cpu().numpy()
        risk_score = float(outputs["risk_score"].squeeze().cpu().item())
        compromise_prob = F.softmax(outputs["compromise_logits"], dim=-1).squeeze().cpu().numpy()

        attack_idx = int(np.argmax(attack_probs))
        stage_idx = int(np.argmax(stage_probs))
        next_stage_idx = int(np.argmax(next_stage_probs))

        attack_type = ATTACK_TYPES[min(attack_idx, len(ATTACK_TYPES) - 1)]
        attack_stage = ATTACK_STAGES[min(stage_idx, len(ATTACK_STAGES) - 1)]
        predicted_next_stage = ATTACK_STAGES[min(next_stage_idx, len(ATTACK_STAGES) - 1)]
        confidence = float(np.max(attack_probs))
        probability = float(np.max(stage_probs))
        threat_level = THREAT_LEVELS.get(attack_type, "medium")
        mitre_tactic, mitre_technique = MITRE_MAP.get(attack_type, ("Unknown", "T0000"))

        attention = outputs.get("attention_weights")
        node_importance = self._compute_node_importance(outputs["node_embeddings"], attention)

        return {
            "attack_type": attack_type,
            "attack_stage": attack_stage,
            "predicted_next_stage": predicted_next_stage,
            "threat_level": threat_level,
            "probability": round(probability, 4),
            "confidence": round(confidence, 4),
            "risk_score": round(risk_score, 4),
            "is_compromised": bool(compromise_prob[1] > 0.5),
            "mitre_tactic": mitre_tactic,
            "mitre_technique": mitre_technique,
            "all_probabilities": {
                ATTACK_TYPES[i]: round(float(attack_probs[i]), 4)
                for i in range(min(len(attack_probs), len(ATTACK_TYPES)))
            },
            "stage_probabilities": {
                ATTACK_STAGES[i]: round(float(stage_probs[i]), 4)
                for i in range(min(len(stage_probs), len(ATTACK_STAGES)))
            },
            "explanation": {
                "node_importance": node_importance,
                "top_attack_type": attack_type,
                "predicted_progression": f"{attack_stage} -> {predicted_next_stage}",
                "expected_next": STAGE_TRANSITIONS.get(attack_stage, attack_stage),
            },
        }

    def predict_batch(self, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [self.predict(record) for record in records]

    def _prepare_tensors(
        self,
        features: dict[str, Any],
        graph_snapshot: dict[str, Any] | None,
    ) -> tuple[torch.Tensor, torch.Tensor]:
        if graph_snapshot and "node_features" in graph_snapshot:
            node_features = graph_snapshot["node_features"]
            edge_index = graph_snapshot.get("edge_index", [[0], [0]])
            x = torch.tensor(node_features, dtype=torch.float32, device=self.device)
            ei = torch.tensor(edge_index, dtype=torch.long, device=self.device)
            if ei.dim() == 2 and ei.size(0) != 2:
                ei = ei.t().contiguous()
            if ei.numel() == 0:
                ei = torch.tensor([[0], [0]], dtype=torch.long, device=self.device)
        else:
            feat_vec = [
                float(features.get("duration", 0)),
                float(features.get("src_bytes", features.get("sbytes", 0))),
                float(features.get("dst_bytes", features.get("dbytes", 0))),
                float(features.get("src_packets", features.get("spkts", 1))),
                float(features.get("dst_packets", features.get("dpkts", 1))),
                float(features.get("num_failed_logins", 0)),
                float(features.get("count", features.get("ct_srv_src", 1))),
                float(features.get("srv_count", features.get("ct_srv_dst", 1))),
                float(features.get("serror_rate", 0)),
                float(features.get("same_srv_rate", 0.5)),
                float(features.get("dst_host_count", 50)),
                float(hash(str(features.get("protocol", "tcp"))) % 100),
                float(hash(str(features.get("service", "http"))) % 100),
                float(features.get("logged_in", 0)),
                float(features.get("num_compromised", 0)),
                float(features.get("root_shell", 0)),
            ]
            x = torch.tensor([feat_vec], dtype=torch.float32, device=self.device)
            ei = torch.tensor([[0], [0]], dtype=torch.long, device=self.device)

        return x, ei

    def _compute_node_importance(
        self,
        embeddings: torch.Tensor,
        attention: torch.Tensor | None,
    ) -> list[dict[str, Any]]:
        norms = embeddings.norm(dim=-1).cpu().numpy()
        total = norms.sum() or 1
        importance = []
        for i, score in enumerate(norms):
            entry: dict[str, Any] = {
                "node_index": i,
                "importance": round(float(score / total), 4),
                "type": "node",
            }
            if attention is not None:
                entry["attention_weight"] = round(float(attention.mean().cpu().item()), 4)
            importance.append(entry)
        importance.sort(key=lambda x: x["importance"], reverse=True)
        return importance[:10]

inference_service = InferenceService()
