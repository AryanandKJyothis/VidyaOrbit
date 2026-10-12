# Vidya Orbit Phase 1 audit report

**DRAFT — read-only.** No application, pricing, or production changes. Companion register: [`ISSUE_REGISTER.md`](./ISSUE_REGISTER.md).

| | |
| --- | --- |
| Date | 12 Oct 2026 |
| Repo | `AryanandKJyothis/VidyaOrbit` @ `87ef957` (branch `cursor/readiness-phase1-audit-d508`) |
| Claimed production | `master` @ `90bb8be` (#18). Master is **#19–#21** ahead. |
| Live site | Public GET only: `https://www.vidyaorbit.in` |
| Live database | User exports only. No Supabase or Razorpay credentials. No live payment calls. |

---

## Executive summary

Vidya Orbit is a working Kerala coaching-centre SaaS: students, batches, fees, attendance, receipts, staff workspaces, and live Razorpay billing. Public pages respond 200. Repo RLS, workspace helpers, billing activation, and webhook signature checks are serious and internally consistent. A local PGlite replica of that policy model **blocked every cross-institute read/write we attempted** (11 isolation cases).

There is **no confirmed P0** (no proven data exposure, cross-institute leak, or corruption). Register: 44 rows — P0 2 unverified; P1 4 confirmed + 1 unverified; P2 21; P3 16.

There **are confirmed P1 correctness bugs** that will bite real centres: the students page counts archived rows toward the plan limit and can block Add; IST dates are wrong around midnight (payment default, attendance Yesterday, due-today overdue at 05:30); unmarked attendance saves as present; analytics silently truncates at 1000 attendance rows.

The known per-process rate limiter is real on Vercel. It does **not** leak data. It multiplies the limit by the number of isolates and is a P2 abuse/availability issue, not a P0.

PRs **#14–#18** (10 Oct) merged **without review**. #14 is the only one with security logic (workspace fallback removed, 1000-row paging, untrusted IP headers dropped). #15–#18 are UI. #16–#18 did not change RLS or billing. Current master then added the UPI WhatsApp loop (#19–#21), which the **live database has not migrated** (`2026101112*`). Do not promote those commits until the two UPI migrations are applied.

Treat `docs/launch-audit.md` (30 Sep) as history. Its P0s (dead Supabase host, anon admin RPC, no CI, no tests) do not match today’s repo or the 12 Oct advisor export.

**Recommended posture:** keep billing on; do not redesign; fix VO-010–VO-013 before the next enrolment/attendance week; verify the three live-SQL Unverified P0/P1 rows (function bodies, cross-tenant trigger, 3b trigger) with a one-shot owner query.

---

## Module findings

### Students and batches

CRUD is scoped to `active.ownerId` and then overwritten onto the payload (`use-data.ts:71-78, 214-216`). Reads go through `students_gated`. Invalid student IDs render “Student not found” (`students.$id.tsx:109-128`). Empty and error states exist on the list (QueryErrorState / EmptyState from #16).

**Confirmed:** plan-limit UI uses `students.data.length` including archived (VO-010). Import uses the RPC active count. Archive/restore is an UPDATE and does not re-run `enforce_student_limit` (VO-047, documented as insert-only). Add-student requires a phone; import does not (VO-032). No `(owner_id, name)` unique (VO-042). Batch capacity is a percentage only (VO-041). No RoutePermissionGate (VO-028).

**Not run:** signed-in create/edit/import against live.

### Fees and payments

Partials work as a running sum. Receipts use an atomic `receipt_counters` row and unique `(owner_id, receipt_number)`. Year in the number comes from `payment_date` (`20261008080000`). Receipt page scopes `fee_payments.id` + `owner_id` and has a not-found state. Staff without `fees:read` are gated on `/fees` and `/receipts/$id`.

**Confirmed:** payment default date and overdue comparison are UTC-based (VO-011). Overpay is allowed and then hidden (VO-015/VO-037). No payment idempotency.

**Live:** `fee_payments` policies are `has_resource_access(..., 'fees', ...)`. Client writes to `receipt_counters` are denied. `subscriptions` client DML is revoked (matches `20261008095000`).

**UPI reminders (#19–#21)** exist on master only. Live DB lacks `upi_vpa` (VO-021). Claimed prod SHA `90bb8be` does not include that UI.

### Attendance

Sessions are unique on `(batch_id, session_date)`; records on `(session_id, student_id)`. Default page date is `todayISO()` (itself host-TZ fragile). Last batch and last date persist in localStorage (VO-026). Save is delete-all + insert (VO-014). Unmarked → present (VO-012). Yesterday uses `toISOString()` (VO-011). History on the student page is capped at 60. No RoutePermissionGate. Mobile nav omits the page (VO-027).

Local PGlite: duplicate session insert rejected.

### Reports and exports

Exports are client-side from already-loaded rows (`export.ts`). Student/fee exports honour list filters and omit fee columns without `fees:read`. Analytics `att-all` is a single unpaginated query (VO-013) — **confirmed silent truncation** at the PostgREST 1000 default. Dashboard 30-day attendance is the same pattern (VO-036) and filters `created_at`, not `session_date`. Payments-tab export may not match the visible filter (VO-051). No institute-wide attendance export route.

### Auth, sessions, staff, ownership

- Browser session: `persistSession` + `onAuthStateChange` (`use-auth.tsx`). Expired/signed-out session redirects to `/login`.
- Server functions: Bearer + `getClaims` (`auth-middleware.ts`). Invalid/missing token → Unauthorized.
- API billing: `parseBearerUserId`; create-order requires an `institutes` row for that user (staff → `NOT_OWNER`).
- Admin: `assertAdmin` via `user_roles` then `supabaseAdmin`. Page `ssr: false` after the #9 fix.
- Invites:  token length 10–200; email match; email must be confirmed (`workspace.functions.ts:457-492`). `previewInvite` is public by design (token = capability).
- #14: if `listMyWorkspaces` fails, the UI shows **no** synthetic owner permissions (VO-054). That is a security improvement with an empty-workspace UX cost.
- UI `useCan` is not a security boundary; RLS is.

**Unverified live:** session length, Google provider, leaked-password setting is **disabled** (VO-025). `GOOGLE_AUTH_ENABLED` is false in repo (VO-044).

### Multi-institute isolation

Model: `owner_id` = institute owner UUID. Staff = `workspace_members.permissions`.

Live policies on students/batches/fees/attendance all call `has_resource_access(owner_id, auth.uid(), <resource>, write?)`. Institutes: member SELECT, settings write, owner insert. Billing/subscription/webhook/receipt/role tables deny client writes.

**Local PGlite probe** (`isolation.probe.ts`, 11/11): as a non-superuser role with the repo helpers + policies + `validate_workspace_references`:

- Owner A cannot SELECT/UPDATE B’s student or INSERT a student with B’s `owner_id`.
- Owner A cannot pay B’s student (trigger) or attach B’s batch.
- Stranger and anon see no students.
- Staff with `students:read`, `fees:none` sees A, not B; `students_gated.fee_total` is null; payment insert denied.

**Therefore:** the *repo policy model* isolates. Live *policies* match that model. Live *function/trigger bodies* and 3b were not dumped (VO-001, VO-002, VO-003).

`students_gated` is SECURITY DEFINER (advisor ERROR, VO-022). Isolation is the WHERE clause, not table RLS. Not a demonstrated leak.

FORCE RLS is off (VO-023). Anon still has default DML/TRUNCATE grants (VO-024). Neither is a PostgREST client bypass.

Storage policies were `null` in the export (VO-049). App logos are URLs, not Storage.

### Billing

Server computes amount (`billing-pricing.ts`). Live keys require `RAZORPAY_ALLOW_LIVE=true`. Runtime switch is `BILLING_ENABLED === "true"` (defaults off in `env.example`; user says live billing is on). Verify-payment: HMAC `order_id|payment_id`, order belongs to bearer, amount/currency/status + Razorpay fetch, then `activateOrderOnce`. Webhook: raw-body signature, `x-razorpay-event-id` dedupe, same activation RPC. Client cannot write `subscriptions` or `billing_orders` (live policies + grants). Existing PGlite tests cover activation races, setup double-charge, mid-term hold.

**Confirmed limitation:** in-memory rate limit (VO-020, VO-045). **Suspected:** new Razorpay order every click (VO-038); ignored webhook paths not marked handled (VO-039).

**Not run:** live `orders.create`, live webhook, live capture. Per instructions.

### General quality

Public GET 200: `/`, `/login`, `/pricing`, `/terms`, `/privacy`, `/forgot-password`, `/join/not-a-real-token`, `/dashboard` (shell), `/robots.txt`, `/sitemap.xml`. Launch-audit’s “no robots/sitemap” is stale.

#16 added skip links, password show/hide, inline login errors, QueryErrorState + retry, empty dashboard copy. Loading screens exist. Double-submit: payment and checkout disable while pending; attendance uses `saving`. Pagination: main lists 1000-row pages; analytics/dashboard attendance do not. Mobile: bottom nav exists but skips Attendance; fee-reminder overflow was fixed in #21 (not in claimed prod). Env: server reads `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (not `VITE_`). Sep 30 note that Vercel stored secrets under `VITE_` names is **unverified today** (Vercel MCP returned no teams). CI: bun install, 183 vitest, eslint, typecheck, build. Probes are `*.probe.ts` and do not run in that job.

---

## Feature inventory (about the last three weeks)

Prospect request is recorded **only** when a commit/PR says so. No guessing.

| Feature | When | What the code does | Prospect named? | Verified how |
| --- | --- | --- | --- | --- |
| Mumbai empty-DB launch + RPC locks | 22–30 Sep | New project apply; `20260930153000` admin RPC null-uid + revoke; `20260930160000` `current_plan` member guard | Not stated | Migrations in repo; live advisors no longer list admin summary. Live `prosrc` unread. |
| Landing truth / pricing copy | early Oct, #8–#10 | Remove unbuilt claims; Kerala/owner-first landing | #10 text talks to Kerala centre owners, not a named prospect | `landing-copy.test.ts`, `seo.test.ts`; live title matches |
| Razorpay in-app billing | 8 Oct, #7 | Orders, `billing_orders`, `activate_billing_order`, webhook, UI | Not stated | Strong unit/PGlite/handler tests. Live billing **on** per user — checkout not exercised. |
| Student fee column gate (3a/3b) | 8 Oct | `students_gated` + optional 3b revoke/trigger | Not stated | App reads the view. Live SELECT on `students` revoked. 3b trigger unread (VO-003). |
| Receipt year from payment_date | 8 Oct | `generate_receipt_number` | Not stated | SQL in repo; not run live |
| SEO / GSC / AI crawlers | #12–#13 | robots, sitemap, JSON-LD, GSC file | Not stated | Live robots + sitemap 200 |
| Apple-like motion | #11 | Springs, materials | Not stated | `motion.test.ts`; visual not re-run |
| #14 production-readiness | 9 Oct, `88ddedf` | Workspace fail-closed, `fetchAllRows`, platform IP only | Not stated | Code review. Unreviewed merge. |
| #15 UI/UX | 9 Oct | Previews + skeletons | Not stated | Diff only (cosmetic) |
| #16 Checklist Design | 10 Oct | A11y, login errors, empty/error, footer | Not stated | Diff + live 404/footer not fully clicked |
| #17 four design skills | 10 Oct | Island nav, landing IA, motion tokens | Not stated | Diff; live landing HTML exists |
| #18 Valanchery micro polish | 10 Oct, `90bb8be` | 300px preview grid, hash scroll | Valanchery is a **sample** screenshot set, not a named customer request | Live landing still serves preview WebPs |
| #19–#21 UPI WhatsApp fee loop | 11 Oct | `upi_vpa`, `wa.me` queue, grants, modal wrap | PR #19: owner workflow; no named prospect | `fee-reminder.test.ts` (11). **Not in claimed prod. Not migrated live.** |

If a later note says “a prospect asked for X” and it is not in the table, it was not identifiable from git.

---

## Security, integrity and isolation findings

**Working (repo + live export + local probe):**

- Tenant tables have RLS enabled; policies are owner/member + resource permission.
- Client cannot write subscriptions, billing orders, webhook deliveries, receipt counters, user_roles, workspace membership.
- Billing verify + webhook verify signatures; activation is single-winner.
- `create-order` is owner-only.
- Admin mutations go through `assertAdmin` + service role.
- Cross-tenant trigger in repo; enforced in PGlite.
- #14 does not invent owner rights on workspace load failure.
- Rate-limit IP is platform headers only (not spoofable `x-forwarded-for`).

**Confirmed problems:** VO-010–VO-013 (correctness), VO-020/045 (limiter), VO-021 (UPI drift), VO-022/046 (definer view + RPC surface), VO-025 (pwned passwords off), VO-026–028 (attendance UX/permissions), plus P3 hardening (FORCE RLS, anon grants).

**Unverified P0/P1 live SQL:** VO-001, VO-002, VO-003.

**PRs #14–#18 security impact:** #14 net positive (fail-closed workspace, no silent 1000-row drop on main lists, no spoofed IP). Residual: `"unknown"` bucket; analytics still unpaged. #15–#18 no RLS/auth/billing change. Process failure: zero reviews (VO-035).

---

## What could NOT be inspected and why

| Item | Why |
| --- | --- |
| Live Supabase SQL as a user | No credentials. Instructed not to obtain any. |
| Live function bodies / triggers / column grants | Export had policies, table grants, RLS flags, migration versions, advisors — not `pg_proc.prosrc`, trigger list, or column ACLs. |
| Signed-in product flows | Would need a real owner/staff session. Not used. |
| Live Razorpay orders / webhooks / refunds | Instructed not to hit live payment endpoints. |
| Vercel env names/values today | Vercel MCP `get_git_deployment_context` returned no teams. Sep 30 `VITE_` secret names are stale-unverified. |
| Production deploy SHA | User said `90bb8be`. Landing JS hash `index-4WaylEwZ.js` contains no git SHA and no `upi_vpa`. |
| Storage buckets | `storage_policies` was null. |
| Google OAuth / email templates / redirect URLs | Auth dashboard not available. |
| Real concurrent users on prod | Only local PGlite / static analysis. |
| Mobile devices | Code + public HTML only; no device lab. |
| Whether a named prospect requested a feature | Git does not say, except Kerala-oriented copy and Valanchery **sample** screenshots. |

Destructive / failure probes ran only on **local PGlite** or as pure JS (`docs/readiness/probes/`). Default CI still runs 183 tests and does not load `*.probe.ts`.

---

## Recommended fix order

1. **Verify live SQL (no app change):** VO-001, VO-002, VO-003, VO-049. One owner-session query each. If a guard/trigger is missing, that becomes a real P0/P1 patch.
2. **P1 correctness (small, no pricing):** VO-010 (count active students), VO-011 (IST helpers), VO-012 (no silent present), VO-013 (paginate analytics). VO-026 can ride with VO-011.
3. **Do not ship #19–#21** until VO-021 migrations are applied. Claimed prod can stay on `90bb8be`.
4. **P2 isolation hardening:** VO-022 (invoker view or test), VO-046 (revoke unneeded RPC), VO-028 (permission gates), VO-033 (version 3b after VO-003).
5. **P2 billing ops:** VO-020 shared limiter (known item), VO-038 open-order reuse, VO-039 mark ignored webhooks handled. Do not turn billing off for these.
6. **P2 product:** VO-027 mobile Attendance, VO-015/037 payment idempotency and overdue-end-of-day, VO-036 dashboard paging, VO-032 phone rule.
7. **P3 / process:** VO-025 leaked-password toggle, VO-035 require review on data PRs, VO-029 `.validator()`, VO-040 monitoring, VO-023/024 grants only after the P1s.

Phase 1 delivered only this register, this report, and optional local probes. No merge to `master`.
