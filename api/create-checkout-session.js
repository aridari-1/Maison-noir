const Stripe = require('stripe');
const { kv } = require('../lib/kv');
const tiers = require('../lib/tiers');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { tierKey } = req.body || {};
    const tier = tiers[tierKey];
    if (!tier) {
      return res.status(400).json({ error: 'Unknown tier' });
    }

    // Check configuration FIRST, before touching any external service —
    // this way a missing env var always produces a clear message instead
    // of a confusing crash from whatever we happened to call first.
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Stripe is not configured on this deployment yet (missing STRIPE_SECRET_KEY).' });
    }
    if (!process.env.SITE_URL) {
      return res.status(500).json({ error: 'SITE_URL environment variable is not set.' });
    }
    const priceId = process.env[tier.priceEnv];
    if (!priceId) {
      return res.status(500).json({
        error: `Missing Stripe price ID. Set the ${tier.priceEnv} environment variable in Vercel.`,
      });
    }

    // Soft pre-check so we don't send someone to Stripe for a sold-out tier.
    // Skipped entirely when tier.total is null (unlimited) — most tiers
    // now, since this is a wellness tool, not a scarce collectible, and
    // nobody who wants a piece should be turned away by an artificial cap.
    if (tier.total !== null) {
      let sold = 0;
      try {
        sold = parseInt((await kv.get(`sold:${tierKey}`)) || '0', 10);
      } catch (kvErr) {
        console.error('KV read failed (continuing without sold-out pre-check):', kvErr.message);
      }
      if (sold >= tier.total) {
        return res.status(409).json({ error: `${tier.name} is sold out.` });
      }
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.SITE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL}/mint.html`,
      metadata: { tierKey },
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    // Last-resort catch-all so the client ALWAYS gets a real error message
    // instead of a bare 500 with no body.
    console.error('create-checkout-session failed:', err && err.message, err && err.stack);
    return res.status(500).json({ error: `Checkout failed: ${err && err.message ? err.message : 'unknown error'}` });
  }
};