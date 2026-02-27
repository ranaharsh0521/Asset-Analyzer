export const MOCK_LOGS = [
  "[INFO] Initializing GNN-IDS System...",
  "[INFO] Loading dataset: CICIDS2017 (Sampled)",
  "[INFO] Preprocessing temporal graph snapshots...",
  "[INFO] Constructing edge features (Timestamp, Protocol, Bytes)...",
  "[SUCCESS] Graph construction complete. Nodes: 15,420, Edges: 142,891",
  "[INFO] Model: Temporal Graph Network (TGN)",
  "[INFO] Device: CUDA:0 (Simulated)",
  "[INFO] Optimizer: Adam (lr=0.001)",
  "--------------------------------------------------",
  "Epoch 1/50 | Loss: 0.8921 | AUC: 0.54 | Precision: 0.42",
  "Epoch 2/50 | Loss: 0.7654 | AUC: 0.61 | Precision: 0.55",
  "Epoch 3/50 | Loss: 0.6122 | AUC: 0.72 | Precision: 0.68",
  "Epoch 4/50 | Loss: 0.5433 | AUC: 0.78 | Precision: 0.74",
  "Epoch 5/50 | Loss: 0.4981 | AUC: 0.82 | Precision: 0.79",
  "Epoch 6/50 | Loss: 0.4122 | AUC: 0.85 | Precision: 0.83",
  "Epoch 7/50 | Loss: 0.3876 | AUC: 0.88 | Precision: 0.86",
  "Epoch 8/50 | Loss: 0.3544 | AUC: 0.90 | Precision: 0.88",
  "Epoch 9/50 | Loss: 0.3321 | AUC: 0.91 | Precision: 0.89",
  "Epoch 10/50 | Loss: 0.3109 | AUC: 0.92 | Precision: 0.90",
];

export const MOCK_RESULTS = {
  accuracy: 0.945,
  precision: 0.912,
  recall: 0.968,
  f1: 0.939,
  auc: 0.972,
  earlyDetectionRate: "89.4% (< 2s)",
};

export const MOCK_FILES = [
  { name: "dataset/", type: "folder", children: ["CICIDS2017.csv", "preprocess.py"] },
  { name: "models/", type: "folder", children: ["tgn_model.py", "gat_model.py", "layers.py"] },
  { name: "scripts/", type: "folder", children: ["train.py", "eval.py", "inference_api.py"] },
  { name: "utils/", type: "folder", children: ["graph_builder.py", "metrics.py"] },
  { name: "README.md", type: "file" },
  { name: "requirements.txt", type: "file" },
  { name: "main.py", type: "file" },
];
