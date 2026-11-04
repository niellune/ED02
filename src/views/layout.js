import { html } from './html.js';

export function layout({ ctx, title, description, body, canonical, noindex = false }) {
  const { config, user, csrf } = ctx;
  const fullTitle = title ? `${title} · ${config.brand}` : `${config.brand} — Dynamic QR codes that never get held hostage`;
  const desc = description || 'Create editable QR codes with scan analytics. Free static codes forever, and dynamic codes that keep working even if you stop paying.';
  return html`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${fullTitle}</title>
  <meta name="description" content="${desc}">
  ${noindex ? html`<meta name="robots" content="noindex">` : ''}
  ${canonical ? html`<link rel="canonical" href="${config.baseUrl}${canonical}">` : ''}
  <meta property="og:title" content="${fullTitle}">
  <meta property="og:description" content="${desc}">
  <meta property="og:type" content="website">
  ${canonical ? html`<meta property="og:url" content="${config.baseUrl}${canonical}">` : ''}
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/styles.css">
  ${config.plausibleDomain ? html`<script defer data-domain="${config.plausibleDomain}" src="https://plausible.io/js/script.js"></script>` : ''}
</head>
<body>
  <header class="site-header">
    <div class="wrap nav">
      <a class="logo" href="${user ? '/dashboard' : '/'}"><img src="/favicon.svg" alt="" width="26" height="26">${config.brand}</a>
      <nav>
        ${user
          ? html`<a href="/dashboard">My codes</a><a href="/account">Account</a>
             <form method="post" action="/logout" class="inline"><input type="hidden" name="_csrf" value="${csrf}"><button class="link">Log out</button></form>`
          : html`<a href="/pricing">Pricing</a><a href="/no-hostage-pledge">Our pledge</a><a href="/login">Log in</a><a class="btn btn-small" href="/signup">Start free</a>`}
      </nav>
    </div>
  </header>
  <main>${body}</main>
  <footer class="site-footer">
    <div class="wrap footer-grid">
      <div><strong>${config.brand}</strong><p class="muted">Honest dynamic QR codes for small businesses.</p></div>
      <div><h4>Product</h4><a href="/">Free QR generator</a><a href="/pricing">Pricing</a><a href="/no-hostage-pledge">No-hostage pledge</a></div>
      <div><h4>Use cases</h4><a href="/qr-code-for/restaurant-menu">Restaurant menus</a><a href="/qr-code-for/real-estate">Real estate</a><a href="/qr-code-for/business-cards">Business cards</a><a href="/qr-code-for/events">Events</a></div>
      <div><h4>Company</h4><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/report">Report abuse</a><a href="mailto:${config.supportEmail}">Contact</a></div>
    </div>
  </footer>
  <script src="/app.js" defer></script>
</body>
</html>`;
}
