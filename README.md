# AI-Driven Cyber Attack Prediction using Temporal Graph Neural Networks (TGNN)

Production-grade Security Operations Center (SOC) platform with real TGNN models, PostgreSQL backend, JWT authentication, and live WebSocket alerts.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  React 19 UI    │────▶│  Express API     │────▶│  FastAPI AI Service │
│  (Vite + TS)    │ WS  │  JWT + RBAC      │     │  PyTorch Geometric  │
└─────────────────┘     │  PostgreSQL      │     │  TGNN (GAT/TGN/...)  │
                        │  Redis           │     └─────────────────────┘
                        └──────────────────┘
```

## Features

- **TGNN Models**: Graph Attention Networks with temporal encoding for attack prediction
- **Real Datasets**: UNSW-NB15, TON-IoT, CICIDS2017, NSL-KDD (auto-download)
- **Attack Stages**: Reconnaissance → Scanning → Credential Attack → ... → Impact
- **Explainability**: GAT attention weights, Integrated Gradients, SHAP approximation
- **Risk Engine**: Node, subnet, department, organization, propagation risk
- **SOC Dashboards**: Mission Control, Threat Journey, Model Studio, Alert Center, Admin Panel
- **Security**: JWT + refresh tokens, RBAC, bcrypt, TOTP 2FA, Helmet, rate limiting
- **Real-time**: WebSocket alerts, live predictions, training progress

## Quick Start

### Prerequisites

- Node.js 20+
- Python 3.11+
- PostgreSQL 16
- Redis 7
- Docker (optional)

### 1. Environment

```bash
cp .env.example .env
# Edit DATABASE_URL, JWT secrets, etc.
```

### 2. Database

```bash
npm install
npm run db:push
npm run db:seed
```

### 3. AI Service

```bash
cd ai
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

### 4. Train TGNN Model

```bash
curl -X POST http://localhost:8000/api/v1/train \
  -H "Content-Type: application/json" \
  -d '{"dataset_id": "unsw_nb15", "architecture": "gat", "epochs": 50}'
```

### 5. Start Application

```bash
npm run dev
# Open http://localhost:5000
# Login: admin@gnn-ids.local / Admin@123456
```

### Docker (Full Stack)

```bash
docker compose up -d
```

## Project Structure

```
Asset-Analyzer/
├── client/          # React 19 frontend
├── server/          # Express API + WebSocket
├── shared/          # Drizzle ORM schema
├── ai/              # FastAPI + PyTorch TGNN
├── nginx/           # Reverse proxy config
├── docker-compose.yml
└── docs/            # Documentation
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | JWT login |
| POST | /api/auth/register | User registration |
| POST | /api/predict | TGNN inference |
| GET | /api/alerts | Security alerts |
| GET | /api/dashboard/metrics | SOC metrics |
| GET | /api/network/topology | Graph topology |
| POST | /api/training/start | Start TGNN training |
| GET | /api/metrics | Model evaluation metrics |
| WS | /ws | Live alerts & predictions |

## Default Credentials

- **Admin**: admin@gnn-ids.local / Admin@123456
- Enable 2FA via Admin Panel after first login

## Research

This project implements Temporal Graph Neural Networks for cyber attack prediction suitable for:
- Final Year Engineering Projects
- MSc/PhD research extensions
- Cybersecurity portfolio demonstrations
- Academic publications on GNN-based IDS

## License

MIT
