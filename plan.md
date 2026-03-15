# LinkedIn & Instagram Integration Plan

## Overview

Add LinkedIn and Instagram as integration providers so agents can post, read, and manage content on behalf of clients. Both use OAuth 2.0 and fit cleanly into the existing provider/integration pattern.

---

## 1. LinkedIn

### OAuth Provider Setup
- **Provider:** `linkedin`
- **Auth URL:** `https://www.linkedin.com/oauth/v2/authorization`
- **Token URL:** `https://www.linkedin.com/oauth/v2/accessToken`
- **User Info URL:** `https://api.linkedin.com/v2/userinfo` (OpenID Connect)
- **Env vars:** `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`
- **Extra auth params:** `{ response_type: "code" }`
- **Extra scopes:** `["openid", "profile", "email"]`

### Integration Definition
```typescript
linkedin: {
  id: "linkedin",
  displayName: "LinkedIn",
  provider: "linkedin",
  scopes: ["w_member_social", "r_basicprofile", "r_organization_social"],
}
```

### Scopes Breakdown
| Scope | Purpose |
|-------|---------|
| `openid`, `profile`, `email` | Identify user (on provider config) |
| `w_member_social` | Create/delete posts, comments, reactions |
| `r_basicprofile` | Read profile info for context |
| `r_organization_social` | Read/manage company page posts (if client manages a company page) |

### LinkedIn API Capabilities for Agents
- **Post text/image/article** — `POST /v2/ugcPosts` or Community Management API
- **Read feed/reactions/comments** — `GET /v2/socialActions`
- **Company page management** — Post on behalf of organizations
- **Profile data** — Read profile for personalization

### App Registration
1. Create app at https://www.linkedin.com/developers/
2. Request "Sign In with LinkedIn using OpenID Connect" product
3. Request "Share on LinkedIn" product (gives `w_member_social`)
4. Request "Marketing Developer Platform" if company page management needed
5. Add redirect URI: `{BASE_URL}/api/integrations/callback`

### Important Notes
- LinkedIn tokens expire in **60 days** (access) with refresh tokens valid for **365 days**
- Need to handle refresh token flow — LinkedIn uses standard OAuth refresh
- LinkedIn API rate limits: 100 calls/day for most endpoints on basic tier
- LinkedIn requires app review for `r_organization_social` scope

---

## 2. Instagram

### OAuth Provider Setup (via Meta/Facebook)
- **Provider:** `instagram` (uses Meta's OAuth infrastructure)
- **Auth URL:** `https://www.facebook.com/v21.0/dialog/oauth`
- **Token URL:** `https://graph.facebook.com/v21.0/oauth/access_token`
- **User Info URL:** `https://graph.instagram.com/v21.0/me?fields=id,username,account_type`
- **Env vars:** `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET` (from Meta Developer app)
- **Extra auth params:** `{ response_type: "code" }`
- **Extra scopes:** `[]`

### Integration Definition
```typescript
instagram: {
  id: "instagram",
  displayName: "Instagram",
  provider: "instagram",
  scopes: [
    "instagram_basic",
    "instagram_content_publish",
    "instagram_manage_comments",
    "instagram_manage_insights",
    "pages_show_list",
    "pages_read_engagement",
  ],
}
```

### Scopes Breakdown
| Scope | Purpose |
|-------|---------|
| `instagram_basic` | Read profile, media |
| `instagram_content_publish` | Publish photos, videos, carousels, stories |
| `instagram_manage_comments` | Read/reply/delete comments |
| `instagram_manage_insights` | Read engagement analytics |
| `pages_show_list` | Required — Instagram API goes through Facebook Pages |
| `pages_read_engagement` | Required for comment management |

### Instagram Graph API Capabilities for Agents
- **Publish content** — `POST /{ig-user-id}/media` + `POST /{ig-user-id}/media_publish`
- **Read media/feed** — `GET /{ig-user-id}/media`
- **Manage comments** — `GET/POST/DELETE /{media-id}/comments`
- **Read insights** — `GET /{ig-user-id}/insights`

### App Registration
1. Create app at https://developers.facebook.com/
2. App type: "Business"
3. Add "Instagram Graph API" product
4. Configure OAuth redirect: `{BASE_URL}/api/integrations/callback`
5. Submit for App Review with required permissions

### Important Notes
- Instagram API **requires a Facebook Page** linked to the Instagram Business/Creator account
- Short-lived tokens (1 hour) → exchange for long-lived tokens (60 days)
- Need a **token exchange step** in the callback: short-lived → long-lived token
- No refresh tokens — must re-exchange before expiry or re-authorize
- Instagram Basic Display API was **deprecated December 2024** — must use Instagram Graph API
- Requires business or creator account (not personal)

---

## 3. Implementation Steps

### Step 1: Add providers to `integration-registry.ts`
Add `linkedin` and `instagram` provider configs and integration definitions.

### Step 2: Add env vars
Add to `~/.cliclaw/env/portal.env`:
```
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
INSTAGRAM_CLIENT_ID=...
INSTAGRAM_CLIENT_SECRET=...
```

### Step 3: Handle token lifecycle differences
The existing OAuth callback handles Google-style tokens well, but LinkedIn and Instagram have different patterns:

- **LinkedIn:** Standard refresh tokens. The existing `persistRefreshedTokens()` flow should work, but need to ensure the OAuth client manager handles LinkedIn refresh (currently only handles Google OAuth2Client).
- **Instagram:** No refresh tokens. Need a token exchange step (short → long-lived) in the callback handler. Consider a background job or pre-chat check to re-authorize expiring tokens.

**Recommended approach:** Add a `postTokenExchange` hook to the provider config for provider-specific token processing (e.g., Instagram's long-lived token exchange).

### Step 4: Token refresh in containers
Currently `OAuthClientManager` only creates Google `OAuth2Client` instances. For LinkedIn/Instagram:
- Option A: Add generic OAuth refresh logic in `token-store.ts` that checks token expiry and calls the provider's token URL directly
- Option B: Create provider-specific client classes (like `OAuth2Client` for Google)

**Recommended:** Option A — a generic `refreshTokenIfNeeded(provider, credentials)` function that works for any OAuth provider.

### Step 5: Agent tooling
Agents need CLI commands or MCP tools to actually use these APIs. Two approaches:
- **MCP servers** — Create `linkedin-mcp` and `instagram-mcp` tools that agents can use
- **CLI commands** — Add `cliclaw linkedin post/read` and `cliclaw instagram post/read` commands

**Recommended:** MCP servers, since they're more natural for Claude agents and can be added to agent configs.

### Step 6: Update UI
- Add LinkedIn and Instagram icons to `integration-grid.tsx`
- Both will use the existing OAuth flow UI (no special handling needed)

---

## 4. Risks & Considerations

| Risk | Mitigation |
|------|------------|
| Instagram requires Facebook Page + Business account | Document requirement clearly in onboarding; validate during connect flow |
| LinkedIn app review for org scopes | Start with personal posting scopes; add org scopes later |
| Instagram token expiry (60 days, no refresh) | Add pre-chat token validity check; prompt re-auth when expired |
| API rate limits | Add rate limiting awareness to agent instructions |
| Meta app review process | Can take weeks; plan ahead |
| LinkedIn API v2 deprecations | Use Community Management API (latest) |

---

## 5. Priority Order

1. **LinkedIn first** — simpler OAuth, standard refresh tokens, no Facebook Page dependency
2. **Instagram second** — more complex (Meta ecosystem, token exchange, Business account requirement)
