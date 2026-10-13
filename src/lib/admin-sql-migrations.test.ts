import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ADMIN_LIST_PRICE_PAISE, annualMrrPaise } from "@/lib/admin-mrr";

const sql = readFileSync(
  "supabase/migrations/20261013120000_admin_platform_rpcs.sql",
  "utf8",
);

const FUNCTIONS = [
  { name: "admin_platform_overview", args: "" },
  { name: "admin_centres_list", args: "text, text, text, integer, integer" },
  { name: "admin_users_list", args: "text, text, integer, integer" },
  { name: "admin_user_detail", args: "uuid" },
  { name: "admin_payments_list", args: "text, text, integer, integer" },
  { name: "admin_alerts", args: "" },
] as const;

const F6_GUARD =
  "IF auth.role() IS DISTINCT FROM 'service_role' THEN\n    IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN\n      RAISE EXCEPTION 'Forbidden: admin only' USING ERRCODE = '42501';";

function functionBodies(source: string): string[] {
  const bodies: string[] = [];
  const re =
    /CREATE OR REPLACE FUNCTION public\.(\w+)\([\s\S]*?\$function\$; /g;
  let match: RegExpExecArray | null;
  const src = source.replaceAll("$function$;", "$function$; ");
  while ((match = re.exec(src))) {
    bodies.push(match[0]);
  }
  return bodies;
}

describe("admin platform RPC migration lock", () => {
  it("defines exactly the six read-only admin RPCs", () => {
    for (const fn of FUNCTIONS) {
      expect(sql).toContain(`CREATE OR REPLACE FUNCTION public.${fn.name}(`);
    }
    const created = [
      ...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)/g),
    ].map((m) => m[1]);
    expect(created.sort()).toEqual(
      FUNCTIONS.map((f) => f.name)
        .slice()
        .sort(),
    );
  });

  it("sets search_path, F6 guard, revoke-from-clients, service_role-only execute", () => {
    for (const fn of FUNCTIONS) {
      const start = sql.indexOf(
        `CREATE OR REPLACE FUNCTION public.${fn.name}(`,
      );
      expect(start).toBeGreaterThan(-1);
      const next = sql.indexOf(
        "CREATE OR REPLACE FUNCTION public.",
        start + 10,
      );
      const body = next === -1 ? sql.slice(start) : sql.slice(start, next);
      expect(body).toContain("SECURITY DEFINER");
      expect(body).toContain("SET search_path TO 'public'");
      expect(body).toContain("STABLE");
      expect(body).toContain(F6_GUARD);

      const sig =
        fn.args.length > 0
          ? `public.${fn.name}(${fn.args})`
          : `public.${fn.name}()`;
      expect(sql).toContain(
        `REVOKE ALL ON FUNCTION ${sig} FROM PUBLIC, anon, authenticated;`,
      );
      expect(sql).toContain(
        `GRANT EXECUTE ON FUNCTION ${sig} TO service_role;`,
      );
    }
    expect(sql).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\.admin_\w+[^;]*TO authenticated/,
    );
  });

  it("does not write data and does not expose secrets", () => {
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
    expect(sql).not.toMatch(/\bCREATE TABLE\b/i);
    expect(sql).not.toMatch(/\bADD COLUMN\b/i);
    const withoutComments = sql
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    expect(withoutComments).not.toMatch(/\btoken\b/);
    expect(withoutComments).not.toMatch(/\braw_body\b/);
    expect(withoutComments).not.toMatch(/\bsignature\b/);
  });

  it("MRR list prices in SQL match TS constants", () => {
    expect(sql).toContain(String(ADMIN_LIST_PRICE_PAISE.starter.monthly));
    expect(sql).toContain(String(ADMIN_LIST_PRICE_PAISE.growth.monthly));
    expect(sql).toContain(String(ADMIN_LIST_PRICE_PAISE.pro.monthly));
    expect(sql).toContain(String(ADMIN_LIST_PRICE_PAISE.starter.annual));
    expect(sql).toContain(String(ADMIN_LIST_PRICE_PAISE.growth.annual));
    expect(sql).toContain(String(ADMIN_LIST_PRICE_PAISE.pro.annual));
    expect(sql).toContain("round(499900::numeric / 12)");
    expect(sql).toContain("round(1000000::numeric / 12)");
    expect(sql).toContain("round(2500000::numeric / 12)");
    expect(annualMrrPaise(ADMIN_LIST_PRICE_PAISE.growth.annual)).toBe(
      Math.round(1000000 / 12),
    );
  });

  it("every function body is STABLE SECURITY DEFINER", () => {
    const bodies = functionBodies(sql);
    expect(bodies.length).toBe(FUNCTIONS.length);
    for (const body of bodies) {
      expect(body).toContain("LANGUAGE plpgsql");
      expect(body).toContain("STABLE");
      expect(body).toContain("SECURITY DEFINER");
    }
  });
});
