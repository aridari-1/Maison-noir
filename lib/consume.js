const { kv } = require('./kv');

/**
 * Marks a certificate as smoked/consumed. This is a ONE-WAY, permanent
 * action — once lit, a piece cannot be lit again. To "light another,"
 * the buyer has to purchase a new certificate (new edition, new id).
 *
 * Idempotent: calling this twice on an already-smoked certificate just
 * returns the existing status rather than erroring or double-processing —
 * a page refresh mid-animation should never be able to somehow un-consume
 * or re-consume a piece.
 */
async function consume(certId) {
  const key = `smoked:${certId}`;
  const existing = await kv.get(key);
  if (existing) {
    return typeof existing === 'string' ? JSON.parse(existing) : existing;
  }

  const status = {
    smoked: true,
    smokedAt: new Date().toISOString(),
  };
  await kv.set(key, JSON.stringify(status));
  return status;
}

async function getStatus(certId) {
  const existing = await kv.get(`smoked:${certId}`);
  if (!existing) {
    return { smoked: false, smokedAt: null };
  }
  const parsed = typeof existing === 'string' ? JSON.parse(existing) : existing;
  return { smoked: true, smokedAt: parsed.smokedAt };
}

module.exports = { consume, getStatus };
