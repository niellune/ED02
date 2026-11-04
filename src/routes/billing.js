import { Router } from 'express';
import Stripe from 'stripe';
import { requireUser } from './helpers.js';

const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due']); // past_due = grace period while Stripe retries

function stripeClient(deps) {
  if (deps.stripe) return deps.stripe;
  if (!deps.config.stripe.secretKey) return null;
  deps.stripe = new Stripe(deps.config.stripe.secretKey);
  return deps.stripe;
}

export function applyStripeEvent(db, event) {
  const obj = event.data.object;
  if (event.type === 'checkout.session.completed') {
    const userId = Number(obj.client_reference_id || obj.metadata?.userId);
    if (!userId || obj.mode !== 'subscription') return;
    db.prepare(`UPDATE users SET plan = 'pro', subscription_status = 'active', stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?`)
      .run(obj.customer, obj.subscription, userId);
    return;
  }
  if (event.type.startsWith('customer.subscription.')) {
    let user = db.prepare('SELECT id FROM users WHERE stripe_customer_id = ?').get(obj.customer);
    if (!user && obj.metadata?.userId) {
      user = db.prepare('SELECT id FROM users WHERE id = ?').get(Number(obj.metadata.userId));
    }
    if (!user) return;
    const live = event.type !== 'customer.subscription.deleted' && ACTIVE_STATUSES.has(obj.status);
    db.prepare('UPDATE users SET plan = ?, subscription_status = ?, stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?')
      .run(live ? 'pro' : 'free', event.type === 'customer.subscription.deleted' ? 'canceled' : obj.status, obj.customer, obj.id, user.id);
  }
}

export function webhookHandler(deps) {
  return (req, res) => {
    const stripe = stripeClient(deps);
    if (!stripe || !deps.config.stripe.webhookSecret) return res.status(503).send('Billing not configured');
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, req.get('stripe-signature'), deps.config.stripe.webhookSecret);
    } catch (err) {
      return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
    }
    const { db } = deps;
    // Stripe retries deliveries; process each event at most once.
    const fresh = db.prepare('INSERT OR IGNORE INTO stripe_events (id, created_at) VALUES (?, ?)').run(event.id, Date.now()).changes;
    if (fresh) applyStripeEvent(db, event);
    res.json({ received: true });
  };
}

export default function billingRoutes(deps) {
  const { db, config } = deps;
  const router = Router();

  router.post('/billing/checkout', requireUser, async (req, res) => {
    const stripe = stripeClient(deps);
    if (!stripe || !config.billingEnabled) return res.redirect(303, '/account');
    const price = req.body.interval === 'year' && config.stripe.priceYearly ? config.stripe.priceYearly : config.stripe.priceMonthly;
    const u = req.user;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      client_reference_id: String(u.id),
      metadata: { userId: String(u.id) },
      subscription_data: { metadata: { userId: String(u.id) } },
      ...(u.stripe_customer_id ? { customer: u.stripe_customer_id } : { customer_email: u.email }),
      allow_promotion_codes: true,
      success_url: `${config.baseUrl}/dashboard?msg=upgraded`,
      cancel_url: `${config.baseUrl}/account?msg=checkout-cancelled`,
    });
    res.redirect(303, session.url);
  });

  router.post('/billing/portal', requireUser, async (req, res) => {
    const stripe = stripeClient(deps);
    if (!stripe || !req.user.stripe_customer_id) return res.redirect(303, '/account');
    const session = await stripe.billingPortal.sessions.create({ customer: req.user.stripe_customer_id, return_url: `${config.baseUrl}/account` });
    res.redirect(303, session.url);
  });

  if (config.devBilling) {
    router.post('/billing/dev-upgrade', requireUser, (req, res) => {
      db.prepare(`UPDATE users SET plan = 'pro', subscription_status = 'active' WHERE id = ?`).run(req.user.id);
      res.redirect(303, '/dashboard?msg=upgraded');
    });
    router.post('/billing/dev-downgrade', requireUser, (req, res) => {
      db.prepare(`UPDATE users SET plan = 'free', subscription_status = 'canceled' WHERE id = ?`).run(req.user.id);
      res.redirect(303, '/account?msg=downgraded');
    });
  }

  return router;
}
