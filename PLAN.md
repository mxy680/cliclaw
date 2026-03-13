# cliclaw — Architecture & Implementation Roadmap

> Living implementation spec documenting the current system architecture and the roadmap for evolving cliclaw into a multi-tenant SaaS platform.

---

## Part 1: Current Architecture (As-Is)

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         cliclaw system                              │
│                                                                     │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────────────┐  │
│  │ packages/     │   │ packages/     │   │ apps/ (deleted from    │  │
│  │ auth          │   │ cliclaw       │   │ repo, in git history)  │  │
│  │               │   │               │   │                        │  │
│  │ AgentStore    │   │ CLI (bin)     │   │ agent-server :3002     │  │
│  │ TokenStore    │   │ 8 cmd groups  │   │ dashboard    :3000     │  │
│  │ OAuthClient   │◄──│ cron daemon   │   │ portal       :3001     │  │
│  │ ScopedClient  │   │ ralph-wiggum  │   │ website      :3003     │  │
│  │ MemoryStore   │   │ JSON stdout   │   │                        │  │
│  │ IntegRegistry │   │               │   │                        │  │
│  │ ClaudeMdGen   │   │               │   │                        │  │
│  └──────────────┘   └──────────────┘   └────────────────────────┘  │
│                                                                     │
│  Runtime data: ~/.cliclaw/                                          │
│  Portal DB:    ~/.cliclaw/portal/portal.db (SQLite)                 │
└─────────────────────────────────────────────────────────────────────┘

Portal data flow (when apps are deployed):

  Client browser ──► Vercel (portal) ──► Cloudflare Tunnel ──► agent-server ──► Claude SDK
                                                                    │
                                                              ~/.cliclaw/
                                                              portal.db
```

### Package: `packages/auth` — OAuth & Agent Management Library

Exported as `@cliclaw/auth`. Core library consumed by CLI and agent-server.

**Source files** (`packages/auth/src/`):

| File | Purpose |
|------|---------|
| `index.ts` | Barrel export |
| `config.ts` | Config loading, path helpers (`getConfigDir`, `getTokensPath`, `getAgentsDir`) |
| `agent-store.ts` | Agent CRUD, workspace scaffolding, cron job management |
| `memory-store.ts` | JSONL-based agent memory with search/tagging/importance |
| `token-store.ts` | JSON file-based OAuth token storage by account |
| `oauth-client-manager.ts` | OAuth2Client lifecycle + auto token refresh |
| `scoped-client-manager.ts` | Permission-enforced wrapper (throws `PermissionDeniedError`) |
| `oauth-server.ts` | HTTP callback server for OAuth code exchange |
| `integration-registry.ts` | Master registry of integrations + scopes |
| `claude-md-generator.ts` | Auto-generates CLAUDE.md from config + memories |
| `gmail-auth.ts` | Gmail OAuth client factory |
| `gdrive-auth.ts` | Google Drive OAuth client factory |
| `gsheets-auth.ts` | Google Sheets OAuth client factory |
| `gslides-auth.ts` | Google Slides OAuth client factory |
| `calendar-auth.ts` | Google Calendar OAuth client factory |
| `forms-auth.ts` | Google Forms OAuth client factory |

### Package: `packages/cliclaw` — CLI Tool

Commander.js-based CLI with 8 command groups. All output is structured JSON to stdout.

**Command groups** (`packages/cliclaw/src/commands/`):

| Command | Subcommands |
|---------|-------------|
| `agent` | `create`, `list`, `show`, `delete`, `grant`, `revoke`, `memory {add,remove,search,clear}` |
| `cron` | `add`, `remove`, `list`, `enable`, `disable`, `start`, `run` |
| `gmail` | `auth`, `accounts`, `inbox`, `get`, `send`, `reply`, `forward`, `drafts`, `labels`, `threads` |
| `gdrive` | `auth`, `accounts`, `files`, `folders`, `search`, `sharing`, `about` |
| `gslides` | `auth`, `accounts`, `presentations` |
| `sheets` | `auth`, `accounts`, `spreadsheets`, `sheets`, `cells`, `format` |
| `calendar` | `auth`, `accounts`, `calendars`, `events`, `create`, `get`, `update`, `delete` |
| `forms` | `auth`, `accounts`, `list`, `create`, `get`, `update`, `questions`, `responses` |

**Cron system** (`packages/cliclaw/src/cron/`):

| File | Purpose |
|------|---------|
| `ralph-wiggum.ts` | Agent loop: invoke Claude → read progress.md → check NEEDS_MORE_ITERATIONS → re-invoke |
| `daemon.ts` | Background scheduler (node-cron, PID file at ~/.cliclaw/cron.pid, 30s job sync) |
| `handlers.ts` | CLI command handlers for cron CRUD |
| `progress.ts` | Progress file + run log management (CronRunLog, RunningMarker types) |
| `logger.ts` | Structured JSON logging to stderr |

**Agent management** (`packages/cliclaw/src/agent/`):

| File | Purpose |
|------|---------|
| `crud.ts` | Agent create/list/show/delete |
| `permissions.ts` | Grant/revoke integration access |
| `memory.ts` | Memory CRUD + search |

**Integration modules** (`packages/cliclaw/src/{service}/`):

- `gmail/` — 8 files (auth, accounts, inbox, get, send, drafts, labels, threads)
- `gdrive/` — 7 files (auth, accounts, files, folders, search, sharing, about)
- `sheets/` — 6 files (auth, accounts, spreadsheets, sheets-tab, cells, format)
- `calendar/` — 8 files (auth, accounts, calendars, events, create, get, update, delete)
- `gslides/` — 3 files (auth, accounts, presentations)
- `forms/` — 8 files (auth, accounts, list, get, create, update, questions, responses)

### Apps (Deleted — In Git History)

The web apps were removed in commits `a03dc9c` and `4fd6f97` to isolate the CLI packages. They exist in git history and will be restored/rebuilt during the roadmap phases.

**agent-server** (`apps/agent-server`) — Express API, port 3002, Cloudflare Tunnel → api.markshteyn.com
- SQLite DB at `~/.cliclaw/portal/portal.db` (better-sqlite3, WAL mode)
- Spawns Claude via `@anthropic-ai/claude-agent-sdk`
- Token injection per-request from DB → workspace `tokens.json`

**portal** (`apps/portal`) — Next.js 15 client-facing, Vercel → agents.markshteyn.com
- Thin proxy: all auth/execution on agent-server
- Chat UI, integration connection, admin panel

**dashboard** (`apps/dashboard`) — Next.js 15 admin UI, port 3000
- Agent testing, cron viewer, integration management

**website** (`apps/website`) — Next.js 15, Framer export, port 3003

---

### Data Model

All TypeScript interfaces from source:

#### `AgentConfig` (agent-store.ts:33-42)

```typescript
interface AgentConfig {
  name: string;              // Agent identifier (no spaces)
  displayName: string;       // Human-readable name
  role: string;              // Agent capabilities/instructions
  permissions: AgentPermission[];
  memory: string[];          // Legacy — migrated to MemoryStore
  cronJobs: CronJobConfig[];
  createdAt: string;         // ISO timestamp
  updatedAt: string;         // ISO timestamp
}
```

#### `AgentPermission` (agent-store.ts:18-21)

```typescript
interface AgentPermission {
  integration: string;  // e.g. "gmail", "gdrive"
  account: string;      // Email or account name
}
```

#### `CronJobConfig` (agent-store.ts:23-31)

```typescript
interface CronJobConfig {
  id: string;                // Random hex ID
  schedule: string;          // Cron expression (e.g. "0 9 * * *")
  task: string;              // Task description/prompt
  maxIterations: number;     // Max Ralph Wiggum loop iterations
  completionPromise: string; // Word/phrase indicating completion
  enabled: boolean;
  createdAt: string;         // ISO timestamp
}
```

#### `MemoryEntry` (memory-store.ts:11-18)

```typescript
interface MemoryEntry {
  id: string;                           // hex(randomBytes(4))
  fact: string;                         // Memory content
  tags: string[];                       // Search/filter tags
  source: "user" | "agent" | "system";  // Origin
  importance: 1 | 2 | 3;               // Priority (1=low, 3=critical)
  createdAt: string;                    // ISO timestamp
}
```

#### `IntegrationDef` (integration-registry.ts:1-5)

```typescript
interface IntegrationDef {
  id: string;           // Integration identifier
  displayName: string;  // Human-readable name
  scopes: string[];     // Google OAuth scopes
}
```

#### `CliclawConfig` (config.ts:5-8)

```typescript
interface CliclawConfig {
  client_secret_path: string;  // Path to Google OAuth client secret JSON
  oauth_port: number;          // Port for OAuth callback server
}
```

---

### Database Schema (SQLite — portal.db)

No migration files exist. Tables created inline in `apps/agent-server/src/db.ts`:

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS client_agent_access (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  granted_at TEXT DEFAULT (datetime('now')),
  granted_by TEXT NOT NULL,
  UNIQUE(user_id, agent_name)
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  claude_session_id TEXT,
  title TEXT NOT NULL DEFAULT 'New Chat',
  messages TEXT NOT NULL DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  cost_usd REAL DEFAULT 0,
  turn_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS client_tokens (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  integration TEXT NOT NULL,
  credentials TEXT NOT NULL,
  email TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, integration)
);
```

---

### Filesystem Layout

```
~/.cliclaw/
├── config.json              # CliclawConfig (client_secret_path, oauth_port)
├── tokens.json              # Admin OAuth tokens by account (TokenFile)
├── cron.pid                 # Daemon PID file
├── portal/
│   └── portal.db            # SQLite database (WAL mode)
└── agents/
    └── {name}/
        ├── config.json      # AgentConfig
        ├── CLAUDE.md        # Auto-generated (ClaudeMdGenerator)
        ├── SOUL.md          # User-editable personality
        ├── ROLE.md          # User-editable capabilities
        ├── memory/
        │   └── memories.jsonl  # MemoryEntry records
        ├── cron/
        │   └── {jobId}/
        │       ├── progress.md     # Ralph Wiggum loop state
        │       └── runs/
        │           └── {timestamp}.json  # CronRunLog
        └── clients/
            └── {userId}/
                ├── CLAUDE.md    # Client-specific generated CLAUDE.md
                ├── SOUL.md      # Symlink → agent root
                ├── ROLE.md      # Symlink → agent root
                └── tokens.json  # Injected per-request from DB
```

---

### Data Flows

#### 1. Client Chat Flow

```
Browser → Vercel (portal Next.js)
  → POST /api/chat/{agentName}
  → Cloudflare Tunnel → agent-server :3002
  → POST /chat/{agentName}
  → Validate session cookie → Load user from sessions table
  → Check client_agent_access
  → Load client tokens from client_tokens table
  → Write tokens to workspace clients/{userId}/tokens.json
  → Set CLICLAW_TOKENS_PATH env var
  → Spawn Claude via @anthropic-ai/claude-agent-sdk
  → Claude uses cliclaw CLI (reads CLICLAW_TOKENS_PATH)
  → Stream SSE response back through chain
```

#### 2. Token Flow

- **Admin tokens**: `~/.cliclaw/tokens.json` — used by CLI directly, managed by `TokenStore`
- **Client tokens**: SQLite `client_tokens` table — injected per-request into workspace `tokens.json`
- **Token refresh**: `OAuthClientManager` listens for `tokens` event, auto-persists refreshed credentials

#### 3. Agent Lifecycle

```
1. Create:    cliclaw agent create --name <n> --display-name "<d>" --role "<r>"
2. Configure: Edit SOUL.md, ROLE.md manually
3. Permit:    cliclaw agent grant <name> --integration gmail --account user@gmail.com
4. Memory:    cliclaw agent memory add <name> --fact "..." --tags "tag1,tag2"
5. Cron:      cliclaw cron add <name> --schedule "0 9 * * *" --task "..."
6. Assign:    POST /admin/agents → grant client access via dashboard
7. Connect:   Client connects integrations via portal /integrations page
8. Execute:   Client chats via portal, or cron daemon triggers scheduled tasks
```

---

### Integration Architecture

6 Google integrations, all OAuth-based:

| ID | Display Name | Scopes |
|----|-------------|--------|
| `gmail` | Gmail | `gmail.modify` |
| `gdrive` | Google Drive | `drive` |
| `gsheets` | Google Sheets | `spreadsheets`, `drive` |
| `gslides` | Google Slides | `presentations`, `drive.file` |
| `calendar` | Google Calendar | `calendar` |
| `forms` | Google Forms | `forms.body`, `forms.responses.readonly`, `drive.metadata.readonly` |

Each integration follows the pattern:
- `{service}-auth.ts` in `packages/auth/src/` — OAuth client factory + auth URL generator
- `{service}/auth.ts` in `packages/cliclaw/src/` — CLI OAuth flow handler
- `{service}/accounts.ts` — Token/account management
- Operation-specific modules (e.g., `gmail/inbox.ts`, `gmail/send.ts`)

---

### Cron System — Ralph Wiggum Loop

```
Daemon (node-cron, PID file, 30s sync)
  → Schedule triggers
  → executeRalphWiggumLoop(agent, jobId)
    → Iteration 1: Spawn Claude with task prompt + progress.md context
      → Claude writes progress.md
      → Check for NEEDS_MORE_ITERATIONS marker
    → Iteration 2..N: Re-spawn with updated progress.md
      → Until completion or maxIterations reached
  → Write run log to runs/{timestamp}.json
```

- Prevents concurrent runs of same job via `RunningMarker` (PID + startedAt)
- Configures Claude with allowed tools: Read, Write, Edit, Bash, Glob, Grep
- Captures full transcript with cost tracking

---

## Part 2: Implementation Roadmap (To-Be)

### Phase 1: Foundation Hardening

> Stabilize the core before adding new capabilities.

#### 1.1 Database Migrations

Create `packages/auth/src/migrations/` with:

- `runner.ts` — Migration runner that tracks applied migrations in a `_migrations` table
- `001_initial.sql` — Current schema (users, sessions, client_agent_access, chat_sessions, client_tokens)

Replace inline `CREATE TABLE IF NOT EXISTS` in agent-server's `db.ts` with the migration runner. All future schema changes go through numbered migration files.

#### 1.2 Environment Management

- `.env.example` files for each app (agent-server, portal, dashboard)
- Shared env validator utility in `packages/auth/src/env.ts`
- Document all env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AGENT_API_SECRET`, `PORTAL_URL`, `ADMIN_EMAILS`, `PORT`, `AGENT_API_URL`

#### 1.3 DEPLOYMENT.md

Document full deployment procedures:
- Agent-server: local setup, Cloudflare Tunnel config, env vars
- Portal: Vercel deployment, env vars, domain config
- CLI: global shim setup via `~/emdash-projects/cliclaw-cli` symlink
- Cron daemon: start/stop, log locations, monitoring

#### 1.4 Error Handling

Create `packages/auth/src/errors.ts`:

```typescript
class CliclawError extends Error { code: string; statusCode: number }
class AgentNotFoundError extends CliclawError { }
class PermissionDeniedError extends CliclawError { }  // consolidate with scoped-client-manager's version
class TokenError extends CliclawError { }
class IntegrationError extends CliclawError { }
```

Replace silent `catch` blocks in agent-store, token-store, and CLI handlers with structured error types.

#### 1.5 Testing

Unit tests for `packages/auth` using vitest + temporary directories:

- `AgentStore` — CRUD, workspace scaffolding, cron job management
- `MemoryStore` — add/remove/search, JSONL persistence, migration from legacy
- `TokenStore` — get/set/delete, file persistence
- `ScopedClientManager` — permission enforcement, PermissionDeniedError
- `ClaudeMdGenerator` — output format with various config combinations

---

### Phase 2: Cloud Deployment

> Move from local + Cloudflare Tunnel to proper VPS hosting.

#### 2.1 VPS + Docker

- Dockerize agent-server (`Dockerfile` + `docker-compose.yml`)
- Add `CLICLAW_HOME` env var to `config.ts` (default: `~/.cliclaw`, overridable for containerized deployment)
- Caddy reverse proxy with automatic TLS for api.markshteyn.com
- Mount `~/.cliclaw` as Docker volume for persistence

#### 2.2 CI/CD

GitHub Actions workflows:
- **PR**: typecheck + lint + test (vitest)
- **Merge to main**: build + deploy agent-server to VPS via SSH
- **Portal**: auto-deploys via Vercel Git integration (no action needed)

#### 2.3 Monitoring

- Structured logging with `pino` in agent-server (replace `console.log`)
- `GET /health` endpoint returning DB status, uptime, active sessions
- SQLite backup script (daily copy of portal.db to timestamped file)
- Log rotation for cron daemon output

#### 2.4 DNS Cutover

- Point `api.markshteyn.com` A record to VPS IP
- Remove Cloudflare Tunnel dependency
- Caddy handles TLS via Let's Encrypt

---

### Phase 3: Universal Integration Framework

> Expand beyond Google OAuth to support any service.

#### 3.1 Extensible Auth Types

Redesign `IntegrationDef` with discriminated union:

```typescript
type IntegrationAuthConfig =
  | { type: "oauth"; scopes: string[]; provider: "google" | "github" | "slack" }
  | { type: "api_token"; instructions: string }
  | { type: "session_credential"; fields: string[]; instructions: string };

interface IntegrationDef {
  id: string;
  displayName: string;
  category: "productivity" | "social" | "developer" | "communication";
  icon: string;           // Icon identifier for portal UI
  auth: IntegrationAuthConfig;
  cliCommand: string;     // CLI command group name
}
```

#### 3.2 Token Store Generalization

Wrap all credentials in a unified envelope:

```typescript
interface StoredCredential {
  type: "oauth" | "api_token" | "session_credential";
  data: Record<string, unknown>;  // OAuth tokens, API key, or session fields
  updatedAt: string;
}
```

Auto-migrate existing Google OAuth credentials from bare `Credentials` to `StoredCredential` wrapper.

#### 3.3 Integration Plugin Architecture

Move each integration to a self-contained plugin:

```
packages/cliclaw/src/integrations/
├── gmail/
│   ├── index.ts          # registerCommands(program, clientManager) export
│   ├── auth.ts
│   ├── inbox.ts
│   └── ...
├── github/
│   ├── index.ts
│   └── ...
└── registry.ts           # Auto-discovers and loads all integrations
```

CLI entry point (`cli.ts`) auto-discovers integrations via `registry.ts` instead of hardcoded imports.

#### 3.4 Non-Google Integrations

| Integration | Auth Type | Priority |
|-------------|-----------|----------|
| GitHub | API token (Personal Access Token) | High |
| Framer | API token | Medium |
| Slack | OAuth | Medium |
| LinkedIn | Session credential | Low |
| Instagram | Session credential | Low |

Portal UI adapts per auth type:
- **OAuth**: "Connect" button → redirect flow
- **API token**: Text input + "Save" button
- **Session credential**: Multi-field form with setup instructions

---

### Phase 4: SaaS Platform Evolution

> Portal becomes the product. Multi-tenant hardening + usage tracking.

#### 4.1 Multi-Tenant Hardening

- **Process isolation**: Each Claude spawn gets its own workspace + env (already done via `clients/{userId}/`)
- **Resource limits**: Configurable max tokens per session, max sessions per day per user
- **Audit logging**: New `audit_log` table

```sql
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,        -- 'chat', 'connect_integration', 'admin_grant', etc.
  agent_name TEXT,
  details TEXT,                -- JSON blob
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

#### 4.2 Usage Tracking

New `usage_records` table:

```sql
CREATE TABLE usage_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  agent_name TEXT NOT NULL,
  session_type TEXT NOT NULL,  -- 'chat' or 'cron'
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost_usd REAL DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
```

Record after each Claude SDK `query()` call. Augments the existing `cost_usd` / `turn_count` on `chat_sessions`.

#### 4.3 Admin Dashboard Enhancement

New admin API endpoints + dashboard pages:

- **Usage graphs**: Per-user, per-agent, per-day token/cost breakdowns
- **User management**: List users, view stats, suspend/unsuspend
- **Agent config viewer**: Read-only view of agent configs, SOUL.md, ROLE.md
- **Audit log viewer**: Filterable event stream

#### 4.4 User Onboarding

Invite system:

```sql
CREATE TABLE invites (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  agent_names TEXT NOT NULL,     -- JSON array of agent names to grant
  max_uses INTEGER DEFAULT 1,
  uses INTEGER DEFAULT 0,
  created_by TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

- Admin generates invite codes via CLI: `cliclaw invite create --agents "agent1,agent2" --max-uses 5`
- Invite landing page at portal: `/invite/{code}`
- Onboarding wizard: sign in → accept invite → connect required integrations → start chatting

---

### Phase 5: Advanced Agent Capabilities

> Richer execution model beyond chat and cron.

#### 5.1 Cron Improvements

- Integrate daemon into agent-server process (eliminate separate `cron.pid` process)
- Timezone support on `CronJobConfig` (currently UTC-only)
- Retry policy: configurable retries with exponential backoff on failure
- Job history viewer in portal: show past runs, progress, costs
- Pause/resume jobs without disable/enable cycle

#### 5.2 Event-Driven Triggers

- Webhook receiver endpoint on agent-server: `POST /webhooks/{agentName}/{triggerId}`
- Event matcher system: map incoming webhook payloads to agent tasks

```typescript
interface EventTrigger {
  id: string;
  source: "webhook" | "gmail_push" | "github_webhook" | "schedule";
  filter: Record<string, unknown>;  // JSONPath-style matchers
  task: string;                     // Agent prompt template
  agentName: string;
}
```

- Integration-specific event sources:
  - Gmail push notifications (Google Pub/Sub)
  - GitHub webhooks (PR opened, issue created, etc.)
  - Calendar event reminders

#### 5.3 Real-Time Features

- **Chat streaming**: Replace SSE polling with WebSocket or native SSE for lower latency
- **Push notifications**: Notify users when cron jobs complete or when agents need input
- **Live status**: Show agent execution status in real-time (thinking, using tool X, etc.)

---

### Phase Dependency Graph

```
Phase 1: Foundation Hardening
  ├── 1.1 DB Migrations ─────────────────────────┐
  ├── 1.2 Env Management ────────┐                │
  ├── 1.3 DEPLOYMENT.md          │                │
  ├── 1.4 Error Handling         │                │
  └── 1.5 Testing                │                │
                                 │                │
Phase 2: Cloud Deployment        │                │
  ├── 2.1 VPS + Docker ◄────────┘                │
  ├── 2.2 CI/CD ◄──── (1.5)                      │
  ├── 2.3 Monitoring                              │
  └── 2.4 DNS Cutover ◄──── (2.1)                │
                                                  │
Phase 3: Universal Integrations                   │
  ├── 3.1 Extensible Auth Types                   │
  ├── 3.2 Token Store Generalization ◄──── (1.1) ─┘
  ├── 3.3 Plugin Architecture ◄──── (3.1)
  └── 3.4 Non-Google Integrations ◄──── (3.2, 3.3)
                                       │
Phase 4: SaaS Platform                │
  ├── 4.1 Multi-Tenant Hardening ◄────┘
  ├── 4.2 Usage Tracking ◄──── (1.1)
  ├── 4.3 Admin Dashboard ◄──── (4.2)
  └── 4.4 User Onboarding ◄──── (4.1)

Phase 5: Advanced Agent
  ├── 5.1 Cron Improvements ◄──── (2.1)
  ├── 5.2 Event Triggers ◄──── (3.4, 5.1)
  └── 5.3 Real-Time Features ◄──── (2.1)
```

**Key dependencies**:
- Phase 2 requires Phase 1 env management (1.2) for Docker config
- Phase 3 token store (3.2) requires DB migrations (1.1) for credential schema changes
- Phase 4 multi-tenancy (4.1) requires the integration framework (Phase 3) to be complete
- Phase 5 event triggers (5.2) require both integrations (3.4) and improved cron (5.1)

---

### Critical Files Inventory

#### `packages/auth/src/`

| File | Lines | Purpose |
|------|-------|---------|
| `index.ts` | ~20 | Barrel export |
| `config.ts` | ~50 | Config loading, path resolution |
| `agent-store.ts` | ~264 | Agent CRUD, scaffolding, cron management |
| `memory-store.ts` | ~128 | JSONL memory persistence |
| `token-store.ts` | ~58 | OAuth token storage |
| `oauth-client-manager.ts` | ~64 | OAuth2Client lifecycle |
| `scoped-client-manager.ts` | ~66 | Permission-enforced OAuth wrapper |
| `oauth-server.ts` | ~87 | OAuth callback HTTP server |
| `integration-registry.ts` | ~49 | Integration definitions + scopes |
| `claude-md-generator.ts` | ~95 | Auto-generates agent CLAUDE.md |
| `gmail-auth.ts` | ~21 | Gmail OAuth factory |
| `gdrive-auth.ts` | ~21 | Google Drive OAuth factory |
| `gsheets-auth.ts` | ~22 | Google Sheets OAuth factory |
| `gslides-auth.ts` | ~22 | Google Slides OAuth factory |
| `calendar-auth.ts` | ~21 | Google Calendar OAuth factory |
| `forms-auth.ts` | ~23 | Google Forms OAuth factory |

#### `packages/cliclaw/src/`

| File | Purpose |
|------|---------|
| `cli.ts` | CLI entry point, command registration |
| `commands/*.ts` | 8 command group definitions |
| `agent/crud.ts` | Agent create/list/show/delete |
| `agent/permissions.ts` | Grant/revoke integration access |
| `agent/memory.ts` | Memory CRUD + search |
| `cron/ralph-wiggum.ts` | Agent execution loop |
| `cron/daemon.ts` | Background cron scheduler |
| `cron/handlers.ts` | Cron CLI command handlers |
| `cron/progress.ts` | Progress + run log management |
| `cron/logger.ts` | Structured logging |
| `lib/config.ts` | Config loading wrapper |
| `lib/output.ts` | JSON stdout + error output |
| `lib/media-utils.ts` | Media/file utilities |
| `{service}/*.ts` | 40 integration operation modules |

---

### Key Decisions

1. **Portal IS the product** — evolves into the full SaaS platform
2. **Mark is sole admin** — creates agents and cron jobs via CLI, not UI
3. **Users sign up on portal** — get granted agent access by admin (later: invite system)
4. **Users connect integrations through portal** — credentials stored in server DB, injected at runtime
5. **Free/invite-only model** — track usage for visibility, no billing infrastructure
6. **Cloud deployment to VPS (Hetzner)** — eliminate Cloudflare Tunnel dependency
7. **SQLite stays** — sufficient for single-server deployment, simpler than Postgres
8. **CLI remains the agent interface** — Claude uses `cliclaw` commands, not direct API calls
