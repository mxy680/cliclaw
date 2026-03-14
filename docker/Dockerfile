FROM node:22-slim

# Install Claude Code CLI and agent SDK globally
RUN npm install -g @anthropic-ai/claude-agent-sdk@latest @digitalpresence/cliclaw@0.2.1

# Create instance mount point
RUN mkdir -p /instance/workspace

WORKDIR /instance

# Copy entrypoint
COPY entrypoint.mjs /usr/local/bin/entrypoint.mjs

ENTRYPOINT ["node", "/usr/local/bin/entrypoint.mjs"]
