# Stage 1: Install dependencies and build
FROM node:22 AS builder
WORKDIR /app

RUN corepack enable pnpm

# Copy workspace root files for pnpm install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/auth/package.json packages/auth/
COPY apps/portal/package.json apps/portal/

RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/auth/ packages/auth/
COPY apps/portal/ apps/portal/

# Build (turbo handles dependency order: auth -> portal)
RUN pnpm turbo build --filter=@cliclaw/portal

# Stage 2: Production runtime
FROM node:22-slim AS runner
WORKDIR /app

# Docker CLI for spawning sibling agent containers
RUN apt-get update && apt-get install -y --no-install-recommends \
    docker.io \
    && rm -rf /var/lib/apt/lists/*

# Copy standalone build output
COPY --from=builder /app/apps/portal/.next/standalone ./
COPY --from=builder /app/apps/portal/.next/static ./apps/portal/.next/static

# Copy migrations (loaded from process.cwd()/migrations at runtime)
COPY --from=builder /app/apps/portal/migrations ./apps/portal/migrations

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Run as the standalone server from the portal directory
WORKDIR /app/apps/portal
CMD ["node", "server.js"]
