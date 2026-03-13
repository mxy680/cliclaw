# cliclaw Portal — Detailed Implementation Plan

## Context

cliclaw is evolving from a CLI-only tool into a multi-tenant SaaS platform. The old portal (deleted in `a03dc9c`) was a thin Next.js proxy to a separate Express agent-server. We're rewriting from scratch as a **unified Next.js 15 app** — the portal IS the server. SQLite, Claude SDK, and all business logic run directly in Next.js Route Handlers on a VPS.

**This plan covers Phase 1 (MVP) only.** Later phases (deployment, universal integrations, SaaS features, cron) are outlined at the end for reference.

---

## Implementation Order

The plan is organized by implementation order, respecting dependencies:

```
Step 1: Scaffold + Config Changes          (no deps)
Step 2: Foundation (constants, errors, types)  (no deps)
Step 3: Database Layer                      (depends on Step 2)
Step 4: Session + Auth                      (depends on Step 3)
Step 5: Middleware                           (no deps — cookie-only check)
Step 6: Auth API Routes                     (depends on Step 4)
Step 7: Design System + Root Layout         (no deps)
Step 8: UI Primitives                       (depends on Step 7)
Step 9: Layout Components + Hooks           (depends on Step 8)
Step 10: Token Injector + Chat Service      (depends on Step 4)
Step 11: API Routes (agents, chat, integrations, admin)  (depends on Steps 4, 10)
Step 12: Pages + Feature Components         (depends on Steps 9, 11)
```

---

## Step 1: Scaffold + Config Changes

### 1a. `pnpm-workspace.yaml` — Add `apps/*`

```yaml
packages:
  - "packages/*"
  - "apps/*"
```

### 1b. `apps/portal/package.json`

```json
{
  "name": "@cliclaw/portal",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start --port 3000",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.2.74",
    "@cliclaw/auth": "workspace:*",
    "better-sqlite3": "^11.8.1",
    "next": "^15.3.3",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-markdown": "^10.1.0",
    "remark-gfm": "^4.0.1"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.1.8",
    "@tailwindcss/typography": "^4.1.8",
    "@types/better-sqlite3": "^7.6.13",
    "@types/node": "^22.0.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "tailwindcss": "^4.1.8",
    "postcss": "^8.5.4",
    "typescript": "^5.8.0"
  }
}
```

### 1c. `apps/portal/tsconfig.json`

Standard Next.js 15 config with bundler module resolution, `@/*` path alias to `./src/*`.

### 1d. `apps/portal/next.config.ts`

```typescript
const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "@anthropic-ai/claude-agent-sdk"],
};
```

- `output: "standalone"` for VPS Docker deployment
- `serverExternalPackages` prevents webpack from bundling native Node addons

### 1e. `apps/portal/postcss.config.mjs` — Tailwind 4 PostCSS plugin

### 1f. `apps/portal/.env.example`

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ADMIN_EMAILS=admin@example.com
BASE_URL=http://localhost:3000
CLICLAW_HOME=
ANTHROPIC_API_KEY=
```

### 1g. Modify `packages/auth/src/config.ts` — Add `CLICLAW_HOME` support

**Change**: Replace hardcoded `CONFIG_DIR`:
```typescript
// Line 10, BEFORE:
const CONFIG_DIR = join(homedir(), ".cliclaw");

// AFTER:
const CONFIG_DIR = process.env.CLICLAW_HOME || join(homedir(), ".cliclaw");
```

This makes `getConfigDir()`, `getAgentsDir()`, `getTokensPath()` all respect the env var. Backwards compatible — without `CLICLAW_HOME`, behavior is unchanged.

### 1h. Run `pnpm install` to bootstrap the workspace

---

## Step 2: Foundation

### 2a. `src/lib/constants.ts`

Exports:
- `SESSION_COOKIE = "cliclaw_session"` — cookie name
- `SESSION_MAX_AGE = 30 * 24 * 60 * 60` — 30 days in seconds
- `CLICLAW_HOME` — `process.env.CLICLAW_HOME || ${HOME}/.cliclaw`
- `GOOGLE_AUTH_URL`, `GOOGLE_TOKEN_URL`, `GOOGLE_USERINFO_URL` — OAuth endpoint constants
- `OAUTH_STATE_TTL_MS = 10 * 60 * 1000` — 10 minute state token TTL

### 2b. `src/lib/errors.ts`

Error class hierarchy:
```typescript
class CliclawError extends Error { code: string; statusCode: number }
class BadRequestError extends CliclawError    // 400
class UnauthorizedError extends CliclawError  // 401
class ForbiddenError extends CliclawError     // 403
class NotFoundError extends CliclawError      // 404

function errorResponse(err: unknown): Response  // catch-all for Route Handlers
```

`errorResponse` converts errors to `{ error, code }` JSON responses. Used in every Route Handler catch block.

### 2c. `src/lib/types.ts`

DB row types (match SQLite columns exactly):
- `UserRow { id, email, created_at, updated_at }`
- `SessionRow { token, user_id, created_at, expires_at }`
- `SessionWithUser { token, user_id, email, expires_at }` — joined query result
- `ClientAgentAccessRow { id, user_id, agent_name, granted_at, granted_by }`
- `ChatSessionRow { id, user_id, agent_name, claude_session_id, title, messages, cost_usd, turn_count, ... }`
- `ClientTokenRow { id, user_id, integration, credentials, email, ... }`

Application types:
- `AuthUser { id, email }` — auth context
- `ChatBlock = { type: "user"; content } | { type: "assistant"; content } | { type: "tool"; name; input?; done }` — client-side chat state
- `AgentInfo { name, displayName, role, permissions }` — API response shape
- `IntegrationStatus { id, displayName, connected, email? }` — API response shape

---

## Step 3: Database Layer

### 3a. `migrations/001_initial.sql`

Five tables (same schema as old `agent-server/src/db.ts`):

```sql
users (id TEXT PK, email TEXT UNIQUE, created_at, updated_at)
sessions (token TEXT PK, user_id FK → users, created_at, expires_at)
  INDEX: idx_sessions_user, idx_sessions_expires
client_agent_access (id TEXT PK, user_id FK, agent_name, granted_at, granted_by, UNIQUE(user_id, agent_name))
  INDEX: idx_access_user, idx_access_agent
chat_sessions (id TEXT PK, user_id FK, agent_name, claude_session_id, title, messages INT, cost_usd REAL, turn_count INT, ...)
  INDEX: idx_chat_user, idx_chat_agent
client_tokens (id TEXT PK, user_id FK, integration, credentials TEXT, email, UNIQUE(user_id, integration))
  INDEX: idx_tokens_user
```

**Location**: `apps/portal/migrations/` (at project root, NOT inside `src/`). This avoids webpack bundling issues.

### 3b. `src/lib/db-migrations.ts`

Exports: `runMigrations(db: Database.Database): void`

- Creates `_migrations` tracking table
- Reads `.sql` files from `join(process.cwd(), "migrations")` sorted lexicographically
- Applies unapplied migrations, each in a transaction
- **Why `process.cwd()`**: In Next.js, files in `src/` are bundled by webpack. `import.meta.dirname` would resolve to `.next/server/` build output, not the source tree. `process.cwd()` always returns the Next.js project root where `next.config.ts` lives, both in dev and production.

### 3c. `src/lib/db.ts`

Exports: `getDb(): Database.Database`, `generateId(): string`

SQLite singleton with HMR-safe pattern:
```typescript
function getDb(): Database.Database {
  // In dev: globalThis.__portalDb survives HMR
  // In prod: module-level singleton
  const g = globalThis as any;
  if (!g.__portalDb) {
    const db = new Database(join(CLICLAW_HOME, "portal", "portal.db"));
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    runMigrations(db);
    g.__portalDb = db;
  }
  return g.__portalDb;
}
```

**Key details**:
- DB path: `${CLICLAW_HOME}/portal/portal.db` (creates directory if needed)
- WAL mode for concurrent reads during writes
- `foreign_keys = ON` per-connection (not persisted in SQLite)
- `generateId()` uses `crypto.randomBytes(16).toString("hex")`

### 3d. `src/lib/db-statements.ts`

Exports: `getStmts()` — lazy singleton returning all prepared statements.

Statement groups:
- **Users**: `findUserByEmail`, `createUser`, `getUser`, `listUsers`
- **Sessions**: `createSession`, `getSession` (JOIN users, checks expiry), `deleteSession`, `cleanExpiredSessions`
- **Access**: `grantAccess` (INSERT OR IGNORE), `revokeAccess`, `checkAccess`, `getUserAccess`, `listAccess` (JOIN users)
- **Chat sessions**: `createChatSession`, `updateChatSession` (increment messages/cost/turns), `getChatSession`, `getUserChatSessions`
- **Client tokens**: `upsertClientToken` (INSERT ON CONFLICT UPDATE), `getClientTokens`, `getClientToken`, `deleteClientToken`
- **Stats**: `countUsers`, `countSessions`, `totalCost`, `countAccess`

---

## Step 4: Session + Auth

### 4a. `src/lib/session.ts`

Cookie helpers:
- `getSessionToken(): Promise<string | undefined>` — reads `SESSION_COOKIE` from `cookies()`
- `sessionCookieOptions(token): CookieOptions` — httpOnly, secure in prod, sameSite lax, 30-day maxAge

### 4b. `src/lib/auth.ts`

Auth helpers for Route Handlers and Server Components:
- `getSession(): Promise<AuthUser | null>` — reads cookie, validates against DB
- `requireAuth(): Promise<AuthUser>` — throws `UnauthorizedError` if no valid session
- `requireAdmin(): Promise<AuthUser>` — throws `ForbiddenError` if not in `ADMIN_EMAILS`
- `isAdmin(email): boolean` — checks `ADMIN_EMAILS` env var
- `findOrCreateUser(email): { id, email }` — upserts user row
- `createSession(userId): string` — generates token, inserts row, returns token

HMAC OAuth state (for CSRF protection on integration OAuth):
- `createOAuthState(payload): string` — signs `{timestamp, ...payload}` with HMAC-SHA256 using `GOOGLE_CLIENT_SECRET`, returns base64url
- `verifyOAuthState(state): payload | null` — verifies HMAC + checks TTL (10 min), uses `crypto.timingSafeEqual`

---

## Step 5: Middleware

### `src/middleware.ts`

Next.js Edge Middleware — cookie-only check (no DB access, no native modules):

```typescript
const PUBLIC_PATHS = ["/", "/auth", "/api/auth", "/invite"];

function middleware(request) {
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (isPublicPath(pathname)) {
    // Redirect authed users from "/" to "/agents"
    return hasSession && pathname === "/" ? redirect("/agents") : next();
  }

  // Protected API routes: return 401 JSON
  if (!hasSession && pathname.startsWith("/api/")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Protected pages: redirect to sign-in
  if (!hasSession) return redirect("/");

  return next();
}
```

**Important**: Middleware checks cookie *existence* only, not validity. An expired cookie passes middleware but fails at `requireAuth()` in the Route Handler. This is the standard Next.js pattern since middleware runs on Edge where native modules (better-sqlite3) are unavailable.

Cookie name is hardcoded in middleware (not imported from constants.ts) to avoid pulling Node.js dependencies into Edge runtime.

---

## Step 6: Auth API Routes

### 6a. `src/app/api/auth/google/route.ts` — GET: Initiate OAuth

- Builds Google consent URL with `GOOGLE_CLIENT_ID`, `redirect_uri`, scopes `"openid email profile"`, `access_type: "offline"`, `prompt: "consent"`
- Includes HMAC state token via `createOAuthState()`
- Returns `{ url }` JSON (client does `window.location.href = url`)

### 6b. `src/app/api/auth/callback/route.ts` — GET: OAuth callback

1. Validates `code` param exists, `state` via `verifyOAuthState()`
2. Exchanges code → tokens via `POST https://oauth2.googleapis.com/token`
3. Fetches user email via `GET https://www.googleapis.com/oauth2/v2/userinfo`
4. `findOrCreateUser(email)` → user
5. `createSession(user.id)` → token
6. Sets HTTP-only session cookie on response
7. Redirects to `/agents`

**Key change from old architecture**: The old flow exposed the session token in a URL parameter (`/auth/session?token=xxx`). The new flow sets the cookie directly in the callback redirect response, so the token never appears in browser history.

### 6c. `src/app/auth/session/route.ts` — GET: Session validation

Returns current session info for client-side auth checks:
```json
{ "user": { "id": "...", "email": "...", "isAdmin": true } }
```
Returns 401 if no valid session. Used by client-side `useSession` hook for hydration.

### 6d. `src/app/api/auth/logout/route.ts` — POST: Destroy session

Reads cookie token, deletes session row from DB, clears cookie, returns `{ ok: true }`.

---

## Step 7: Design System + Root Layout

### 7a. `src/app/globals.css` — Terminal Noir theme

Port verbatim from old portal at `66277e5`:
- OKLch color tokens: `--background: oklch(0.12 0.005 250)`, `--primary/--amber: oklch(0.82 0.16 75)`, etc.
- Tailwind 4 `@theme inline` block mapping CSS vars to theme tokens
- Noise texture overlay (`body::before` with SVG fractalNoise)
- Animations: `cursor-blink`, `thinking-bounce`, `fade-in-up`, `glow-pulse`
- `::selection` amber tint
- `.streaming-cursor::after` — blinking block cursor
- `.thinking-dot` — bouncing dots with staggered delays

### 7b. `src/app/layout.tsx` — Root layout

- Loads `Outfit` (variable, `--font-sans`) and `JetBrains_Mono` (`--font-mono`) via `next/font/google`
- `<html lang="en" className="dark">`
- `<body className="font-sans antialiased">`
- Imports `globals.css`

---

## Step 8: UI Primitives

All in `src/components/ui/`, all Tailwind-only, no shadcn. Terminal Noir styling: `rounded-sm`, `border border-border`, `font-mono text-xs tracking-wider uppercase` for labels.

| Component | Props | Notes |
|-----------|-------|-------|
| `button.tsx` | `variant: default\|secondary\|destructive\|ghost\|outline`, `size: default\|sm\|lg\|icon` | `forwardRef`, amber primary variant |
| `input.tsx` | Standard `<input>` props | `forwardRef`, `focus:border-amber/50 focus:ring-1 focus:ring-amber/20` |
| `card.tsx` | `Card`, `CardHeader`, `CardTitle`, `CardContent` | All `forwardRef`, composable |
| `badge.tsx` | `variant: default\|secondary\|destructive\|outline` | Inline `text-[10px]` tracking-wider |
| `table.tsx` | `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` | All `forwardRef` |
| `spinner.tsx` | `className?` | Uses `.thinking-dot` CSS animation |
| `toast.tsx` | `ToastProvider` (renders), `toast(msg, type)` (imperative) | `fixed bottom-4 right-4`, auto-dismiss 4s |
| `dialog.tsx` | `open`, `onClose`, `children` | Native `<dialog>`, `backdrop:bg-black/60` |

---

## Step 9: Layout Components + Hooks

### Layout Components (`src/components/layout/`)

#### `app-shell.tsx` — Server component
- `<div className="flex min-h-screen">`
- `<NavSidebar />` (hidden on mobile: `hidden lg:flex`)
- `<main className="flex-1 flex flex-col min-h-0 lg:ml-60">` wrapping `{children}`

#### `nav-sidebar.tsx` — Client component (`"use client"` for `usePathname`)
- Fixed left sidebar: `w-60 fixed inset-y-0 left-0 border-r border-border bg-card`
- Logo: `font-mono text-lg font-bold text-amber`
- Nav links: Agents (`/agents`), Integrations (`/integrations`), Admin (`/admin` — conditional on `isAdmin` from `useSession()`)
- Active link: `text-amber bg-amber/5 border-l-2 border-amber`
- Bottom: user email + `<SignOutButton />`

#### `header.tsx` — Server component
- `Props: { title, breadcrumb?: { label, href }[] }`
- `border-b border-border px-6 py-4`
- Breadcrumb with `/` separators, mobile nav trigger on right

#### `mobile-nav.tsx` — Client component
- Hamburger button visible `lg:hidden`
- Overlay + slide-out drawer with same nav as sidebar
- Closes on link click or overlay click

### Auth Components (`src/components/auth/`)

#### `sign-in-form.tsx` — Client component
- Fetches `/api/auth/google` → gets `{ url }` → `window.location.href = url`
- Google "G" SVG icon + "Sign in with Google" text
- Amber border styling

#### `sign-out-button.tsx` — Client component
- `POST /api/auth/logout` → `router.push("/")` + `router.refresh()`

### Hooks (`src/hooks/`)

#### `use-session.ts`
- `SessionProvider` wraps authenticated layout, receives session from server
- `useSession()` returns `{ id, email, isAdmin }`
- Context-based, no fetching — server component loads and passes down

#### `use-chat.ts`
- Manages chat state machine: message array, streaming, session ID
- Uses `fetch` + `ReadableStream` (not EventSource — POST required)
- SSE line parser: accumulate chunks, split on `\n`, track `event:` and `data:` lines, dispatch on empty line

**Tool call state machine**:
1. `tool_start` → push `{ type: "tool", name, done: false }`
2. `tool_input` → find last incomplete tool block, set `input`
3. `tool_result` → find last incomplete tool block, set `done: true`
Between tool phases, `delta` events append to the last assistant block.

State: `sessionIdRef` (useRef, persists Claude session across turns), `blocks` (useState), `isStreaming` (useState), `abortControllerRef` (for cancellation).

#### `use-toast.ts`
- Re-exports `toast()` from `ui/toast.tsx` for convenience

---

## Step 10: Token Injector + Chat Service

### 10a. `src/lib/token-injector.ts`

Exports:
```typescript
function injectClientTokens(userId, agent, workspacePath, env): InjectionResult
function persistRefreshedTokens(userId, injection): void
```

`injectClientTokens`:
1. Query `getStmts().getClientTokens.all(userId)`
2. Filter by `agent.permissions` → `permittedIntegrations` set
3. Build `clientTokensFile` object: key `{integration}:client` → parsed credentials
4. Write `tokens.json` to workspace
5. Write `CLIENT_INTEGRATIONS.md` listing connected integrations with `--account client` instructions
6. Set `env.CLICLAW_TOKENS_PATH = tokensPath`
7. Return `{ tokensPath, connectedIntegrations }`

`persistRefreshedTokens`:
- Read `tokens.json` back from workspace
- Upsert any changed credentials back to `client_tokens` table
- Wrapped in try/catch — non-critical failure

### 10b. `src/lib/chat-service.ts`

Exports:
```typescript
type ChatSSEEvent =
  | { event: "delta"; data: string }
  | { event: "tool_start"; data: string }
  | { event: "tool_input"; data: string }
  | { event: "tool_result"; data: string }
  | { event: "session"; data: string }
  | { event: "result"; data: string }
  | { event: "error"; data: string };

async function* streamChat(opts: ChatOptions): AsyncGenerator<ChatSSEEvent>
```

Implementation:
1. Strip `CLAUDECODE` from env (prevents nested Claude detection)
2. Call `query()` from `@anthropic-ai/claude-agent-sdk`:
   ```typescript
   query({
     prompt: message,
     options: {
       cwd: workspacePath,
       env: cleanEnv,
       systemPrompt: { type: "preset", preset: "claude_code" },
       settingSources: ["project"],
       includePartialMessages: true,
       permissionMode: "bypassPermissions",
       model: "claude-sonnet-4-6",
       ...(sessionId ? { resume: sessionId } : {}),
     },
   })
   ```
3. `for await (const event of conversation)` — same event mapping as old server:
   - `stream_event` + `content_block_start` type `tool_use` → yield `tool_start`
   - `content_block_delta` + `text_delta` → yield `delta`
   - `content_block_delta` + `input_json_delta` → accumulate `currentToolInput`
   - `content_block_stop` with accumulated input → yield `tool_input`, reset
   - `tool_result` → yield `tool_result`
   - `result` → yield `session` then `result`
4. Check `signal?.aborted` each iteration for client disconnect
5. On error → yield `{ event: "error", data: err.message }`

**Key design**: Pure async generator with no HTTP awareness. Route Handler handles SSE encoding. Makes chat logic testable without HTTP.

---

## Step 11: API Routes

### 11a. `src/app/api/chat/[agentName]/route.ts` — POST: SSE streaming

```typescript
export const dynamic = "force-dynamic";
export const maxDuration = 300;
```

Flow:
1. `requireAuth()`, parse `{ message, sessionId }` from body
2. `checkAccess(user.id, agentName)` — 403 if no access
3. `AgentStore.get(agentName)` — 404 if not found
4. `AgentStore.clientWorkspacePath(agentName, user.id)` — get/create workspace
5. `injectClientTokens(userId, agent, workspace, env)`
6. Construct `ReadableStream`:
   ```typescript
   new ReadableStream({
     async start(controller) {
       const encoder = new TextEncoder();
       function send(event, data) {
         const encoded = data.split("\n").map(l => `data: ${l}`).join("\n");
         controller.enqueue(encoder.encode(`event: ${event}\n${encoded}\n\n`));
       }
       try {
         for await (const sseEvent of streamChat(opts)) {
           if (request.signal.aborted) break;
           send(sseEvent.event, sseEvent.data);
         }
       } finally {
         persistRefreshedTokens(user.id, injection);
         controller.close();
       }
     }
   })
   ```
7. Return `new Response(stream, { headers: { "Content-Type": "text/event-stream", ... } })`

**Client disconnect**: `request.signal` (AbortSignal) fires when client disconnects. `finally` block guarantees token persistence.

### 11b. `src/app/api/agents/route.ts` — GET: List accessible agents

- `requireAuth()`
- Query `getUserAccess(user.id)` → agent name set
- `AgentStore.list()` → filter by access set
- Return `{ agents: [{ name, displayName, role }] }`

### 11c. Integration Routes

#### `src/app/api/integrations/route.ts` — GET: List with status
- `requireAuth()`
- Query `getClientTokens(user.id)` → build connected map
- Map `INTEGRATIONS` → `{ id, displayName, connected, email }`

#### `src/app/api/integrations/connect/[integration]/route.ts` — GET: Initiate OAuth
- Validate integration exists in `INTEGRATIONS`
- Sign state with `createOAuthState({ userId, integration })`
- Build Google OAuth URL with integration-specific scopes
- Redirect to consent URL

#### `src/app/api/integrations/callback/route.ts` — GET: OAuth callback
- Verify HMAC state → extract `{ userId, integration }`
- Exchange code for tokens
- Fetch user email from Google
- `upsertClientToken(id, userId, integration, credentials, email)`
- Redirect to `/integrations?connected={name}`

#### `src/app/api/integrations/disconnect/[integration]/route.ts` — DELETE
- `requireAuth()`, validate integration
- `deleteClientToken(user.id, integration)`
- Return `{ ok: true }`

#### `src/app/api/integrations/agent/[agentName]/route.ts` — GET: Agent's required integrations
- Check access, load agent config
- Cross-reference `agent.permissions` with user's `client_tokens`
- Return `{ integrations: [{ id, displayName, connected, email }] }`
- Used by integration gate UI

### 11d. Admin Routes

#### `src/app/api/admin/stats/route.ts` — GET
- `requireAdmin()`
- Query stat counts (users, sessions, cost, access grants)
- Load agent count from `AgentStore.list()`
- Return `{ totalUsers, totalAgents, totalSessions, totalCostUsd }`

#### `src/app/api/admin/access/route.ts` — GET/POST/DELETE
- All methods: `requireAdmin()`
- GET: `listAccess()` — all grants with user emails
- POST `{ email, agentName }`: find-or-create user, `grantAccess(id, userId, agentName, adminId)`
- DELETE `{ userId, agentName }`: `revokeAccess(userId, agentName)`

---

## Step 12: Pages + Feature Components

### Pages

#### `src/app/page.tsx` — Sign-in (Server Component)
- Full-screen centered, NO sidebar (outside authenticated route group)
- "cliclaw" logo text in amber + "AI Agent Portal" subtitle
- `<SignInForm />`
- Reads `searchParams.error` → shows error message
- If already authed (middleware redirects, but defense-in-depth): `redirect("/agents")`

#### `src/app/(authenticated)/layout.tsx` — App shell (Server Component)
- Calls `getSession()` — redirects to `/` if null
- Determines `isAdmin(user.email)`
- Renders `<SessionProvider session={...}>` → `<AppShell>` → `<ToastProvider />` → `{children}`

#### `src/app/(authenticated)/agents/page.tsx` — Agent list (Server Component)
- `requireAuth()`
- Query accessible agents (same logic as `/api/agents`)
- Renders `<Header title="Agents" />` + `<AgentGrid agents={...} />`
- Empty state when no agents assigned

#### `src/app/(authenticated)/chat/[agentName]/page.tsx` — Chat (Server Component wrapper)
- `requireAuth()`, check access, load agent config
- Fetch integration status for this agent
- If missing required integrations → render `<IntegrationGate missing={...} />`
- Otherwise → render `<ChatContainer agentName={...} displayName={...} />`

#### `src/app/(authenticated)/integrations/page.tsx` — Integrations (Server Component)
- `requireAuth()`
- Load all integrations + connection status
- Renders `<IntegrationGrid initialIntegrations={...} />`
- Reads `searchParams.connected` for success toast

#### `src/app/(authenticated)/admin/layout.tsx` — Admin guard (Server Component)
- `requireAdmin()` — redirects to `/agents` if not admin

#### `src/app/(authenticated)/admin/page.tsx` — Admin dashboard (Server Component)
- Load stats + access list + agent list
- Renders `<AdminOverview stats={...} />` + `<AccessManager initialAccess={...} agents={...} />`

### Feature Components

#### Agent Components (`src/components/agents/`)

**`agent-card.tsx`** — Server Component
- Props: `{ agent: { name, displayName, role } }`
- Wraps in `<Link href="/chat/{name}">`
- `bg-card border border-border hover:border-amber/30 group`
- Display name: `group-hover:text-amber`
- Role: `text-xs text-muted-foreground line-clamp-2`

**`agent-grid.tsx`** — Server Component
- `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`
- Empty state centered text

#### Chat Components (`src/components/chat/`)

**`chat-container.tsx`** — Client Component
- Uses `useChat(agentName)` hook
- Layout: `flex flex-col flex-1 min-h-0`
- Empty state: centered "{displayName}" prompt
- Renders `<MessageList>` + `<ChatInput>`

**`message-list.tsx`** — Client Component
- Scrollable area with auto-scroll on new blocks
- Maps blocks → `<MessageBubble>` or `<ToolCallIndicator>`

**`message-bubble.tsx`** — Client Component
- User: right-aligned, `bg-amber/10 border-amber/20`
- Assistant: left-aligned, `bg-card border-border`, agent name label, `<MarkdownRenderer>`, streaming cursor when active, thinking dots when empty+streaming

**`tool-call-indicator.tsx`** — Client Component
- `bg-black/20 border-border/50`
- Glow-pulse dot (active) or checkmark SVG (done)
- `formatToolInput()`: shows file paths for Read, patterns for Glob/Grep

**`chat-input.tsx`** — Client Component
- Form: Clear button (when has messages) + text input + Send button
- All disabled during streaming

**`markdown-renderer.tsx`** — Client Component
- `react-markdown` + `remarkGfm`
- Extensive prose styling: `prose-code:text-amber/80 prose-code:bg-amber/5 prose-strong:text-amber/90`

#### Integration Components (`src/components/integrations/`)

**`integration-card.tsx`** — Client Component
- Status dot (green/gray) + name + email + Connect/Disconnect button
- Connect: fetches OAuth URL, redirects
- Disconnect: DELETE request, updates state

**`integration-grid.tsx`** — Client Component
- `space-y-3` layout
- Manages integration state, handles connect/disconnect callbacks
- Connected count header

**`integration-gate.tsx`** — Client Component
- Full-height centered blocker
- Lists missing integrations
- CTA: `<Link href="/integrations">`

#### Admin Components (`src/components/admin/`)

**`admin-overview.tsx`** — Server Component
- `grid gap-4 sm:grid-cols-2 lg:grid-cols-4`
- Stat cards: Users, Agents, Sessions, Total Cost

**`access-manager.tsx`** — Client Component
- Grant form: email input + agent name select + "Grant" button
- Access table: email, agent, granted date, revoke button
- Uses `router.refresh()` after mutations

---

## File Inventory (53 files)

### Config/Scaffold (6 files)
```
pnpm-workspace.yaml                    (modify)
packages/auth/src/config.ts            (modify — 1 line change)
apps/portal/package.json               (create)
apps/portal/tsconfig.json              (create)
apps/portal/next.config.ts             (create)
apps/portal/postcss.config.mjs         (create)
apps/portal/.env.example               (create)
```

### Database (4 files)
```
apps/portal/migrations/001_initial.sql
apps/portal/src/lib/db.ts
apps/portal/src/lib/db-migrations.ts
apps/portal/src/lib/db-statements.ts
```

### Foundation (3 files)
```
apps/portal/src/lib/constants.ts
apps/portal/src/lib/errors.ts
apps/portal/src/lib/types.ts
```

### Auth (4 files)
```
apps/portal/src/lib/session.ts
apps/portal/src/lib/auth.ts
apps/portal/src/middleware.ts
```

### Auth Routes (4 files)
```
apps/portal/src/app/api/auth/google/route.ts
apps/portal/src/app/api/auth/callback/route.ts
apps/portal/src/app/auth/session/route.ts
apps/portal/src/app/api/auth/logout/route.ts
```

### Design System (2 files)
```
apps/portal/src/app/globals.css
apps/portal/src/app/layout.tsx
```

### UI Primitives (8 files)
```
apps/portal/src/components/ui/button.tsx
apps/portal/src/components/ui/input.tsx
apps/portal/src/components/ui/card.tsx
apps/portal/src/components/ui/badge.tsx
apps/portal/src/components/ui/table.tsx
apps/portal/src/components/ui/spinner.tsx
apps/portal/src/components/ui/toast.tsx
apps/portal/src/components/ui/dialog.tsx
```

### Layout (4 files)
```
apps/portal/src/components/layout/app-shell.tsx
apps/portal/src/components/layout/nav-sidebar.tsx
apps/portal/src/components/layout/header.tsx
apps/portal/src/components/layout/mobile-nav.tsx
```

### Hooks (3 files)
```
apps/portal/src/hooks/use-session.ts
apps/portal/src/hooks/use-chat.ts
apps/portal/src/hooks/use-toast.ts
```

### Chat + Token System (2 files)
```
apps/portal/src/lib/token-injector.ts
apps/portal/src/lib/chat-service.ts
```

### API Routes (8 files)
```
apps/portal/src/app/api/chat/[agentName]/route.ts
apps/portal/src/app/api/agents/route.ts
apps/portal/src/app/api/integrations/route.ts
apps/portal/src/app/api/integrations/connect/[integration]/route.ts
apps/portal/src/app/api/integrations/callback/route.ts
apps/portal/src/app/api/integrations/disconnect/[integration]/route.ts
apps/portal/src/app/api/integrations/agent/[agentName]/route.ts
apps/portal/src/app/api/admin/stats/route.ts
apps/portal/src/app/api/admin/access/route.ts
```

### Auth Components (2 files)
```
apps/portal/src/components/auth/sign-in-form.tsx
apps/portal/src/components/auth/sign-out-button.tsx
```

### Feature Components (13 files)
```
apps/portal/src/components/agents/agent-card.tsx
apps/portal/src/components/agents/agent-grid.tsx
apps/portal/src/components/chat/chat-container.tsx
apps/portal/src/components/chat/message-list.tsx
apps/portal/src/components/chat/message-bubble.tsx
apps/portal/src/components/chat/tool-call-indicator.tsx
apps/portal/src/components/chat/chat-input.tsx
apps/portal/src/components/chat/markdown-renderer.tsx
apps/portal/src/components/integrations/integration-card.tsx
apps/portal/src/components/integrations/integration-grid.tsx
apps/portal/src/components/integrations/integration-gate.tsx
apps/portal/src/components/admin/admin-overview.tsx
apps/portal/src/components/admin/access-manager.tsx
```

### Pages (7 files)
```
apps/portal/src/app/page.tsx
apps/portal/src/app/(authenticated)/layout.tsx
apps/portal/src/app/(authenticated)/agents/page.tsx
apps/portal/src/app/(authenticated)/chat/[agentName]/page.tsx
apps/portal/src/app/(authenticated)/integrations/page.tsx
apps/portal/src/app/(authenticated)/admin/layout.tsx
apps/portal/src/app/(authenticated)/admin/page.tsx
```

---

## Key Architectural Decisions

1. **`globalThis` singleton for SQLite**: Survives Next.js HMR in dev. Standard pattern (Prisma docs recommend same).

2. **`process.cwd()` for migration paths**: webpack bundles `src/` files, so `import.meta.dirname` would resolve to `.next/server/`. Migrations live at `apps/portal/migrations/` (outside `src/`) and are located via `process.cwd()`.

3. **Middleware: cookie-only check**: No DB access in middleware (Edge Runtime can't load native modules). Cookie presence is the gate; validity is checked in Route Handlers.

4. **HMAC state tokens**: Stateless CSRF protection for OAuth. `timestamp.hmac` format — no DB storage needed. 10-minute TTL, `timingSafeEqual` verification.

5. **Async generator for chat**: `streamChat()` yields `ChatSSEEvent` with no HTTP awareness. Route Handler wraps it in `ReadableStream` with `TextEncoder`. Separation enables testing without HTTP.

6. **Direct cookie set in callback**: Old flow exposed token in URL (`/auth/session?token=xxx`). New flow sets cookie in the OAuth callback redirect — token never appears in browser history.

7. **Server Components for data, Client Components for interactivity**: Agent cards, grids, admin stats are server-rendered. Chat, integration management, access manager are client components with state.

---

## Verification

### Phase 1 MVP Checklist
1. `pnpm install` succeeds from root
2. `pnpm build` succeeds for `@cliclaw/auth` and `@cliclaw/portal`
3. `pnpm dev` (in `apps/portal`) starts on port 3000
4. Google OAuth sign-in flow works end-to-end
5. Middleware redirects unauthenticated users to sign-in
6. Authenticated user sees accessible agents
7. Chat streams responses with tool call visualization
8. Integration connect/disconnect flow works
9. Integration gate blocks chat when missing required integrations
10. Admin panel: view stats, grant/revoke access
11. Non-admin users cannot access `/admin/*`

---

## Future Phases (Reference Only)

### Phase 2: Cloud Deployment
- Dockerfile (multi-stage), docker-compose.yml, Caddy reverse proxy, GitHub Actions CI/CD, health endpoint

### Phase 3: Universal Integrations
- Extensible auth types (OAuth, API token, session credential), new integrations (GitHub, Framer, Slack)

### Phase 4: SaaS Platform
- Audit log, usage tracking, invite system, enhanced admin pages

### Phase 5: Advanced
- Cron integration in Next.js process, webhook event triggers, SSE heartbeat
