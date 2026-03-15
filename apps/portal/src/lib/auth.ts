import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getStmts } from "./db-statements";
import { generateId } from "./db";
import { getSessionToken } from "./session";
import { SESSION_MAX_AGE, OAUTH_STATE_TTL_MS } from "./constants";
import { UnauthorizedError, ForbiddenError } from "./errors";
import type { AuthUser, SessionWithUser } from "./types";

export async function getSession(): Promise<AuthUser | null> {
  const token = await getSessionToken();
  if (!token) return null;

  const row = await getStmts().getSession.get(token) as unknown as SessionWithUser | undefined;
  if (!row) return null;

  return { id: row.user_id, email: row.email };
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getSession();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth();
  if (!isAdmin(user.email)) throw new ForbiddenError();
  return user;
}

export function isAdmin(email: string): boolean {
  const admins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase());
  return admins.includes(email.toLowerCase());
}

export async function findOrCreateUser(email: string): Promise<AuthUser> {
  const stmts = getStmts();
  const existing = await stmts.findUserByEmail.get(email) as unknown as
    | { id: string; email: string }
    | undefined;
  if (existing) return { id: existing.id, email: existing.email };

  const id = generateId();
  await stmts.createUser.run(id, email);
  return { id, email };
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await getStmts().createSession.run(token, userId, SESSION_MAX_AGE);
  return token;
}

// HMAC OAuth state for CSRF protection
export function createOAuthState(payload: Record<string, string>): string {
  const data = JSON.stringify({ timestamp: Date.now(), ...payload });
  const secret = process.env.OAUTH_STATE_SECRET || process.env.GOOGLE_CLIENT_SECRET!;
  const hmac = createHmac("sha256", secret).update(data).digest();
  const dataB64 = Buffer.from(data).toString("base64url");
  const hmacB64 = hmac.toString("base64url");
  return `${dataB64}.${hmacB64}`;
}

export function verifyOAuthState(
  state: string
): Record<string, string> | null {
  try {
    const [dataB64, hmacB64] = state.split(".");
    if (!dataB64 || !hmacB64) return null;

    const data = Buffer.from(dataB64, "base64url").toString();
    const secret = process.env.OAUTH_STATE_SECRET || process.env.GOOGLE_CLIENT_SECRET!;
    const expected = createHmac("sha256", secret).update(data).digest();
    const actual = Buffer.from(hmacB64, "base64url");

    if (actual.length !== expected.length) return null;
    if (!timingSafeEqual(expected, actual)) return null;

    const parsed = JSON.parse(data);
    if (Date.now() - parsed.timestamp > OAUTH_STATE_TTL_MS) return null;

    return parsed;
  } catch {
    return null;
  }
}
