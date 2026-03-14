#!/usr/bin/env bash
# Deploy cliclaw portal to DigitalOcean droplet
# Usage: ./scripts/deploy.sh [user@host]
set -euo pipefail

SERVER="${1:-root@$(cat .deploy-host 2>/dev/null || echo 'MISSING')}"
REMOTE_DIR="/opt/cliclaw-app"

if [[ "$SERVER" == *"MISSING"* ]]; then
  echo "Usage: ./scripts/deploy.sh user@host"
  echo "Or create .deploy-host with the server address"
  exit 1
fi

echo "==> Building locally..."
cd "$(git rev-parse --show-toplevel)"
pnpm turbo build --filter=@cliclaw/portal

echo "==> Syncing to $SERVER..."
rsync -az --delete \
  --exclude .git \
  --exclude '.env' \
  --exclude '.env.production' \
  --exclude '.deploy-host' \
  --include 'apps/portal/.next/***' \
  ./ "$SERVER:$REMOTE_DIR/"

echo "==> Finalizing and restarting..."
ssh "$SERVER" 'cd /opt/cliclaw-app && \
  cp -r apps/portal/.next/static apps/portal/.next/standalone/apps/portal/.next/static && \
  cd apps/portal/.next/standalone/node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3 && \
  npm install --ignore-scripts=false 2>&1 | tail -1 && \
  systemctl restart cliclaw-portal'

echo "Deploy complete!"
