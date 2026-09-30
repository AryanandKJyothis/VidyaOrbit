# Highest-ROI Improvements for Vidya Orbit

Right now `/` just redirects to `/dashboard` or `/login`. A first-time visitor sees a login form with no context, no proof, no reason to sign up. That is the single biggest leak. Below is a prioritized plan focused on _attract → convert → activate → retain_ — the four levers that actually move usage.

---

## 1. Build a real public landing page at `/` (highest ROI)

Today a curious visitor has nothing to look at. Replace the redirect with a focused, India-coaching-centre-targeted landing page.

Sections:

- **Hero** — clear value prop ("Run your coaching centre without spreadsheets"), one primary CTA ("Start free"), one secondary ("See a live demo"), product screenshot.
- **Problem → Solution strip** — 3 pains (attendance chaos, fee follow-ups, no visibility) → 3 features.
- **Feature grid** — Students, Batches, Attendance, Fees & receipts, Analytics, Team roles. Each with a real screenshot from the app, not stock icons.
- **"See it in 60 seconds"** — short autoplaying muted product walkthrough (Loom-style or animated screenshots).
- **Social proof** — testimonial slots (placeholder-friendly), "Built for Indian coaching centres", WhatsApp/UPI/Razorpay logos.
- **Pricing teaser** — Starter / Growth / Pro with student limits, link to `/billing`.
- **FAQ** — data safety, migration from Excel, refund, multi-branch.
- **Footer** — links to `/terms`, `/privacy`, `/login`, support email/WhatsApp.
- SEO: unique `<title>`, meta description, OG image, JSON-LD `SoftwareApplication`.

Logged-in users still get auto-redirected to `/dashboard`; logged-out users see the landing page.

## 2. Frictionless onboarding (first 5 minutes decide everything)

Goal: a brand-new sign-up should _see their own data_ inside 3 minutes, not an empty dashboard.

- **Sample data toggle** on first login: "Explore with sample students" — pre-seed 8 students, 2 batches, a few attendance sessions and fee payments. One click to wipe and start fresh.
- **Guided 4-step setup checklist** persisted on dashboard until complete: Add institute details → Create first batch → Add/import students → Mark first attendance.
- **One-click bulk student import** prominently surfaced (CSV + paste from Excel). This is the #1 reason coaching owners abandon — manual entry.
- **WhatsApp invite to staff** from the team settings page (deep link to `wa.me` with prefilled join link).

## 3. The "Whoa" demo moment

Add a public **`/demo`** route that boots the app in read-only mode with realistic seeded data (Indian names, real-looking fee/attendance numbers). No signup required. Link it from the landing hero. This converts skeptics far better than screenshots.

## 4. Retention hooks that pull users back

- **Daily WhatsApp / email digest** to the owner: "Yesterday: 42/50 present, ₹12,400 collected, 3 fees overdue." Already have reminder infra (`use-reminders.ts`) — extend it.
- **Auto fee-reminder messages** with one-tap WhatsApp deep links per overdue student (no API cost, opens user's WhatsApp).
- **Parent share link** (read-only) for each student showing attendance % and fee status. Viral loop — every parent who opens it sees "Powered by Vidya Orbit".
- **Monthly auto-generated report PDF** mailed to the owner on the 1st.

## 5. Trust & polish (cheap, high signal)

- Replace generic favicon/title with branded ones (SEO scan likely already flagged).
- Add a visible "Your data is encrypted & backed up daily" line + link to `/privacy`.
- Real testimonials section (even 2–3 named pilots beats none).
- Replace any "Lovable App" / placeholder copy.
- Add OG image so WhatsApp/Twitter shares render properly — this alone drives meaningful referral traffic in India.

## 6. Pricing page that converts

- Clear comparison table (students, batches, team seats, WhatsApp reminders, exports).
- "Most popular" highlight on Growth.
- INR-first pricing with monthly/annual toggle (annual = 2 months free).
- "Refund within 7 days, no questions" line.
- Live FAQ inline.

---

## Suggested build order (each ships independently)

1. Landing page at `/` + OG/SEO meta — **biggest single lift**
2. Onboarding checklist + sample-data toggle + Excel paste import
3. `/demo` read-only sandbox
4. Parent share link (viral) + WhatsApp fee reminders
5. Pricing page polish + testimonials
6. Daily digest + monthly PDF report

---

## Technical notes

- New routes: `src/routes/landing.tsx` (or refactor `src/routes/index.tsx` to render landing when logged out), `src/routes/demo.tsx`, `src/routes/pricing.tsx`, `src/routes/students.share.$token.tsx`.
- Sample-data seeder: a `createServerFn` that inserts demo rows scoped to the new user's institute, plus a "Clear sample data" action.
- Parent share: tokenized public route + a `student_share_tokens` table with RLS allowing `anon` SELECT only via the token-scoped RPC. Migration must include GRANTs.
- Digest: extend existing reminders hook + a cron-driven `/api/public/cron/daily-digest` (signed via shared secret) that emails owners.
- All new public pages get unique `<head>` (title, description, canonical, og:*) per the route-architecture rules.

---

## What I need from you before building

1. **Scope for this round** — do you want me to start with just #1 (landing page) for maximum focus, or bundle #1 + #2 (landing + onboarding) together?
2. **Brand direction for the landing page** — should I propose 2–3 visual directions (palette + typography + layout) for you to pick, or match the existing in-app look?
3. **Pricing numbers** — are the current plan prices/limits in `billing.tsx` final, or should I treat them as placeholder while designing the pricing page?
4. **Demo mode** — OK to ship a fully public `/demo` (no login) seeded with fake institute data, or do you prefer a "Try with sample data" toggle only after signup?
