/**
 * Storage client for tracking sold editions and issued certificates.
 *
 * Vercel KV (the old standalone product) was retired — storage now goes
 * through Upstash Redis via the Vercel Marketplace. When you connect an
 * "Upstash for Redis" database to this project in the Vercel dashboard,
 * it automatically injects KV_REST_API_URL and KV_REST_API_TOKEN as
 * environment variables, which is what this reads.
 *
 * The .get() / .set() / .incr() methods used elsewhere in this project
 * work the same as the old @vercel/kv package did — @vercel/kv was
 * always just a thin wrapper around this same Upstash client.
 */
const { Redis } = require('@upstash/redis');

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

module.exports = { kv };
