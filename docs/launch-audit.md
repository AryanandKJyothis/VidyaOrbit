# Vidya Orbit launch audit

Read-only audit of `D:\Folder\Documents\Vidya Orbit` on 30 September 2026. No code, database, Vercel, or Supabase settings were changed. Secret values are not recorded here. Env vars are named only.

## Plan revision (30 Sep 2026, evening)

These decisions replace P0.1, P0.3, question 3, and question 7 below wherever they conflict.

- `vdhaqyqhjjvogaqircip` is test data only. Do not copy, export, or migrate any rows from it. Do not restore it. Do not spend time on its backups. Skip that step.
- The launch database is a new Supabase project in the connected organization `sxzhajmjmxnsstsotdxm`. It starts empty. Created 30 Sep 2026 after you chose Mumbai: name `vidya-orbit`, ref `qyqomxuxtpbhnicbtmbq`, region `ap-south-1`, quoted cost $0/month. No rows were copied from the old project. Repo migrations, including `20260930153000_lock_admin_health_summary.sql`, were applied to that project only. `institutes` was empty after apply. Anonymous execute is revoked on `admin_institute_health_summary`, `admin_institute_health_detail`, and `apply_subscription_change`.
- Do not create that project until you confirm cost, plan limits, and region. Quote from `get_cost` on 30 Sep 2026: type `project`, recurrence monthly, amount `0`. Supabase docs say a Free plan allows two active projects; paused projects do not count. This org currently has one `ACTIVE_HEALTHY` project (`mes-hss-kalolsavam`) and five `INACTIVE` projects. A second free project should fit. Confirm before creation.
- Do not change production (Vercel env, domains, or the live deployment) until you say so.
- Fix `admin_institute_health_summary` in a new migration in the repo first. Apply migrations to the new project only after that fix is in the migration set. Do not edit historical migration files that already ran elsewhere.
- The fix must do both of these: reject callers whose `auth.uid()` is null unless the role is `service_role`, and `REVOKE EXECUTE` from `PUBLIC`, `anon`, and `authenticated` after every `CREATE` that would grant `PUBLIC` again. The same null-uid pattern exists on `apply_subscription_change`; include that function in the same migration so a later recreate cannot leave it open.

### Access retest (30 Sep 2026, 20:34 IST)

Vercel user: `aryanandkjyothis5@gmail.com` (`aryanandkjyothis5-1347`), hobby plan, default team `team_6EJjqmvBcG4LJoLQhMBALjnN`.

| Call                                                                                                          | Result                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_project` `vidya-orbit` with no team id                                                                   | Works. Framework `tanstack-start-lovable`. Latest deployment `dpl_EEApvLefGEagUN5meXyN2QFWU4ax` is `READY`, target `production`. `live` is false.   |
| `list_project_domains` with no team id                                                                        | Works. `vidyaorbit.in` (verified, 308 to `www.vidyaorbit.in`) and `www.vidyaorbit.in` (verified) are on project `prj_dLpuepvg1Jx2W7nQ2TruRA83HkNF`. |
| `filter_project_envs` with no team id, decrypt false                                                          | Works. Names only, preview and production. See the list below. Values were not decrypted.                                                           |
| `get_project` `vidya-center-mate` with no team id                                                             | Works. Separate older Vite project. Its default domains do not include `vidyaorbit.in`.                                                             |
| `list_teams`                                                                                                  | Empty.                                                                                                                                              |
| `get_project`, `filter_project_envs`, and `list_deployments` when `teamId` is `team_6EJjqmvBcG4LJoLQhMBALjnN` | 403. Message: not authorized for scope `aryanandkjyothis5-1347s-projects`; re-authenticate to that scope.                                           |

Reads of this project succeed when the team id is omitted, because that team is the token's default. They fail when the team id is sent. No Vercel write was attempted (no env edits, no deploys).

GitHub user `AryanandKJyothis` can read `VidyaOrbit` (profile and the earlier empty pull-request list). No GitHub write was attempted.

Supabase `list_projects` works for organization `sxzhajmjmxnsstsotdxm`. `vdhaqyqhjjvogaqircip` and `pegpucyekxczkqsztawp` are not in that list. `get_project` on the old ref is still permission denied.

Vercel env names present on preview and production (all `sensitive`, all tied to one Supabase integration store, none decrypted):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_SUPABASE_URL`
- `VITE_SUPABASE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_SUPABASE_SECRET_KEY`
- `VITE_SUPABASE_SUPABASE_JWT_SECRET`
- `VITE_SUPABASE_POSTGRES_URL`
- `VITE_SUPABASE_POSTGRES_URL_NON_POOLING`
- `VITE_SUPABASE_POSTGRES_PRISMA_URL`
- `VITE_SUPABASE_POSTGRES_HOST`
- `VITE_SUPABASE_POSTGRES_USER`
- `VITE_SUPABASE_POSTGRES_PASSWORD`
- `VITE_SUPABASE_POSTGRES_DATABASE`

Not present: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (the names `src/integrations/supabase/client.server.ts` reads), and every `RAZORPAY_*` name. The service role, JWT secret, and database password are stored under `VITE_` names. The app does not reference those `VITE_` secret names, and the scanned production client chunk did not contain `service_role` or `sb_secret_`. They are still the wrong prefix for server secrets. Do not change them until you approve a production env edit.

### Secrets in git

`.gitignore` ignores `.env`, `.env.local`, `.env.*.local`, and `.dev.vars`. `git check-ignore` confirms those three paths. `env.example` is tracked and every secret assignment in it is empty (length 0) in `master` and in local agent checkpoint commits. No `.env` file was ever added. No `sb_publishable_` or `sb_secret_` string is in `HEAD` outside the lockfile. `eyJ` hits in history are `bun.lock` integrity hashes, not API keys. `origin/master` is still the single commit `eb251b2`.

The Cursor workspace path `D:\Workspace\SAAS\Vidya Orbit` does not exist. This file is in the folder that actually contains the app.

## 1. What this project is

Vidya Orbit is a web app for Indian coaching centres and tuition institutes. Owners and staff are meant to manage students, batches, attendance, fees, and receipts, with plan limits and optional Razorpay subscriptions. The public landing page says so in `src/routes/index.tsx`, and the canonical site URL in that file is `https://vidyaorbit.in`.

Stack, from `package.json`, `vite.config.ts`, and `wrangler.jsonc`:

- React 19, TanStack Router / Start / Query, Tailwind 4, Radix
- Supabase for auth and data
- Razorpay for institute subscriptions
- Vite build, with a Cloudflare Workers config (`wrangler.jsonc`)
- Lovable tooling (`@lovable.dev/vite-tanstack-config`, `@lovable.dev/cloud-auth-js`)

The live site `https://vidyaorbit.in` returns HTTP 200 with `Server: Vercel`. The repo has no `vercel.json`. Local build output is a Cloudflare/Nitro worker. Hosting intent and what is actually serving traffic are not the same thing.

### Naming that does not match the code

| Source                              | Name                                          |
| ----------------------------------- | --------------------------------------------- |
| `src/routes/index.tsx`              | Vidya Orbit                                   |
| `docs/APP_OVERVIEW.md`              | Vidya Connect                                 |
| `DEPLOYMENT_READY.md` (22 May 2026) | Vidya Center Mate, and "ready for production" |
| `package.json`                      | `tanstack_start_ts`                           |
| `wrangler.jsonc`                    | `tanstack-start-app`                          |
| GitHub remote                       | `AryanandKJyothis/VidyaOrbit`                 |

`DEPLOYMENT_READY.md` is a claim from an older pass. This audit does not treat it as current evidence.

### Unclear

- Which Supabase project is supposed to be production. The live site and the local `.env` disagree, and the hostname in the live JavaScript does not resolve.
- Whether Razorpay is configured on the host that serves `vidyaorbit.in`.
- Whether Google OAuth redirect URLs are set for local, preview, and production.
- Whether the institutes on the local-linked database are real customers or test data.
- Whether Vercel `vidya-orbit` is linked to this GitHub repo. The Vercel token can see the project name and cannot read that team.

## 2. Inventory

### Pages and routes

Public: `/`, `/login`, `/forgot-password`, `/reset-password`, `/terms`, `/privacy`, `/pricing`, `/join/$token`.

Signed-in layout (`src/routes/_authenticated.tsx`, client redirect to `/login` when there is no session): `/dashboard`, `/students`, `/students/$id`, `/fees`, `/attendance`, `/batches`, `/analytics`, `/billing`, `/plan`, `/settings`, `/settings/team`, `/invites`, `/donate`, `/receipts/$paymentId`, `/admin/subscriptions`.

API: `src/routes/api/billing/start-subscription.ts`, `src/routes/api/billing/sync-subscription.ts`, `src/routes/api/webhooks/razorpay.ts`.

Server helpers: `src/server/require-bearer-user.ts`, `src/server/subscriptions-razorpay-sync.ts`, `src/lib/admin-subscriptions.functions.ts`, `src/lib/workspace.functions.ts`.

There is no `supabase/functions` directory. There is no test script in `package.json`. `scripts/phase3-static-qa.mjs` is a static assertion script, not a user-flow test.

### Data model (migrations)

Tables created in `supabase/migrations`: `institutes`, `batches`, `students`, `fee_payments`, `attendance_sessions`, `attendance_records`, `subscriptions`, `razorpay_webhook_deliveries`, `user_roles`, `subscription_audit`, `workspace_members`, `workspace_invites`, `receipt_counters`.

`subscriptions` uses `owner_id` as the primary key, not `id`.

### Third parties

Supabase, Razorpay, Vercel (live HTTP header), Cloudflare (local `wrangler.jsonc` only), Lovable auth helper, Google OAuth (enabled on the local-linked Supabase project; also called from `src/routes/login.tsx` via `lovable.auth.signInWithOAuth`).

## 3. Status

| Item                                   | Status                                         | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product purpose                        | Working as a coded product                     | `src/routes/index.tsx` hero and feature list                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Git repo, default branch               | Working                                        | Remote `https://github.com/AryanandKJyothis/VidyaOrbit.git`. `origin/HEAD` is `master`. Local `master` is `eb251b2` (22 Sep 2026), clean and even with `origin/master`. `git ls-remote --heads` shows only `master`.                                                                                                                                                                                                                                                                                                          |
| Open PRs                               | Working (none)                                 | GitHub API `list_pull_requests` for `AryanandKJyothis/VidyaOrbit` returned `[]`.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| CI                                     | Missing                                        | No `.github` directory. No workflow files.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `main` deployable                      | Incomplete                                     | Default branch is `master`, not `main`. One commit. No CI to prove a deploy.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Live site                              | Working for public HTML                        | `https://vidyaorbit.in` HTTP 200, `Server: Vercel`, HSTS `max-age=63072000`, title "Vidya Orbit - Coaching centre management, made calm".                                                                                                                                                                                                                                                                                                                                                                                     |
| Vercel project link, env, deployments  | Unverified                                     | `list_projects` search `vidya` returned `vidya-orbit` (`prj_dLpuepvg1Jx2W7nQ2TruRA83HkNF`), plus `vidya-atlas` and `vidya-center-mate`, team `team_6EJjqmvBcG4LJoLQhMBALjnN`. `get_project` and `list_deployments` returned 403: not authorized for scope `aryanandkjyothis5-1347s-projects`. `list_teams` returned no teams. Env var names, framework settings, and git branch are unread.                                                                                                                                   |
| Cloudflare production                  | Unverified / not what is serving the domain    | `wrangler.jsonc` exists. The live response is Vercel, not Cloudflare. No Cloudflare dashboard access in this audit.                                                                                                                                                                                                                                                                                                                                                                                                           |
| Local Supabase URL                     | Working as a reachable project                 | `.env` `SUPABASE_URL` / `VITE_SUPABASE_URL` host is `vdhaqyqhjjvogaqircip.supabase.co`. `supabase/config.toml` `project_id` is `vdhaqyqhjjvogaqircip`. DNS resolves.                                                                                                                                                                                                                                                                                                                                                          |
| Production Supabase URL                | Broken                                         | Live asset `https://vidyaorbit.in/assets/client-Kc1R4fAj.js` creates the client with host `pegpucyekxczkqsztawp.supabase.co`. `nslookup` of that host: Non-existent domain. Local build embeds the other host in `.output/public/assets/client-Bdl5xT7R.js`. Asset hashes differ, so production is not this local build.                                                                                                                                                                                                      |
| Client key type                        | Working (publishable / anon, not service role) | Local JWT payload `role=anon`, `ref=vdhaqyqhjjvogaqircip`. Production bundle key prefix is `sb_publishable` (length 46). No `service_role` or `sb_secret_` string in the scanned production client chunk or in `.output` JavaScript.                                                                                                                                                                                                                                                                                          |
| Service role in local env              | Missing                                        | `.env` key names: `SUPABASE_PROJECT_ID`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, and the three `VITE_` copies. No `SUPABASE_SERVICE_ROLE_KEY`. No Razorpay keys. `env.example` documents the missing names.                                                                                                                                                                                                                                                                                                               |
| Service role on Vercel                 | Unverified                                     | Cannot read project env (403).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Supabase account access                | Missing for both refs                          | Supabase MCP project list does not include `vdhaqyqhjjvogaqircip` or `pegpucyekxczkqsztawp`. `get_project` on the local ref: permission denied. Backups, redirect URLs, and dashboard auth settings are Unverified.                                                                                                                                                                                                                                                                                                           |
| Auth providers on local-linked project | Working as configured                          | `GET /auth/v1/settings` on `vdhaqyqhjjvogaqircip`: email true, Google true, other social providers false, `disable_signup` false, `mailer_autoconfirm` false.                                                                                                                                                                                                                                                                                                                                                                 |
| Live schema vs migrations              | Broken                                         | On `vdhaqyqhjjvogaqircip`, anon `GET` finds `institutes`, `batches`, `students`, `fee_payments`, `attendance_sessions`, `attendance_records`, `subscriptions` (no `id` column), `razorpay_webhook_deliveries`, `user_roles`, `subscription_audit`, `workspace_members`, `workspace_invites`. `receipt_counters` returns PostgREST `PGRST205` (table not in schema cache). That table is created in `supabase/migrations/20260613092000_harden_receipt_number_generation.sql`. Storage `GET /storage/v1/bucket` returned `[]`. |
| RLS in repo                            | Incomplete relative to later SQL               | Early migrations enable RLS and owner policies (`20260518064151_...sql` and later). Live enforcement for ordinary tables was not proven: anon `SELECT` returned empty arrays, which is also what an empty table looks like.                                                                                                                                                                                                                                                                                                   |
| Admin summary RPC                      | Broken                                         | `admin_institute_health_summary` is `SECURITY DEFINER`. The guard is `IF auth.uid() IS NOT NULL AND NOT has_role(...)`. A null uid (the anon key) skips the check. `20260705113753_...sql` drops and recreates the function and does not revoke `PUBLIC`. Postgres grants execute to `PUBLIC` on a new function. Live call with the local anon key: HTTP 200 and 5 rows. Row contents are not copied here. `admin_institute_health_detail` and `current_plan` returned 401 permission denied on that same key.                |
| Razorpay                               | Incomplete                                     | Code verifies webhook signatures and returns 503 when `RAZORPAY_WEBHOOK_SECRET` is missing (`src/routes/api/webhooks/razorpay.ts`, `src/lib/razorpay-env.ts`). Local `.env` has no Razorpay keys. `BILLING_DISABLED` is `false` in `src/lib/feature-flags.ts`. Whether production has the keys is Unverified.                                                                                                                                                                                                                 |
| Typecheck                              | Working                                        | `npm run typecheck` (`tsc --noEmit`) exit 0. Node v22.22.2. Bun is not installed; the repo has `bun.lock`.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Lint                                   | Broken as a gate                               | `npm run lint` exit 1. 1763 problems: 1749 `prettier/prettier` errors, 9 `react-refresh/only-export-components` warnings, 5 `react-hooks/exhaustive-deps` warnings.                                                                                                                                                                                                                                                                                                                                                           |
| Build                                  | Working                                        | `npm run build` exit 0, "built in 1.89s". Warnings: many `use client` directives may not be preserved; Nitro says Wrangler `main` is overridden.                                                                                                                                                                                                                                                                                                                                                                              |
| Automated tests                        | Missing                                        | No `*.test.ts` / `*.spec.ts` outside dependencies. `node scripts/phase3-static-qa.mjs` printed "Phase 3 static QA passed."                                                                                                                                                                                                                                                                                                                                                                                                    |
| Public routes on the live site         | Working as HTML                                | HTTP 200: `/`, `/login`, `/forgot-password`, `/reset-password`, `/terms`, `/privacy`, `/pricing`, `/join/not-a-real-token`.                                                                                                                                                                                                                                                                                                                                                                                                   |
| Signed-in flows                        | Unverified                                     | `/dashboard`, `/students`, `/billing` return HTTP 200 shells. The layout redirects in the browser only after `useAuth` (`src/routes/_authenticated.tsx`). Signup, Google, invite accept, student CRUD, attendance, fees, and checkout were not executed. Login cannot succeed against the production Supabase host while that DNS name does not exist.                                                                                                                                                                        |
| Placeholder contact                    | Broken                                         | `src/routes/pricing.tsx` links to `https://wa.me/919999999999`. `src/routes/index.tsx` uses `https://wa.me/?text=...` with no number. Billing uses `917025063047` (`src/routes/_authenticated/billing.tsx`).                                                                                                                                                                                                                                                                                                                  |
| SEO                                    | Incomplete                                     | Landing and root set title, description, and Open Graph in `src/routes/__root.tsx` and `src/routes/index.tsx`. No `robots.txt` or sitemap in `public/` or `src`.                                                                                                                                                                                                                                                                                                                                                              |
| Error monitoring and analytics         | Missing                                        | No Sentry, PostHog, Plausible, or analytics package usage under `src/`.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Rate limiting                          | Missing                                        | No rate-limit code under `src/`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Legal pages                            | Working as pages                               | `/privacy` and `/terms` are real copy, last updated 26 May 2026. They name the operator, a Gmail address, and a phone number, and they mention student data. They are not a substitute for a lawyer's review.                                                                                                                                                                                                                                                                                                                 |
| Account export / delete                | Incomplete                                     | In-app CSV/Excel export exists (`src/lib/export.ts`). Privacy says permanent deletion is by email, not a self-serve control.                                                                                                                                                                                                                                                                                                                                                                                                  |
| Custom domain and SSL                  | Working                                        | `https://vidyaorbit.in` over TLS with HSTS. Other hostnames and mailbox DNS are Unverified.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Transactional email                    | Unverified                                     | Supabase email provider is on and autoconfirm is off on the local-linked project. No custom domain mailbox is configured in the repo.                                                                                                                                                                                                                                                                                                                                                                                         |
| Accessibility                          | Unverified                                     | Some aria usage exists from earlier work. No automated or manual screen-reader pass in this audit.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Mobile layout                          | Unverified                                     | Code has a bottom nav in `src/routes/_authenticated.tsx`. No device viewport pass in this audit.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| README                                 | Missing                                        | No README in the project root.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Secrets in git                         | Working (names only)                           | `git grep` for `service_role` / `eyJ` / `RAZORPAY_KEY_SECRET` hits docs, `env.example`, and SQL role grants. `.env` is gitignored and not tracked.                                                                                                                                                                                                                                                                                                                                                                            |

## 4. Launch blockers vs later

### Blockers

1. The site that is already public does not point at a Supabase host that exists. Sign-in and all data features on `vidyaorbit.in` cannot work until that build is replaced or that project is restored.
2. The database in local `.env` (`vdhaqyqhjjvogaqircip`) lets the anon key read every institute's admin health summary (5 rows returned). That function is security definer and the latest migration reopens execute to `PUBLIC`.
3. That same database is behind the repo: `receipt_counters` is missing. Receipt numbering and any later security revokes cannot be assumed to be applied.
4. Local and production do not use the same Supabase project. Shipping this folder as-is would either keep the dead production host or attach the app to a database that is already leaking and is not in the connected Supabase account.
5. Billing cannot be turned on from this machine: no Razorpay secrets locally, and Vercel env could not be read. `BILLING_DISABLED` is false, so the UI still offers billing.
6. There is no CI, and `npm run lint` fails, so `master` is not a checked deploy pipeline.

### Not blockers for a first private launch, still needed

- Placeholder WhatsApp on `/pricing`.
- No error monitoring, analytics, or rate limits.
- No README, and older docs use other product names.
- Legal copy exists; a lawyer should confirm it covers student data.
- Account deletion is email-only.
- Prettier noise and no end-to-end tests.
- Cloudflare config vs Vercel reality.

## 5. Implementation plan

The evening revision at the top of this file wins where it conflicts with the steps below. Do not migrate the old test database. Create a new project only after you confirm region and the $0 quote. Fix the admin RPC in a new migration before applying migrations. Ask again before any production change.

Do this only after approval, on a new branch, never on `master`.

### P0 — before calling it launched

**P0.1 Confirm the one Supabase project production should use**

- Why: live JS uses `pegpucyekxczkqsztawp` (DNS does not exist). Local `.env` and `supabase/config.toml` use `vdhaqyqhjjvogaqircip` (reachable, leaking, not in the MCP account).
- Where: Vercel project `vidya-orbit`, Supabase dashboard, `.env`, `supabase/config.toml`.
- Effort: under an hour once you can open both dashboards.
- Depends on: you re-authenticating the Vercel team and opening the Supabase account that owns the real project.
- Done when: one project ref is written down, its API host resolves, and local, preview, and production env names (`SUPABASE_URL`, `VITE_SUPABASE_URL`, publishable key, server-only `SUPABASE_SERVICE_ROLE_KEY`) all use that ref. Service role is not in any `VITE_` name or client bundle.

**P0.2 Close the admin summary leak, then re-test**

- Why: anon HTTP 200 from `POST /rest/v1/rpc/admin_institute_health_summary` on `vdhaqyqhjjvogaqircip`. The guard treats a missing user id as allowed. `DROP FUNCTION` plus `CREATE` in `supabase/migrations/20260705113753_392e565f-f04f-465b-954f-82ba9a00aecc.sql` and `20260712115040_81679f50-c570-4b9f-bbce-6af7335fb413.sql` grants execute to `PUBLIC` again. The same `auth.uid() IS NOT NULL` pattern is in `apply_subscription_change` (`20260614060044_...sql`); that one is revoked later in `20260618010301_...sql` and was not called live because it can write.
- Where: a new migration; do not edit old migration files that may already have run.
- Effort: half a day, including a backup and a verified revoke.
- Depends on: P0.1 and a backup.
- Done when: the anon key gets 401 or 42501 and an empty error, a non-admin user gets forbidden, and only the service role used by the server admin page succeeds. Repeat the anon call on the production project, not only the local one.

**P0.3 Bring the chosen database in line with `supabase/migrations`**

- Why: `receipt_counters` is absent on `vdhaqyqhjjvogaqircip` while the migration exists. Later files also revoke function execute. Applying the folder blindly to the wrong project would be worse.
- Where: Supabase migration history vs `supabase/migrations`.
- Effort: half a day after a backup, longer if history has drifted.
- Depends on: P0.1 and P0.2 (fix the function before replaying July migrations that recreate it without a revoke).
- Done when: every repo table exists, `receipt_counters` is present, and a fresh anon call still cannot read the admin summary.

**P0.4 Ship a production build that uses that project**

- Why: `vidyaorbit.in` is already public and its client bundle cannot resolve its database.
- Where: Vercel `vidya-orbit` (or whichever project owns the domain). Repo build is `npm run build`.
- Effort: half a day after env is set.
- Depends on: P0.1. Preview first. Production only when you say so.
- Done when: the live `client-*.js` contains the chosen host, that host resolves, and email signup or login reaches a dashboard on a preview URL.

**P0.5 Decide billing before launch**

- Why: checkout and the webhook need `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RAZORPAY_PLAN_STARTER`, `RAZORPAY_PLAN_GROWTH`, `RAZORPAY_PLAN_PRO` (`src/lib/razorpay-env.ts`). None are in local `.env`.
- Where: Vercel server env (not `VITE_`), Razorpay dashboard, `src/lib/feature-flags.ts` if you want billing hidden.
- Effort: half a day if plans already exist, longer if not.
- Depends on: P0.4 so the webhook URL is the real domain `/api/webhooks/razorpay`.
- Done when: either `BILLING_DISABLED` is true and `/billing` redirects to `/plan`, or a test subscription in Razorpay test mode updates `subscriptions` and a bad signature returns 400.

### P1 — first week

**P1.1 CI on `master`**

- Why: nothing runs typecheck or build on push.
- Where: new `.github/workflows` (lint is not a useful required check until Prettier is fixed).
- Effort: a few hours.
- Done when: a pull request runs `npm run typecheck` and `npm run build` and both are green.

**P1.2 Make lint meaningful**

- Why: 1749 of 1763 lint problems are Prettier. Real warnings are buried.
- Where: `eslint.config.js` and a one-time format of `src/`.
- Effort: a few hours.
- Done when: `npm run lint` exits 0, or remaining issues are a short named list.

**P1.3 Auth URLs**

- Why: email confirm and Google use `redirect_uri` / `emailRedirectTo` from the browser origin (`src/routes/login.tsx`). Site URL and redirect allow-list were not readable.
- Where: Supabase auth URL config; Google Cloud OAuth client.
- Effort: a few hours.
- Done when: signup email and Google return to local, preview, and `https://vidyaorbit.in` without a redirect mismatch.

**P1.4 Error monitoring**

- Why: failures in billing and webhooks are only `console.error`.
- Where: a new server logger plus a hosted error sink. No vendor is in the repo today.
- Effort: half a day.
- Done when: a thrown error on preview shows up in that sink and is not printed to the user in production (`src/routes/__root.tsx` already hides details when `import.meta.env.DEV` is false).

**P1.5 Rate limits on billing and the webhook**

- Why: `start-subscription` and the webhook have no limit.
- Where: `src/routes/api/billing/*`, `src/routes/api/webhooks/razorpay.ts`.
- Effort: half a day.
- Done when: a burst of unauthenticated checkout calls is rejected, and a valid signed webhook still processes once (dedupe via `razorpay_webhook_deliveries`).

**P1.6 Replace the pricing WhatsApp placeholder**

- Why: `wa.me/919999999999` is not the support number used on the billing page.
- Where: `src/routes/pricing.tsx`, `src/routes/index.tsx`.
- Effort: under an hour.
- Done when: both links use the number you confirm, or the links are removed.

**P1.7 README and one product name**

- Why: there is no README. `docs/APP_OVERVIEW.md` and `DEPLOYMENT_READY.md` use other names.
- Where: `README.md`, those docs.
- Effort: a few hours.
- Done when: a new person can see what the app is, which env names are required, and that production is the Vercel project you confirm.

**P1.8 Tenant test**

- Why: RLS looked correct in SQL and was not proven with two users.
- Where: a disposable Supabase project or the confirmed project with two test users.
- Effort: one day.
- Done when: user A cannot read user B's students, payments, or attendance, including by calling RPCs with the anon and user JWTs.

### P2 — later

- Self-serve account export and delete, matching the privacy page.
- `robots.txt` and a sitemap for the public pages.
- Domain email instead of only the Gmail address in the privacy page.
- Automated accessibility and a mobile pass on dashboard, students, and fees.
- Pagination for large student lists (`PRODUCTION_IMPROVEMENTS.md` already lists this as future work).
- Remove or ignore Cloudflare `wrangler.jsonc` if Vercel stays the host, so the next deploy does not target the wrong platform.
- Migrate deprecated `createServerFn().inputValidator()` noted in `AUDIT.md`.

## 6. Questions only you can answer

1. Which Supabase project should Vidya Orbit use? The live site embeds `pegpucyekxczkqsztawp`, which does not resolve. This folder's `.env` uses `vdhaqyqhjjvogaqircip`, which is not in the Supabase account connected to Cursor.
2. Please re-authenticate Vercel for team `aryanandkjyothis5-1347s-projects` (id `team_6EJjqmvBcG4LJoLQhMBALjnN`). Until then, production env names, git branch, and deployment history stay Unverified. `vidya-center-mate` and `vidya-atlas` also exist; say which one is in scope.
3. Superseded. You confirmed the old project is test data. It will not be copied.
4. Should Google sign-in and Razorpay be on for launch, or should launch be email-only with billing hidden?
5. Is `+91 7025063047`, `aryanandkjyothis4@gmail.com`, UPI `jyothiskaryan@oksbi`, and the second phone on the donate page (`src/routes/_authenticated/donate.tsx`) what you want on the public site?
6. What is the correct WhatsApp number for `/pricing`? It is currently `919999999999`.
7. Superseded. Backups and auth URLs on the old project are skipped. Set site URL and redirect allow-list on the new project after it exists.
8. `gh` is not installed on this machine. Pull requests were listed through the GitHub connection and were empty. If you use a different GitHub account for this repo, confirm that.

No fixes were started.
