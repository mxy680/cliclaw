import { Router, type Request, type Response } from "express";
import { Resend } from "resend";
import { stmts, generateToken, generateId } from "../db.js";
import { requireAuth } from "../auth.js";

const router = Router();
const resend = new Resend(process.env.RESEND_API_KEY);
const PORTAL_URL = process.env.PORTAL_URL || "http://localhost:3001";

// POST /auth/magic-link — send magic link email
router.post("/magic-link", async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };

  if (!email || !email.includes("@")) {
    res.status(400).json({ error: "Valid email required" });
    return;
  }

  const token = generateToken();
  stmts.createMagicLink.run(token, email.toLowerCase().trim());

  const magicUrl = `${PORTAL_URL}/auth/callback?token=${token}`;

  try {
    await resend.emails.send({
      from: "cliclaw <noreply@markshteyn.com>",
      to: email.toLowerCase().trim(),
      subject: "Sign in to cliclaw",
      html: `
        <div style="font-family: monospace; max-width: 400px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="color: #d4a843; font-size: 18px;">cliclaw</h2>
          <p style="color: #888; font-size: 14px;">Click the link below to sign in:</p>
          <a href="${magicUrl}" style="display: inline-block; margin: 20px 0; padding: 12px 24px; background: rgba(212,168,67,0.1); border: 1px solid rgba(212,168,67,0.3); color: #d4a843; text-decoration: none; font-family: monospace; font-size: 14px;">
            Sign in to cliclaw
          </a>
          <p style="color: #666; font-size: 12px;">This link expires in 15 minutes.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send magic link:", err);
    res.status(500).json({ error: "Failed to send email" });
    return;
  }

  res.json({ ok: true });
});

// POST /auth/verify — exchange magic link token for session
router.post("/verify", (req: Request, res: Response) => {
  const { token } = req.body as { token?: string };

  if (!token) {
    res.status(400).json({ error: "Token required" });
    return;
  }

  const link = stmts.findMagicLink.get(token) as { email: string } | undefined;
  if (!link) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  // Mark as used
  stmts.useMagicLink.run(token);

  // Find or create user
  const email = link.email;
  let user = stmts.findUserByEmail.get(email) as { id: string } | undefined;
  if (!user) {
    const id = generateId();
    user = stmts.createUser.get(id, email) as { id: string };
  }

  // Create session
  const sessionToken = generateToken();
  stmts.createSession.run(sessionToken, user.id);

  res.json({ sessionToken, userId: user.id, email });
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
