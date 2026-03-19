# Quizotic — Cost Analysis

**Last updated:** 2026-03-19

---

## Pre-Development Costs (One-Time)

| Item | Cost | Notes |
|---|---|---|
| Domain: Quizotic.in | Already owned | ~₹800-1,200/year renewal |
| Domain: Quizotic.net | Already owned | ~₹1,000-1,500/year renewal |
| Development tools | ₹0 | VS Code (free), Claude Code (existing subscription) |
| Design tools | ₹0 | Tailwind CSS (free), no Figma needed for v1 |
| **Total one-time** | **₹0** | Domains already purchased |

---

## Monthly Infrastructure Costs

### Stage 1: Development + Launch (0–100 users)

| Service | What | Free Tier | Paid Tier | Our Cost |
|---|---|---|---|---|
| **Railway.app** | Server + PostgreSQL | $5 free credits/month (trial) | $5/month | **₹420/month** |
| **Cloudflare** | CDN + DNS | Unlimited free | — | **₹0** |
| **Resend.com** | Transactional email | 3,000 emails/month | $20/month | **₹0** |
| **Razorpay** | Payments | Free setup | 2% per txn | **₹0** (until revenue) |
| **Let's Encrypt** | SSL | Free | — | **₹0** |
| **GitHub** | Code hosting | Free (private repos) | — | **₹0** |
| **Sentry** | Error monitoring | Free tier (5K events) | — | **₹0** |
| **Posthog** | Analytics | Free tier (1M events) | — | **₹0** |
| **Total Stage 1** | | | | **₹420/month** |

### Stage 2: Early Growth (100–500 users)

| Service | Change | Cost |
|---|---|---|
| Railway.app | Upgrade to $10/month (more RAM/CPU) | ₹840 |
| Cloudflare | Still free | ₹0 |
| Resend.com | May approach 3K limit; still free if mostly session-based | ₹0 |
| Razorpay | 2% of revenue | Variable |
| **Total Stage 2** | | **~₹840/month** |

### Stage 3: Scaling (500–2,000 users)

| Service | Change | Cost |
|---|---|---|
| Railway.app | $20/month (or migrate to DigitalOcean $24/month) | ₹1,700–2,000 |
| Redis (via Railway or Upstash) | Needed for Socket.io scaling (multiple server instances) | ₹420 ($5) |
| Neon.tech or Railway PG | Managed PostgreSQL with more storage/connections | ₹1,600 ($19) |
| Resend.com | Paid tier: $20/month (50K emails) | ₹1,700 |
| Cloudflare R2 | Image storage for quiz questions | ₹0 (10GB free) |
| **Total Stage 3** | | **~₹5,400/month** |

### Stage 4: Scale (2,000+ users)

| Service | Spec | Cost |
|---|---|---|
| DigitalOcean Droplet (or App Platform) | 4GB RAM, 2 vCPU | ₹4,000 ($48) |
| Redis (managed) | DigitalOcean Redis or Upstash Pro | ₹1,700 ($20) |
| Managed PostgreSQL | DigitalOcean Managed DB | ₹4,200 ($50) |
| Resend.com | Pro tier: $50/month (100K emails) | ₹4,200 |
| Cloudflare R2 | Storage scaling | ₹500 |
| **Total Stage 4** | | **~₹14,600/month** |

---

## Revenue vs Cost Projections

### Assumptions
- Pro plan: ₹299/month
- Institute plan: ₹999/month (avg 10 teachers)
- Free → Paid conversion: 5%
- Razorpay fee: 2% of revenue

### Scenario Projections

| Milestone | Free Users | Paid Users | MRR | Monthly Cost | Net Profit |
|---|---|---|---|---|---|
| Month 1-2 (building) | 0 | 0 | ₹0 | ₹420 | -₹420 |
| Month 3 (soft launch) | 50 | 2 Pro | ₹598 | ₹420 | +₹178 |
| Month 6 | 300 | 15 Pro + 2 Inst | ₹6,483 | ₹840 | +₹5,643 |
| Month 9 | 700 | 35 Pro + 5 Inst | ₹15,460 | ₹2,500 | +₹12,960 |
| Month 12 | 1,500 | 75 Pro + 10 Inst | ₹32,423 | ₹5,400 | +₹27,023 |
| Month 18 | 4,000 | 200 Pro + 20 Inst | ₹79,780 | ₹14,600 | +₹65,180 |

### Break-Even Analysis

| Question | Answer |
|---|---|
| Cost to build (time to MVP) | ₹840–1,260 (2-3 months hosting) + ₹0 (tools) |
| Monthly break-even | **2 Pro customers** (₹598 > ₹420 hosting) |
| Total investment to break-even | **~₹2,500** (domains + hosting during build) |
| Time to ₹10K/month profit | ~6-9 months from launch |
| Time to ₹50K/month profit | ~12-15 months from launch |

---

## Razorpay Fee Impact

| Monthly Revenue | Razorpay Fee (2%) | Net After Fee |
|---|---|---|
| ₹5,000 | ₹100 | ₹4,900 |
| ₹20,000 | ₹400 | ₹19,600 |
| ₹50,000 | ₹1,000 | ₹49,000 |
| ₹1,00,000 | ₹2,000 | ₹98,000 |

Razorpay fee is negligible — 2% is standard and lower than Stripe's India rates.

---

## Domain Renewal Costs

| Domain | Registrar | Renewal (annual) |
|---|---|---|
| Quizotic.in | (check registrar) | ~₹800-1,200 |
| Quizotic.net | (check registrar) | ~₹1,000-1,500 |
| **Total/year** | | **~₹2,000-2,700** |
| **Amortized/month** | | **~₹175-225** |

---

## Total Cost Summary

| Phase | Duration | Monthly Cost | Total Phase Cost |
|---|---|---|---|
| Building (no users) | 2-3 months | ₹420 | ₹840–1,260 |
| Launch (0-100 users) | 2-3 months | ₹420 | ₹840–1,260 |
| Early growth (100-500) | 3-6 months | ₹840 | ₹2,520–5,040 |
| Scaling (500-2000) | 6-12 months | ₹5,400 | ₹32,400–64,800 |

**Key insight: Infrastructure costs grow linearly, but revenue grows faster (each new paying customer is pure margin above hosting costs). This is a high-margin SaaS business.**

---

## What's NOT a Cost

| Item | Why it's free |
|---|---|
| Next.js | MIT license, open source |
| Socket.io | MIT license, open source |
| PostgreSQL | Open source |
| Tailwind CSS | MIT license |
| NextAuth.js | Open source |
| Chart.js / Recharts | Open source |
| wordcloud2.js | Open source |
| qrcode.js | Open source |
| Prisma ORM | Open source |
| VS Code | Free |
| Git / GitHub | Free for private repos |
| Cloudflare CDN | Free tier |
| Let's Encrypt SSL | Free |

**The entire tech stack has zero licensing costs.** The only costs are hosting infrastructure and payment gateway fees.
