# Deployment Guide

## Architecture

```
User browser
  → agents.markshteyn.com (Vercel — Next.js portal)
    → api.markshteyn.com (Cloudflare Tunnel)
      → localhost:3002 (agent-server — Express + Claude SDK)
        → SQLite DB at ~/.cliclaw/portal/portal.db
```

The portal is a stateless proxy on Vercel. All auth, access control, database, and agent execution live on the agent-server running locally.

## Services

| Service | URL | Host | Port |
|---------|-----|------|------|
| Portal | https://agents.markshteyn.com | Vercel | — |
| Agent API | https://api.markshteyn.com | Local (tunneled) | 3002 |
| Dashboard | http://localhost:3000 | Local | 3000 |

## Starting the Agent Server

```bash
# 1. Build auth package (agent-server imports from dist/)
cd packages/auth && pnpm build

# 2. Start agent-server
cd apps/agent-server && pnpm dev
```

Verify: `curl http://localhost:3002/health`

### Agent Server Environment (apps/agent-server/.env)

```
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
PORTAL_URL=https://agents.markshteyn.com
ADMIN_EMAILS=mark@markshteyn.com
PORT=3002
```

## Cloudflare Tunnel

The tunnel exposes the local agent-server to the internet via `api.markshteyn.com`.

Config: `~/.cloudflared/config.yml`
Tunnel ID: `24ce449a-876f-49ce-b626-6374c5e49689`

### Start the tunnel

```bash
cloudflared tunnel run
```

### DNS Record (Cloudflare)

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `api` | `24ce449a-876f-49ce-b626-6374c5e49689.cfargotunnel.com` | Proxied |

## Vercel (Portal)

Project: `portal` under `markshteyn1-2684s-projects`
Domain: `agents.markshteyn.com`

### Environment Variables (Vercel Dashboard)

| Variable | Value |
|----------|-------|
| `AGENT_API_URL` | `https://api.markshteyn.com` |

### Deploy

Deployments happen automatically when pushing to the branch, or manually:

```bash
cd apps/portal && vercel --prod
```

### DNS Record (Cloudflare)

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `agents` | `cname.vercel-dns.com` | DNS only (grey cloud) |

## Google OAuth

Console: Google Cloud Console → APIs & Services → Credentials

### Authorized Redirect URIs

- `https://agents.markshteyn.com/auth/callback`
- `http://localhost:3001/auth/callback` (dev)

## Full Startup (from cold boot)

```bash
# 1. Build auth package
cd packages/auth && pnpm build

# 2. Start agent-server (background)
cd apps/agent-server && pnpm dev &

# 3. Start Cloudflare tunnel (background)
cloudflared tunnel run &

# 4. Verify
curl https://api.markshteyn.com/health
```

Portal on Vercel requires no action — it's always running.

## Admin

- Grant/revoke user access to agents: https://agents.markshteyn.com/admin
- Only emails listed in `ADMIN_EMAILS` can access the admin panel
- Access control is per-user, per-agent

## Troubleshooting

- **Agent-server won't start**: Run `pnpm build` in `packages/auth` first — it imports from `dist/`
- **Tunnel 404**: Restart tunnel after editing `~/.cloudflared/config.yml` — it doesn't hot-reload
- **OAuth error**: Ensure redirect URI in Google Console matches `PORTAL_URL` + `/auth/callback`
- **CORS errors**: Agent-server CORS origin is set from `PORTAL_URL` env var — must match the portal domain exactly
