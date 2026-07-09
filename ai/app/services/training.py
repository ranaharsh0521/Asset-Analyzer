"""TGNN training service."""

from __future__ import annotations

import os
import shutil
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.nn.functional as F
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.preprocessing import LabelEncoder

from app.data.loaders import load_dataset
from app.graph.builder import TemporalGraphBuilder
from app.models.tgnn import TGNNModel, ATTACK_STAGES, ATTACK_TYPES

MODEL_DIR = Path(os.environ.get("MODEL_DIR", "./models"))

STAGE_FROM_ATTACK = {
    "Normal": 0, "normal": 0,
    "Reconnaissance": 1, "Probe": 2, "Fuzzers": 2,
    "Generic": 3, "Exploits": 3, "R2L": 3, "Brute Force": 3,
    "U2R": 4, "Backdoor": 4,
    "DoS": 7, "DDoS": 7,
    "Analysis": 1, "Shellcode": 5, "Worms": 5,
    "Infiltration": 5, "Botnet": 5,
}


class TrainingService:
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.active_runs: dict[str, dict[str, Any]] = {}
        self._lock = threading.Lock()

    def start_training(
        self,
        run_id: str | None = None,
        dataset_id: str = "unsw_nb15",
        architecture: str = "gat",
        hyperparameters: dict | None = None,
        epochs: int = 50,
    ) -> dict[str, Any]:
        run_id = run_id or str(uuid.uuid4())
        hp = hyperparameters or {}
        hidden_dim = hp.get("hidden_dim", 64)
        lr = hp.get("learning_rate", 0.001)
        batch_size = hp.get("batch_size", 32)

        with self._lock:
            self.active_runs[run_id] = {
                "run_id": run_id,
                "status": "running",
                "dataset_id": dataset_id,
                "architecture": architecture,
                "epochs": epochs,
                "current_epoch": 0,
                "train_loss": None,
                "val_loss": None,
                "train_accuracy": None,
                "val_accuracy": None,
                "metrics": {},
                "gpu_utilization": self._gpu_util(),
                "started_at": datetime.utcnow().isoformat(),
                "history": [],
            }

        thread = threading.Thread(
            target=self._train_worker,
            args=(run_id, dataset_id, architecture, epochs, hidden_dim, lr, batch_size),
            daemon=True,
        )
        thread.start()
        return self.active_runs[run_id]

    def get_status(self, run_id: str) -> dict[str, Any] | None:
        return self.active_runs.get(run_id)

    def _train_worker(
        self,
        run_id: str,
        dataset_id: str,
        architecture: str,
        epochs: int,
        hidden_dim: int,
        lr: float,
        batch_size: int,
    ) -> None:
        try:
            df = load_dataset(dataset_id, max_rows=50000)
            builder = TemporalGraphBuilder(window_seconds=30)
            snapshots = builder.build_from_dataframe(df)

            if not snapshots:
                snapshots = [builder.build_single_snapshot(df.head(1000))]

            attack_labels, stage_labels = self._extract_labels(df)
            attack_encoder = LabelEncoder()
            attack_encoder.fit(ATTACK_TYPES)
            stage_encoder = LabelEncoder()
            stage_encoder.fit(ATTACK_STAGES)

            model = TGNNModel(
                node_features=16,
                hidden_dim=hidden_dim,
                architecture=architecture,
            ).to(self.device)

            optimizer = torch.optim.Adam(model.parameters(), lr=lr)
            attack_criterion = nn.CrossEntropyLoss()
            stage_criterion = nn.CrossEntropyLoss()

            n_snapshots = len(snapshots)
            split = int(n_snapshots * 0.8)
            train_snaps = snapshots[:split] or snapshots
            val_snaps = snapshots[split:] or snapshots[-1:]

            all_attack_preds, all_attack_true = [], []
            all_stage_preds, all_stage_true = [], []

            for epoch in range(epochs):
                model.train()
                epoch_loss = 0.0
                n_batches = 0

                for i, snap in enumerate(train_snaps):
                    x = torch.tensor(snap["node_features"], dtype=torch.float32, device=self.device)
                    if x.size(0) == 0:
                        continue
                    ei_data = snap["edge_index"]
                    if not ei_data or not ei_data[0]:
                        ei = torch.tensor([[0], [0]], dtype=torch.long, device=self.device)
                    else:
                        ei = torch.tensor(ei_data, dtype=torch.long, device=self.device)

                    label_idx = min(i, len(attack_labels) - 1)
                    attack_label = torch.tensor(
                        [min(attack_encoder.transform([attack_labels[label_idx]])[0], len(ATTACK_TYPES) - 1)],
                        dtype=torch.long, device=self.device,
                    )
                    stage_label = torch.tensor(
                        [min(stage_labels[label_idx], len(ATTACK_STAGES) - 1)],
                        dtype=torch.long, device=self.device,
                    )

                    optimizer.zero_grad()
                    outputs = model(x, ei)
                    loss = (
                        attack_criterion(outputs["attack_logits"], attack_label)
                        + stage_criterion(outputs["stage_logits"], stage_label)
                    )
                    loss.backward()
                    optimizer.step()
                    epoch_loss += loss.item()
                    n_batches += 1

                avg_loss = epoch_loss / max(n_batches, 1)

                model.eval()
                val_loss = 0.0
                val_batches = 0
                with torch.no_grad():
                    for i, snap in enumerate(val_snaps):
                        x = torch.tensor(snap["node_features"], dtype=torch.float32, device=self.device)
                        if x.size(0) == 0:
                            continue
                        ei_data = snap["edge_index"]
                        ei = torch.tensor(
                            ei_data if ei_data and ei_data[0] else [[0], [0]],
                            dtype=torch.long, device=self.device,
                        )
                        label_idx = min(i, len(attack_labels) - 1)
                        attack_label = torch.tensor(
                            [min(attack_encoder.transform([attack_labels[label_idx]])[0], len(ATTACK_TYPES) - 1)],
                            dtype=torch.long, device=self.device,
                        )
                        stage_label = torch.tensor(
                            [min(stage_labels[label_idx], len(ATTACK_STAGES) - 1)],
                            dtype=torch.long, device=self.device,
                        )
                        outputs = model(x, ei)
                        loss = (
                            attack_criterion(outputs["attack_logits"], attack_label)
                            + stage_criterion(outputs["stage_logits"], stage_label)
                        )
                        val_loss += loss.item()
                        val_batches += 1

                        attack_pred = outputs["attack_logits"].argmax(dim=-1).cpu().item()
                        stage_pred = outputs["stage_logits"].argmax(dim=-1).cpu().item()
                        all_attack_preds.append(attack_pred)
                        all_attack_true.append(attack_label.cpu().item())
                        all_stage_preds.append(stage_pred)
                        all_stage_true.append(stage_label.cpu().item())

                val_avg = val_loss / max(val_batches, 1)
                train_acc = accuracy_score(all_attack_true[-100:], all_attack_preds[-100:]) if all_attack_true else 0
                val_acc = accuracy_score(all_attack_true, all_attack_preds) if all_attack_true else 0

                with self._lock:
                    run = self.active_runs[run_id]
                    run["current_epoch"] = epoch + 1
                    run["train_loss"] = round(avg_loss, 4)
                    run["val_loss"] = round(val_avg, 4)
                    run["train_accuracy"] = round(train_acc, 4)
                    run["val_accuracy"] = round(val_acc, 4)
                    run["gpu_utilization"] = self._gpu_util()
                    run["history"].append({
                        "epoch": epoch + 1,
                        "train_loss": round(avg_loss, 4),
                        "val_loss": round(val_avg, 4),
                        "train_accuracy": round(train_acc, 4),
                        "val_accuracy": round(val_acc, 4),
                    })

            metrics = self._compute_metrics(all_attack_true, all_attack_preds, all_stage_true, all_stage_preds)
            MODEL_DIR.mkdir(parents=True, exist_ok=True)
            model_path = MODEL_DIR / f"candidate_{run_id}.pt"
            torch.save({
                "model_state": model.state_dict(),
                "architecture": architecture,
                "metrics": metrics,
                "dataset_id": dataset_id,
                "run_id": run_id,
                "trained_at": datetime.utcnow().isoformat(),
            }, model_path)

            with self._lock:
                self.active_runs[run_id]["status"] = "completed"
                self.active_runs[run_id]["metrics"] = metrics
                self.active_runs[run_id]["completed_at"] = datetime.utcnow().isoformat()
                self.active_runs[run_id]["model_path"] = str(model_path)

        except Exception as e:
            with self._lock:
                if run_id in self.active_runs:
                    self.active_runs[run_id]["status"] = "failed"
                    self.active_runs[run_id]["error"] = str(e)

    def _extract_labels(self, df: pd.DataFrame) -> tuple[list[str], list[int]]:
        attack_col = None
        for col in ["attack_type", "attack_cat", "label", "Label"]:
            if col in df.columns:
                attack_col = col
                break

        attacks, stages = [], []
        for val in df[attack_col].values if attack_col else ["Normal"] * len(df):
            val_str = str(val)
            if val_str in ("0", "normal", "Normal", "BENIGN"):
                attacks.append("Normal")
                stages.append(0)
            else:
                attacks.append(val_str if val_str in ATTACK_TYPES else "Generic")
                stages.append(STAGE_FROM_ATTACK.get(val_str, STAGE_FROM_ATTACK.get(attacks[-1], 2)))
        return attacks, stages

    def _compute_metrics(
        self,
        attack_true: list,
        attack_pred: list,
        stage_true: list,
        stage_pred: list,
    ) -> dict[str, Any]:
        if not attack_true:
            return {}
        return {
            "accuracy": round(float(accuracy_score(attack_true, attack_pred)), 4),
            "precision": round(float(precision_score(attack_true, attack_pred, average="weighted", zero_division=0)), 4),
            "recall": round(float(recall_score(attack_true, attack_pred, average="weighted", zero_division=0)), 4),
            "f1": round(float(f1_score(attack_true, attack_pred, average="weighted", zero_division=0)), 4),
            "stage_accuracy": round(float(accuracy_score(stage_true, stage_pred)), 4) if stage_true else 0,
            "confusion_matrix": {
                "attack": np.bincount(attack_pred, minlength=max(attack_true) + 1).tolist() if attack_pred else [],
            },
        }

    def _gpu_util(self) -> float:
        if torch.cuda.is_available():
            return round(float(torch.cuda.utilization()), 2)
        return 0.0

    def get_metrics(self, model_id: str | None = None) -> dict[str, Any]:
        model_path = MODEL_DIR / "tgnn_model.pt"
        if model_path.exists():
            checkpoint = torch.load(model_path, map_location="cpu", weights_only=False)
            return {
                "model_loaded": True,
                "architecture": checkpoint.get("architecture", "gat"),
                "metrics": checkpoint.get("metrics", {}),
                "trained_at": checkpoint.get("trained_at"),
            }
        return {"model_loaded": False, "metrics": {}}

    def deploy_model(self, candidate_path: str) -> dict[str, Any]:
        candidate = Path(candidate_path)
        if not candidate.exists():
            raise FileNotFoundError(f"Candidate checkpoint not found: {candidate_path}")

        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        active_path = MODEL_DIR / "tgnn_model.pt"
        previous_path = MODEL_DIR / "tgnn_model.previous.pt"

        if active_path.exists():
            shutil.copy2(active_path, previous_path)
        shutil.copy2(candidate, active_path)

        from app.services.inference import inference_service
        inference_service._load_model()

        checkpoint = torch.load(active_path, map_location="cpu", weights_only=False)
        return {
            "deployed": True,
            "active_path": str(active_path),
            "previous_path": str(previous_path) if previous_path.exists() else None,
            "metrics": checkpoint.get("metrics", {}),
            "architecture": checkpoint.get("architecture", "gat"),
            "trained_at": checkpoint.get("trained_at"),
        }


training_service = TrainingService()
