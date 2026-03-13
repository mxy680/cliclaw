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
- `apps/dashboard` — Next.js 15 web dashboard

## Agent Workspaces

Agents are stored as directories in `~/.cliclaw/agents/{name}/` with:
- `config.json` — AgentConfig
- `CLAUDE.md` — Auto-regenerated on permission/memory changes
- `SOUL.md` — User-editable personality
- `ROLE.md` — User-editable capabilities

Create agents via CLI: `cliclaw agent create --name <name> --display-name "<name>" --role "<role>"`
