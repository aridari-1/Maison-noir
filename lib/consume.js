const { kv } = require('./kv');

const MAX_MESSAGE_LENGTH = 140;

/**
 * Cleans up a personal inscription before it's ever stored:
 *  - trims whitespace
 *  - hard-cuts to MAX_MESSAGE_LENGTH regardless of what the client sent
 *    (client-side limits are a UX nicety, never a security boundary)
 *  - collapses newlines/repeated whitespace to single spaces, since this
 *    is meant to render as one elegant line during the ritual, not a
 *    paragraph
 * Returns null for empty/whitespace-only input, so "no message" and
 * "empty string" are treated identically everywhere downstream.
 */
function sanitizeMessage(raw) {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_MESSAGE_LENGTH);
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Marks a certificate as smoked/consumed. This is a ONE-WAY, permanent
 * action — once lit, a piece cannot be lit again. To "light another,"
 * the buyer has to purchase a new certificate (new edition, new id).
 *
 * Idempotent: calling this twice on an already-smoked certificate just
 * returns the existing status rather than erroring or double-processing —
 * a page refresh mid-animation should never be able to somehow un-consume
 * or re-consume a piece. Note this means the message from the FIRST call
 * wins; a retry can't silently overwrite what was already recorded.
 */
async function consume(certId, message) {
  const key = `smoked:${certId}`;
  const existing = await kv.get(key);
  if (existing) {
    return typeof existing === 'string' ? JSON.parse(existing) : existing;
  }

  const status = {
    smoked: true,
    smokedAt: new Date().toISOString(),
    message: sanitizeMessage(message),
  };
  await kv.set(key, JSON.stringify(status));
  return status;
}

async function getStatus(certId) {
  const existing = await kv.get(`smoked:${certId}`);
  if (!existing) {
    return { smoked: false, smokedAt: null, message: null };
  }
  const parsed = typeof existing === 'string' ? JSON.parse(existing) : existing;
  return {
    smoked: true,
    smokedAt: parsed.smokedAt,
    message: parsed.message || null,
  };
}

module.exports = { consume, getStatus, sanitizeMessage, MAX_MESSAGE_LENGTH };