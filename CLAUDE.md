# cliclaw

## Environment Setup

- `.env` files are **symlinked** from `~/.cliclaw/env/` — NOT stored in the repo
- Canonical files: `~/.cliclaw/env/agent-server.env`, `~/.cliclaw/env/dashboard.env`
- After creating a new worktree, run `./scripts/setup-env.sh` from the repo root to create symlinks
- Never copy `.env` files directly into a worktree — always symlink

## Dev Server

- Do NOT restart the dev server unless absolutely necessary (config/env/dependency changes) — restarting kills the user's Firefox tab
- "Run the web app" means the dashboard: `cd apps/dashboard && pnpm dev` (port 3000)
- Portal runs on Vercel (agents.markshteyn.com) — run locally on port 3001 if explicitly asked: `cd apps/portal && pnpm dev`
- Internal dashboard ALWAYS on port 3000, external portal ALWAYS on port 3001 — no exceptions
- If you must restart, use `lsof -ti:3000 | xargs kill` (SIGTERM, not kill -9)
- Do NOT use `pnpm dev` from root — the CLI package's dev script exits immediately and fails turbo
- `@cliclaw/auth` exports source (`src/index.ts`) so Next.js hot-reloads it — no rebuild needed
- Portal URL: http://localhost:3000

## Project Structure

- `packages/auth` — OAuth, agent store, instance store, CLAUDE.md/CONTEXT.md generators
- `packages/cliclaw` — CLI tool (bin: cliclaw)
- `apps/dashboard` — Next.js 15 web dashboard (localhost:3000)
- `apps/portal` — Next.js 15 public agent chat portal (localhost:3001, deployed to Vercel at agents.markshteyn.com)
- `apps/website` — Next.js 15 landing page + style guide (localhost:3003, Framer export via `unframed`)
- `docker/` — Dockerfile and entrypoint for containerized agent execution

## Website (Landing Page)

- Framer project "Digital Presence" exported to static HTML via `npx unframed https://rich-product-499907.framer.app`
- Static HTML lives in `apps/website/public/framer/` — served by Next.js rewrites
- Next.js pages (e.g. `/style-guide`) coexist alongside Framer rewrites
- Design tokens in `apps/website/src/styles/tokens.ts` (14 colors, 13 typography styles)
- CSS vars + Tailwind theme in `apps/website/src/app/globals.css`
- Dev mode has EMFILE issues from large Framer HTML files — use `pnpm build && pnpm start` for testing
- To re-export: `cd apps/website && npx unframed https://rich-product-499907.framer.app --output ./public/framer`

## Portal Architecture

Client browser → Vercel (portal) → Docker container → Claude SDK

- Portal: https://agents.markshteyn.com (Vercel, Next.js 15)
- Auth: Google OAuth, session tokens in HTTP-only cookies
- Auth + DB live on the portal server (SQLite at `~/.cliclaw/portal/portal.db`)
- Agent execution runs in isolated Docker containers (cliclaw-agent image)
- Each user gets an instance at `~/.cliclaw/instances/{agentName}/{userId}/`
- Container only mounts the instance directory — no host filesystem access
- DB tables: `users`, `sessions`, `client_agent_access`, `chat_sessions`, `client_tokens`
- Build container: `pnpm docker:build`

## Agent Architecture

### Templates (agent definitions)
Agents are templates stored at `~/.cliclaw/agents/{name}/`:
- `config.json` — AgentConfig (name, displayName, role, integrations[], cronJobs[])
- `SOUL.md` — User-editable personality
- `ROLE.md` — User-editable capabilities
- `CONTEXT.md` — Auto-generated per-instance context (integrations, cron schedules, memories)
- `cron-tasks/` — Markdown task files for cron jobs

Create agents via `/create-agent` skill or CLI:
`cliclaw agent create --name <name> --display-name "<name>" --role "<role>"`
Then configure SOUL.md, ROLE.md, integrations, and cron jobs.

### Instances (per-user materializations)
When a user is assigned to an agent, an instance is created at `~/.cliclaw/instances/{agentName}/{userId}/`:
- `CLAUDE.md` — Copied from universal `~/.cliclaw/CLAUDE.md`
- `SOUL.md`, `ROLE.md` — Copied from agent template
- `CONTEXT.md` — Generated with agent-specific context
- `workspace/` — Agent's working directory (mounted into Docker)
- `memory/` — Per-instance memory JSONL
- `cron/` — Per-instance cron progress/runs

Files are **copied** (not symlinked) because symlinks break across Docker mount boundaries.

### Universal CLAUDE.md
`~/.cliclaw/CLAUDE.md` — shared instructions for all agents (safety rules, CLI usage, memory instructions).
Generate/update with `cliclaw init`.

### AgentConfig
```typescript
interface AgentConfig {
  name: string;
  displayName: string;
  role: string;
  integrations: string[];     // integration IDs (e.g. ["gmail", "gdrive"])
  cronJobs: CronJobConfig[];
  createdAt: string;
  updatedAt: string;
}
```

### Docker Sandboxing
Agents run in `cliclaw-agent` Docker containers:
- Only the instance directory is mounted at `/instance`
- `session.json` written to instance dir before spawn
- NDJSON events streamed from container stdout → SSE to client
- `--network=host` for API access, `--cpus=2 --memory=2g` limits
- `bypassPermissions` is safe because agents are containerized

**CLI Distribution**: The `cliclaw` CLI is published to npm as `@digitalpresence/cliclaw` and installed globally (`npm i -g @digitalpresence/cliclaw`). The auth package is `@digitalpresence/cliclaw-auth`. To publish updates:
```bash
cd packages/auth && pnpm build && npm publish --access public
cd packages/cliclaw && pnpm build && npm publish --access public
npm install -g @digitalpresence/cliclaw@latest
```
**IMPORTANT**: Bump the version in `package.json` before publishing (npm rejects duplicate versions).

## Client Integrations

Portal clients connect their own Google accounts so agents act on their behalf (not admin tokens).

- Integration registry: `packages/auth/src/integration-registry.ts` (gmail, gdrive, gsheets, gslides, calendar, forms)
- Token storage: `client_tokens` table in portal.db (user_id + integration → credentials JSON)
- Token path override: `CLICLAW_TOKENS_PATH` env var (set per-request in chat handler)
- Token injection: portal writes client tokens to instance workspace before spawning container, persists refreshed tokens back after chat
- Integration gate: portal blocks agent chat until all agent-required integrations are connected
- OAuth flow: portal → `/integrations/connect/:integration` → Google → portal callback → exchange code
- Dashboard: Admin → Agents tab shows agents with integration badges, client management (assign/revoke users)
- Portal: `/integrations` page for clients to connect/disconnect accounts

## Cron Jobs

Agents can run scheduled tasks via `cliclaw cron`. Uses Ralph Wiggum loop pattern (re-invoke in Docker containers with fresh context, write progress to workspace, check for NEEDS_MORE_ITERATIONS marker).

- Config: `cronJobs` array on `AgentConfig` with `taskFile` pointing to markdown in `cron-tasks/`
- CLI: `cliclaw cron add/remove/list/enable/disable/start/run` (packages/cliclaw/src/commands/cron.ts)
- Loop: packages/cliclaw/src/cron/ralph-wiggum.ts (spawns Docker containers per iteration)
- Daemon: packages/cliclaw/src/cron/daemon.ts (node-cron, PID file at ~/.cliclaw/cron.pid)
- Cron instance: `~/.cliclaw/instances/{agentName}/_cron/` (special system instance)
