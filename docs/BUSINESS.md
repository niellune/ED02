# KeepQR: product & business plan

## 1. Why this product

The goal is an application that can make money with little capital, little operations work and
a single maintainer. Criteria used to choose the idea:

1. **Proven willingness to pay.** Dynamic QR codes are an established paid category. Incumbents
   (QR Code Generator PRO, QR Tiger, Uniqode, Flowcode and others) charge roughly $5–$40/month.
2. **Recurring revenue.** Once a code is printed, the customer needs it to keep working for years,
   so subscriptions are naturally sticky.
3. **Free acquisition.** "qr code generator" and its long-tail variants are among the most-searched
   tool queries on the web. A genuinely free generator is the top of the funnel.
4. **Cheap to run.** A redirect plus a database insert per scan. One small VM serves millions of scans/month.
5. **A clear wedge.** The category's best-known complaint is the *bait-and-switch*: "free" dynamic
   codes that get deactivated after a trial, often after printing. Customers call these codes
   "held hostage." KeepQR builds its brand on the opposite promise.

## 2. Customer

**Primary:** owners and marketers of small businesses who print things: restaurants and cafés,
real-estate agents, event organizers, retailers, small consumer brands, freelancers with business cards.

**Their job to be done:** "Put a code on something physical, change where it goes later without
reprinting, and know whether people use it."

**What they fear:** printing 5,000 flyers and having the code die. Surprise bills. Cancel mazes.

## 3. Positioning

> KeepQR: dynamic QR codes that never get held hostage.

Proof points, all enforced in code and covered by tests:
- Dynamic codes keep redirecting on every plan, including after cancellation.
- Downgrades never delete codes. Extra codes become read-only, never dead.
- No scan caps. Two-click self-serve cancel through the Stripe portal.
- Static codes need no account and no server, so they work forever.
- No IP addresses stored.

## 4. Pricing

| | Free | Pro |
| --- | --- | --- |
| Price | $0 | **$5/mo** or **$48/yr** |
| Static codes | Unlimited | Unlimited |
| Dynamic codes | 3 | 250 |
| Analytics history | 30 days | Unlimited |
| Custom colors | — | ✓ |
| CSV export | — | ✓ |

**Why these numbers.** $5 is below every major competitor's entry plan, which makes it easy to
choose on comparison pages and lets the pledge do the persuading. Three free dynamic codes is
enough for a business to rely on the product, and real reliance is what converts. The upgrade
triggers are natural: a 4th code, wanting history older than 30 days, brand colors, or exporting
data for a report. Annual pricing (2 months free) improves cash flow and retention.

**Next pricing steps, once there is data:** a Business tier ($19/mo: team seats, custom domain for
short links, logo-in-code, bulk creation, API). Test $7 vs. $5 for Pro after 50 paying customers.

## 5. Unit economics

| Item | Monthly cost |
| --- | --- |
| Fly.io shared-cpu-1x 256 MB + 1 GB volume | ~$3–5 |
| Domain | ~$1 |
| Email (Resend free tier, 3k/mo) | $0 |
| Backups (Cloudflare R2 via Litestream, <10 GB) | ~$0–1 |
| **Total fixed** | **≈ $5–7** |

Stripe takes 2.9% + $0.30, so **$4.55 net per $5 subscriber** (about $46.30 net per annual plan).
**Break-even: 2 paying customers.** Marginal cost per customer is effectively zero.

### Revenue model (honest version)

These are planning assumptions, not promises. They need validating with real traffic.

| Metric | Conservative | Target |
| --- | --- | --- |
| Monthly generator visitors (month 6) | 2,000 | 10,000 |
| Visitor → signup | 2% | 4% |
| Signup → Pro (cumulative, within 90 days) | 3% | 6% |
| Monthly churn | 4% | 2.5% |
| Pro customers at month 12 | ~15 | ~150 |
| MRR at month 12 | ~$75 | ~$750 |

SEO is slow: expect little traffic for the first 2–4 months. The fastest early revenue comes from
direct outreach to local businesses and communities (see LAUNCH.md). A realistic first milestone
is **10 paying customers**. That proves the funnel, and from there the job is pouring traffic in.

## 6. Growth plan

1. **SEO tool funnel (compounding).** The homepage *is* the free generator. Use-case pages
   (`/qr-code-for/*`) target long-tail queries such as "qr code for restaurant menu". Add one new
   page per week: wifi QR, vCard QR, Google review QR, PDF QR, and comparison pages
   ("Alternative to [competitor] that doesn't deactivate codes").
2. **The hostage story.** Write up the bait-and-switch problem with sources. It suits Reddit
   (r/smallbusiness, r/restaurateur, r/realtors, r/Entrepreneur), Hacker News "Show HN", and
   Product Hunt. Offer a "rescue" guide: how to move an expiring code from another service
   (re-create the destination in KeepQR and reprint once, never again).
3. **Direct sales, local.** Walk into or email 50 restaurants and agents. Offer a free month of Pro
   for a testimonial.
4. **Partnerships.** Print shops and sign makers: they hear "my QR code stopped working" constantly.
   Offer a 30% recurring referral commission (Stripe promo codes per partner).
5. **Product-led loops.** Later: an optional, small "Made with KeepQR" landing for scans of
   deleted codes, and a public "pledge" badge that customers can show.

## 7. Metrics to watch (see `/admin`)

- Weekly signups, activation (created ≥1 dynamic code **and** it got ≥1 real scan), Pro conversions, MRR.
- North-star metric: **dynamic codes with a scan in the last 7 days.** A code being scanned means
  it is printed and in use, which is what makes a customer stay.
- Abuse reports per week (keep response under 24h).

## 8. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Phishing/malware use (redirect services attract it) | Strict URL validation, shortener-chaining ban, blocklist env, abuse report form, admin disable. Next: Google Safe Browsing lookup on create/edit. |
| Losing the database = broken printed codes | Volume snapshots + Litestream continuous backup; documented in README. |
| The pledge costs money (free users scanning forever) | Redirects cost microcents; scans are tiny rows. Prune scan rows of free users older than 30 days if storage ever matters. |
| Commodity market | Compete on trust and price, not features; own the "no hostage" brand. |
| Single-maintainer bus factor | Small codebase (≈2k lines), 3 dependencies, test suite, CI. |

## 9. Roadmap

- **Now (v1, shipped):** everything in the README feature table.
- **Next:** Google Safe Browsing check; Wi-Fi, vCard and Google-review code types; logo in code
  center; bulk create from CSV; welcome and "your code got its first scan!" emails (activation).
- **Later:** Business tier with teams, custom short-link domains, API, and webhooks on scan.
