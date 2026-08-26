const Stripe = require('stripe');
const { kv } = require('../lib/kv');
const { randomUUID, randomInt } = require('crypto');
const { getRawBody } = require('../lib/rawBody');
const { signCertificate } = require('../lib/certificate');
const tiers = require('../lib/tiers');

async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).send('Method not allowed');
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const sig = req.headers['stripe-signature'];
    const rawBody = await getRawBody(req);

    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type !== 'checkout.session.completed') {
      // We only care about completed payments — acknowledge everything else
      // so Stripe doesn't retry events we're intentionally ignoring.
      return res.status(200).json({ received: true, ignored: event.type });
    }

    const session = event.data.object;
    const tierKey = session.metadata && session.metadata.tierKey;
    const tier = tiers[tierKey];

    if (!tier) {
      console.error('Webhook received unknown tierKey:', tierKey, 'session:', session.id);
      return res.status(200).json({ received: true, error: 'unknown tier, needs manual review' });
    }

    // Idempotency: Stripe can send the same event more than once. If we've
    // already issued a certificate for this session, don't issue a second one.
    const existing = await kv.get(`cert:${session.id}`);
    if (existing) {
      return res.status(200).json({ received: true, alreadyIssued: true });
    }

    // Atomic increment — still tracked for every tier (nice to know "you
    // were purchase #412"), but only enforced as a cap when tier.total
    // is set. Unlimited tiers just keep counting up forever.
    const edition = await kv.incr(`sold:${tierKey}`);

    if (tier.total !== null && edition > tier.total) {
      // Oversold edge case: the pre-check in create-checkout-session.js makes
      // this very unlikely, but not impossible under a race. Payment was
      // already captured, so this needs a human to refund and follow up —
      // it must NOT silently issue a certificate beyond the stated supply.
      await kv.set(
        `oversold:${session.id}`,
        JSON.stringify({
          tierKey,
          attemptedEdition: edition,
          buyerEmail: session.customer_details && session.customer_details.email,
          amountTotal: session.amount_total,
          flaggedAt: new Date().toISOString(),
        })
      );
      console.error('OVERSOLD — needs manual refund + follow-up:', session.id, tierKey);
      return res.status(200).json({ received: true, oversold: true });
    }

    const buyerEmail = (session.customer_details && session.customer_details.email) || 'unknown';
    const buyerName = (session.customer_details && session.customer_details.name) || buyerEmail;

    const cert = {
      id: randomUUID(),
      tier: tier.name,
      edition,
      edition_total: tier.total,
      artwork_hash: tier.artworkHash,
      buyer_name: buyerName,
      issued_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    };
    cert.signature = signCertificate(cert);

    // Founder's Cut only: assign one of the 50 keepsake artworks at
    // issuance, permanently — this is randomized ONCE per certificate,
    // not re-rolled every time the buyer visits a page. Deliberately
    // added AFTER signing: this is asset metadata, not a claim that
    // needs cryptographic protection, so it stays outside the signed
    // message (buildMessage in lib/certificate.js only reads specific
    // named fields, so adding this here can't affect verification).
    if (tier.artworkPoolSize) {
      cert.founderArtwork = randomInt(1, tier.artworkPoolSize + 1); // 1..50 inclusive
    }

    // Keyed three ways:
    //  - by Stripe session id, so success.html can fetch it right after redirect
    //  - by certificate id, which is the PERMANENT, bookmarkable identifier
    //    used by ritual.html — this is what still works weeks later, long
    //    after the Stripe session itself has expired
    //  - by buyer email, so a simple "resend my certificate" lookup is
    //    possible later without a full database
    await kv.set(`cert:${session.id}`, JSON.stringify(cert));
    await kv.set(`cert-id:${cert.id}`, JSON.stringify(cert));
    await kv.set(`cert-by-email:${buyerEmail}:${cert.id}`, JSON.stringify(cert));

    console.log(`Issued ${tier.name} #${edition}/${tier.total} to ${buyerEmail}`);

    return res.status(200).json({ received: true, certificateId: cert.id });
  } catch (err) {
    // This is the difference between a certificate silently never arriving
    // and a clear log entry telling us exactly what broke.
    console.error('Webhook handler crashed:', err && err.message, err && err.stack);
    // Still return 200 here would hide the failure from Stripe's retry
    // mechanism — better to return 500 so Stripe retries the event later.
    return res.status(500).json({ error: err && err.message ? err.message : 'unknown error' });
  }
}

// Stripe requires the RAW, unparsed request body to verify the webhook
// signature — so we turn off Vercel's automatic JSON body parsing here.
// IMPORTANT: this must be attached to the function AFTER it's defined,
// and module.exports must be assigned exactly once, or this config gets
// silently discarded (which was the actual bug in the previous version —
// bodyParser was never really disabled, so signature verification was
// failing on every single webhook call).
handler.config = {
  api: { bodyParser: false },
};

module.exports = handler;