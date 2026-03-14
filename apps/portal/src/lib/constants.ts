import { homedir } from "os";

export const SESSION_COOKIE = "cliclaw_session";
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

export const CLICLAW_HOME = process.env.CLICLAW_HOME || `${homedir()}/.cliclaw`;

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export const AGENTS_DIR = `${CLICLAW_HOME}/agents`;
