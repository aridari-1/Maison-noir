const nacl = require('tweetnacl');
const naclUtil = require('tweetnacl-util');

/**
 * Builds the exact same pipe-delimited message the Python issue_certificate.py
 * script signs. Field order is fixed — changing it breaks verification of
 * every certificate issued before the change.
 */
function buildMessage(cert) {
  return [
    cert.id,
    cert.tier,
    String(cert.edition),
    String(cert.edition_total),
    cert.artwork_hash,
    cert.buyer_name,
    cert.issued_at,
  ].join('|');
}

/**
 * Signs a certificate object with the private key from SIGNING_PRIVATE_KEY.
 * That env var must hold the same base64 seed generate_keys.py produces —
 * PyNaCl's SigningKey and tweetnacl's keyPair.fromSeed use the same
 * 32-byte Ed25519 seed format, so keys are interchangeable between the
 * Python tooling and this Node code.
 */
function signCertificate(cert) {
  const seedB64 = process.env.SIGNING_PRIVATE_KEY;
  if (!seedB64) {
    throw new Error('SIGNING_PRIVATE_KEY environment variable is not set');
  }
  const seed = naclUtil.decodeBase64(seedB64);
  const keyPair = nacl.sign.keyPair.fromSeed(seed);
  const message = naclUtil.decodeUTF8(buildMessage(cert));
  const signature = nacl.sign.detached(message, keyPair.secretKey);
  return naclUtil.encodeBase64(signature);
}

module.exports = { buildMessage, signCertificate };
