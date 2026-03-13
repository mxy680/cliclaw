import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { AgentStore, getAgentsDir, INTEGRATIONS } from "@cliclaw/auth";
import { stmts, generateId } from "../db.js";
import { requireAuth } from "../auth.js";

const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const PORTAL_URL = process.env.PORTAL_URL || "http://localhost:3001";
const AGENT_API_SECRET = process.env.AGENT_API_SECRET!;

// The OAuth callback comes directly to the agent-server (via Cloudflare Tunnel)
const AGENT_API_URL = process.env.AGENT_API_URL || "http://localhost:3002";
const OAUTH_REDIRECT_URI = `${AGENT_API_URL}/integrations/oauth/callback`;

function signState(payload: object): string {
  const data = JSON.stringify(payload);
  const hmac = crypto.createHmac("sha256", AGENT_API_SECRET).update(data).digest("hex");
  return Buffer.from(JSON.stringify({ data, hmac })).toString("base64url");
}

function verifyState(state: string): Record<string, string> | null {
  try {
    const { data, hmac } = JSON.parse(Buffer.from(state, "base64url").toString()) as {
      data: string;
      hmac: string;
    };
    const expected = crypto.createHmac("sha256", AGENT_API_SECRET).update(data).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// GET / — list all integrations with user's connection status
router.get("/", requireAuth, (req: Request, res: Response) => {
  const clientTokens = stmts.getClientTokens.all(req.user!.id) as {
    integration: string;
    email: string | null;
  }[];
  const connectedMap = new Map(clientTokens.map((t) => [t.integration, t.email]));

  const integrations = Object.values(INTEGRATIONS).map((def) => ({
    id: def.id,
    displayName: def.displayName,
    connected: connectedMap.has(def.id),
    email: connectedMap.get(def.id) ?? null,
  }));

  res.json({ integrations });
});

// GET /connect/:integration — get OAuth consent URL (user-level)
router.get("/connect/:integration", requireAuth, (req: Request, res: Response) => {
  const integration = req.params.integration as string;

  const integrationDef = INTEGRATIONS[integration];
  if (!integrationDef) {
    res.status(400).json({ error: `Unknown integration: ${integration}` });
    return;
  }

  const state = signState({
    userId: req.user!.id,
    integration,
  });

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: OAUTH_REDIRECT_URI,
    response_type: "code",
    scope: integrationDef.scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });

  res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
});

// GET /oauth/callback — Google redirects here directly after user consents
router.get("/oauth/callback", async (req: Request, res: Response) => {
  const { code, state, error } = req.query as {
    code?: string;
    state?: string;
    error?: string;
  };

  if (error || !code || !state) {
    res.redirect(`${PORTAL_URL}/integrations?error=denied`);
    return;
  }

  const payload = verifyState(state);
  if (!payload) {
    res.redirect(`${PORTAL_URL}/integrations?error=invalid_state`);
    return;
  }

  const { userId, integration } = payload;

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: OAUTH_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("Integration token exchange failed:", err);
      res.redirect(`${PORTAL_URL}/integrations?error=token_exchange`);
      return;
    }

    const tokens = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expiry_date?: number;
      token_type: string;
      scope?: string;
    };

    // Fetch the connected account's email
    let email: string | null = null;
    try {
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (userInfoRes.ok) {
        const info = (await userInfoRes.json()) as { email?: string };
        email = info.email?.toLowerCase().trim() ?? null;
      }
    } catch {
      // Non-critical — email is just for display
    }

    // Upsert into client_tokens
    stmts.upsertClientToken.run(
      generateId(),
      userId,
      integration,
      JSON.stringify(tokens),
      email,
    );

    res.redirect(`${PORTAL_URL}/integrations?connected=${integration}`);
  } catch (err) {
    console.error("Integration OAuth error:", err);
    res.redirect(`${PORTAL_URL}/integrations?error=server_error`);
  }
});

// DELETE /:integration — disconnect an integration (user-level)
router.delete("/:integration", requireAuth, (req: Request, res: Response) => {
  const integration = req.params.integration as string;

  if (!(integration in INTEGRATIONS)) {
    res.status(400).json({ error: `Unknown integration: ${integration}` });
    return;
  }

  stmts.deleteClientToken.run(req.user!.id, integration);
  res.json({ ok: true });
});

// GET /agent/:agentName — list integrations for a specific agent + connection status
router.get("/agent/:agentName", requireAuth, (req: Request, res: Response) => {
  const agentName = req.params.agentName as string;

  const access = stmts.checkAccess.get(req.user!.id, agentName);
  if (!access) {
    res.status(403).json({ error: "No access to this agent" });
    return;
  }

  const store = new AgentStore(getAgentsDir());
  const agent = store.get(agentName);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const permittedIntegrations = new Set(agent.permissions.map((p) => p.integration));

  const clientTokens = stmts.getClientTokens.all(req.user!.id) as {
    integration: string;
    email: string | null;
  }[];
  const connectedMap = new Map(clientTokens.map((t) => [t.integration, t.email]));

  const integrations = [...permittedIntegrations]
    .filter((id) => id in INTEGRATIONS)
    .map((id) => ({
      id,
      displayName: INTEGRATIONS[id].displayName,
      connected: connectedMap.has(id),
      email: connectedMap.get(id) ?? null,
    }));

  res.json({ integrations });
});

export default router;
