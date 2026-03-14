# cliclaw

**Deploy AI agents that act on behalf of your users.**

cliclaw is a platform for creating, managing, and deploying Claude-powered agents that authenticate as your users and operate their Google Workspace accounts — sending emails, managing calendars, editing spreadsheets, and more — on a schedule or on demand through a web portal.

## How It Works

1. **You create agents** via the CLI (or `/create-agent` skill), defining their role, personality, integrations, and scheduled tasks.
2. **Users sign in** to the web portal, connect their Google accounts, and get assigned to agents.
3. **Agents act on users' behalf** inside isolated Docker containers — each agent authenticates with the user's own OAuth credentials, scoped to only the integrations you've granted.

```
User (browser) → Portal (Vercel/Next.js) → Docker container → Claude SDK → cliclaw CLI → Google APIs
                                                  ↕
                                           ~/.cliclaw/instances/
```

## Core Capabilities

- **Google Workspace integration** — Gmail, Drive, Sheets, Slides, Calendar, and Forms, with full CRUD operations
- **Per-user OAuth** — each user connects their own Google account; agents act as the user, not as an admin
- **Docker sandboxing** — agents run in isolated containers with no host filesystem access
- **Scheduled tasks** — cron jobs with an iterative execution loop that breaks complex work into steps
- **Agent memory** — persistent, searchable memory so agents retain context across sessions
- **Integration scoping** — agents only access the integrations explicitly granted to them
- **Multi-user isolation** — each user gets a separate instance; credentials and state are never shared

## Architecture

| Component | Description |
|-----------|-------------|
| `packages/auth` | OAuth, agent store, instance store, integration registry |
| `packages/cliclaw` | CLI tool — agent CRUD, cron management, 40+ integration commands |
| `apps/portal` | Next.js web app — user chat, integration connection, admin management |
| `docker/` | Dockerfile and entrypoint for containerized agent execution |

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

- Node.js 22+
- pnpm 10+
- Docker
- Google Cloud project with OAuth 2.0 credentials

### Setup

```bash
# Install dependencies
pnpm install

# Build packages
pnpm build

# Build the agent container
pnpm docker:build

# Initialize universal CLAUDE.md
cliclaw init

# Create your first agent
cliclaw agent create --name assistant --display-name "Assistant" --role "General-purpose assistant"

# Grant it Gmail access
cliclaw agent grant assistant --integration gmail

# Add a scheduled task
cliclaw cron add assistant --schedule "0 9 * * *" --task "Check inbox and summarize unread emails"

# Start the cron daemon
cliclaw cron start
```

### Running the Portal

```bash
# Start the portal (localhost:3000, or deploy to Vercel)
cd apps/portal && pnpm dev
```

## Agent Configuration

Agent templates live at `~/.cliclaw/agents/{name}/` with user-editable files:

- **`SOUL.md`** — Personality and communication style
- **`ROLE.md`** — Capabilities, domain knowledge, and behavioral guidelines
- **`CONTEXT.md`** — Auto-generated from config, integrations, and memory

Per-user instances are materialized at `~/.cliclaw/instances/{agentName}/{userId}/` with copied template files and an isolated workspace.

## License

Private — not open source.
