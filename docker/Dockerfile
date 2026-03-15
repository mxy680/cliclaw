FROM node:22-slim

# Install system tools (PDF, images, office docs, git, common utilities)
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    python3 \
    python3-pip \
    git \
    curl \
    imagemagick \
    ffmpeg \
    libreoffice-calc-nogui \
    libreoffice-writer-nogui \
    && pip3 install --break-system-packages pypdf pdfplumber openpyxl python-docx python-pptx Pillow \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI and agent SDK globally
RUN npm install -g @anthropic-ai/claude-code@latest @anthropic-ai/claude-agent-sdk@latest @digitalpresence/cliclaw@0.3.2

# Create non-root user (Claude Code refuses bypassPermissions as root)
RUN useradd -m -s /bin/bash agent

# Create instance mount point owned by agent user
RUN mkdir -p /instance/workspace && chown -R agent:agent /instance

# Entrypoint lives in /app (not /instance, which is bind-mounted at runtime)
RUN mkdir -p /app
COPY entrypoint.mjs /app/entrypoint.mjs

# ESM ignores NODE_PATH — symlink global packages so they resolve from /app
RUN ln -s /usr/local/lib/node_modules /app/node_modules

USER agent
WORKDIR /instance

ENTRYPOINT ["node", "/app/entrypoint.mjs"]
