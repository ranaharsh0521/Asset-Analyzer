# Model checkpoints

Trained PyTorch weights (`*.pt` / `*.pth`) are gitignored because of size.

The JSON files in this folder are registry metadata. Inference expects a matching checkpoint, typically:

- `tgnn_model.pt` — active model loaded by FastAPI
- `cicids2017.pt` — CICIDS2017 registry entry (`cicids2017.json`)

If no `.pt` file is present, train a checkpoint from the repo root:

```bash
export DATASET_ROOT=./DataSet
export MODEL_DIR=./ai/models
python ai/train_cicids.py --epochs 20 --max-rows 20000
```

Then start the AI service and confirm `GET http://127.0.0.1:8000/health` reports `"model_loaded": true`.
