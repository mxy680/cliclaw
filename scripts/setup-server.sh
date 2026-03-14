#!/usr/bin/env bash
# One-time server setup for cliclaw on Hetzner VPS
# Run this ON the server: curl -sL <url> | bash
# Or: ssh root@host < scripts/setup-server.sh
set -euo pipefail

echo "Installing Docker..."
apt-get update
apt-get install -y docker.io docker-compose-plugin
systemctl enable --now docker

echo "Creating directories..."
mkdir -p /opt/cliclaw/{portal,agents,instances}
mkdir -p /opt/cliclaw-app

echo "Server setup complete."
echo ""
echo "Next steps:"
echo "  1. Create /opt/cliclaw-app/.env.production with your secrets:"
echo "     GOOGLE_CLIENT_ID=..."
echo "     GOOGLE_CLIENT_SECRET=..."
echo "     CLAUDE_CODE_OAUTH_TOKEN=..."
echo "     ADMIN_EMAILS=..."
echo "     TOKEN_ENCRYPTION_KEY=..."
echo ""
echo "  2. Copy agent templates from your machine:"
echo "     rsync -az ~/.cliclaw/agents/ root@<this-server>:/opt/cliclaw/agents/"
echo ""
echo "  3. Run deploy from your machine:"
echo "     ./scripts/deploy.sh root@<this-server>"
