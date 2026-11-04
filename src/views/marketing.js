import { html } from './html.js';
import { layout } from './layout.js';
import { PLANS } from '../plans.js';

export const USE_CASES = {
  'restaurant-menu': {
    title: 'QR codes for restaurant menus',
    h1: 'A menu QR code you print once and update forever',
    pitch: 'Prices change, specials rotate, the menu PDF gets a new link. With a dynamic QR code the sticker on the table stays the same: change where it points in seconds.',
    points: ['Swap the menu link whenever you like, with no reprinting', 'See how many guests scan per day and which phones they use', 'Point lunch and dinner tables to different menus', 'Your code keeps working even if you cancel, because table stickers last years'],
  },
  'real-estate': {
    title: 'QR codes for real estate signs and flyers',
    h1: 'Yard-sign QR codes that move with your listings',
    pitch: 'Put one code on your sign rider and repoint it to each new listing. Know which signs actually generate interest from the scan counts.',
    points: ['Reuse one sign for every listing', 'Track scans per sign or per flyer batch', 'Send buyers straight to a virtual tour or booking page', 'Never lose a sign to an expired subscription'],
  },
  'business-cards': {
    title: 'QR codes for business cards',
    h1: 'A business card that never goes out of date',
    pitch: 'New job, new portfolio, new booking link? Update where your card points instead of throwing away 500 cards.',
    points: ['Point to your LinkedIn, portfolio, or calendar, and change it anytime', 'See how many people actually scanned your card', 'Clean, high-resolution SVG for your printer', 'Static codes are free forever if you never need to edit'],
  },
  events: {
    title: 'QR codes for events, posters and tickets',
    h1: 'Event QR codes you can fix after the posters are printed',
    pitch: 'Typo in the registration link? Venue moved? Repoint the code and every poster, wristband and slide is fixed instantly.',
    points: ['Change the destination before, during, and after the event', 'Daily scan charts show which promotion pushed sign-ups', 'One code per channel to compare posters vs. flyers vs. slides', 'Download print-ready SVG and PNG'],
  },
  flyers: {
    title: 'QR codes for flyers and direct mail',
    h1: 'Measure your flyers like you measure your ads',
    pitch: 'Give every flyer batch its own dynamic QR code and finally see which neighborhood, mailing, or design brings people in.',
    points: ['Scan counts per batch, per day', 'Unique-visitor estimates without invasive tracking', 'Retarget a mailing to a new offer mid-campaign', 'Export scan history to CSV on Pro'],
  },
  'product-packaging': {
    title: 'QR codes for product packaging and labels',
    h1: 'Packaging QR codes that outlive your print run',
    pitch: 'Packaging sits on shelves and in homes for years. Send customers to manuals, reorder pages, or promotions, and change them without a new print run.',
    points: ['Update manuals, warranty, or reorder links anytime', 'See scans by device and country', 'Our no-hostage pledge means codes on shipped products keep working', 'High-resolution vector output for packaging designers'],
  },
};

const FAQ = [
  ['What is the difference between static and dynamic QR codes?', 'A static QR code stores the link itself, so it can never be changed but also never depends on anyone. A dynamic code stores a short link that we redirect, so you can change the destination and see scan statistics.'],
  ['What happens to my dynamic codes if I stop paying?', 'They keep redirecting to the last destination you set. Always. Downgrading only limits editing and analytics history. That is our no-hostage pledge.'],
  ['Do static codes from the free generator expire?', 'No. They contain your link directly and do not touch our servers when scanned. They work forever, even if we disappeared tomorrow.'],
  ['Do you track the people who scan my codes?', 'We record coarse, anonymous data: time, device type, operating system, browser and country when available. We never store IP addresses.'],
  ['Can I cancel anytime?', 'Yes. Cancel from your account page in two clicks. No phone calls, no retention maze.'],
];

export function homePage(ctx) {
  const body = html`
  <section class="hero">
    <div class="wrap hero-grid">
      <div>
        <p class="eyebrow">Free QR code generator, no sign-up</p>
        <h1>QR codes that <span class="accent">never get held hostage</span></h1>
        <p class="lead">Make a QR code in seconds. Need to change the link later or count scans? Upgrade to a dynamic code. It keeps working even if you stop paying.</p>
        <ul class="checks">
          <li>Static codes: free forever, no account, no watermark</li>
          <li>Dynamic codes: edit the destination anytime</li>
          <li>Scan analytics with no IP addresses stored</li>
        </ul>
      </div>
      ${generator()}
    </div>
  </section>

  <section class="band">
    <div class="wrap">
      <h2>Why people switch to ${ctx.config.brand}</h2>
      <div class="cards three">
        <div class="card"><h3>The bait-and-switch problem</h3><p>Many "free" QR generators quietly make dynamic codes that stop working when a trial ends, often after you have printed thousands. We think that is a hostage situation.</p></div>
        <div class="card"><h3>Our answer</h3><p>Every dynamic code you create keeps redirecting to its last destination, whether you are on Free, Pro, or cancelled. Upgrading buys features, never your code's life.</p></div>
        <div class="card"><h3>Fair, simple pricing</h3><p>3 dynamic codes free. Pro is $${PLANS.pro.priceMonthly}/month for ${PLANS.pro.maxDynamicCodes} codes, unlimited analytics history and CSV export. No per-scan fees.</p></div>
      </div>
    </div>
  </section>

  <section>
    <div class="wrap">
      <h2>Built for things that get printed</h2>
      <div class="cards three">
        ${Object.entries(USE_CASES).map(([slug, u]) => html`<a class="card card-link" href="/qr-code-for/${slug}"><h3>${u.title.replace('QR codes for ', '').replace(/^./, (c) => c.toUpperCase())}</h3><p>${u.pitch.split('.')[0]}.</p></a>`)}
      </div>
    </div>
  </section>

  <section class="band">
    <div class="wrap narrow">
      <h2>Questions</h2>
      ${FAQ.map(([q, a]) => html`<details class="faq"><summary>${q}</summary><p>${a}</p></details>`)}
      <p class="center"><a class="btn" href="/signup">Create your first dynamic code, free</a></p>
    </div>
  </section>`;
  return layout({ ctx, body, canonical: '/' });
}

function generator() {
  return html`
  <div class="card generator" id="generator">
    <label for="gen-data">Your link or text</label>
    <input id="gen-data" type="text" placeholder="https://your-website.com" value="https://example.com" maxlength="1000">
    <div class="row">
      <div><label for="gen-fg">Color</label><input id="gen-fg" type="color" value="#111827"></div>
      <div><label for="gen-bg">Background</label><input id="gen-bg" type="color" value="#ffffff"></div>
      <div><label for="gen-ecc">Error correction</label>
        <select id="gen-ecc"><option value="L">Low</option><option value="M" selected>Medium</option><option value="Q">High</option><option value="H">Max</option></select></div>
    </div>
    <div class="preview"><img id="gen-img" alt="QR code preview" width="240" height="240" src="/api/qr?data=https%3A%2F%2Fexample.com&amp;format=svg"></div>
    <p id="gen-warn" class="warn" hidden></p>
    <div class="row">
      <a id="gen-png" class="btn" href="/api/qr?data=https%3A%2F%2Fexample.com&amp;format=png&amp;download=1">Download PNG</a>
      <a id="gen-svg" class="btn btn-ghost" href="/api/qr?data=https%3A%2F%2Fexample.com&amp;format=svg&amp;download=1">Download SVG</a>
    </div>
    <p class="small muted">Static code: works forever and can't be edited. <a href="/signup">Want to edit it later?</a></p>
  </div>`;
}

export function pricingPage(ctx) {
  const { free, pro } = PLANS;
  const body = html`
  <section class="wrap">
    <h1 class="center">Simple pricing. No hostage-taking.</h1>
    <p class="lead center">Every dynamic code keeps redirecting forever, on every plan, even after you cancel.</p>
    <div class="cards two pricing">
      <div class="card">
        <h2>${free.name}</h2>
        <p class="price">$0</p>
        <ul class="checks">
          <li>Unlimited static QR codes</li>
          <li>${free.maxDynamicCodes} dynamic (editable) codes</li>
          <li>${free.historyDays} days of scan analytics</li>
          <li>PNG &amp; SVG downloads</li>
        </ul>
        <a class="btn btn-ghost block" href="/signup">Start free</a>
      </div>
      <div class="card featured">
        <p class="badge">Most popular</p>
        <h2>${pro.name}</h2>
        <p class="price">$${pro.priceMonthly}<span>/month</span></p>
        <p class="muted">or $${pro.priceYearly}/year (2 months free)</p>
        <ul class="checks">
          <li>${pro.maxDynamicCodes} dynamic codes</li>
          <li>Unlimited analytics history</li>
          <li>Custom colors on dynamic codes</li>
          <li>CSV export of every scan</li>
          <li>Priority email support</li>
        </ul>
        <a class="btn block" href="${ctx.user ? '/account' : '/signup?plan=pro'}">Go Pro</a>
      </div>
    </div>
    <div class="narrow">
      <h2>Compare that to the usual</h2>
      <table class="table">
        <thead><tr><th></th><th>${ctx.config.brand}</th><th>Typical QR SaaS</th></tr></thead>
        <tbody>
          <tr><td>Codes after you cancel</td><td><strong>Keep working</strong></td><td>Often deactivated</td></tr>
          <tr><td>Entry paid plan</td><td><strong>$${pro.priceMonthly}/mo</strong></td><td>$7–$15/mo</td></tr>
          <tr><td>Hidden scan caps</td><td><strong>None</strong></td><td>Common</td></tr>
          <tr><td>Cancel online</td><td><strong>Two clicks</strong></td><td>Sometimes requires contacting sales</td></tr>
        </tbody>
      </table>
    </div>
  </section>`;
  return layout({ ctx, title: 'Pricing', body, canonical: '/pricing', description: `Free static QR codes forever. Pro dynamic QR codes for $${pro.priceMonthly}/month, and they never stop working if you cancel.` });
}

export function pledgePage(ctx) {
  const body = html`
  <section class="wrap narrow prose">
    <h1>The no-hostage pledge</h1>
    <p class="lead">Printed QR codes live for years on menus, signs, packaging and business cards. Breaking them to force a payment is wrong. So we promise:</p>
    <ol>
      <li><strong>Your dynamic codes keep redirecting</strong> to their last destination on every plan, including Free and after cancelling Pro.</li>
      <li><strong>Downgrading never deletes codes.</strong> If you have more codes than your plan allows, the extra ones become read-only. They still work, you just can't edit them until you upgrade or remove others.</li>
      <li><strong>No per-scan limits.</strong> A code that suddenly goes viral will not be switched off for being popular.</li>
      <li><strong>Static codes never touch our servers.</strong> They work even if ${ctx.config.brand} disappears.</li>
      <li><strong>If we ever shut down</strong>, we will give at least 12 months' notice and let you export every destination so you can redirect elsewhere.</li>
    </ol>
    <p>The only time we disable a code is if it is used for phishing, malware, or other abuse covered by our <a href="/terms">terms</a>.</p>
    <p><a class="btn" href="/signup">Create a code you can trust</a></p>
  </section>`;
  return layout({ ctx, title: 'No-hostage pledge', body, canonical: '/no-hostage-pledge', description: 'Our promise: dynamic QR codes keep working even if you cancel. No scan caps, no deactivation.' });
}

export function useCasePage(ctx, slug) {
  const u = USE_CASES[slug];
  const body = html`
  <section class="hero">
    <div class="wrap hero-grid">
      <div>
        <p class="eyebrow">${u.title}</p>
        <h1>${u.h1}</h1>
        <p class="lead">${u.pitch}</p>
        <ul class="checks">${u.points.map((p) => html`<li>${p}</li>`)}</ul>
        <p><a class="btn" href="/signup">Create a dynamic code free</a></p>
      </div>
      ${generator()}
    </div>
  </section>`;
  return layout({ ctx, title: u.title, body, canonical: `/qr-code-for/${slug}`, description: u.pitch });
}

export function reportPage(ctx, { error, done, values = {} } = {}) {
  const body = html`
  <section class="wrap narrow">
    <h1>Report a malicious QR code</h1>
    ${done
      ? html`<p class="notice">Thank you. We review every report, usually within one business day.</p>`
      : html`
      <p>If a code from ${ctx.config.brand} led you to phishing, malware, or other abuse, tell us and we will investigate.</p>
      ${error ? html`<p class="error">${error}</p>` : ''}
      <form method="post" action="/report" class="stack">
        <label>Short link or code ID<input name="slug" required maxlength="200" value="${values.slug || ''}" placeholder="${ctx.config.baseUrl}/r/abc1234"></label>
        <label>What happened?<textarea name="details" required maxlength="2000" rows="5">${values.details || ''}</textarea></label>
        <label>Your email (optional)<input name="email" type="email" maxlength="200" value="${values.email || ''}"></label>
        <button class="btn">Send report</button>
      </form>`}
  </section>`;
  return layout({ ctx, title: 'Report abuse', body, canonical: '/report' });
}

export function legalPage(ctx, kind) {
  const { brand, supportEmail } = ctx.config;
  const terms = html`
    <h1>Terms of Service</h1>
    <p class="muted">Template. Have it reviewed by a lawyer for your jurisdiction before launch.</p>
    <h2>1. The service</h2><p>${brand} lets you generate static QR codes and create dynamic QR codes that redirect to destinations you choose, with scan statistics.</p>
    <h2>2. Your account</h2><p>You are responsible for activity under your account and for keeping your password secure. You must be at least 16 years old.</p>
    <h2>3. Acceptable use</h2><p>You may not use ${brand} for phishing, malware, scams, illegal content, harassment, spam, or to hide the destination of a link from moderation (for example by chaining URL shorteners). We may disable codes that break these rules, and we may close accounts used for abuse, without refund.</p>
    <h2>4. Payments</h2><p>Paid plans are billed in advance, monthly or yearly, through Stripe. You can cancel anytime from your account page and keep paid features until the end of the billing period. Except where required by law, payments are non-refundable, but contact us if something went wrong and we will be fair.</p>
    <h2>5. Code continuity</h2><p>Subject to section 3, dynamic codes continue redirecting to their last destination after a downgrade or cancellation, as described in our <a href="/no-hostage-pledge">no-hostage pledge</a>. If you delete your account, your dynamic codes stop working.</p>
    <h2>6. Disclaimer</h2><p>The service is provided "as is". To the maximum extent permitted by law, our liability is limited to the amount you paid us in the 12 months before the claim.</p>
    <h2>7. Contact</h2><p><a href="mailto:${supportEmail}">${supportEmail}</a></p>`;
  const privacy = html`
    <h1>Privacy Policy</h1>
    <p class="muted">Template. Have it reviewed for your jurisdiction (GDPR/CCPA) before launch.</p>
    <h2>Account holders</h2><p>We store your email address, a salted hash of your password, your codes and their settings. Payments are handled by Stripe. We never see or store your card number.</p>
    <h2>People who scan codes</h2><p>When someone scans a dynamic code we record the time, coarse device type, operating system, browser, and country when our hosting provider supplies it. We compute a daily, salted, one-way visitor hash to estimate unique scans. We do <strong>not</strong> store IP addresses, and the hash cannot be reversed or linked across days.</p>
    <h2>Free static generator</h2><p>The text you put in a static QR code is used only to draw the image and is not stored.</p>
    <h2>Cookies</h2><p>We use one essential cookie to keep you logged in. No advertising cookies.</p>
    <h2>Your rights</h2><p>You can export your data and delete your account from the account page at any time. Contact <a href="mailto:${supportEmail}">${supportEmail}</a> for anything else.</p>`;
  const isTerms = kind === 'terms';
  return layout({ ctx, title: isTerms ? 'Terms of Service' : 'Privacy Policy', body: html`<section class="wrap narrow prose">${isTerms ? terms : privacy}</section>`, canonical: `/${kind}` });
}

export function messagePage(ctx, { title, message, status }) {
  return layout({ ctx, title, noindex: true, body: html`<section class="wrap narrow center"><h1>${title}</h1><p class="lead">${message}</p>${status === 404 ? html`<p><a class="btn" href="/">Go home</a></p>` : ''}</section>` });
}
