import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(`Phase 3 QA failed: ${message}`);
}

assert(
  existsSync(resolve(root, "src/integrations")),
  "integrations directory is missing",
);
assert(
  !existsSync(resolve(root, "src/intergrations")),
  "misspelled integrations directory remains",
);
assert(existsSync(resolve(root, ".env")), "Vite environment file is missing");

const dashboard = read("src/routes/_authenticated/dashboard.tsx");
assert(
  dashboard.includes('queryKey: ["att-summary", active?.ownerId]') &&
    dashboard.includes('.eq("owner_id", active!.ownerId)'),
  "dashboard attendance is not workspace-scoped",
);

const analytics = read("src/routes/_authenticated/analytics.tsx");
assert(
  analytics.includes('queryKey: ["att-all", active?.ownerId]') &&
    analytics.includes('.eq("owner_id", active!.ownerId)'),
  "analytics attendance is not workspace-scoped",
);

const onboarding = read("src/components/onboarding-checklist.tsx");
assert(
  onboarding.includes('queryKey: ["onboarding-attendance", active?.ownerId]') &&
    onboarding.includes('.eq("owner_id", active!.ownerId)'),
  "onboarding attendance is not workspace-scoped",
);

const attendance = read("src/routes/_authenticated/attendance.tsx");
assert(
  attendance.includes("if (sessionError) throw sessionError;") &&
    attendance.includes("if (recordsError) throw recordsError;"),
  "attendance read failures are not surfaced",
);

const migration = read(
  "supabase/migrations/20260922060000_enforce_cross_tenant_references.sql",
);
for (const table of [
  "students_validate_workspace_refs",
  "payments_validate_workspace_refs",
  "attendance_sessions_validate_workspace_refs",
  "attendance_records_validate_workspace_refs",
]) {
  assert(migration.includes(table), `cross-tenant trigger ${table} is missing`);
}

const packageJson = JSON.parse(read("package.json"));
assert(packageJson.scripts?.typecheck, "typecheck script is missing");

console.log("Phase 3 static QA passed.");
