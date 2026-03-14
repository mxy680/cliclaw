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

echo "==> Restarting portal..."
ssh "$SERVER" 'systemctl restart cliclaw-portal'

echo "Deploy complete!"
