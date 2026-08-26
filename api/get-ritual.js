const { kv } = require('../lib/kv');
const { getStatus } = require('../lib/consume');

module.exports = async (req, res) => {
  try {
    const { cert } = req.query;
    if (!cert) {
      return res.status(400).json({ error: 'Missing cert id' });
    }

    const certData = await kv.get(`cert-id:${cert}`);
    if (!certData) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    const parsed = typeof certData === 'string' ? JSON.parse(certData) : certData;
    const status = await getStatus(cert);

    return res.status(200).json({ certificate: parsed, status });
  } catch (err) {
    console.error('get-ritual failed:', err.message, err.stack);
    return res.status(500).json({ error: err.message || 'unknown error' });
  }
};