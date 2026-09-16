# AI-Driven Cyber Attack Prediction using Temporal Graph Neural Networks (TGNN)

AI-Driven Cyber Attack Prediction System.

Production-oriented Security Operations Center (SOC) platform that trains a Temporal Graph Neural Network on real network intrusion datasets, serves live inference through FastAPI, persists results in PostgreSQL via Express, and visualizes threats in a React dashboard with WebSocket updates.

## Highlights

- **TGNN inference** on CICIDS2017 (and other supported datasets)
- **FastAPI AI service** with checkpoint loading and prediction APIs
- **Express + JWT + RBAC** backend with PostgreSQL persistence
- **React SOC dashboards** — predictions, alerts, MITRE mapping, topology, risk, model info
- **Live WebSocket** event stream for alerts and predictions

## Architecture (high level)

```
React (Vite)  →  Express API + WS  →  PostgreSQL / Redis
                      ↓
               FastAPI + PyTorch TGNN
                      ↓
               ai/models/tgnn_model.pt
```

## Quick start

See **[INSTALL.md](./INSTALL.md)** for full setup.

```bash
# 1) Environment
cp .env.example .env

# 2) Install Node deps + push schema
npm install
npm run db:push
npm run db:seed

# 3) AI service (Python 3.11+ recommended)
cd ai
pip install -r requirements.txt
set MODEL_DIR=..\ai\models
set DATASET_ROOT=..\DataSet
py -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# If port 8000 is already in use, run on 8001 and set AI_SERVICE_URL=http://127.0.0.1:8001 in .env

# 4) Express + UI (new terminal)
npm run dev
```

Open http://localhost:5000  
Login (seeded admin; not shown on the login UI): `admin@gnn-ids.local` / `Admin@123456`

**Live detection:** Network Graph → LIVE → select Wi‑Fi/Ethernet → Start. On Windows, install [Npcap](https://npcap.com/) and run with capture permissions if Start fails.

## Documentation index

| Document | Purpose |
|----------|---------|
| [INSTALL.md](./INSTALL.md) | Installation steps |
| [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) | REST + WS APIs |
| [PROJECT_ARCHITECTURE.md](./PROJECT_ARCHITECTURE.md) | System design |
| [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) | PostgreSQL schema |
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | Deploy notes |
| [DEMO_SCRIPT.md](./DEMO_SCRIPT.md) | Live demo walkthrough |
| [TEST_CASES.md](./TEST_CASES.md) | Test checklist |
| [VIVA_QUESTIONS.md](./VIVA_QUESTIONS.md) | Viva Q&A |
| [PPT_CONTENT.md](./PPT_CONTENT.md) | Presentation outline |
| [FINAL_REPORT.md](./FINAL_REPORT.md) | Academic report |
| [FINAL_PROJECT_SUMMARY.md](./FINAL_PROJECT_SUMMARY.md) | End-to-end summary |
| [DataSet/README.md](./DataSet/README.md) | Where to place CICIDS2017 CSVs |
| [ai/models/README.md](./ai/models/README.md) | Checkpoint files not stored in git |

## Default ports

| Service | Port |
|---------|------|
| React + Express | 5000 |
| FastAPI AI | 8000 |
| PostgreSQL | 5432 |
| Redis | 6379 (optional) |

## Team

This repository is maintained by:

- [ranaharsh0521](https://github.com/ranaharsh0521)
- [Harsh-depot](https://github.com/Harsh-depot)
- [digs2610](https://github.com/digs2610)

Upstream academic source for the current tree: [Suchit-Parmar/Asset-Analyzer-main](https://github.com/Suchit-Parmar/Asset-Analyzer-main).

## License

MIT — see [LICENSE](./LICENSE). Academic / project use for the 7th semester Asset Analyzer project.
