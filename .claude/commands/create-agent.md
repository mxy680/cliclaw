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

### Phase 8: Assign Users (Optional)

- [ ] **14. Ask: Should any users be assigned now?** — If the portal is running, users can be assigned via the dashboard admin panel. Remind the user:
  - Dashboard: `http://localhost:3000` → Agents tab → click agent → Add User
  - Or via API: `POST /api/admin/access` with `{ email, agentName }`

## Tips

- **Iterating on personality**: SOUL.md can be edited anytime. Changes propagate to new instances when they're synced.
- **Adding integrations later**: `cliclaw agent grant <name> --integration <integration>`
- **Testing the agent**: Assign yourself, then chat via the portal.
- **Cron job task files**: Stored at `~/.cliclaw/agents/<name>/cron-tasks/<jobId>.md` — edit directly for complex tasks.
