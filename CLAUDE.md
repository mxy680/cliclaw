# cliclaw

## Dev Server

- Always kill port 3000 first, then run the dashboard on port 3000: `cd apps/dashboard && pnpm dev`
- Do NOT use `pnpm dev` from root — the CLI package's dev script exits immediately and fails turbo
- Dashboard URL: http://localhost:3000

## Project Structure

- `packages/auth` — OAuth, agent store, CLAUDE.md generator
- `packages/cliclaw` — CLI tool (bin: cliclaw)
- `apps/dashboard` — Next.js 15 web dashboard

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
