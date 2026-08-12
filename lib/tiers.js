/**
 * Tier definitions — single source of truth for pricing, supply caps,
 * and which Stripe Price ID / artwork each tier maps to.
 *
 * `priceEnv` names the environment variable (set in Vercel's dashboard)
 * that holds the actual Stripe Price ID for that tier. We never hardcode
 * price IDs here so you can update pricing in Stripe without redeploying.
 *
 * `total` is the hard supply cap enforced by the webhook — once
 * `sold:<tierKey>` reaches this number in KV, no more can be issued.
 */
module.exports = {
  ember: {
    name: 'Ember',
    priceEnv: 'STRIPE_PRICE_EMBER',
    total: 2000,
    artworkHash: 'ember-v1-placeholder-hash',
  },
  gold: {
    name: 'Gold Band',
    priceEnv: 'STRIPE_PRICE_GOLD',
    total: 800,
    artworkHash: 'gold-band-v1-placeholder-hash',
  },
  platinum: {
    name: 'Platinum',
    priceEnv: 'STRIPE_PRICE_PLATINUM',
    total: 200,
    artworkHash: 'platinum-v1-placeholder-hash',
  },
  founder: {
    name: "Founder's Cut",
    priceEnv: 'STRIPE_PRICE_FOUNDER',
    total: 50,
    artworkHash: 'founder-v1-placeholder-hash',
  },
};
