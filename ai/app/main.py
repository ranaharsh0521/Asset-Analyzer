"""FastAPI application for TGNN cyber attack prediction."""

from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import Any

import pandas as pd
import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.graph.builder import TemporalGraphBuilder
from app.services.explainability import explainability_service
from app.services.inference import inference_service
from app.services.risk_engine import risk_engine
from app.services.training import training_service

app = FastAPI(
    title="GNN-IDS AI Service",
    description="Temporal Graph Neural Network for Cyber Attack Prediction",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path(os.environ.get("DATA_DIR", "./data")) / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


class PredictRequest(BaseModel):
    features: dict[str, Any]
    graph_snapshot: dict[str, Any] | None = None


class BatchPredictRequest(BaseModel):
    records: list[dict[str, Any]]


class ExplainRequest(BaseModel):
    node_id: str
    graph_snapshot: dict[str, Any]


class TrainRequest(BaseModel):
    run_id: str | None = None
    dataset_id: str = "unsw_nb15"
    architecture: str = "gat"
    hyperparameters: dict[str, Any] = Field(default_factory=dict)
    epochs: int = 50


class GraphBuildRequest(BaseModel):
    dataset_id: str
    window_seconds: int = 30


class RiskComputeRequest(BaseModel):
    entity_type: str
    entity_id: str
    graph_snapshot: dict[str, Any]


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "model_loaded": inference_service.is_loaded,
        "gpu_available": torch.cuda.is_available(),
        "device": str(inference_service.device),
    }


@app.post("/api/v1/predict")
def predict(req: PredictRequest):
    try:
        return inference_service.predict(req.features, req.graph_snapshot)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/predict/batch")
def predict_batch(req: BatchPredictRequest):
    try:
        return {"predictions": inference_service.predict_batch(req.records)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/explain")
def explain(req: ExplainRequest):
    try:
        return explainability_service.explain(req.node_id, req.graph_snapshot)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/train")
def start_training(req: TrainRequest):
    try:
        result = training_service.start_training(
            run_id=req.run_id,
            dataset_id=req.dataset_id,
            architecture=req.architecture,
            hyperparameters=req.hyperparameters,
            epochs=req.epochs,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/train/{run_id}")
def get_training_status(run_id: str):
    status = training_service.get_status(run_id)
    if not status:
        raise HTTPException(status_code=404, detail="Training run not found")
    return status


@app.get("/api/v1/metrics")
def get_metrics(model_id: str | None = None):
    return training_service.get_metrics(model_id)


@app.post("/api/v1/datasets/upload")
async def upload_dataset(
    file: UploadFile = File(...),
    source: str = Form("upload"),
    name: str = Form(""),
):
    try:
        file_id = str(uuid.uuid4())
        ext = Path(file.filename or "data.csv").suffix
        dest = UPLOAD_DIR / f"{file_id}{ext}"

        content = await file.read()
        dest.write_bytes(content)

        record_count = 0
        if ext.lower() == ".csv":
            df = pd.read_csv(dest, nrows=100000)
            record_count = len(df)
        elif ext.lower() in (".pcap", ".pcapng"):
            record_count = len(content) // 100

        return {
            "file_path": str(dest),
            "filename": file.filename,
            "source": source,
            "name": name or file.filename,
            "record_count": record_count,
            "file_type": ext.lstrip("."),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/graph/build")
def build_graph(req: GraphBuildRequest):
    try:
        from app.data.loaders import load_dataset
        df = load_dataset(req.dataset_id, max_rows=10000)
        builder = TemporalGraphBuilder(window_seconds=req.window_seconds)
        snapshot = builder.build_single_snapshot(df)
        return {
            "node_count": snapshot["node_count"],
            "edge_count": snapshot["edge_count"],
            "snapshot": snapshot,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/risk/compute")
def compute_risk(req: RiskComputeRequest):
    try:
        return risk_engine.compute(req.entity_type, req.entity_id, req.graph_snapshot)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
