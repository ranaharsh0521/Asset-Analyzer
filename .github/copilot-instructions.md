# Asset Analyzer - Copilot Instructions

## Project Overview

Asset Analyzer is a production-oriented **Temporal Graph Neural Network (TGNN)** SOC prototype for intrusion detection and attack-stage prediction. It trains on real network-intrusion datasets (CICIDS2017 and related sets), serves inference from FastAPI, persists results in PostgreSQL via Express, and visualizes threats in a React dashboard with WebSocket updates.

## Architecture

```
React (Vite)  →  Express API + WS  →  PostgreSQL / Redis
                      ↓
               FastAPI + PyTorch TGNN
                      ↓
               ai/models/*.pt
```

### Monorepo layout

- `client/` — React + Vite UI (Wouter routing, Tailwind, Radix/shadcn)
- `server/` — Express API, JWT/RBAC, PostgreSQL (Drizzle), WebSocket
- `ai/` — FastAPI TGNN service (training, inference, live capture, explainability)
- `shared/` — Drizzle schema + Zod types shared by client/server
- `script/` — Production build (esbuild server + Vite client)

Dashboards talk to **real APIs** (`client/src/lib/api.ts`, `hooks/useApi.ts`). Do not reintroduce mock prediction pipelines.

## Key flows

1. Login (`POST /api/auth/login`) issues JWT; seeded admin is `admin@gnn-ids.local` / `Admin@123456`.
2. Express proxies/persists AI results (`server/routes/api.routes.ts`, `server/ai-client.ts`).
3. FastAPI loads checkpoints from `MODEL_DIR` (default `ai/models`) in `ai/app/services/inference.py`.
4. Live detection: Network Graph → LIVE → pick NIC → Start (`ai/app/live/`).
5. WebSocket `/ws` pushes alerts and predictions (`server/websocket.ts`, `hooks/useWebSocketSync.ts`).

## Commands

| Command | Purpose |
|---------|---------|
| `npm install` | Install Node dependencies |
| `npm run db:push` | Sync Drizzle schema to PostgreSQL |
| `npm run db:seed` | Seed admin user |
| `npm run dev` | Express + Vite (port 5000) |
| `npm run dev:ai` | FastAPI on port 8000 |
| `npm test` | Node tests (`server/**/*.test.ts`) |
| `npm run check` | TypeScript check |
| `npm run build` | Production bundle |

Python (from `ai/`): `pip install -r requirements.txt` then `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`.

## Conventions

- Keep live capture **authorized local interfaces only**; never invent a fake `any` NIC.
- Do not fabricate accuracy metrics or topology nodes when the graph is empty.
- Node features are 16-d endpoint vectors (`ai/app/graph/builder.py`); reserved dims must stay unused for labels.
- New pages: add `client/src/pages/`, route in `App.tsx`, link in `Sidebar.tsx`.
- New APIs: `/api` prefix in `server/routes/`, persist via Drizzle schema in `shared/schema.ts`.
