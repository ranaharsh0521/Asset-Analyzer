#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Create local .env from example if missing
if [[ ! -f .env ]]; then
  cp .env.example .env
  sed -i 's|^DATABASE_URL=.*|DATABASE_URL=postgresql://gnn_ids:gnn_ids_secret@localhost:5432/gnn_ids|' .env
fi

# Node dependencies
npm ci

# Python AI service virtualenv
if [[ ! -d ai/.venv ]]; then
  python3 -m venv ai/.venv
fi
ai/.venv/bin/pip install --upgrade pip
ai/.venv/bin/pip install -r ai/requirements.txt

# Ensure data directories exist
mkdir -p ai/data ai/models data

# Database schema and seed (requires PostgreSQL running via start script)
set -a
source .env
set +a
npm run db:push
npm run db:seed
