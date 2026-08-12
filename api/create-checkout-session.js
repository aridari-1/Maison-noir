const Stripe = require('stripe');
const { kv } = require('../lib/kv');
const tiers = require('../lib/tiers');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tierKey } = req.body || {};
  const tier = tiers[tierKey];
  if (!tier) {
    return res.status(400).json({ error: 'Unknown tier' });
  }

  // Soft pre-check so we don't send someone to Stripe for a sold-out tier.
  // The webhook does the final, authoritative check at issuance time —
  // this one just avoids a bad user experience in the common case.
  const sold = parseInt((await kv.get(`sold:${tierKey}`)) || '0', 10);
  if (sold >= tier.total) {
    return res.status(409).json({ error: `${tier.name} is sold out.` });
  }

  const priceId = process.env[tier.priceEnv];
  if (!priceId) {
    return res.status(500).json({
      error: `Missing Stripe price ID. Set the ${tier.priceEnv} environment variable in Vercel.`,
    });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe is not configured on this deployment yet.' });
  }
  if (!process.env.SITE_URL) {
    return res.status(500).json({ error: 'SITE_URL environment variable is not set.' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.SITE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL}/mint.html`,
      metadata: { tierKey },
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe session creation failed:', err.message);
    return res.status(500).json({ error: 'Could not start checkout. Please try again.' });
  }
};
