# Cyber Attack Prediction System - Setup Instructions

## Project Structure

```
Asset-Analyzer-main/
├── backend/
│   ├── app.py                    # Flask API server
│   ├── ml/
│   │   └── train_model.py        # Model training script
│   ├── models/                   # Trained models (generated)
│   ├── data/                     # Dataset storage
│   ├── requirements.txt           # Python dependencies
│   └── test_api.py               # API test examples
├── client/                       # React frontend (existing)
├── server/                       # Express backend (existing)
└── README.md                     # This file
```

## Setup Steps

### 1. Backend Setup

Navigate to the backend directory:
```bash
cd backend
```

Create a virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

Install dependencies:
```bash
pip install -r requirements.txt
```

### 2. Train the Model

Run the training script:
```bash
cd backend/ml
python train_model.py
```

This will:
- Download or create NSL-KDD dataset
- Preprocess data and encode categorical features
- Train a Random Forest classifier
- Save model to `backend/models/attack_model.pkl`
- Save scaler to `backend/models/scaler.pkl`

Expected output:
- Training accuracy: ~99%
- Model files in `backend/models/`

### 3. Start the Flask API

```bash
cd backend
python app.py
```

The API will run on `http://localhost:5001`

### 4. Test the API

In a new terminal:
```bash
cd backend
python test_api.py
```

### 5. API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/predict` | POST | Predict attack type |
| `/predict/batch` | POST | Batch predictions |
| `/upload-log` | POST | Upload CSV for analysis |
| `/alerts` | GET | Get detected alerts |
| `/statistics` | GET | Get system statistics |
| `/simulate` | POST | Simulate attacks |

### 6. Example Request/Response

**Request:**
```bash
curl -X POST http://localhost:5001/predict \
  -H "Content-Type: application/json" \
  -d '{
    "duration": 0,
    "protocol_type": "tcp",
    "service": "http",
    "flag": "SF",
    "src_bytes": 200,
    "dst_bytes": 1000,
    ...
  }'
```

**Response:**
```json
{
  "prediction": "normal",
  "attack_type": "Normal",
  "threat_level": "Low",
  "confidence": 0.95,
  "timestamp": "2024-01-01T00:00:00",
  "all_probabilities": {
    "normal": 0.95,
    "neptune": 0.02,
    ...
  }
}
```

## Integration with Frontend

To connect the React frontend with the Flask backend:

1. Update API calls in React components to use `http://localhost:5001`

Example fetch call:
```javascript
const response = await fetch('http://localhost:5001/predict', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(networkData)
});
const result = await response.json();
```

## Features

- **Attack Detection**: Detects Normal, DDoS, Probe, R2L, U2R attacks
- **Threat Levels**: Low, Medium, High
- **Confidence Scores**: Model prediction confidence
- **Real-time Simulation**: Test with simulated attacks
- **Alert System**: Track detected threats
- **Statistics**: Attack distribution and trends