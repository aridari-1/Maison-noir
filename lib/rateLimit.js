const { kv } = require('./kv');

/**
 * Simple fixed-window rate limiter. Returns { allowed, remaining } —
 * callers check `allowed` and return 429 if false.
 *
 * Keyed by a caller-supplied identifier (almost always the request IP)
 * plus an endpoint name, so limits are per-person-per-endpoint, not
 * global. Uses Redis INCR + EXPIRE, which is atomic enough for this
 * purpose — a small amount of race-condition slop at the window edge
 * is fine for abuse prevention, this isn't a billing system.
 *
 * @param {string} identifier - usually the request IP
 * @param {string} endpoint - short name, e.g. 'log-light'
 * @param {number} limit - max requests allowed in the window
 * @param {number} windowSeconds - window length
 */
async function rateLimit(identifier, endpoint, limit, windowSeconds) {
  const key = `ratelimit:${endpoint}:${identifier}`;
  try {
    const count = await kv.incr(key);
    if (count === 1) {
      // only set expiry on the first request in a new window
      await kv.expire(key, windowSeconds);
    }
    return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
  } catch (err) {
    // If rate limiting itself is broken (Redis hiccup), fail OPEN, not
    // closed — a rate limiter that accidentally blocks all real traffic
    // during a storage blip is worse than one that's briefly permissive.
    console.error('Rate limit check failed, allowing request:', err.message);
    return { allowed: true, remaining: limit };
  }
}

/**
 * Best-effort extraction of the caller's IP from a Vercel serverless
 * request. Vercel sets x-forwarded-for; falls back to a constant so
 * rate limiting degrades gracefully rather than crashing if it's ever
 * missing (e.g. local testing).
 */
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : 'unknown';
}

module.exports = { rateLimit, getClientIp };
