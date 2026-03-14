import { homedir } from "os";

export const SESSION_COOKIE = "cliclaw_session";
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

export const CLICLAW_HOME = process.env.CLICLAW_HOME || `${homedir()}/.cliclaw`;

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export const AGENTS_DIR = `${CLICLAW_HOME}/agents`;
export const INSTANCES_DIR = `${CLICLAW_HOME}/instances`;
