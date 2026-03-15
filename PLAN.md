# Session-Based Auth via Remote Browser

## Problem

Many platforms (Instagram, LinkedIn, Slack, Twitter, Reddit, etc.) either lack usable OAuth APIs or restrict them to business accounts. Session-based auth — using the same cookies a logged-in browser has — unlocks full access to any platform. But extracting cookies is a terrible UX for non-technical users.

## Solution

Build a **generic remote browser session capture** system into the portal. The user clicks "Connect", sees a live browser viewport in a modal, logs into the service normally (including 2FA), and the portal captures session cookies automatically. It looks and feels like OAuth.

## User Flow

```
Integrations Page
├── Gmail ✅ (OAuth)
├── Instagram — [Connect]
│   └── Modal opens with live browser viewport
│       └── User sees real instagram.com login page
│       └── Types credentials, handles 2FA normally
│       └── Portal detects successful login
│       └── "Connected as @username" ✅ — modal closes
├── LinkedIn — [Connect]  (same flow)
├── Slack — [Connect]     (same flow)
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Portal UI                                       │
│  ┌───────────────────────────────────────┐       │
│  │  <canvas>                             │       │
│  │  Live browser viewport streamed       │       │
│  │  via WebSocket (~5-10 fps JPEG)       │       │
│  │                                       │       │
│  │  Mouse/keyboard events → WS →        │       │
│  └───────────────────────────────────────┘       │
└──────────────┬───────────────────────────────────┘
               │ WebSocket
┌──────────────▼───────────────────────────────────┐
│  Browser Session Service (Node + Playwright)      │
│                                                   │
│  Per connection:                                  │
│  ├── Spawns Chromium via Playwright               │
│  ├── Navigates to target login URL                │
│  ├── Streams viewport via CDP screencast          │
│  ├── Forwards input events from client            │
│  ├── Watches cookies for login success            │
│  └── On success: extracts cookies → stores        │
│                                                   │
│  Limits: max 5 concurrent, 5 min timeout          │
│  Each browser gets a fresh profile (isolation)    │
└───────────────────────────────────────────────────┘
```

## Integration Registry Extension

New `authType: "session"` with a `sessionConfig` block. Adding a new session-based integration becomes ~15 lines of config:

```typescript
// packages/auth/src/integration-registry.ts

instagram: {
  id: "instagram",
  displayName: "Instagram",
  authType: "session",
  sessionConfig: {
    loginUrl: "https://www.instagram.com/accounts/login/",
    domain: "instagram.com",
    successIndicators: {
      cookies: ["sessionid"],             // these cookies must be present
      urlPattern: /instagram\.com\/?$/,   // URL after successful login
    },
    extractCookies: ["sessionid", "csrftoken", "ds_user_id", "ig_did", "mid"],
    userIdentifier: async (cookies) => {
      // fetch username from Instagram private API using captured cookies
    },
  },
},

linkedin: {
  id: "linkedin",
  displayName: "LinkedIn",
  authType: "session",
  sessionConfig: {
    loginUrl: "https://www.linkedin.com/login",
    domain: "linkedin.com",
    successIndicators: {
      cookies: ["li_at"],
      urlPattern: /linkedin\.com\/feed/,
    },
    extractCookies: ["li_at", "JSESSIONID", "li_rm"],
    userIdentifier: async (cookies) => { /* fetch profile name */ },
  },
},
```

## Key Components to Build

### 1. Browser Session Service

Standalone Node server using Playwright, deployed alongside the portal:

- **Input**: WebSocket connection with `{integration, userId}`
- **Process**: Launch Chromium → navigate to `loginUrl` → stream via CDP `Page.screencastFrame` → forward mouse/keyboard → watch for `successIndicators`
- **Output**: On login success, extract cookies and call `upsertClientToken`
- **Cleanup**: Auto-kill browser after 5 min timeout

Resource budget: ~100-150MB per Chromium instance, 5 concurrent = ~750MB max.

### 2. `<SessionCaptureModal>` (Portal UI)

Reusable React component used by every session-based integration:

```tsx
<SessionCaptureModal
  integration="instagram"
  onConnected={(account) => { /* refresh status */ }}
  onCancel={() => { /* close */ }}
/>
```

- Renders a `<canvas>` element sized to browser viewport
- Connects to WS endpoint, draws incoming JPEG frames
- Captures mouse clicks/moves/keyboard and sends over WS
- Shows loading state while browser spins up
- Shows success state when login detected

### 3. Portal API Route

`/api/integrations/session/[integration]` — initiates a browser session, returns the WebSocket URL for the client to connect to.

### 4. Session Health Check

Generic endpoint per integration to verify a stored session is still valid:

- `GET /api/integrations/status/[integration]`
- Makes a lightweight authenticated request to the target service
- Returns `{ valid: boolean, username: string }`
- Portal UI shows warning badge when session expires, prompts reconnection

### 5. Integration Card Updates

Extend `integration-card.tsx` to handle `authType: "session"`:

- "Connect" button opens `<SessionCaptureModal>` instead of OAuth redirect or token paste
- Shows session expiry warning when health check fails
- Same disconnect/rename flow as other auth types

## What Stays the Same

Everything downstream of token storage is unchanged:

- **Token storage** → `client_tokens` table (AES-256-GCM encrypted)
- **Token injection** → `token-injector.ts` writes cookies to container
- **Agent access** → `ScopedClientManager` permission checks
- **CLI commands** → `cliclaw instagram ...` reads from `CLICLAW_TOKENS_PATH`
- **Integration gate** → same component, checks if token exists

## Token Storage Format

Session cookies stored in the same `client_tokens` table as OAuth tokens:

```json
{
  "instagram:default": {
    "access_token": "<sessionid value>",
    "csrf_token": "<csrftoken value>",
    "ds_user_id": "12345678",
    "user_agent": "Mozilla/5.0 ...",
    "connected_at": "2026-03-15T..."
  }
}
```

## Implementation Phases

| Phase | Work | Outcome |
|-------|------|---------|
| **1** | Playwright WS service (CDP screencast + input forwarding) | Core remote browser infra |
| **2** | `authType: "session"` + `sessionConfig` in registry | Declarative integration definitions |
| **3** | `<SessionCaptureModal>` portal component | Reusable UI for all session integrations |
| **4** | Portal API route for session initiation | Connects UI to browser service |
| **5** | Cookie extraction → `upsertClientToken` on success | Stores sessions like any other token |
| **6** | Session health check endpoint | Detects expired sessions |
| **7** | Instagram as first integration (config + CLI commands) | End-to-end proof of concept |
| **8** | LinkedIn, Slack, etc. | Just config — no new code needed |

## Instagram CLI Commands (Phase 7)

New command group `cliclaw instagram` (same pattern as `cliclaw gmail`):

```
cliclaw instagram profile [username]     # Get profile info
cliclaw instagram feed [--count N]       # Get feed posts
cliclaw instagram post --image <path> --caption "..."
cliclaw instagram story --image <path>
cliclaw instagram dm send --to <user> --message "..."
cliclaw instagram dm inbox
cliclaw instagram follow/unfollow <user>
cliclaw instagram search <query>
cliclaw instagram comments <post-id>
```

Under the hood, HTTP requests to `i.instagram.com/api/v1/` with session cookies:

```
Cookie: sessionid=...; csrftoken=...
X-CSRFToken: ...
User-Agent: Instagram 275.0.0.27.98 Android (...)
```

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Session expiry (Instagram ~90 days) | Health check + portal UI warning to reconnect |
| Rate limiting / bot detection | Use realistic User-Agent, respect rate limits |
| 2FA / captcha during login | Works naturally — user handles it in the live browser view |
| Chromium resource usage | Concurrency cap (5), timeout (5 min), fresh profile per session |
| Service login page changes | Login URL + success indicators are config — easy to update |
| Multiple concurrent users | Browser instance pool with queue when at capacity |

## Service Directory

Potential session-based integrations beyond Instagram:

| Service | Login URL | Key Cookie | Session Duration |
|---------|-----------|------------|-----------------|
| Instagram | instagram.com/accounts/login | `sessionid` | ~90 days |
| LinkedIn | linkedin.com/login | `li_at` | ~1 year |
| Twitter/X | x.com/login | `auth_token` | ~5 years |
| Reddit | reddit.com/login | `reddit_session` | ~1 year |
| Slack | slack.com/signin | `d` | ~30 days |
| Facebook | facebook.com/login | `c_user` + `xs` | ~90 days |
| TikTok | tiktok.com/login | `sessionid` | ~30 days |
| Pinterest | pinterest.com/login | `_pinterest_sess` | ~1 year |
