import { Router, type Request, type Response } from "express";
import { stmts, generateToken, generateId } from "../db.js";
import { requireAuth } from "../auth.js";

const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const PORTAL_URL = process.env.PORTAL_URL || "http://localhost:3001";
const AGENT_API_URL = process.env.AGENT_API_URL || "http://localhost:3002";
const OAUTH_REDIRECT_URI = `${AGENT_API_URL}/auth/oauth/callback`;

// GET /auth/google/url — return the Google OAuth consent URL
router.get("/google/url", (_req: Request, res: Response) => {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: OAUTH_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
  });

  res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
});

// GET /auth/oauth/callback — Google redirects here directly
router.get("/oauth/callback", async (req: Request, res: Response) => {
  const { code, error } = req.query as { code?: string; error?: string };

  if (error || !code) {
    res.redirect(`${PORTAL_URL}/?error=auth_denied`);
    return;
  }

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
      console.error("Google token exchange failed:", err);
      res.redirect(`${PORTAL_URL}/?error=auth_failed`);
      return;
    }

    const tokens = await tokenRes.json() as { access_token: string };

    // Get user info
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoRes.ok) {
      res.redirect(`${PORTAL_URL}/?error=auth_failed`);
      return;
    }

    const userInfo = await userInfoRes.json() as { email: string };
    const email = userInfo.email.toLowerCase().trim();

    // Find or create user
    let user = stmts.findUserByEmail.get(email) as { id: string } | undefined;
    if (!user) {
      const id = generateId();
      user = stmts.createUser.get(id, email) as { id: string };
    }

    // Create session
    const sessionToken = generateToken();
    stmts.createSession.run(sessionToken, user.id);

    // Redirect to portal with session token in URL — portal will set the cookie
    res.redirect(`${PORTAL_URL}/auth/session?token=${sessionToken}`);
  } catch (err) {
    console.error("Google OAuth error:", err);
    res.redirect(`${PORTAL_URL}/?error=server_error`);
  }
});

// GET /auth/session — validate session and return user info
router.get("/session", requireAuth, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

// POST /auth/logout — destroy session
router.post("/logout", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    stmts.deleteSession.run(authHeader.slice(7));
  }
  res.json({ ok: true });
});

export default router;
