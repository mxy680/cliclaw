/**
 * In-memory sliding window rate limiter.
 *
 * Uses a Map keyed by an arbitrary string (typically IP + route path).
 * Each entry holds timestamps of recent requests within the window.
 * Stale entries are cleaned up every 5 minutes to prevent unbounded growth.
 *
 * NOTE: This is intentionally not placed in middleware because the portal's
 * middleware runs on the Edge runtime, which does not persist module-level
 * state across requests. Rate limiting is applied in individual Node.js
 * route handlers instead.
 */

interface WindowEntry {
  timestamps: number[];
  lastAccess: number;
}

// Module-level store — persists across requests in the Node.js runtime.
const store = new Map<string, WindowEntry>();

// Cleanup interval: remove entries that haven't been accessed in over 10
// minutes (well past any reasonable window), running every 5 minutes.
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const STALE_THRESHOLD_MS = 10 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.lastAccess > STALE_THRESHOLD_MS) {
      store.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS).unref(); // .unref() so this timer doesn't keep the process alive

// ---------------------------------------------------------------------------
// Core rate limit function
// ---------------------------------------------------------------------------

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number; // Unix ms timestamp when the oldest request in the window expires
}

export function rateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [], lastAccess: now };
    store.set(key, entry);
  }

  // Evict timestamps outside the sliding window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);
  entry.lastAccess = now;

  const count = entry.timestamps.length;
  const resetAt =
    entry.timestamps.length > 0
      ? entry.timestamps[0] + config.windowMs
      : now + config.windowMs;

  if (count >= config.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetAt,
    };
  }

  entry.timestamps.push(now);

  return {
    success: true,
    remaining: config.maxRequests - entry.timestamps.length,
    resetAt,
  };
}

// ---------------------------------------------------------------------------
// Preset configs
// ---------------------------------------------------------------------------

/** Login / OAuth flows — tight limit to prevent brute-force / abuse */
export const AUTH_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 10,
};

/** General API endpoints */
export const API_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 60,
};

/** Chat / LLM calls — expensive, lower limit */
export const CHAT_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 20,
};

/** File upload endpoints */
export const UPLOAD_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000,
  maxRequests: 10,
};

// ---------------------------------------------------------------------------
// Helper: extract IP from a standard Request
// ---------------------------------------------------------------------------

function extractIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for may contain a comma-separated list; take the first entry
    return forwarded.split(",")[0].trim();
  }
  // Fall back to a placeholder — all requests without a detectable IP share
  // the same bucket, which is the safe default.
  return "unknown";
}

// ---------------------------------------------------------------------------
// applyRateLimit — call at the top of a route handler
// ---------------------------------------------------------------------------

/**
 * Checks the rate limit for the incoming request.
 *
 * @returns A `Response` with status 429 if the limit is exceeded, or `null`
 *   if the request is allowed. When `null` is returned the caller should add
 *   `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers to their own
 *   response using the exported `getRateLimitHeaders` helper.
 */
export function applyRateLimit(
  request: Request,
  config: RateLimitConfig
): { blocked: Response; headers?: never } | { blocked?: never; headers: HeadersInit } {
  const ip = extractIp(request);
  // Include the pathname so different endpoints don't share buckets
  const url = new URL(request.url);
  const key = `${ip}:${url.pathname}`;

  const result = rateLimit(key, config);

  const retryAfterSeconds = Math.ceil((result.resetAt - Date.now()) / 1000);

  const rateLimitHeaders: Record<string, string> = {
    "X-RateLimit-Limit": String(config.maxRequests),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };

  if (!result.success) {
    return {
      blocked: Response.json(
        {
          error: "Too many requests",
          retryAfter: retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            ...rateLimitHeaders,
            "Retry-After": String(retryAfterSeconds),
          },
        }
      ),
    };
  }

  return { headers: rateLimitHeaders };
}
