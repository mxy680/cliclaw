# cliclaw

**Deploy AI agents that act on behalf of your users.**

cliclaw is a platform for creating, managing, and deploying Claude-powered agents that authenticate as your users and operate their Google Workspace accounts — sending emails, managing calendars, editing spreadsheets, and more — on a schedule or on demand through a web portal.

## How It Works

1. **You create agents** via the CLI, defining their role, personality, permissions, and scheduled tasks.
2. **Users sign in** to the web portal, connect their Google accounts, and get assigned to agents.
3. **Agents act on users' behalf** — each agent authenticates with the user's own OAuth credentials, scoped to only the integrations you've granted.

```
User (browser) → Portal (Vercel) → Agent Server → Claude SDK → cliclaw CLI → Google APIs
                                        ↕
                                   SQLite / ~/.cliclaw/
```

## Core Capabilities

- **Google Workspace integration** — Gmail, Drive, Sheets, Slides, Calendar, and Forms, with full CRUD operations
- **Per-user OAuth** — each user connects their own Google account; agents act as the user, not as an admin
- **Scheduled tasks** — cron jobs with an iterative execution loop that breaks complex work into steps
- **Agent memory** — persistent, searchable memory so agents retain context across sessions
- **Permission scoping** — agents only access the integrations and accounts explicitly granted to them
- **Multi-user isolation** — each user gets a sandboxed workspace; credentials and state are never shared

## Architecture

| Component | Description |
|-----------|-------------|
| `packages/auth` | OAuth, agent store, token management, integration registry |
| `packages/cliclaw` | CLI tool — agent CRUD, cron management, 40+ integration commands |
| `apps/agent-server` | Express API that spawns Claude agents with injected user credentials |
| `apps/portal` | Next.js web app where users chat with agents and connect integrations |
| `apps/dashboard` | Admin UI for managing agents, users, and monitoring usage |

## Integrations

| Service | Auth | Operations |
|---------|------|------------|
| Gmail | OAuth | Read inbox, send, reply, forward, drafts, labels, threads |
| Google Drive | OAuth | Files, folders, search, sharing, metadata |
| Google Sheets | OAuth | Spreadsheets, sheets, cells, formatting |
| Google Slides | OAuth | Presentations (read, create, edit) |
| Google Calendar | OAuth | Calendars, events, CRUD |
| Google Forms | OAuth | Forms, questions, responses |

The integration framework is designed to expand beyond Google — API token and session credential auth types are on the roadmap for GitHub, Slack, and more.

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 10+
- Google Cloud project with OAuth 2.0 credentials

### Setup

```bash
# Install dependencies
pnpm install

# Build packages
pnpm build

# Create your first agent
cliclaw agent create --name assistant --display-name "Assistant" --role "General-purpose assistant"

# Grant it Gmail access
cliclaw agent grant assistant --integration gmail --account you@gmail.com

# Add a scheduled task
cliclaw cron add assistant --schedule "0 9 * * *" --task "Check inbox and summarize unread emails"

# Start the cron daemon
cliclaw cron start
```

### Running the Portal

```bash
# Start the agent server (localhost:3002)
cd apps/agent-server && pnpm dev

# Start the portal (localhost:3001, or deploy to Vercel)
cd apps/portal && pnpm dev
```

## Agent Configuration

Agents live at `~/.cliclaw/agents/{name}/` with three user-editable files:

- **`SOUL.md`** — Personality and communication style
- **`ROLE.md`** — Capabilities, domain knowledge, and behavioral guidelines
- **`CLAUDE.md`** — Auto-generated from config, permissions, and memory (do not edit directly)

## Roadmap

See [PLAN.md](./PLAN.md) for the full architecture spec and implementation roadmap, covering:

1. **Foundation hardening** — migrations, testing, structured errors
2. **Cloud deployment** — Docker, CI/CD, VPS hosting
3. **Universal integrations** — plugin architecture for non-Google services
4. **SaaS platform** — usage tracking, invite system, admin dashboard
5. **Advanced agents** — event-driven triggers, webhooks, real-time streaming

## License

Private — not open source.
