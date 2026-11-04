# Launch checklist

Everything in the code is done. These are the steps only the owner can do, because they need
accounts, money or a legal identity. Expected time: one afternoon.

## 1. Infrastructure (≈1 hour)

- [ ] Buy a short, trustworthy domain (short links appear inside every code, so shorter is better).
- [ ] Deploy to Fly.io following the README (`fly launch`, volume, secrets, `fly deploy`).
- [ ] Point the domain at Fly: `fly certs add yourdomain.com`, then add the DNS records it shows.
- [ ] Set `BASE_URL=https://yourdomain.com`. **Pick the final domain before anyone prints codes.**
      Short links contain it, and changing it later breaks printed codes.
- [ ] Enable backups: Fly volume snapshots are on by default. Add Litestream to R2/S3 for continuous backup.
- [ ] Set `ADMIN_EMAILS` to your email, sign up with it, and check that `/admin` loads.

## 2. Payments (≈30 min)

- [ ] Create a Stripe account and complete business verification.
- [ ] Products → add "KeepQR Pro" with two recurring prices: $5/month and $48/year.
      Copy the price IDs to `STRIPE_PRICE_PRO_MONTHLY` / `STRIPE_PRICE_PRO_YEARLY`.
- [ ] Developers → API keys → `STRIPE_SECRET_KEY`.
- [ ] Developers → Webhooks → add endpoint `https://yourdomain.com/billing/webhook` with events
      `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
      `customer.subscription.deleted`. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`.
- [ ] Settings → Billing → Customer portal: enable cancel, plan switching (monthly↔yearly), invoice history.
- [ ] Test end-to-end in test mode with card `4242 4242 4242 4242`: upgrade, check you're Pro,
      cancel in the portal, check you're Free and codes still redirect. Then switch to live keys.

## 3. Email & legal (≈30 min)

- [ ] Create a Resend account, verify the domain, and set `RESEND_API_KEY` and `MAIL_FROM`. Test "Forgot password".
- [ ] Set `SUPPORT_EMAIL` to a real inbox you read.
- [ ] Have `/terms` and `/privacy` reviewed for your jurisdiction. They are templates. Add your legal entity name.
- [ ] Optional: set `PLAUSIBLE_DOMAIN` for privacy-friendly traffic analytics.

## 4. Search (≈15 min)

- [ ] Add the site to Google Search Console and Bing Webmaster Tools, and submit `/sitemap.xml`.

## 5. First 10 customers (weeks 1–6)

- [ ] **Day 1:** Post on Show HN: "Show HN: KeepQR – dynamic QR codes that keep working after you cancel".
- [ ] **Day 1–3:** Share the hostage story on r/smallbusiness, r/restaurateur and r/realtors.
      Lead with the problem and help people. Mention the tool once.
- [ ] **Week 1:** Product Hunt launch (Tuesday–Thursday, 12:01am PT).
- [ ] **Weeks 1–4:** Email or visit 50 local restaurants, agents and print shops. Script below.
- [ ] **Weeks 2–6:** Publish one new SEO page per week (see BUSINESS.md §6).
- [ ] Reply to every signup personally for the first 100 users. Ask what they're printing.

### Outreach script

> Hi {name}, quick one: are the QR codes on your {menus/signs} from a free generator? A lot of
> them quietly switch off after a trial, and businesses only find out when customers complain.
> I built KeepQR so that can't happen: your code keeps working even if you never pay. It's free
> for up to 3 codes, and I'll set yours up for you if you like. — {you}

### Show HN draft

> **Show HN: KeepQR – dynamic QR codes that keep working after you cancel**
>
> Many QR generators make "dynamic" codes that redirect through their servers and then deactivate
> them when a trial ends, often after the code is printed on thousands of menus. I built the opposite:
> static codes are free with no account; dynamic codes (editable destination + scan stats) keep
> redirecting on every plan, forever, even if you cancel. Pro is $5/mo for more codes and analytics.
> No IPs stored. Node + SQLite, three dependencies. Feedback welcome, especially on the pledge wording.

## 6. Weekly operating rhythm (≈1 hour/week)

- [ ] Check `/admin`: signups, Pro count, MRR, abuse queue (resolve reports within 24h).
- [ ] Reply to support email.
- [ ] Ship one SEO page or one roadmap item.
- [ ] Check the Stripe dashboard for failed payments (Stripe retries automatically; past-due users keep Pro during retries).
