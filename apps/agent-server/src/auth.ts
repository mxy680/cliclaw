import type { Request, Response, NextFunction } from "express";
import { stmts } from "./db.js";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);

export interface AuthUser {
  id: string;
  email: string;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Middleware: requires valid session token in Authorization header.
 * Sets req.user on success.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7);
  const session = stmts.findSession.get(token) as { user_id: string; email: string } | undefined;

  if (!session) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  req.user = { id: session.user_id, email: session.email };
  next();
}

/**
 * Middleware: requires the authenticated user to be an admin.
 * Must be used after requireAuth.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !ADMIN_EMAILS.includes(req.user.email)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

/**
 * Middleware: validates x-api-secret header.
 * Used for portal-to-server trust (in addition to user session).
 */
export function requireSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.AGENT_API_SECRET;
  if (!secret) {
    res.status(500).json({ error: "AGENT_API_SECRET not configured" });
    return;
  }
  if (req.headers["x-api-secret"] !== secret) {
    res.status(401).json({ error: "Invalid API secret" });
    return;
  }
  next();
}
