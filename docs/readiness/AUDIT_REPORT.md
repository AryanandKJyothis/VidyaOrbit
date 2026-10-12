# Vidya Orbit Phase 1 audit report

**DRAFT — read-only.** No application, pricing, or production changes. Companion register: [`ISSUE_REGISTER.md`](./ISSUE_REGISTER.md).

| | |
| --- | --- |
| Date | 12 Oct 2026 (updated same day) |
| Repo | `AryanandKJyothis/VidyaOrbit` @ `87ef957` (branch `cursor/readiness-phase1-audit-d508`) |
| Production | Vercel `dpl_4qPYBYkCFH799nw7vU9gvFEXwxr1` READY on **`87ef957` (#21)**. #19 `c080e33` and #20 `988ed41` are also live. |
| Live site | Public GET only: `https://www.vidyaorbit.in`. `/api/billing/pricing` `billingEnabled: true` since 8 Oct (COO). |
| Live database | User exports only (advisors; policies/grants/versions; **function bodies + triggers + storage** 12 Oct). No Supabase or Razorpay credentials. No live payment calls. |

---

## Executive summary

Vidya Orbit is a working Kerala coaching-centre SaaS: students, batches, fees, attendance, receipts, staff workspaces, live Razorpay billing, and a live WhatsApp overdue-fee reminder loop (#19–#21). Public pages respond 200. Repo RLS, workspace helpers, billing activation, and webhook signature checks are serious and internally consistent. A local PGlite replica of that policy model **blocked every cross-institute read/write we attempted** (11 isolation cases).

There is **no confirmed P0** (no proven data exposure, cross-institute leak, or corruption). Live `pg_get_functiondef` + trigger dump closed the three previously unverified SQL rows: **VO-001, VO-002, VO-003 are Verified OK / Closed**. Register: **54 rows** — P0 0; P1 4 confirmed; P2 15 confirmed + 10 suspected; P3 8 confirmed + 8 suspected; 8 closed; 1 planned/blocked.

There **are confirmed P1 correctness bugs** that will bite real centres: the students page counts archived rows toward the plan limit and can block Add; IST dates are wrong around midnight (payment default, attendance Yesterday, due-today overdue at 05:30); unmarked attendance saves as present; analytics silently truncates at 1000 attendance rows.

The known per-process rate limiter is real on Vercel. It does **not** leak data. It multiplies the limit by the number of isolates and is a P2 abuse/availability issue, not a P0.

PRs **#14–#18** (10 Oct) merged **without review**. #14 is the only one with security logic (workspace fallback removed, 1000-row paging, untrusted IP headers dropped). #15–#18 are UI. **#19–#21 are live production code** (Vision Academy overdue WhatsApp + UPI). The live column `institutes.upi_vpa` exists; `schema_migrations` still ends `20261008142028` — that is **migration-history drift** (VO-021), not a missing column.

Treat `docs/launch-audit.md` (30 Sep) as history. Its P0s (dead Supabase host, anon admin RPC, no CI, no tests) do not match today’s repo, advisors, or function dump.

**Recommended posture:** keep billing on; do not redesign; do not treat #19–#21 as unshipped. Fix VO-010–VO-013 before the next enrolment/attendance week. Then copy (VO-060 coming-soon, VO-061 GST) and version the drifted SQL (VO-021, VO-033). **VO-PRICING-1 is planned/blocked**, not a defect.

---

## Module findings

### Students and batches

CRUD is scoped to `active.ownerId` and then overwritten onto the payload (`use-data.ts:71-78, 214-216`). Reads go through `students_gated`. Invalid student IDs render “Student not found” (`students.$id.tsx:109-128`). Empty and error states exist on the list (QueryErrorState / EmptyState from #16).

**Confirmed:** plan-limit UI uses `students.data.length` including archived (VO-010). Import uses the RPC active count. Archive/restore is an UPDATE and does not re-run `enforce_student_limit` (VO-047, documented as insert-only). Add-student requires a phone; import does not (VO-032). No `(owner_id, name)` unique (VO-042). Batch capacity is a percentage only (VO-041). No RoutePermissionGate (VO-028).

**Not run:** signed-in create/edit/import against live.

### Fees and payments

Partials work as a running sum. Receipts use an atomic `receipt_counters` row and unique `(owner_id, receipt_number)`. Year in the number comes from `payment_date` (`20261008080000`). Receipt page scopes `fee_payments.id` + `owner_id` and has a not-found state. Staff without `fees:read` are gated on `/fees` and `/receipts/$id`.

**Confirmed:** payment default date and overdue comparison are UTC-based (VO-011). Overpay is allowed and then hidden (VO-015/VO-037). No payment idempotency.

**Live:** `fee_payments` policies are `has_resource_access(..., 'fees', ...)`. Client writes to `receipt_counters` are denied. `subscriptions` client DML is revoked (matches `20261008095000`). `validate_student_fee_write` is live and enabled (VO-003 closed).

### WhatsApp overdue reminders (Vision Academy — live in prod)

Prospect: Vision Academy (PSC coaching, Valanchery) asked for overdue-fee WhatsApp reminders: owner selects overdue students, one action sends each an overdue message (amount, due date, details, centre UPI) to the student’s linked number. Shipped as #19–#21; **this is production**.

| Check | Verdict |
| --- | --- |
| How messages are sent | `wa.me` deep links, not the WhatsApp Business API. One student: `window.open`. Two+: `FeeReminderQueue` one chat, then Next. No N-tab spray; popup-blocker toast exists. VO-068 closed. |
| “One click sends all” | Not implemented. The real path is select overdue → walk the queue. Safer for browsers. |
| Phone / +91 | Last 10 digits + `91` (`whatsAppDigits`). Shorter numbers → `no_phone` and the skip list. |
| Amounts | Outstanding `max(0, fee_total - sum(payments))`. Partials reduce `am`. No discount column. Zero/negative refused. VO-066 closed. |
| Dates | Overdue set inherits VO-011 (UTC). Message uses IST month via `+05:30` (`feeMonthLabel`) and **omits the calendar due date** (VO-062). |
| UPI | `upi://pay?pa&pn&am&cu=INR&tn` with `encodeURIComponent`. Invalid/missing VPA → no link. Tests cover `@`, `&`, paise, 50-char `tn`. VO-067 closed. |
| Institute isolation | Students/institute queries `.eq("owner_id", active.ownerId)` + RLS. Another institute cannot see or trigger. Same-institute `fees:read` staff can (VO-064). |
| `upi_vpa` UPDATE | Column exists live. `authenticated` SELECT/INSERT/UPDATE/REFERENCES; `anon` REFERENCES only. RLS `inst_update` = `has_resource_access(..., 'settings', true)` — **owner or settings:write staff of that institute**, not a cross-tenant write. Not owner-only. |
| Bulk cap | `selectAllOverdue` takes every in-memory overdue row (VO-065). |
| Double send / log | No `fee_reminder_sends` table; Open WhatsApp can be clicked again (VO-063). |
| Empty / error | No UPI: toast + Settings banner. No phone / invalid VPA / zero balance: skip list. |

Feature-inventory status: **live and used**; verified from repo + `fee-reminder.test.ts` + live column/grants. Not a signed-in click-through.

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
- Invites: token length 10–200; email match; email must be confirmed (`workspace.functions.ts:457-492`). `previewInvite` is public by design (token = capability).
- #14: if `listMyWorkspaces` fails, the UI shows **no** synthetic owner permissions (VO-054). That is a security improvement with an empty-workspace UX cost.
- UI `useCan` is not a security boundary; RLS is.

**Still not a signed-in session:** session length, Google provider live. Leaked-password protection is **disabled** (VO-025). `GOOGLE_AUTH_ENABLED` is false in repo (VO-044).

### Multi-institute isolation

Model: `owner_id` = institute owner UUID. Staff = `workspace_members.permissions`.

Live policies on students/batches/fees/attendance all call `has_resource_access(owner_id, auth.uid(), <resource>, write?)`. Institutes: member SELECT, settings write, owner insert. Billing/subscription/webhook/receipt/role tables deny client writes.

**Live function/trigger dump (12 Oct) closed the SQL gaps:**

- All 15 SECURITY DEFINER functions pin `search_path=public` and carry uid / admin / `service_role` guards on callable RPCs (VO-001 closed).
- Cross-tenant FK triggers are present and enabled (VO-002 closed). Body matches repo (nested IF so `NEW.batch_id` is only read on `students`).
- 3b `validate_student_fee_write` is SECURITY INVOKER, pinned, and enabled (VO-003 closed).
- Storage: no buckets, no policies (VO-049 closed).

**Local PGlite probe** (`isolation.probe.ts`, 11/11): as a non-superuser role with the repo helpers + policies + `validate_workspace_references`:

- Owner A cannot SELECT/UPDATE B’s student or INSERT a student with B’s `owner_id`.
- Owner A cannot pay B’s student (trigger) or attach B’s batch.
- Stranger and anon see no students.
- Staff with `students:read`, `fees:none` sees A, not B; `students_gated.fee_total` is null; payment insert denied.

`students_gated` is SECURITY DEFINER (advisor ERROR, VO-022). Isolation is the WHERE clause, not table RLS. Not a demonstrated leak.

FORCE RLS is off (VO-023). Anon still has default DML/TRUNCATE grants (VO-024). Neither is a PostgREST client bypass.

### Billing and public copy

Server computes amount (`billing-pricing.ts`). Live keys require `RAZORPAY_ALLOW_LIVE=true`. Runtime switch is `BILLING_ENABLED === "true"` (defaults off in `env.example`; **live billing has been on since 8 Oct**). Verify-payment: HMAC `order_id|payment_id`, order belongs to bearer, amount/currency/status + Razorpay fetch, then `activateOrderOnce`. Webhook: raw-body signature, `x-razorpay-event-id` dedupe, same activation RPC. Client cannot write `subscriptions` or `billing_orders` (live policies + grants). Existing PGlite tests cover activation races, setup double-charge, mid-term hold.

**Confirmed limitation:** in-memory rate limit (VO-020, VO-045). **Suspected:** new Razorpay order every click (VO-038); ignored webhook paths not marked handled (VO-039).

**Copy (COO items, recorded only):**

- **VO-060 (P2 confirmed):** public/legal copy still says online payment is coming soon / not live — `pricing.tsx:78,88-89`; `terms.tsx:79-80`; `privacy.tsx:79-81`; `public-faqs.ts:23,81` (also JSON-LD); `seo-documents.ts:130` / `public/llms.txt:30`; `landing-copy.ts:82`. Landing hero (`landing-page.tsx:324-325`) says “Paid plans by invoice” only. `/plan` does not say coming soon. `jsonLdOffers` has no coming-soon string.
- **VO-061 (P2 confirmed, compliance):** business is **not** GST-registered. Only in-app GST wording: `plan.tsx:211-215` “Prices are exclusive of GST. GST invoicing is coming soon.” `/pricing`, landing, FAQ, `llms.txt`, receipts, and emails (none in repo) have no GST. `docs/payments.md:105` repeats the /plan line. Phase 2 fix: remove the sentence; do not add GST to amounts.

**VO-PRICING-1** is a **planned change, Blocked** — not a defect. Keep current plans; add Lite 26–50 @ ₹299/₹2,999 (no setup); Starter becomes 51–100 @ ₹499/₹4,999; Free stays ≤25. Touch: plan codes/limits, Razorpay create-order/verify/webhook, `/pricing` `/plan`, FAQs, `llms.txt`, JSON-LD, tests. Razorpay **test mode on Preview** first; prod needs the founder’s tap and a COO review of the billing diff. Wait until Phase 2 P0/P1 fixes are verified.

**Not run:** live `orders.create`, live webhook, live capture. Per instructions.

### General quality

Public GET 200: `/`, `/login`, `/pricing`, `/terms`, `/privacy`, `/forgot-password`, `/join/not-a-real-token`, `/dashboard` (shell), `/robots.txt`, `/sitemap.xml`. Launch-audit’s “no robots/sitemap” is stale.

#16 added skip links, password show/hide, inline login errors, QueryErrorState + retry, empty dashboard copy. Loading screens exist. Double-submit: payment and checkout disable while pending; attendance uses `saving`. Pagination: main lists 1000-row pages; analytics/dashboard attendance do not. Mobile: bottom nav exists but skips Attendance; fee-reminder overflow was fixed in #21 (in prod). Env: server reads `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (not `VITE_`). Sep 30 note that Vercel stored secrets under `VITE_` names is **unverified today** (Vercel MCP returned no teams). CI: bun install, 183 vitest, eslint, typecheck, build. Probes are `*.probe.ts` and do not run in that job.

---

## Feature inventory (about the last three weeks)

Prospect request is recorded **only** when a commit/PR says so, or when the COO named one in this audit. No guessing.

| Feature | When | What the code does | Prospect named? | Verified how |
| --- | --- | --- | --- | --- |
| Mumbai empty-DB launch + RPC locks | 22–30 Sep | New project apply; `20260930153000` admin RPC null-uid + revoke; `20260930160000` `current_plan` member guard | Not stated | Migrations in repo; live function bodies match the locked guards. Advisors do not list admin summary as callable by `authenticated`. |
| Landing truth / pricing copy | early Oct, #8–#10 | Remove unbuilt claims; Kerala/owner-first landing | #10 text talks to Kerala centre owners, not a named prospect | `landing-copy.test.ts`, `seo.test.ts`; live title matches. **Stale claim remains:** checkout “not live” / “coming soon” (VO-060). |
| Razorpay in-app billing | 8 Oct, #7 | Orders, `billing_orders`, `activate_billing_order`, webhook, UI | Not stated | Strong unit/PGlite/handler tests. Live billing **on** since 8 Oct — checkout not exercised. |
| Student fee column gate (3a/3b) | 8 Oct | `students_gated` + 3b revoke/trigger | Not stated | App reads the view. Live SELECT on `students` revoked. **3b trigger live and enabled** (VO-003 closed). File still under `supabase/manual/` (VO-033). |
| Receipt year from payment_date | 8 Oct | `generate_receipt_number` | Not stated | Live function body matches repo. |
| SEO / GSC / AI crawlers | #12–#13 | robots, sitemap, JSON-LD, GSC file | Not stated | Live robots + sitemap 200 |
| Apple-like motion | #11 | Springs, materials | Not stated | `motion.test.ts`; visual not re-run |
| #14 production-readiness | 9 Oct, `88ddedf` | Workspace fail-closed, `fetchAllRows`, platform IP only | Not stated | Code review. Unreviewed merge. |
| #15 UI/UX | 9 Oct | Previews + skeletons | Not stated | Diff only (cosmetic) |
| #16 Checklist Design | 10 Oct | A11y, login errors, empty/error, footer | Not stated | Diff + live 404/footer not fully clicked |
| #17 four design skills | 10 Oct | Island nav, landing IA, motion tokens | Not stated | Diff; live landing HTML exists |
| #18 Valanchery micro polish | 10 Oct, `90bb8be` | 300px preview grid, hash scroll | Valanchery is a **sample** screenshot set, not a named customer request | Live landing still serves preview WebPs. This SHA is **not** current prod. |
| #19–#21 UPI WhatsApp fee loop | 11 Oct, **live on `87ef957`** | `upi_vpa`, `wa.me` queue, grants, modal wrap | **Vision Academy** (PSC coaching, Valanchery) — COO | Live column + grants; live function dump; `fee-reminder.test.ts` (11). History drift VO-021. Product issues VO-062/063; staff gate VO-064. |

If a later note says “a prospect asked for X” and it is not in the table, it was not identifiable from git or this COO pass.

---

## Security, integrity and isolation findings

**Working (repo + live export including function/trigger bodies + local probe):**

- Tenant tables have RLS enabled; policies are owner/member + resource permission.
- Client cannot write subscriptions, billing orders, webhook deliveries, receipt counters, user_roles, workspace membership.
- Billing verify + webhook verify signatures; activation is single-winner.
- `create-order` is owner-only.
- Admin mutations go through `assertAdmin` + service role.
- All 15 live SECURITY DEFINER functions pin `search_path` and guard callable RPCs (VO-001 closed).
- Cross-tenant trigger live and enabled (VO-002 closed).
- 3b fee-write trigger live and enabled (VO-003 closed).
- #14 does not invent owner rights on workspace load failure.
- Rate-limit IP is platform headers only (not spoofable `x-forwarded-for`).
- No Storage buckets (VO-049 closed).
- `upi_vpa` UPDATE is institute-scoped via settings:write RLS.

**Confirmed problems:** VO-010–VO-013 (correctness), VO-020/045 (limiter), VO-021 (UPI **history drift**), VO-022/046 (definer view + RPC surface), VO-025 (pwned passwords off), VO-026–028 (attendance UX/permissions), VO-060/061 (billing/GST copy), VO-062/063 (WhatsApp due date + no send log), plus P3 hardening (FORCE RLS, anon grants).

**Closed this pass:** VO-001, VO-002, VO-003, VO-034, VO-049, VO-066, VO-067, VO-068.

**PRs #14–#21 security impact:** #14 net positive. #15–#18 no RLS/auth/billing change. #19–#21 add a client `wa.me` loop and a settings-scoped UPI column; isolation holds; staff `fees:read` can open chats (VO-064). Process failure: zero reviews on #14–#18 (VO-035).

---

## What could NOT be inspected and why

| Item | Why |
| --- | --- |
| Live Supabase SQL as a user | No credentials. Instructed not to obtain any. |
| Live function **EXECUTE** ACLs | 12 Oct dump had `pg_get_functiondef`, `proconfig`, triggers, storage — not `routine_privileges`. Callable-by-`authenticated` set is from advisors (five helpers, VO-046) plus latest repo GRANTs. |
| Signed-in product flows | Would need a real owner/staff session. Not used. WhatsApp queue not click-tested in a browser. |
| Live Razorpay orders / webhooks / refunds | Instructed not to hit live payment endpoints. |
| Vercel env names/values today | Vercel MCP `get_git_deployment_context` returned no teams. Sep 30 `VITE_` secret names are stale-unverified. |
| Google OAuth / email templates / redirect URLs | Auth dashboard not available. |
| Real concurrent users on prod | Only local PGlite / static analysis. |
| Mobile devices | Code + public HTML only; no device lab. |

**Now covered (was a limitation yesterday):** live function bodies, `search_path`/`proconfig`, all public non-internal triggers + enabled flag, storage buckets/policies, production deploy SHA (`87ef957` / `dpl_4qPYBYkCFH799nw7vU9gvFEXwxr1`), live `upi_vpa` column + grants.

Destructive / failure probes ran only on **local PGlite** or as pure JS (`docs/readiness/probes/`). Default CI still runs 183 tests and does not load `*.probe.ts`.

---

## Recommended fix order

1. **P1 correctness (small, no pricing):** VO-010 (count active students), VO-011 (IST helpers), VO-012 (no silent present), VO-013 (paginate analytics). VO-026 can ride with VO-011.
2. **P2 copy (no logic):** VO-060 replace “coming soon” / “checkout is not live” on pricing, terms, privacy, FAQs/JSON-LD, `llms.txt`, `landing-copy.ts`. VO-061 remove the GST sentence on `/plan` (Phase 2; business is not GST-registered).
3. **P2 isolation / SQL hygiene:** VO-021 insert the missing `schema_migrations` rows for `upi_vpa` (column already live). VO-033 promote 3b into a versioned migration. VO-022 (invoker view or WHERE regression test). VO-046 revoke unused RPC. VO-028 permission gates.
4. **P2 WhatsApp (Vision Academy, already live):** VO-062 add the IST due-date line; VO-063 optional send log / disable re-open; VO-064 gate Remind on `fees:write` or owner.
5. **P2 billing ops:** VO-020 shared limiter (known item), VO-038 open-order reuse, VO-039 mark ignored webhooks handled. Do not turn billing off for these.
6. **P2 product:** VO-027 mobile Attendance, VO-015/037 payment idempotency and overdue-end-of-day, VO-036 dashboard paging, VO-032 phone rule.
7. **P3 / process:** VO-025 leaked-password toggle, VO-035 require review on data PRs, VO-029 `.validator()`, VO-040 monitoring, VO-023/024 grants only after the P1s.
8. **VO-PRICING-1 (planned, Blocked):** after Phase 2 P0/P1 fixes are done and verified. Preview + Razorpay test mode first; founder tap + COO billing-diff review before prod.

Phase 1 delivered only this register, this report, and optional local probes. No merge to `master`.
