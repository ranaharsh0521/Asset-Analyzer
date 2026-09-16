#!/usr/bin/env bash
set -euo pipefail

# Start PostgreSQL if not already running
if ! pg_isready -h localhost -q 2>/dev/null; then
  if command -v pg_ctlcluster >/dev/null 2>&1; then
    sudo pg_ctlcluster 16 main start || true
  else
    sudo -u postgres /usr/lib/postgresql/16/bin/pg_ctl \
      -D /var/lib/postgresql/16/main \
      -l /var/log/postgresql/postgresql-16-main.log start || true
  fi
fi

# Create database user and database if they don't exist
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='gnn_ids'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER gnn_ids WITH PASSWORD 'gnn_ids_secret' CREATEDB;"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='gnn_ids'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE gnn_ids OWNER gnn_ids;"

# Start Redis if not already running
if ! redis-cli ping >/dev/null 2>&1; then
  redis-server --daemonize yes --port 6379
fi

# Wait for services to be ready
for i in $(seq 1 30); do
  pg_isready -h localhost -q && redis-cli ping >/dev/null 2>&1 && break
  sleep 1
done

pg_isready -h localhost -q || { echo "PostgreSQL failed to start"; exit 1; }
redis-cli ping >/dev/null 2>&1 || { echo "Redis failed to start"; exit 1; }

echo "Infrastructure ready: PostgreSQL and Redis are running"
