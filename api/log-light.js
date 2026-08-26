const { kv } = require('../lib/kv');
const { consume, getStatus } = require('../lib/consume');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { cert, message } = req.body || {};
    if (!cert) {
      return res.status(400).json({ error: 'Missing cert id' });
    }

    const certData = await kv.get(`cert-id:${cert}`);
    if (!certData) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    const existing = await getStatus(cert);
    if (existing.smoked) {
      return res.status(200).json({ status: existing, alreadySmoked: true });
    }

    const status = await consume(cert, message);
    return res.status(200).json({ status });
  } catch (err) {
    console.error('log-light failed:', err.message, err.stack);
    return res.status(500).json({ error: err.message || 'unknown error' });
  }
};