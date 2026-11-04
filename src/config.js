// Central configuration. Everything is driven by environment variables so the
// same build runs locally, in tests and in production.
export function loadConfig(env = process.env) {
  const isProd = env.NODE_ENV === 'production';
  const baseUrl = (env.BASE_URL || `http://localhost:${env.PORT || 3000}`).replace(/\/+$/, '');

  const sessionSecret = env.SESSION_SECRET || (isProd ? '' : 'dev-insecure-secret-change-me');
  if (isProd && sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET must be set to a random string of at least 32 characters in production.');
  }

  const stripe = {
    secretKey: env.STRIPE_SECRET_KEY || '',
    webhookSecret: env.STRIPE_WEBHOOK_SECRET || '',
    priceMonthly: env.STRIPE_PRICE_PRO_MONTHLY || '',
    priceYearly: env.STRIPE_PRICE_PRO_YEARLY || '',
  };

  return {
    isProd,
    port: Number(env.PORT || 3000),
    baseUrl,
    secureCookies: baseUrl.startsWith('https://'),
    trustProxy: env.TRUST_PROXY ? (/^\d+$/.test(env.TRUST_PROXY) ? Number(env.TRUST_PROXY) : env.TRUST_PROXY === 'true') : false,
    dbPath: env.DATABASE_PATH || './data/keepqr.db',
    sessionSecret,
    brand: env.BRAND_NAME || 'KeepQR',
    supportEmail: env.SUPPORT_EMAIL || 'support@example.com',
    adminEmails: (env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
    stripe,
    billingEnabled: Boolean(stripe.secretKey && stripe.priceMonthly),
    // Lets you exercise upgrade/downgrade flows locally without Stripe. Never on in production.
    devBilling: !isProd && !stripe.secretKey,
    mail: {
      resendApiKey: env.RESEND_API_KEY || '',
      from: env.MAIL_FROM || 'KeepQR <no-reply@example.com>',
    },
    plausibleDomain: env.PLAUSIBLE_DOMAIN || '',
    // Multiplies every rate limit. Raise it in tests or behind a shared NAT.
    rateLimitScale: Math.max(1, Number(env.RATE_LIMIT_SCALE) || 1),
  };
}
