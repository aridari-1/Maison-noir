/**
 * Tier definitions — single source of truth for pricing and which Stripe
 * Price ID / artwork each tier maps to.
 *
 * `priceEnv` names the environment variable (set in Vercel's dashboard)
 * that holds the actual Stripe Price ID for that tier. We never hardcode
 * price IDs here so you can update pricing in Stripe without redeploying.
 *
 * `total: null` means unlimited — this is a wellness tool, not a scarce
 * collectible, so nobody who wants a piece should ever be turned away by
 * an artificial cap. The webhook still assigns each purchase a sequential
 * edition number (nice for the certificate, "you were purchase #412"),
 * it just never refuses a sale for running out.
 *
 * `artworkPoolSize` — Founder's Cut only. The webhook randomly assigns
 * one of this many keepsake artworks (see /founder-art/) to each
 * certificate at issuance. Other tiers leave this unset.
 */
module.exports = {
  ember: {
    name: 'Ember',
    priceEnv: 'STRIPE_PRICE_EMBER',
    total: null,
    artworkHash: 'ember-v1-placeholder-hash',
  },
  gold: {
    name: 'Gold Band',
    priceEnv: 'STRIPE_PRICE_GOLD',
    total: null,
    artworkHash: 'gold-band-v1-placeholder-hash',
  },
  platinum: {
    name: 'Platinum',
    priceEnv: 'STRIPE_PRICE_PLATINUM',
    total: null,
    artworkHash: 'platinum-v1-placeholder-hash',
  },
  founder: {
    name: "Founder's Cut",
    priceEnv: 'STRIPE_PRICE_FOUNDER',
    total: null,
    artworkHash: 'founder-v1-placeholder-hash',
    artworkPoolSize: 50,
  },
};