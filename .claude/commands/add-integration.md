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

### Phase 5: Final Verification

- [ ] **24. Full build**: `pnpm build` — all packages compile
- [ ] **25. All tests**: `pnpm --filter @digitalpresence/cliclaw test` — all integration tests pass
- [ ] **26. Final commit** if any remaining changes

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
