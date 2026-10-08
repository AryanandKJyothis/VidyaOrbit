# Vidya Orbit

Web app for Indian coaching centres and tuition institutes. Owners and staff manage students, batches, attendance, fees, and receipts. Data and sign-in use Supabase. The public site is [https://vidyaorbit.in](https://vidyaorbit.in).

## Stack

React, TanStack Start, Tailwind, Supabase. Hosting is the Vercel project `vidya-orbit`. Razorpay checkout is turned off until server secrets are added (`src/lib/feature-flags.ts`).

## Local setup

1. Install [Bun](https://bun.sh).
2. Copy `env.example` to `.env` and fill in the Supabase URL and publishable key. Never commit `.env`. Contact phone/WhatsApp/email default to the founder’s number and email; leave the `VITE_CONTACT_*` lines commented unless you need to override or hide them (an empty value hides that channel).
3. `SUPABASE_SERVICE_ROLE_KEY` is server-only. Do not prefix it with `VITE_`.
4. `bun install`
5. `bun run dev`

The database is Supabase project `qyqomxuxtpbhnicbtmbq` (Mumbai). Schema lives in `supabase/migrations`. Do not copy data from the older test project.

## Scripts

- `bun run dev` — local app
- `bun run typecheck`
- `bun run build`
- `bun run lint`

## Launch notes

- Email sign-up and Google sign-in need the Supabase auth site URL and redirect allow-list to include `https://vidyaorbit.in`, `https://www.vidyaorbit.in`, and local dev.
- Paid plans stay on the in-app plan page until Razorpay keys and plan ids are set, then set `BILLING_DISABLED` to `false`.
