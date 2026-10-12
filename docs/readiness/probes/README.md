# Readiness probes (not in default CI)

These files are **local audit probes**. They are named `*.probe.ts` so
`bunx vitest run` (CI) does not pick them up.

Run from the repo root:

```bash
# Timezone + rate-limiter (no database)
bunx vitest run --config docs/readiness/probes/vitest.config.ts docs/readiness/probes/timezone.probe.ts docs/readiness/probes/rate-limit.probe.ts

# Cross-institute RLS on local PGlite (repo policy model, not live Supabase)
bunx vitest run --config docs/readiness/probes/vitest.config.ts docs/readiness/probes/isolation.probe.ts
```

Do not point these at production. Do not use live Razorpay or live Supabase credentials.
