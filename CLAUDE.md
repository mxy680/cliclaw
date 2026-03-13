# cliclaw

## Dev Server

- Do NOT restart the dev server unless absolutely necessary (config/env/dependency changes) — restarting kills the user's Firefox tab
- If the server isn't running, start it: `cd apps/dashboard && pnpm dev`
- If you must restart, use `lsof -ti:3000 | xargs kill` (SIGTERM, not kill -9)
- Do NOT use `pnpm dev` from root — the CLI package's dev script exits immediately and fails turbo
- `@cliclaw/auth` exports source (`src/index.ts`) so Next.js hot-reloads it — no rebuild needed
- Dashboard URL: http://localhost:3000

## Project Structure

- `packages/auth` — OAuth, agent store, CLAUDE.md generator
- `packages/cliclaw` — CLI tool (bin: cliclaw)
- `apps/dashboard` — Next.js 15 web dashboard (localhost:3000)
- `apps/portal` — Next.js 15 public agent chat portal (localhost:3001, deployed to Vercel at agents.markshteyn.com)
- `apps/agent-server` — Express API server for running Claude agents locally (localhost:3002, exposed via Cloudflare Tunnel at api.markshteyn.com)

## Portal Architecture

Client browser → Vercel (portal) → Cloudflare Tunnel → local agent-server → Claude SDK

- Portal uses Supabase Auth (magic link) + Supabase Postgres for access control and chat history
- Agent-server validates requests via `AGENT_API_SECRET` header (shared secret with portal)
- Agent execution restricted to Read/Glob/Grep tools only (no filesystem writes, no shell)
- DB schema: `client_agent_access` (user↔agent mapping), `chat_sessions` (chat history)
- SQL migrations in `apps/portal/supabase/migrations/`

## Agent Workspaces

Agents are stored as directories in `~/.cliclaw/agents/{name}/` with:
- `config.json` — AgentConfig
- `CLAUDE.md` — Auto-regenerated on permission/memory changes
- `SOUL.md` — User-editable personality
- `ROLE.md` — User-editable capabilities

Create agents via CLI: `cliclaw agent create --name <name> --display-name "<name>" --role "<role>"`

## Cron Jobs

Agents can run scheduled tasks via `cliclaw cron`. Uses Ralph Wiggum loop pattern (re-invoke with fresh context, write progress to `progress.md`, output completion promise when done).

- Config: `cronJobs` array on `AgentConfig` (packages/auth/src/agent-store.ts)
- CLI: `cliclaw cron add/remove/list/enable/disable/start/run` (packages/cliclaw/src/commands/cron.ts)
- Loop: packages/cliclaw/src/cron/ralph-wiggum.ts
- Daemon: packages/cliclaw/src/cron/daemon.ts (node-cron, PID file at ~/.cliclaw/cron.pid)
- Progress: `~/.cliclaw/agents/{name}/cron/{jobId}/progress.md` + `runs/{timestamp}.json`
