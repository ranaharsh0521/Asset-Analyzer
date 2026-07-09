# AI-Driven Cyber Attack Prediction using TGNN - Continuation Report

Generated: 2026-07-03

## Current Architecture

- Frontend: React 19, TypeScript, Vite, TailwindCSS, ShadCN-style UI components, React Query, Recharts, React Flow/D3-oriented network visualization.
- Backend API: Node.js/Express with JWT auth, RBAC permissions, Drizzle ORM, PostgreSQL, Redis cache/pub-sub, multer uploads, and WebSocket broadcasting.
- AI service: FastAPI with PyTorch, PyTorch Geometric, NetworkX, scikit-learn, SHAP/GNN explainability service hooks, TGNN model, graph builder, training worker, inference service, and dataset loaders.
- Deployment: Dockerfiles for API and AI service, Docker Compose for PostgreSQL, Redis, AI, API, and Nginx.

## Existing Frontend Pages

- Dashboard: live SOC overview, alert stream, high-risk nodes, topology.
- Attack Intelligence: attack-stage journey derived from predictions.
- Explainability: attention/importance panels from prediction explanations.
- Risk Assessment: network risk matrix and action prioritization.
- Network Scanner: asset telemetry and node details.
- Advanced Evaluation: model metrics and training-history charts.
- Alert Center, Experiment, Admin Panel, Project Structure, Login, Not Found.

## Existing APIs

- Auth: `/api/auth/register`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`, `/api/auth/me`, TOTP setup/verify.
- Dashboard/alerts: `/api/dashboard/metrics`, `/api/alerts`, `/api/alerts/:id`.
- Prediction: `/api/predict`, `/api/predict/batch`, `/api/predictions`.
- Attack stage: `/api/attack-stage`.
- Explainability: `/api/explain`.
- Risk: `/api/risk/scores`, `/api/risk/compute`.
- Network: `/api/network/nodes`, `/api/network/edges`, `/api/network/topology`.
- Training/models: `/api/training/start`, `/api/training/runs`, `/api/training/runs/:id`, `/api/models`, `/api/metrics`.
- Data/graphs: `/api/datasets`, `/api/datasets/upload`, `/api/graph/build`, `/api/packets/parse`; packet parsing now persists graph snapshots, network nodes/edges, packet-derived predictions, alerts, audit logs, and WebSocket/Redis events.
- Health: `/api/health`.

## Existing Database Schema

- Identity/security: roles, users, sessions, audit_logs.
- Data/AI: datasets, ml_models, training_runs, attack_graphs, predictions, risk_scores.
- SOC operations: network_nodes, network_edges, alerts, reports, notifications, system_logs.
- Schema uses Drizzle enums, typed JSONB fields, indexes for frequently queried alert, prediction, network, risk, training, and audit fields.

## Existing Authentication

- JWT access/refresh token flow with session persistence.
- RBAC permissions through role records.
- TOTP fields and auth endpoints exist.
- Security middleware includes Helmet/rate-limit style protections.

## Existing AI Modules

- `app.models.tgnn.TGNNModel`: graph convolutions plus temporal attention and multi-head outputs for attack type, stage, next stage, risk, and compromise.
- `app.services.inference`: loads production checkpoint and performs real-time TGNN prediction.
- `app.services.training`: asynchronous background training worker.
- `app.services.explainability`: explanation endpoint service.
- `app.services.risk_engine`: graph-aware risk computation.
- `app.graph.builder`: automatic temporal graph construction from network flows.
- `app.data.loaders`: real dataset download/load management.
- `app.services.packet_parser`: PCAP/CSV flow parsing into graph snapshots and TGNN predictions.

## Existing TGNN Implementation

- Completed: model architecture, graph convolution options, temporal attention, attack/stage/risk heads, inference service, background training service, graph builder.
- Fixed in this pass: graph builder now emits 16 node features to match the TGNN input layer.

## Existing Docker Configuration

- API Dockerfile builds Vite/client and Express server into production output.
- AI Dockerfile and requirements support FastAPI, PyTorch Geometric, Scapy, PyShark, SHAP, and Redis/PostgreSQL clients.
- Docker Compose provisions PostgreSQL, Redis, AI, API, and Nginx with health checks and named volumes.

## Existing WebSocket Implementation

- `/ws` WebSocket endpoint authenticates with JWT access token.
- Supports alert, prediction, graph, training, topology, risk, and health event types.
- Redis pub-sub channel `gnn-ids:events` bridges events across services.
- Fixed in this pass: stored predictions are now broadcast as `prediction` events.
- Fixed in this pass: packet-capture graph and prediction persistence now publishes `graph_update`, `prediction`, and `alert` events.

## Existing Datasets

- Implemented loaders: UNSW-NB15, TON-IoT, CICIDS2017, NSL-KDD.
- Requested but not yet fully implemented: CSE-CIC-IDS2018, Bot-IoT, Edge-IIoTset.
- Fixed in this pass: failed downloads now raise explicit errors instead of silently generating synthetic fallback data.

## Existing Documentation

- README, backend SETUP, Docker/Nginx config, and attached project prompt files exist.
- This report documents the current state and continuation checklist.

## Checklist

### Already Completed

- Core React SOC dashboard shell.
- Auth, JWT, RBAC, TOTP fields/endpoints.
- PostgreSQL schema for SOC, AI, model, report, notification, and audit data.
- Express API endpoints for prediction, explainability, risk, metrics, network topology, datasets, graph build, training, models, alerts, and health.
- `/api/packets/parse` persists packet-derived graph snapshots, network topology updates, TGNN predictions, generated alerts, and audit metadata.
- FastAPI AI service with TGNN inference/training/graph/risk/explain endpoints.
- Docker Compose for API, AI, PostgreSQL, Redis, and Nginx.
- WebSocket infrastructure with Redis pub-sub.
- Real-time dashboard polling through React Query.

### Partially Completed

- Automatic dataset management: implemented for several datasets, still missing all requested datasets and checksum verification.
- Model registry: schema exists, but full latest/previous/best/archive/rollback/compare workflows need API completion.
- Automatic retraining: background training exists, but file-watch/scheduled retraining triggers and deploy-if-better comparison need completion.
- Live packet analysis: PCAP/CSV upload parsing and database persistence now exist; live interface capture and continuous monitoring still need privileged runtime integration.
- Admin panel/profile/notifications/reports: schema and partial UI exist, but feature-complete workflows remain.
- WebSocket UI consumption: backend broadcasts are available; several frontend pages still rely mostly on React Query polling.
- Security hardening: major middleware/auth pieces exist; CSRF, secure cookie deployment policy, file validation depth, and audit coverage need expansion.

### Missing

- Full CSE-CIC-IDS2018, Bot-IoT, Edge-IIoTset loaders.
- Dataset checksum/signature verification and duplicate-download manifest.
- Continuous live capture worker for Scapy/PyShark/tshark interfaces.
- Model deployment comparison, rollback, and registry lifecycle APIs.
- Scheduled daily/weekly retraining orchestration.
- PDF/CSV/JSON report generation endpoints.
- GitHub Actions CI/CD.
- Unit/integration/API/AI/security/performance/load test coverage for the new pipeline.
