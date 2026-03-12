# Add Integration

Add a new integration to cliclaw. The user will provide the integration name and auth type. Scaffold everything needed across all three packages.

## Input

Ask the user for:
1. **Integration name** (e.g., "instagram", "linkedin", "slack", "notion") — lowercase, used as directory/command names
2. **Auth type** — one of:
   - `oauth` — Full OAuth2 flow (like Gmail: Google, GitHub, Slack, etc.)
   - `session` — Browser session token pasted by user (like Instagram, LinkedIn)
   - `apikey` — Static API key (like OpenAI, Notion)
3. **Display name** — Human-readable (e.g., "Instagram", "LinkedIn", "Slack")
4. **Description** — Short phrase (e.g., "Browse feed, send DMs, manage posts")
5. **Base URL** — API base URL if known (e.g., `https://api.github.com`)

## Architecture Reference

The Gmail integration serves as the canonical pattern. All integrations follow the same structure:

```
packages/auth/src/{name}-auth.ts       Auth helpers (create client, scopes, etc.)
packages/auth/src/index.ts             Re-export new auth module
packages/cliclaw/src/{name}/           CLI command handlers
packages/cliclaw/src/commands/{name}.ts CLI command registration
packages/cliclaw/src/cli.ts            Register new commands
apps/dashboard/src/app/{name}/page.tsx  Dashboard page
apps/dashboard/src/app/api/oauth/{name}/route.ts  (oauth only)
apps/dashboard/src/app/page.tsx         Add card to overview
```

Shared token storage: `~/.cliclaw/tokens.json` — all integrations share the same file, keyed by `{integration}:{account}` (e.g., `instagram:personal`). Gmail currently uses bare account names for backwards compatibility, but new integrations MUST use the prefixed format.

## Step-by-step Scaffolding

### 1. `packages/auth/src/{name}-auth.ts`

Create auth helpers based on auth type:

**For `oauth` type:**
```typescript
import { readFileSync } from "fs";
// Create OAuth client, define scopes, generate auth URL
// Follow gmail-auth.ts pattern but with service-specific scopes and client creation
export function create{Name}OAuthClient(clientSecretPath: string, redirectUri: string): OAuth2Client { ... }
export function get{Name}AuthUrl(client: OAuth2Client): string { ... }
```

**For `session` type:**
```typescript
// Session-based auth: user provides a token/cookie string
export interface {Name}Session {
  token: string;
  // any other session fields
}
export function create{Name}Client(session: {Name}Session): { headers: Record<string, string>; baseUrl: string } {
  return {
    headers: { Authorization: `Bearer ${session.token}` },  // or Cookie, or custom header
    baseUrl: "https://api.example.com",
  };
}
```

**For `apikey` type:**
```typescript
export interface {Name}ApiKey {
  key: string;
}
export function create{Name}Client(apiKey: {Name}ApiKey): { headers: Record<string, string>; baseUrl: string } {
  return {
    headers: { Authorization: `Bearer ${apiKey.key}` },
    baseUrl: "https://api.example.com",
  };
}
```

### 2. Update `packages/auth/src/index.ts`

Add barrel export for the new auth module.

### 3. `packages/cliclaw/src/{name}/auth.ts`

CLI auth handler:
- **oauth**: Follow `gmail/auth.ts` — open browser, wait for callback, save tokens
- **session**: Prompt user to paste their token, validate it, save to token store
- **apikey**: Prompt user for API key, validate, save to token store

Token store key format for new integrations: `{name}:{account}` (e.g., `instagram:personal`)

### 4. `packages/cliclaw/src/{name}/accounts.ts`

List accounts handler — filter token store keys by `{name}:` prefix, fetch profile info if possible.

### 5. `packages/cliclaw/src/{name}/` — Additional command handlers

Create placeholder handlers for the integration's core operations. Ask the user what commands they want, or scaffold sensible defaults:
- For social media: `feed`, `profile`, `post`, `dm`
- For messaging: `channels`, `messages`, `send`
- For productivity: `list`, `get`, `create`, `update`

Each handler follows the pattern:
```typescript
import type { OAuthClientManager } from "@cliclaw/auth";
// or for session/apikey: import the token store directly
import { outputJson, outputError, outputAuthRequired } from "../lib/output.js";

export async function handle{Command}(clientManager: OAuthClientManager, account: string, ...args): Promise<void> {
  const client = clientManager.getClient(`{name}:${account}`);
  // ... API calls, output JSON
}
```

### 6. `packages/cliclaw/src/commands/{name}.ts`

Register commands under `program.command("{name}")`:
- `{name} auth --account <name>` — authenticate
- `{name} accounts` — list accounts
- Plus all operation commands from step 5

Follow `commands/gmail.ts` pattern exactly — factory function, cached resolution.

### 7. Update `packages/cliclaw/src/cli.ts`

Import and register the new command module:
```typescript
import { register{Name}Commands } from "./commands/{name}.js";
register{Name}Commands(program, getClientManager);
```

### 8. `apps/dashboard/src/app/{name}/page.tsx`

Dashboard page for the integration — server component that:
- Lists authenticated accounts (filtered by `{name}:` prefix from token store)
- Shows account details (name, profile info if available)
- Add/remove account actions
- For session/apikey: "Add Account" opens an inline form instead of OAuth redirect

### 9. `apps/dashboard/src/app/api/oauth/{name}/route.ts` (oauth type only)

OAuth start route — same pattern as Gmail:
- Accept `?account=NAME`
- Set `oauth_account` cookie with `{name}:{account}` value
- Generate auth URL and redirect

### 10. Update `apps/dashboard/src/app/page.tsx`

Add an IntegrationCard for the new integration on the overview page.

### 11. Update `apps/dashboard/src/app/api/oauth/callback/route.ts` (oauth type only)

The existing callback route may need to be generalized if the new OAuth integration uses a different token exchange mechanism. Check if the existing callback can handle the new integration or if a separate callback is needed.

## Config changes

If the new integration requires its own credentials file (like `client_secret.json` for Google), update:
- `packages/auth/src/config.ts` — add optional field to `CliclawConfig` interface
- Document the config field in the auth handler's error message

## After scaffolding

1. Run `pnpm build` to verify all packages compile
2. Run `pnpm --filter @cliclaw/cli test` to verify existing tests still pass
3. Start `pnpm --filter @cliclaw/dashboard dev` and verify the new integration card appears
4. Commit incrementally after each working milestone

## Important conventions

- All JSON output uses `outputJson()` / `outputError()` / `outputAuthRequired()` from `lib/output.ts`
- CLI commands use commander with `--account <name>` option defaulting to `"default"`
- Token store keys for new integrations: `{name}:{account}` (never bare account names)
- Dashboard pages are server components; interactive parts are client components
- Dashboard uses Terminal Noir theme — dark charcoal, amber accents, monospace labels, sharp edges
- Follow existing shadcn component usage (Card, Button, Input, Badge, Separator)
