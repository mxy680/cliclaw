import { Router, type Request, type Response } from "express";
import { stmts, generateToken, generateId } from "../db.js";
import { requireAuth } from "../auth.js";

const router = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const PORTAL_URL = process.env.PORTAL_URL || "http://localhost:4000";
const REDIRECT_URI = `${PORTAL_URL}/auth/callback`;

// GET /auth/google/url — return the Google OAuth consent URL
router.get("/google/url", (_req: Request, res: Response) => {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
  });

  res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
});

// POST /auth/google/callback — exchange auth code for session
router.post("/google/callback", async (req: Request, res: Response) => {
  const { code } = req.body as { code?: string };

  if (!code) {
    res.status(400).json({ error: "Authorization code required" });
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
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("Google token exchange failed:", err);
      res.status(401).json({ error: "Failed to exchange authorization code" });
      return;
    }

    const tokens = await tokenRes.json() as { access_token: string };

    // Get user info
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoRes.ok) {
      res.status(401).json({ error: "Failed to get user info" });
      return;
    }

    const userInfo = await userInfoRes.json() as { email: string };
    const email = userInfo.email.toLowerCase().trim();

    // Find or create user
    let isNewUser = false;
    let user = stmts.findUserByEmail.get(email) as { id: string } | undefined;
    if (!user) {
      const id = generateId();
      user = stmts.createUser.get(id, email) as { id: string };
      isNewUser = true;
    }

    // Create session
    const sessionToken = generateToken();
    stmts.createSession.run(sessionToken, user.id);

    res.json({ sessionToken, userId: user.id, email, isNewUser });
  } catch (err) {
    console.error("Google OAuth error:", err);
    res.status(500).json({ error: "Authentication failed" });
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
