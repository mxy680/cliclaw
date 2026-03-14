#!/usr/bin/env bash
# Deploy cliclaw portal to Hetzner VPS
# Usage: ./scripts/deploy.sh [user@host]
set -euo pipefail

SERVER="${1:-root@$(cat .deploy-host 2>/dev/null || echo 'MISSING')}"
REMOTE_DIR="/opt/cliclaw-app"

if [[ "$SERVER" == *"MISSING"* ]]; then
  echo "Usage: ./scripts/deploy.sh user@host"
  echo "Or create .deploy-host with the server address"
  exit 1
fi

echo "Deploying to $SERVER..."

# Sync project files (exclude heavy/unnecessary dirs)
rsync -az --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude .git \
  --exclude dist \
  --exclude .env \
  --exclude .env.production \
  --exclude .deploy-host \
  ./ "$SERVER:$REMOTE_DIR/"

# Build and restart on server
ssh "$SERVER" <<'DEPLOY'
  set -euo pipefail
  cd /opt/cliclaw-app

  # Ensure data dirs exist
  mkdir -p /opt/cliclaw/{portal,agents,instances}

  # Build the agent container image
  echo "Building agent container..."
  docker build -t cliclaw-agent ./docker

  # Build and restart portal + caddy
  echo "Building and starting portal..."
  docker compose build portal
  docker compose up -d

  echo "Done. Checking status..."
  docker compose ps
DEPLOY

echo "Deploy complete!"
