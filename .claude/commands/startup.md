# Startup

Start the cliclaw portal dev server on localhost:3000.

## Procedure

### 1. Check if already running

```bash
lsof -ti:3000
```

If port 3000 is in use, tell the user and ask if they want to kill it and restart.

### 2. Ensure dependencies are installed

```bash
ls apps/portal/node_modules/.package-lock.json 2>/dev/null || pnpm install
```

If `node_modules` is missing (common in fresh worktrees), run `pnpm install` from repo root.

### 3. Ensure env symlinks exist

```bash
ls -la apps/portal/.env 2>/dev/null
```

If `.env` is missing or not a symlink, run `./scripts/setup-env.sh` from repo root.

### 4. Build the auth package

```bash
cd packages/auth && pnpm build
```

The portal depends on `@digitalpresence/cliclaw-auth` (workspace link). The dist must exist or Next.js will fail with "Module not found".

### 5. Clear Next.js cache (if stale)

```bash
rm -rf apps/portal/.next
```

Only do this if a previous startup attempt failed or if dependency changes were made.

### 6. Start the portal

```bash
cd apps/portal && pnpm dev
```

Run in background. This starts Next.js on port 3000.

### 7. Verify

Wait a few seconds, then check:

```bash
curl -sf http://localhost:3000 > /dev/null && echo "Portal OK" || echo "Portal FAILED"
```

Report the result to the user.

## Gotchas

| Mistake | Consequence | Fix |
|---------|-------------|-----|
| Missing `node_modules` in fresh worktree | `next: command not found` | `pnpm install` from repo root |
| Auth package not built | "Module not found: @digitalpresence/cliclaw-auth" | `cd packages/auth && pnpm build` |
| `.env` not symlinked | Missing env vars, OAuth fails | `./scripts/setup-env.sh` |
| Stale `.next` cache | Build errors persist after fixes | `rm -rf apps/portal/.next` |
| `pnpm dev` from repo root | CLI package dev script fails turbo | Always `cd apps/portal && pnpm dev` |
| Using `kill -9` on port 3000 | May kill Firefox or other apps | Use `lsof -ti:3000 \| xargs kill` (SIGTERM) |
