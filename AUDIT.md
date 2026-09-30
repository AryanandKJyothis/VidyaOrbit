# Vidya Orbit Application Audit

## Executive summary

The copied application is a TanStack Start/Vite React SaaS with Supabase-backed
authentication and data access, workspace membership, and optional Razorpay
subscriptions. The initial copy had two P0 blockers: the integrations directory
was misspelled and the environment file was not named for Vite discovery. Both
were repaired. The application now typechecks, builds, serves the public
landing/login pages, and redirects unauthenticated protected-route requests to
`/login`.

The database and server code include tenant-scoped queries, Supabase RLS
migrations, bearer-token validation, service-role isolation, Razorpay signature
verification, and webhook deduplication. A static security review found no
concrete exploitable vulnerability in the reviewed changes.

## Original baseline problems

- `src/intergrations` was referenced everywhere as `src/integrations`, causing
  production build and TypeScript module-resolution failures.
- The client environment file was named `env`, which Vite does not load. The
  browser therefore threw a missing Supabase configuration error while mounting
  `AuthProvider`.
- TypeScript failed on a removed TanStack Router state property
  (`isTransitioning`) and on the root error component accepting `Error` where the
  current router API supplies `unknown`.
- The root metadata contained the typo “Manage you Center”.
- Bun is declared by the repository lock/configuration, but Bun is not installed
  in this environment. Dependencies were installed temporarily with pnpm for
  validation; generated pnpm files were removed afterward.

## Missing/broken files discovered

- No referenced source modules were missing after correcting the integrations
  directory name.
- All generated route-tree imports resolve.
- The repository contains the expected Supabase migration set and deployment
  configuration.

## Architecture

- Client entry and route composition are in `src/router.tsx` and
  `src/routes/__root.tsx`.
- TanStack Start server middleware and the Cloudflare-compatible server wrapper
  are in `src/start.ts` and `src/server.ts`.
- Client Supabase access uses the publishable key; server-only operations use
  `src/integrations/supabase/client.server.ts` and the service-role key.
- Authenticated UI is grouped under `src/routes/_authenticated.tsx`.
- Workspace-aware queries include the active owner ID and are additionally
  protected by database RLS.
- No broad architectural rewrite was necessary.

Remaining maintainability item: TanStack Start reports deprecated
`createServerFn().inputValidator()` calls in the workspace and admin server
function modules. They are non-blocking today but should be migrated to
`.validator()` during the next dependency upgrade.

## Security

- Static review found no concrete exploitable issue in the reviewed changes.
- API billing routes require a validated Supabase bearer token.
- Service-role access is confined to server modules and server routes.
- Razorpay webhooks verify the raw-body signature and deduplicate deliveries.
- Supabase migrations enable RLS for core tenant tables and restrict
  security-definer helper functions.

Live authorization, RLS behavior, webhook delivery, and payment reconciliation
could not be exercised without a real authenticated Supabase user, deployed
database, and Razorpay credentials.

## Database

The migration history defines institutes, students, batches, fees, attendance,
subscriptions, roles, workspaces, invites, receipt counters, and webhook
deliveries. Core tenant tables have owner-scoped policies and indexes. Static
query inspection found client reads and writes consistently include the active
workspace owner where the application controls that scope.

Remaining item: apply the migrations to a disposable Supabase project and run
cross-tenant read/write tests, including member permissions and direct RPC
calls.

## Functional, UI/UX, performance, and reliability

- Public landing, login, and protected-route redirect were verified in a local
  browser session.
- The root error and not-found states provide recovery/navigation actions.
- React Query keys include workspace identity for primary data hooks.
- Supabase failures are surfaced through route/query error handling rather than
  silently replaced with mock data.
- No production data or mock backend was introduced.

The full authenticated workflows (signup verification, invite acceptance,
student CRUD, attendance, fee receipts, subscription checkout, and webhook
reconciliation) require live services and credentials and remain unexecuted in
this environment.

## Changes made

1. Renamed `src/intergrations` to `src/integrations`.
2. Renamed the client environment file from `env` to `.env` so Vite loads the
   documented `VITE_*` variables.
3. Updated route progress state to use the current TanStack Router API.
4. Updated the root error component to accept the current router error type and
   safely display unknown errors.
5. Corrected root SEO title metadata.
6. Added a `typecheck` package script.

## Verification

- `tsc --noEmit`: passed.
- `vite build`: passed.
- Local Vite server: passed.
- Browser landing page: rendered successfully.
- Browser login page: rendered successfully.
- Browser `/dashboard` without a session: redirected to `/login`.
- `eslint .`: currently fails on pre-existing Prettier formatting violations in
  `eslint.config.js`, `scripts/repair-seroval-package.mjs`, and other existing
  files; no broad formatting rewrite was made as part of this audit.

## Production-readiness status

**Conditionally ready for deployment after environment and service validation.**
The application now has a coherent build/runtime baseline, but production
readiness still depends on applying migrations, configuring Supabase auth and
RLS, setting server-only Razorpay secrets, registering the webhook URL, and
executing authenticated end-to-end tests against a non-production environment.

## Recommended next steps

1. Install/use the repository's intended Bun version in CI and run
   `bun install`, `bun run typecheck`, and `bun run build`.
2. Add a CI lint step after resolving the existing Prettier violations or
   narrowing lint scope intentionally.
3. Deploy migrations to a disposable Supabase project and test tenant
   isolation, workspace permissions, and invite expiry.
4. Configure Supabase redirect URLs and Razorpay test-mode credentials, then
   exercise signup, login, billing, webhook retries, and subscription
   reconciliation.
5. Migrate deprecated TanStack server-function validators to `.validator()`.

## Phase 2 Findings

### Verified Working

- Re-traced the implemented routes and data paths for authentication, workspace
  membership, students, batches, attendance, fees, receipts, settings, and
  billing.
- Re-ran the production build and TypeScript validation after the Phase 2
  changes.
- Confirmed the public landing page, login page, and unauthenticated protected
  route behavior in a local browser session.
- Confirmed the server billing routes require a validated Supabase bearer token
  and that browser subscription state is read from Supabase/Razorpay-backed
  server state rather than a client success flag.

### Fixed

- Added explicit active-workspace owner predicates to student archive/restore,
  batch pause/resume, receipt lookup, and student attendance detail queries.
- Added owner predicates to attendance session/record reads and deletes, and
  prevented attendance queries from running before a workspace is selected.
- Scoped dashboard and analytics attendance queries and cache keys to the
  active workspace, preventing mixed metrics and cross-workspace cache reuse.
- Made attendance load errors fail visibly instead of being treated as an empty
  roster that could be destructively overwritten on save.
- Added user-facing handling for sign-out failures and clipboard permission
  failures during invite creation/resend.
- Added an additive migration,
  `20260922060000_enforce_cross_tenant_references.sql`, which rejects
  cross-workspace references between students/batches, payments/students,
  attendance sessions/batches, and attendance records/sessions/students.
  Existing RLS policies remain in place; this adds database-level relationship
  integrity for values a caller may know by UUID.
- Added a stale-webhook guard so a delayed Razorpay activation event cannot
  reactivate a subscription already marked canceled/expired for the same
  Razorpay subscription ID.

### Security

The Phase 2 security review found no confirmed exploitable vulnerability in the
reviewed auth, bearer-token, workspace, RLS, service-role, or Razorpay code.
Service-role usage remains server-only, webhook signatures are checked against
the raw body, and webhook deliveries are deduplicated.

The newly added relationship triggers address a concrete tenant-integrity
weakness: RLS validated the row being written, but foreign keys alone did not
prove that referenced rows shared its `owner_id`.

### Multi-Tenancy

Workspace membership maps a user to an institute owner. Client queries use the
active owner ID, while Supabase RLS delegates read/write access to
`has_resource_access(owner_id, auth.uid(), resource, write)`. Owner-only
workspace administration is enforced in server functions. The Phase 2
relationship migration now enforces same-owner references in the database,
including for direct API/RPC attempts that bypass the UI query conventions.

### Billing

Static tracing verified the lifecycle from server-created Razorpay
subscription, pending local state, signed webhook, idempotent delivery record,
subscription reconciliation, and plan/limit calculation. Client code cannot
mark a subscription paid. Delayed activation after cancellation is now ignored
for the canceled subscription ID.

Live checkout, payment failure/retry behavior, out-of-order delivery against a
deployed database, and Razorpay reconciliation still require test-mode
credentials and a deployed non-production environment.

### Database

The migration history has RLS and security-definer hardening for the core
tenant tables, subscriptions, workspaces, invites, receipt counters, and
webhook deliveries. Receipt numbering is atomic per owner. The new migration
adds cross-table ownership validation without destructive schema changes.

The migration itself was statically reviewed and included in the successful
application build; it still needs to be applied and exercised against a
disposable Supabase project.

### Functional

Student, batch, attendance, fee, receipt, workspace, and billing flows are
implemented rather than mocked. The main remaining verification boundary is
live authentication and database execution. No new placeholder handlers or
silent success fallbacks were introduced.

The workflow trace found and fixed mixed-workspace attendance metrics,
workspace-insensitive attendance cache keys, destructive attendance behavior
after silent read errors, silent logout failures, and misleading clipboard
success messages.

### UX

The Phase 2 fixes preserve the existing product design and add clearer failure
feedback when no active workspace is available before direct status mutations.
No broad visual redesign was justified by the repository evidence.

### Performance

Primary list queries retain workspace-scoped React Query keys and existing
stale-time settings. The Phase 2 changes add predicates rather than extra
requests. Large-list pagination remains a future concern because the current
hooks cap reads at 5,000 rows.

### Remaining Risks

- Full authenticated workflow coverage has not been executed without live
  Supabase credentials and a deployed database.
- The application still reports deprecated TanStack
  `createServerFn().inputValidator()` usage during build.
- Full-repository ESLint remains blocked by pre-existing formatting violations.
- Direct database migration execution and cross-tenant negative tests are still
  required before calling the system production-ready.

### Live Verification Required

Use a disposable Supabase/Razorpay environment to verify signup email
confirmation, session expiry/refresh, invite acceptance and revocation,
cross-tenant read/write denial, student-limit enforcement, payment/receipt
creation, Razorpay success/failure/cancellation/retry events, duplicate and
out-of-order webhooks, and subscription entitlement changes.

# Phase 3 — Real-World SaaS QA

## Test Environment

- Local TanStack Start/Vite development server on Node.js with the repository
  dependencies installed.
- Local `.env` contains only client-safe Supabase URL and publishable-key
  configuration. No Supabase service-role key or Razorpay credentials are
  available.
- No project-owned automated test suite exists yet.
- Supabase endpoint reachability could not be established from this environment,
  so no remote data was read or modified.
- Browser smoke coverage included the login route at desktop and 390x844
  mobile dimensions.

## Test Matrix

| Persona                     | Scope exercised locally                                                                            | External verification still required                             |
| --------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Unauthenticated visitor     | Landing/login rendering, protected-route behavior from Phase 1/2, invalid invite route code review | Signup, confirmation, password recovery, expired sessions        |
| Workspace owner/admin       | Workspace-aware source paths, team/invite error paths, owner-scoped writes                         | Authenticated CRUD, permissions, invite lifecycle, billing       |
| Workspace staff/member      | Permission and workspace predicates reviewed in client/server paths                                | Read/write denial for each restricted resource                   |
| Separate workspace/customer | Cross-tenant predicates and migration trigger coverage                                             | Two real users/workspaces with URL-ID and direct-request attacks |

## Passed

- `npm run qa:phase3` passed. The static QA script verifies corrected
  integration paths, workspace-scoped attendance queries, attendance error
  propagation, cross-tenant trigger presence, and required typecheck tooling.
- `npm run typecheck` passed.
- `npm run build` passed. Existing deprecation and bundler warnings remain
  non-blocking.
- Local browser login smoke test passed at 390x844 with no horizontal overflow.
- Invite creation/resend/copy failure paths now report accurate feedback.
- Attendance read errors are surfaced instead of being treated as empty data.
- Onboarding attendance completion is scoped to the active workspace.

## Failed

- Live authenticated multi-persona testing was blocked by unavailable
  non-production credentials and unreachable Supabase from this environment.
- Live RLS, trigger execution, direct API authorization, invite races, payment
  races, and Razorpay event ordering were not empirically verified.
- Full lint remains blocked by pre-existing repository formatting violations;
  targeted changed-file checks remain clean apart from known existing warnings.

## Fixed

- Added active-workspace scoping to the onboarding attendance query.
- Added active-owner scoping to imported student update mutations.
- Added clipboard rejection handling for the remaining invite copy action.
- Added sign-out failure feedback on the invite acceptance page.
- Added a repeatable `qa:phase3` static verification command.

## Security Findings

No new confirmed exploitable vulnerability was found in the local Phase 3
review. The principal residual security risk is evidentiary: RLS, security
definers, and the new same-workspace foreign-reference triggers still require
execution against a disposable database with authenticated users.

## Tenant Isolation Results

Static review confirms workspace predicates and workspace-aware query keys for
dashboard, analytics, attendance, onboarding, student detail attendance,
receipts, archive/restore, and batch status mutations. The migration
`20260922060000_enforce_cross_tenant_references.sql` covers the identified
student, payment, batch, session, and attendance-record relationships.
Negative cross-tenant requests remain untested against a live database.

## Billing Results

The existing server-side bearer-token, entitlement, webhook signature,
deduplication, and stale-activation protections remain in place. No Razorpay
test credentials are configured, so successful payment, failure, cancellation,
retry, replay, forged signature, wrong-customer, and out-of-order event
scenarios remain unverified.

## Database Results

The additive cross-tenant trigger migration is present and statically checked.
It has not been applied to a disposable Supabase/Postgres instance. Atomic
receipt numbering and existing RLS hardening were preserved. Query scale above
the existing 5,000-row cap remains untested.

## Remaining Risks

- No live proof of authentication, authorization, tenant isolation, billing,
  or database-trigger behavior.
- Concurrent attendance saves, duplicate payments, invite acceptance/revocation
  races, and large-list behavior remain untested.
- Build emits deprecated `inputValidator()` warnings and development browser
  hydration diagnostics involving `data-tsd-source`.

## External Verification Required

Before release, run the matrix in a disposable Supabase/Razorpay environment
with two workspaces and owner/staff accounts. Verify RLS and trigger denial for
cross-tenant reads and writes, direct API calls with forged IDs, session
expiry/refresh, invite replay/revocation, payment overpayment and duplicate
submission handling, receipt numbering under concurrency, and all signed and
out-of-order Razorpay webhook cases. Capture sanitized request IDs and result
status codes without storing credentials.

## Production Gate

**BLOCKED — not ready for controlled beta.** Local build and static/browser
checks pass, but the evidence required to claim production readiness—live
authenticated multi-tenant tests, database migration execution, and Razorpay
test-event verification—is unavailable in the current environment.
