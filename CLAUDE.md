# cliclaw

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

- `packages/auth` — OAuth, agent store, CLAUDE.md generator
- `packages/cliclaw` — CLI tool (bin: cliclaw)
- `apps/dashboard` — Next.js 15 web dashboard (localhost:3000)
- `apps/portal` — Next.js 15 public agent chat portal (localhost:3001, deployed to Vercel at agents.markshteyn.com)
- `apps/agent-server` — Express API server for running Claude agents locally (localhost:3002, exposed via Cloudflare Tunnel at api.markshteyn.com)

## Portal Architecture

Client browser → Vercel (portal) → Cloudflare Tunnel → local agent-server → Claude SDK

- Portal: https://agents.markshteyn.com (Vercel, Next.js 15)
- Agent API: https://api.markshteyn.com (Cloudflare Tunnel → localhost:3002)
- Auth: Google OAuth, session tokens in HTTP-only cookies
- Auth + DB live entirely on the agent-server (SQLite at `~/.cliclaw/portal/portal.db`)
- Portal is a thin proxy — all auth, access control, and agent execution happen on agent-server
- Agent execution has all tools enabled; each client gets an isolated workspace at `~/.cliclaw/agents/{name}/clients/{userId}/`
- Agent identity files (CLAUDE.md, SOUL.md, ROLE.md) are symlinked from agent root into client workspaces
- DB tables: `users`, `sessions`, `client_agent_access`, `chat_sessions`, `client_tokens`
- Agent-server env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AGENT_API_SECRET`, `PORTAL_URL`, `ADMIN_EMAILS`, `PORT`
- Agent-server validates required env vars at startup — fails fast if `.env` is missing
- Portal env (Vercel): `AGENT_API_URL` (set to `https://api.markshteyn.com`)
- `@cliclaw/auth` must be built (`pnpm build` in packages/auth) before agent-server can start — it imports from `dist/`
- See DEPLOYMENT.md for full deployment and operations guide

## Agent Workspaces

Agents are stored as directories in `~/.cliclaw/agents/{name}/` with:
- `config.json` — AgentConfig
- `CLAUDE.md` — Auto-regenerated on permission/memory changes
- `SOUL.md` — User-editable personality
- `ROLE.md` — User-editable capabilities

Create agents via dashboard (Admin → Agents → Create Agent) or CLI: `cliclaw agent create --name <name> --display-name "<name>" --role "<role>"`

**IMPORTANT**: Never run `pnpm link --global` from a temporary worktree — it hardcodes the absolute path. The global cliclaw link lives in the `_reserve` worktree (`/Users/markshteyn/emdash-projects/worktrees/_reserve-nvcncx/packages/cliclaw`). If the CLI needs rebuilding, build there: `cd /Users/markshteyn/emdash-projects/worktrees/_reserve-nvcncx/packages/cliclaw && pnpm build`

## Client Integrations

Portal clients connect their own Google accounts so agents act on their behalf (not admin tokens).

- Integration registry: `packages/auth/src/integration-registry.ts` (gmail, gdrive, gsheets, gslides, calendar, forms)
- Token storage: `client_tokens` table in portal.db (user_id + integration → credentials JSON)
- Token path override: `CLICLAW_TOKENS_PATH` env var (set per-request in chat handler)
- Token injection: agent-server writes client tokens to workspace `tokens.json` before spawning Claude, persists refreshed tokens back after chat
- Integration gate: portal blocks agent chat until all agent-required integrations are connected
- OAuth flow: portal → agent-server `/integrations/connect/:integration` → Google → portal callback → agent-server exchanges code
- Dashboard: Admin → Agents tab → create/edit agents with integration toggle buttons
- Portal: `/integrations` page for clients to connect/disconnect accounts
- Admin endpoints: `POST/PUT/DELETE /admin/agents` for agent CRUD with integrations

## Cron Jobs

Agents can run scheduled tasks via `cliclaw cron`. Uses Ralph Wiggum loop pattern (re-invoke with fresh context, write progress to `progress.md`, output completion promise when done).

- Config: `cronJobs` array on `AgentConfig` (packages/auth/src/agent-store.ts)
- CLI: `cliclaw cron add/remove/list/enable/disable/start/run` (packages/cliclaw/src/commands/cron.ts)
- Loop: packages/cliclaw/src/cron/ralph-wiggum.ts
- Daemon: packages/cliclaw/src/cron/daemon.ts (node-cron, PID file at ~/.cliclaw/cron.pid)
- Progress: `~/.cliclaw/agents/{name}/cron/{jobId}/progress.md` + `runs/{timestamp}.json`
