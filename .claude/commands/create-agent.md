# Create Agent

Guided agent creation workflow. Walk through each step interactively to create a fully configured agent template.

## Checklist

Work through each item in order. Do NOT skip steps. Check off each item as you complete it.

### Phase 1: Identity

- [ ] **1. Ask: Agent name** — lowercase slug (e.g., `scheduler`, `researcher`, `assistant`). Must be unique — check existing agents with `cliclaw agent list`.
- [ ] **2. Ask: Display name** — human-readable (e.g., "Research Assistant", "Daily Scheduler")
- [ ] **3. Ask: Role** — one-line description of what this agent does (e.g., "Manages calendar and schedules meetings")

### Phase 2: Create Scaffold

- [ ] **4. Run `cliclaw agent create`** — Execute:
  ```
  cliclaw agent create --name <name> --display-name "<displayName>" --role "<role>"
  ```
  This creates `~/.cliclaw/agents/<name>/` with `config.json`, `CONTEXT.md`, `SOUL.md`, `ROLE.md`.

### Phase 3: Write SOUL.md

- [ ] **5. Discuss personality** — Ask the user about the agent's:
  - **Voice**: formal, casual, playful, professional, terse, verbose?
  - **Traits**: helpful, proactive, cautious, curious, opinionated?
  - **Communication style**: bullet points vs prose, emoji usage, level of detail?
  - **Name/persona**: does the agent have a character name or identity?
- [ ] **6. Write SOUL.md** — Based on the discussion, write a compelling SOUL.md to `~/.cliclaw/agents/<name>/SOUL.md`. Structure:
  ```markdown
  # <Display Name>

  ## Identity
  <Who this agent is, in 2-3 sentences>

  ## Voice & Tone
  <How the agent communicates>

  ## Personality Traits
  - <trait 1>
  - <trait 2>
  - ...

  ## Boundaries
  <What the agent won't do or how it handles edge cases>
  ```

### Phase 4: Write ROLE.md

- [ ] **7. Discuss capabilities** — Ask the user about:
  - **Primary tasks**: What should this agent do day-to-day?
  - **Tools & integrations**: Which cliclaw integrations will it use?
  - **Workflows**: Are there multi-step processes it should follow?
  - **Output formats**: Does it produce reports, send emails, update spreadsheets?
  - **Constraints**: What should it NOT do? What are the guardrails?
- [ ] **8. Write ROLE.md** — Based on the discussion, write a detailed ROLE.md to `~/.cliclaw/agents/<name>/ROLE.md`. Structure:
  ```markdown
  # <Display Name> — Role

  ## Purpose
  <What this agent exists to do>

  ## Capabilities
  ### <Category 1>
  - <capability>
  - <capability>

  ### <Category 2>
  - <capability>

  ## Workflows
  ### <Workflow Name>
  1. <step>
  2. <step>
  3. <step>

  ## Constraints
  - <what the agent should NOT do>
  - <guardrails>
  ```

### Phase 5: Configure Integrations

- [ ] **9. Select integrations** — Show available integrations and let the user pick:
  - `gmail` — Gmail (read, send, search, manage labels)
  - `gdrive` — Google Drive (upload, download, share, organize)
  - `gsheets` — Google Sheets (read, write, create spreadsheets)
  - `gslides` — Google Slides (create, edit presentations)
  - `calendar` — Google Calendar (events, scheduling)
  - `forms` — Google Forms (create, manage, read responses)

  For each selected integration, run:
  ```
  cliclaw agent grant <name> --integration <integration>
  ```

### Phase 6: Configure Cron Jobs (Optional)

- [ ] **10. Ask: Does this agent need scheduled tasks?** — If yes, for each task:
  - Ask for a **schedule** (cron expression, help them with syntax if needed)
  - Ask for a **task description** — what should the agent do on each run?
  - Ask for **max iterations** (default 10)
  - Run:
    ```
    cliclaw cron add <name> --schedule "<cron>" --task "<description>"
    ```

### Phase 7: Initialize & Verify

- [ ] **11. Run `cliclaw init`** — Ensure the universal CLAUDE.md is up to date.
- [ ] **12. Verify scaffold** — Read and display the final state:
  - `cat ~/.cliclaw/agents/<name>/config.json` — show config
  - `cat ~/.cliclaw/agents/<name>/SOUL.md` — show personality
  - `cat ~/.cliclaw/agents/<name>/ROLE.md` — show capabilities
  - `cat ~/.cliclaw/agents/<name>/CONTEXT.md` — show generated context
- [ ] **13. Confirm with user** — Ask if anything needs adjustment. If so, edit the relevant files.

### Phase 8: Assign Users (Development)

- [ ] **14. Ask: Should any users be assigned now?** — If the portal is running locally, users can be assigned via the admin panel:
  - Portal: `http://localhost:3000` → Admin → Agents tab → click agent → Add User
  - Or via API: `POST /api/admin/access` with `{ email, agentName }`

### Phase 9: Production Deployment

This phase deploys the agent to the production server so it's accessible at `agents.markshteyn.com`. Without this, the agent only exists locally.

#### 9a. Sync Agent Template to Server

- [ ] **15. Sync agent files** — Copy the agent template to the production server:
  ```bash
  rsync -az ~/.cliclaw/agents/<name>/ root@$(cat .deploy-host):/opt/cliclaw/agents/<name>/
  ```
  This copies `config.json`, `SOUL.md`, `ROLE.md`, and `CONTEXT.md`.

- [ ] **16. Verify on server** — Confirm the agent exists:
  ```bash
  ssh root@$(cat .deploy-host) "ls /opt/cliclaw/agents/<name>/ && cat /opt/cliclaw/agents/<name>/config.json"
  ```

#### 9b. Grant User Access in Production DB

- [ ] **17. Check existing users** — List users in the production database:
  ```bash
  ssh root@$(cat .deploy-host) "sqlite3 /opt/cliclaw/portal/portal.db 'SELECT id, email FROM users;'"
  ```

- [ ] **18. Grant access** — For each user who should access this agent:
  ```bash
  ssh root@$(cat .deploy-host) "sqlite3 /opt/cliclaw/portal/portal.db \"INSERT INTO client_agent_access (id, user_id, agent_name, granted_by) VALUES (hex(randomblob(16)), '<user_id>', '<agent_name>', '<admin_user_id>');\""
  ```
  The `client_agent_access` table schema:
  - `id` TEXT PRIMARY KEY
  - `user_id` TEXT NOT NULL (from `users` table)
  - `agent_name` TEXT NOT NULL (must match agent directory name)
  - `granted_at` TEXT DEFAULT datetime('now') (auto-set)
  - `granted_by` TEXT NOT NULL (admin user_id)
  - UNIQUE(user_id, agent_name)

#### 9c. Ensure Required Integrations Are Available

- [ ] **19. Check integration env vars** — If the agent requires integrations, verify the production server has the corresponding OAuth credentials:
  ```bash
  ssh root@$(cat .deploy-host) "grep -E 'CLIENT_ID|CLIENT_SECRET' /opt/cliclaw-app/.env.production"
  ```
  Required env vars per provider:
  - **Google** (gmail, gdrive, gsheets, gslides, calendar, forms): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - **GitHub**: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
  - If any are missing, add them (use PRODUCTION OAuth app credentials, not dev)

#### 9d. Verify Docker Image Has Required CLI Commands

- [ ] **20. Check cliclaw version in Docker** — If the agent uses a recently-added integration, verify the Docker image has the latest cliclaw version:
  ```bash
  ssh root@$(cat .deploy-host) "docker run --rm --entrypoint bash cliclaw-agent -c 'cat /usr/local/lib/node_modules/@digitalpresence/cliclaw/package.json | grep version'"
  ```
  If the version is outdated, rebuild the Docker image (see `/add-integration` Phase 7e).

#### 9e. Restart and Verify

- [ ] **21. Restart portal** — `ssh root@$(cat .deploy-host) "systemctl restart cliclaw-portal"`
- [ ] **22. Verify agent appears** — Visit `https://agents.markshteyn.com/agents` and confirm the new agent is listed
- [ ] **23. Test chat** — Click into the agent and send a test message to verify it works end-to-end

## Tips

- **Iterating on personality**: SOUL.md can be edited anytime. Re-sync to production with `rsync -az ~/.cliclaw/agents/<name>/ root@$(cat .deploy-host):/opt/cliclaw/agents/<name>/`
- **Adding integrations later**: `cliclaw agent grant <name> --integration <integration>`, then re-sync to production
- **Testing the agent**: Assign yourself, then chat via the portal
- **Cron job task files**: Stored at `~/.cliclaw/agents/<name>/cron-tasks/<jobId>.md` — edit directly for complex tasks
- **Production deploy host**: Stored in `.deploy-host` file at repo root (currently `157.230.191.59`)
- **Agent templates on server**: `/opt/cliclaw/agents/` (NOT `~/.cliclaw/agents/` — the server uses `/opt/cliclaw/` as `CLICLAW_HOME`)
- **Production DB**: `/opt/cliclaw/portal/portal.db` on the server
- **Publishing packages**: Always use `pnpm publish` (not `npm publish`) to resolve `workspace:*` protocol
