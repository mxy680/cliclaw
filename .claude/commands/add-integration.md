# Add Integration

Add a new integration to cliclaw. Walk through a checklist to gather requirements, scaffold code across all packages, and write integration tests.

## Checklist

Work through each item in order. Do NOT skip steps. Check off each item as you complete it.

### Phase 1: Requirements Gathering

- [ ] **1. Ask: Integration name** — lowercase slug used for directories, commands, and token prefixes (e.g., `instagram`, `linkedin`, `slack`, `notion`, `github`)
- [ ] **2. Ask: Auth type** — one of:
  - `oauth` — Full OAuth2 flow (Google, GitHub, Slack, Spotify, etc.)
  - `session` — Browser session/cookie token pasted by user (Instagram, LinkedIn, etc.)
  - `apikey` — Static API key or personal access token (OpenAI, Notion, GitHub PAT, etc.)
- [ ] **3. Ask: Display name** — human-readable (e.g., "Instagram", "LinkedIn")
- [ ] **4. Ask: Description** — short phrase (e.g., "Browse feed, send DMs, manage posts")
- [ ] **5. Ask: Base URL** — API base URL (e.g., `https://api.github.com`, `https://api.slack.com`)
- [ ] **6. Ask: What tools to include** — Present a comprehensive list of suggested tools based on the integration type. Research the API and suggest as many useful tools as possible. Group them by category. For example:

  **For a social media integration (Instagram, LinkedIn, Twitter):**
  - **Feed**: `feed` (view timeline), `search` (search posts/users)
  - **Posts**: `post` (create), `delete-post`, `like`, `unlike`, `repost`/`share`
  - **Comments**: `comments` (list), `comment` (add), `delete-comment`
  - **Profile**: `profile` (view own), `user` (view other), `followers`, `following`, `follow`, `unfollow`
  - **Messaging**: `dm-list` (conversations), `dm-get` (thread), `dm-send`
  - **Stories/Media**: `stories`, `upload-media`
  - **Notifications**: `notifications`

  **For a messaging integration (Slack, Discord, Teams):**
  - **Channels**: `channels`, `channel-info`, `channel-create`, `channel-join`, `channel-leave`
  - **Messages**: `messages` (list), `send`, `reply`, `edit-message`, `delete-message`, `react`
  - **Threads**: `thread` (get replies)
  - **Users**: `users`, `user-info`, `presence`/`status`, `set-status`
  - **Search**: `search`
  - **Files**: `upload-file`, `files`

  **For a productivity integration (Notion, Linear, Jira, GitHub):**
  - **Items**: `list`, `get`, `create`, `update`, `delete`
  - **Search**: `search`
  - **Comments**: `comments`, `comment`
  - **Labels/Tags**: `labels`, `add-label`, `remove-label`
  - **Assignments**: `assign`, `unassign`
  - **Attachments**: `attachments`, `upload`

  **For an email/calendar integration (Outlook, CalDAV):**
  - **Messages**: `inbox`, `search`, `get`, `send`, `reply`, `forward`, `trash`, `archive`
  - **Drafts**: `drafts-list`, `draft-create`, `draft-update`, `draft-delete`, `draft-send`
  - **Labels/Folders**: `labels`, `label-create`, `label-delete`, `move`
  - **Calendar**: `events`, `event-get`, `event-create`, `event-update`, `event-delete`
  - **Contacts**: `contacts`, `contact-get`

  **For a cloud storage integration (Google Drive, Dropbox, S3):**
  - **Files**: `list`, `get`, `upload`, `download`, `delete`, `move`, `copy`
  - **Folders**: `mkdir`, `list-folder`
  - **Sharing**: `share`, `unshare`, `permissions`
  - **Search**: `search`

  Present ALL relevant suggestions, let the user pick which ones to include, and confirm the final list before proceeding.

- [ ] **7. Confirm plan** — Summarize everything back to the user and get approval before scaffolding.

### Phase 2: Auth Layer (`packages/auth/`)

- [ ] **8. Create `packages/auth/src/{name}-auth.ts`** — Auth helpers based on type:
  - `oauth`: `create{Name}OAuthClient(clientSecretPath, redirectUri)` + `get{Name}AuthUrl(client)` with appropriate scopes
  - `session`: `{Name}Session` interface + `create{Name}Client(session)` returning `{ headers, baseUrl }`
  - `apikey`: `{Name}ApiKey` interface + `create{Name}Client(apiKey)` returning `{ headers, baseUrl }`
- [ ] **9. Update `packages/auth/src/index.ts`** — Add barrel export for the new module
- [ ] **10. If `oauth` and needs its own credentials**: Update `CliclawConfig` in `packages/auth/src/config.ts` with optional field
- [ ] **11. `pnpm build` passes** — Verify auth package compiles

### Phase 3: CLI Commands (`packages/cliclaw/`)

- [ ] **12. Create `packages/cliclaw/src/{name}/auth.ts`** — Auth handler:
  - `oauth`: Open browser → wait for callback → save tokens (follow `gmail/auth.ts`)
  - `session`: Read token from stdin/argument → validate → save to token store
  - `apikey`: Read key from stdin/argument → validate → save to token store
  - Token key format: `{name}:{account}` (e.g., `slack:work`)
- [ ] **13. Create `packages/cliclaw/src/{name}/accounts.ts`** — List accounts filtered by `{name}:` prefix, fetch profile info
- [ ] **14. Create handler files for each tool** — One file per logical group (e.g., `messages.ts`, `channels.ts`, `posts.ts`). Each handler:
  - Takes `clientManager`/`tokenStore` + `account` + tool-specific args
  - Makes API calls
  - Outputs JSON via `outputJson()` / `outputError()` / `outputAuthRequired()`
- [ ] **15. Create `packages/cliclaw/src/commands/{name}.ts`** — Register all commands under `program.command("{name}")`:
  - `{name} auth --account <name>` — authenticate
  - `{name} accounts` — list accounts
  - One command per tool from the agreed list
  - Follow `commands/gmail.ts` pattern: factory function, cached resolution
- [ ] **16. Update `packages/cliclaw/src/cli.ts`** — Import and register: `register{Name}Commands(program, getClientManager)`
- [ ] **17. `pnpm build` passes** — Verify CLI package compiles
- [ ] **18. Commit** — "Add {name} CLI integration with {N} tools"

### Phase 4: Integration Tests

- [ ] **19. Ask user to authenticate a default account** — Before writing tests, the integration needs a real authenticated account. Ask the user to run the auth command in their terminal:
  ```
  cliclaw {name} auth --account default
  ```
  This opens a browser for OAuth (or prompts for session/apikey). Wait for the user to confirm authentication succeeded before proceeding. If the integration uses OAuth, remind them they need `~/.cliclaw/client_secret.json` configured. Verify tokens exist by running:
  ```
  cliclaw {name} accounts
  ```
  If accounts come back empty or with an error, troubleshoot with the user (wrong scopes, missing client secret, expired token, etc.) before moving on. Tests hit real APIs — they will all fail without valid credentials.
- [ ] **20. Create `packages/cliclaw/src/__tests__/{name}.integration.test.ts`** — Follow the Gmail/Drive/Sheets/Slides/Calendar test patterns exactly:
  - Use `describe.sequential` since tests share state
  - Shared `run()` helper that invokes the built CLI via `execFile`
  - `parseJson()` helper to parse stdout
  - Test every tool that was implemented:
    - `accounts` — returns list with at least one account
    - `auth` — skip (requires interactive browser)
    - Each read operation — verify returns expected shape
    - Each write operation — verify creates/modifies/deletes and returns success
    - Chain tests that depend on each other (create → get → update → delete)
    - Clean up any test data at the end (trash, delete, etc.)
  - Set appropriate timeouts for API-heavy tests
  - Use timestamps in test data names to avoid collisions (`` `cliclaw-test-${Date.now()}` ``)
  - If a command requires scopes the integration doesn't have, test it as an expected failure (see Calendar's `calendars` test for the pattern)
- [ ] **21. Build before testing** — Run `pnpm build` to ensure `dist/cli.js` is up to date (tests invoke the built binary, not source)
- [ ] **22. `pnpm --filter @digitalpresence/cliclaw test` passes** — ALL tests pass (existing integrations and new integration)
- [ ] **23. Commit** — "Add {name} integration tests"

### Phase 5: Portal Integration Registry

For OAuth integrations that need to work through the portal (not just CLI), register them in the portal's integration system.

- [ ] **24. Add provider to `packages/auth/src/integration-registry.ts`** — If the integration uses a new OAuth provider (not Google), add a `PROVIDERS` entry:
  ```typescript
  {name}: {
    authUrl: "https://...",
    tokenUrl: "https://...",
    userInfoUrl: "https://...",
    clientIdEnv: "{NAME}_CLIENT_ID",
    clientSecretEnv: "{NAME}_CLIENT_SECRET",
    extraScopes: [],
    extraAuthParams: {},
  }
  ```
- [ ] **25. Add integration to `INTEGRATIONS` in the same file** — Add the integration definition:
  ```typescript
  {name}: {
    id: "{name}",
    displayName: "{Display Name}",
    provider: "{provider}",  // e.g., "github", "google", "slack"
    scopes: ["scope1", "scope2"],
  }
  ```
- [ ] **26. Handle provider-specific OAuth callback quirks** — Check `apps/portal/src/app/api/integrations/callback/route.ts`. Different providers have different token exchange and user info patterns:
  - **Google**: Standard OAuth2 with `access_type=offline`, returns email in userinfo
  - **GitHub**: Token exchange returns `application/x-www-form-urlencoded` by default (must send `Accept: application/json`), email may need separate `/user/emails` API call
  - **Other providers**: May need custom token exchange headers, different userinfo endpoints, or different email resolution logic
  - If the callback route doesn't handle the new provider's quirks, update it
- [ ] **27. Update `.env.example`** — Add the new env vars:
  ```
  {NAME}_CLIENT_ID=
  {NAME}_CLIENT_SECRET=
  ```
- [ ] **28. `pnpm build` passes** — Verify portal and auth packages compile with new registry entries
- [ ] **29. Commit** — "Add {name} to portal integration registry"

### Phase 6: Final Verification (Development)

- [ ] **30. Full build**: `pnpm build` — all packages compile
- [ ] **31. All tests**: `pnpm --filter @digitalpresence/cliclaw test` — all integration tests pass
- [ ] **32. Test portal integration page** — Start the dev portal (`cd apps/portal && pnpm dev`), go to `/integrations`, verify the new integration appears and the OAuth connect flow works with dev credentials
- [ ] **33. Commit** if any remaining changes

### Phase 7: Production Deployment

This phase is CRITICAL and must not be skipped. Without it, the integration only works locally.

#### 7a. OAuth App Setup (for OAuth integrations)

- [ ] **34. Create production OAuth app** — Most OAuth providers require separate dev and prod apps because callback URLs differ:
  - **Dev callback**: `http://localhost:3000/api/integrations/callback`
  - **Prod callback**: `https://agents.markshteyn.com/api/integrations/callback`
  - Create a new OAuth app on the provider's developer portal with the production callback URL
  - Save the production client ID and secret

#### 7b. Add Production Environment Variables

- [ ] **35. Add env vars to production server** — SSH into the DigitalOcean server and add the production OAuth credentials:
  ```bash
  ssh root@$(cat .deploy-host) "echo '{NAME}_CLIENT_ID=<prod-client-id>' >> /opt/cliclaw-app/.env.production && echo '{NAME}_CLIENT_SECRET=<prod-secret>' >> /opt/cliclaw-app/.env.production"
  ```
  **IMPORTANT**: Use the PRODUCTION OAuth app credentials, not the dev ones. Dev credentials have `localhost:3000` as the callback URL and will fail in production with a redirect URI mismatch.

#### 7c. Publish npm Packages

- [ ] **36. Bump auth package version** — Edit `packages/auth/package.json`, increment the version
- [ ] **37. Publish auth package** — `cd packages/auth && pnpm build && pnpm publish --access public --no-git-checks`
  - **MUST use `pnpm publish`** (not `npm publish`) — pnpm resolves `workspace:*` protocol to actual version numbers. Using `npm publish` leaks `workspace:*` into the published package, which causes install failures.
- [ ] **38. Bump cliclaw package version** — Edit `packages/cliclaw/package.json`, increment the version
- [ ] **39. Publish cliclaw package** — `cd packages/cliclaw && pnpm build && pnpm publish --access public --no-git-checks`
- [ ] **40. Verify published deps** — `npm view @digitalpresence/cliclaw@<version> dependencies --json` — confirm no `workspace:*` in output

#### 7d. Deploy Portal

- [ ] **41. Deploy portal to production** — Run `./scripts/deploy.sh` from the repo root. This builds the Next.js standalone app and rsyncs it to the DigitalOcean server.
  - The portal bundles `@digitalpresence/cliclaw-auth` at build time, so the new integration registry entries are included in the build
  - After deploy, the portal restarts automatically via systemd

#### 7e. Rebuild Docker Image

- [ ] **42. Update Dockerfile version** — Edit `docker/Dockerfile`, update the `@digitalpresence/cliclaw@X.Y.Z` version to the newly published version
- [ ] **43. Copy Dockerfile and entrypoint to server** — `scp docker/Dockerfile docker/entrypoint.mjs root@$(cat .deploy-host):/opt/cliclaw-app/docker/`
- [ ] **44. Rebuild Docker image on server** — `ssh root@$(cat .deploy-host) "cd /opt/cliclaw-app/docker && docker build --no-cache -t cliclaw-agent ."`
  - This pulls the latest `@digitalpresence/cliclaw` from npm with the new integration commands
  - Verify success: the build should end with `naming to docker.io/library/cliclaw-agent done`

#### 7f. Production Verification

- [ ] **45. Restart portal** — `ssh root@$(cat .deploy-host) "systemctl restart cliclaw-portal"`
- [ ] **46. Verify integration appears** — Visit `https://agents.markshteyn.com/integrations` and confirm the new integration is listed
- [ ] **47. Test OAuth connect flow** — Click "Connect" for the new integration, verify the OAuth flow completes and shows as connected
- [ ] **48. Test agent with integration** — Chat with an agent that uses the new integration, verify the CLI commands work inside the Docker container
- [ ] **49. Final commit** — Commit Dockerfile version bump and any remaining changes

## Architecture Reference

```
packages/auth/src/{name}-auth.ts       Auth helpers (create client, scopes, etc.)
packages/auth/src/index.ts             Re-export new auth module
packages/cliclaw/src/{name}/           CLI command handlers
packages/cliclaw/src/commands/{name}.ts CLI command registration
packages/cliclaw/src/cli.ts            Register new commands
packages/cliclaw/src/__tests__/{name}.integration.test.ts  Integration tests
```

### Token storage

Shared file: `~/.cliclaw/tokens.json`. All integrations share the same file.
- Gmail uses bare account names (`default`, `work`) for backwards compatibility
- New integrations MUST use prefixed keys: `{name}:{account}` (e.g., `slack:work`, `instagram:personal`)

### Test pattern

Tests invoke the built CLI binary via `execFile("node", [CLI, ...args])` and assert on JSON stdout. See `packages/cliclaw/src/__tests__/gmail.integration.test.ts` for the canonical example. Key patterns:
- `describe.sequential` for ordered tests that share state
- `run()` helper wrapping `execFile` with timeout
- `parseJson()` helper for stdout
- Timestamp-based test data names: `` `cliclaw-test-${Date.now()}` ``
- Cleanup at the end (delete/trash test data)

### Code conventions

- All JSON output uses `outputJson()` / `outputError()` / `outputAuthRequired()` from `lib/output.ts`
- CLI commands use commander with `--account <name>` option defaulting to `"default"`
- Commit incrementally after each working milestone

### Publishing packages

- **ALWAYS use `pnpm publish`** for packages with `workspace:*` dependencies. `npm publish` does NOT resolve the workspace protocol and will publish broken packages.
- `claude-agent-sdk` is a peerDependency in cliclaw (not a regular dep). This avoids npm install failures when the SDK's large dependency tree fails to resolve.
- Bump version in `package.json` before each publish (npm rejects duplicate versions).
- Verify with `npm view @digitalpresence/cliclaw@<version> dependencies --json` — no `workspace:*` should appear.
- **Auth package `exports` must point to `dist/`** — The auth package's `main` and `exports` fields point to `dist/index.js` (compiled JS). Do NOT use `publishConfig` to remap — pnpm doesn't apply it reliably. The portal still works in dev because `transpilePackages` in `next.config.ts` handles the workspace-linked source. If exports pointed to `src/index.ts`, the published package would fail with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` in Node.js v22+ Docker containers.
- **Verify auth exports after publish**: `npm view @digitalpresence/cliclaw-auth@<version> main exports --json` — `main` should be `dist/index.js`, NOT `src/index.ts`.

### Production infrastructure

- **Portal**: Deployed to Vercel-style standalone build on DigitalOcean at `agents.markshteyn.com`
- **Deploy host**: Stored in `.deploy-host` file (currently `157.230.191.59`)
- **Agent execution**: Docker containers using `cliclaw-agent` image on same DigitalOcean server
- **Env vars**: Production secrets in `/opt/cliclaw-app/.env.production` on the server
- **Agent templates**: `~/.cliclaw/agents/` on the server (mapped to `/opt/cliclaw/agents/`)
- **DB**: SQLite at `/opt/cliclaw/portal/portal.db` on the server
- **OAuth apps**: Dev and production are SEPARATE apps (different callback URLs). Dev: `localhost:3000`, Prod: `agents.markshteyn.com`
