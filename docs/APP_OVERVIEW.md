    # Vidya Connect — SaaS App Overview

## What the app is

`Vidya Connect` is a modern SaaS admin dashboard built for coaching centres, tuition institutes, and small training academies.

It combines institute operations into one product:

- Student management
- Batch management
- Attendance tracking
- Fee tracking and receipts
- Analytics dashboards
- Billing and subscription plan gating
- Institute settings and support/donation messaging

The app is implemented as a full-stack TanStack Start application:

- `React` + `TypeScript`
- `@tanstack/react-router`
- `@tanstack/react-query`
- `Supabase` for authentication, database storage, and server-side admin operations
- `Cloudflare Workers` via `wrangler.jsonc`
- `Tailwind CSS`, `Radix UI`, and `Lucide` for UI

The source is organized so that frontend, server routes, and Supabase integration are all in one place and compiled through a Vite/TanStack Start build.

## What is prepared right now

### Core readiness

- The `Vidya Connect` folder contains the full working source of the app.
- `npm run build` completes successfully, confirming the app compiles.
- Supabase client and server integrations are wired correctly.
- Route structure is generated and includes the public and authenticated pages.
- Billing is scaffolded with Razorpay integration and is designed to be enabled once credentials are added.

### Config and setup

- `.env.example` documents the exact required secrets.
- Current `.env` includes `SUPABASE_URL` and publishable key values.
- The missing production secrets are expected and handled safely by the code.
- The app uses a `SUPABASE_SERVICE_ROLE_KEY` for server-side admin operations and webhook handling.

### Feature surface prepared

Public pages:

- `/` — home or landing page
- `/login` — sign in / sign up
- `/forgot-password`
- `/reset-password`
- `/terms`
- `/privacy`

Authenticated app pages:

- `/dashboard`
- `/students`
- `/students/$id`
- `/fees`
- `/attendance`
- `/batches`
- `/analytics`
- `/billing`
- `/settings`
- `/donate`
- `/receipts/$paymentId`

### Razorpay billing flow

The billing integration is implemented as:

- Client-side plan checkout UI in `src/routes/_authenticated/billing.tsx`
- Server-side billing route at `src/routes/api/billing/start-subscription.ts`
- Razorpay HTTP helpers in `src/lib/razorpay-http.ts`
- Webhook verification in `src/routes/api/webhooks/razorpay.ts`
- Subscription sync logic in `src/server/subscriptions-razorpay-sync.ts`
- Razorpay environment config in `src/lib/razorpay-env.ts`

The app is ready to receive these credentials:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `RAZORPAY_PLAN_STARTER`
- `RAZORPAY_PLAN_GROWTH`
- `RAZORPAY_PLAN_PRO`

### Supabase compatibility

- Database schemas are typed in `src/integrations/supabase/types.ts`.
- The app uses standard Supabase auth for user sessions.
- Supabase service-role access is separated into `src/integrations/supabase/client.server.ts`.
- Server APIs validate bearer tokens and use Supabase claims.
- The table structure includes `students`, `batches`, `fee_payments`, `attendance_sessions`, `attendance_records`, `institutes`, and `subscriptions`.

### Build and deployment

- `package.json` is configured for Vite build, lint, and format.
- `vite.config.ts` is configured for TanStack Start and Cloudflare server entry wiring.
- `wrangler.jsonc` is ready for Cloudflare Workers deployment.

## Who this is useful for

This application is useful for:

- Coaching centre owners who need a central dashboard for operations.
- Tuition institute administrators managing students, courses, and attendance.
- Small and medium training academies that need billing controls and receipts.
- Tutoring businesses that want to replace spreadsheets and manual tracking.
- Teams looking for a unified institute management tool with payment plan gating.

It is especially useful when the business needs:

- a student database with batch and attendance management
- fee collection and receipt generation
- plan-based student limits
- automated billing activation through Razorpay
- no-code admin workflows with Supabase-backed auth and storage

## Who the audience is

The target audience for `Vidya Connect` is:

- Coaching institute operators in India (especially South India / Kerala)
- Tuition classes and exam coaching centers
- Private tutors scaling to a small academy model
- Admin staff responsible for student onboarding and fee tracking
- Finance teams in small educational businesses
- Early-stage edtech businesses that need a Supabase-compatible SaaS backend

## Current status summary

- The application is fully coded and ready to build.
- Supabase authentication and app data flows are implemented.
- Razorpay billing is implemented but not enabled until credentials are provided.
- The project is ready for deployment once the secret keys are added.

## Recommended next step

Add the missing credentials to your deployment environment, including:

- `SUPABASE_SERVICE_ROLE_KEY`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `RAZORPAY_PLAN_STARTER`
- `RAZORPAY_PLAN_GROWTH`
- `RAZORPAY_PLAN_PRO`

After that, the app should be ready to run with Supabase and Razorpay.
