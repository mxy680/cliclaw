#!/usr/bin/env bash
# Deploy cliclaw portal to DigitalOcean droplet
# Usage: ./scripts/deploy.sh [user@host]
set -euo pipefail

SERVER="${1:-root@$(cat .deploy-host 2>/dev/null || echo 'MISSING')}"
REMOTE_DIR="/opt/cliclaw-app"
PORTAL="apps/portal"

if [[ "$SERVER" == *"MISSING"* ]]; then
  echo "Usage: ./scripts/deploy.sh user@host"
  echo "Or create .deploy-host with the server address"
  exit 1
fi

cd "$(git rev-parse --show-toplevel)"

echo "==> Building locally..."
pnpm turbo build --filter=@cliclaw/portal

# Copy static assets into standalone (Next.js requirement)
cp -r "$PORTAL/.next/static" "$PORTAL/.next/standalone/$PORTAL/.next/static"

# Copy migrations
cp -r "$PORTAL/migrations" "$PORTAL/.next/standalone/$PORTAL/migrations"

echo "==> Syncing standalone build..."
rsync -az --delete \
  "$PORTAL/.next/standalone/" "$SERVER:$REMOTE_DIR/standalone/"

echo "==> Rebuilding native deps and restarting..."
ssh "$SERVER" 'cd /opt/cliclaw-app/standalone/node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3 && \
  npm install --ignore-scripts=false 2>&1 | tail -1 && \
  systemctl restart cliclaw-portal'

echo "Deploy complete!"
