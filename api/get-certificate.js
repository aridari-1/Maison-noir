const { kv } = require('../lib/kv');

module.exports = async (req, res) => {
  const { session_id } = req.query;
  if (!session_id) {
    return res.status(400).json({ error: 'Missing session_id' });
  }

  const cert = await kv.get(`cert:${session_id}`);
  if (!cert) {
    // Not an error necessarily — the webhook may not have run yet.
    // The success page polls this endpoint a few times before giving up.
    return res.status(404).json({ error: 'not_ready' });
  }

  const parsed = typeof cert === 'string' ? JSON.parse(cert) : cert;
  return res.status(200).json(parsed);
};
