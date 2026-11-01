import { describe, expect, it } from "vitest";
import {
  atStudentPlanLimit,
  canRestoreArchivedStudent,
  formatLimit,
  isUnlimited,
  PLAN_STUDENT_LIMITS,
  planLimitHeadcount,
  remainingStudentSlots,
  studentLimitForPlan,
  toClientLimit,
  UNLIMITED_STUDENT_SENTINEL,
} from "@/lib/plan-limits";

describe("plan-limits", () => {
  it("Nov 1 2026 caps: free 25, Spark 50, Orbit 150, Centre 400, Campus unlimited", () => {
    expect(PLAN_STUDENT_LIMITS).toEqual({
      free: 25,
      starter: 50,
      growth: 150,
      pro: 400,
      campus: null,
    });
  });

  it("treats campus and any cap >= 2147483647 as Infinity", () => {
    expect(PLAN_STUDENT_LIMITS.campus).toBeNull();
    expect(studentLimitForPlan("campus")).toBeNull();
    expect(toClientLimit(PLAN_STUDENT_LIMITS.campus)).toBe(Infinity);
    expect(toClientLimit(UNLIMITED_STUDENT_SENTINEL)).toBe(Infinity);
    expect(toClientLimit(UNLIMITED_STUDENT_SENTINEL + 8)).toBe(Infinity);
    expect(toClientLimit(500)).toBe(500);
    expect(isUnlimited(Infinity)).toBe(true);
    expect(isUnlimited(UNLIMITED_STUDENT_SENTINEL)).toBe(true);
  });

  it("never formats the Postgres sentinel as N / 2,14,74,83,647", () => {
    const usage = `12 / ${formatLimit(toClientLimit(UNLIMITED_STUDENT_SENTINEL))}`;
    expect(usage).toBe("12 / Unlimited");
    expect(usage).not.toMatch(/2,?14,?74,?83,?647/);
    expect(formatLimit(UNLIMITED_STUDENT_SENTINEL)).toBe("Unlimited");
    expect(formatLimit(null)).toBe("Unlimited");
    expect(formatLimit(UNLIMITED_STUDENT_SENTINEL)).not.toBe(
      UNLIMITED_STUDENT_SENTINEL.toLocaleString("en-IN"),
    );
  });

  it("does not stop Campus imports at 1,000 students", () => {
    expect(
      remainingStudentSlots(toClientLimit(PLAN_STUDENT_LIMITS.campus), 1000),
    ).toBe(Infinity);
    expect(
      remainingStudentSlots(toClientLimit(UNLIMITED_STUDENT_SENTINEL), 1000),
    ).toBe(Infinity);
    expect(remainingStudentSlots(1000, 1000)).toBe(0);
    expect(remainingStudentSlots(500, 12)).toBe(488);
  });

  it("does not count archived students toward the plan limit (VO-010)", () => {
    const students = [
      ...Array.from({ length: 90 }, (_, i) => ({
        status: i % 2 === 0 ? "active" : "inactive",
      })),
      ...Array.from({ length: 20 }, () => ({ status: "archived" })),
    ];
    const before = students.length;
    expect(before).toBe(110);
    expect(before >= 100).toBe(true);

    const currentCount = planLimitHeadcount(undefined, students);
    expect(currentCount).toBe(90);
    expect(atStudentPlanLimit(currentCount, 100)).toBe(false);
    expect(atStudentPlanLimit(before, 100)).toBe(true);
  });

  it("restored from archive without a plan-limit check before the fix", () => {
    const currentCount = 100;
    const limit = 100;
    const beforeAllowed = true;
    expect(beforeAllowed).toBe(true);
    expect(atStudentPlanLimit(currentCount, limit)).toBe(true);
    expect(canRestoreArchivedStudent(currentCount, limit)).toBe(false);
  });

  it("allows restore when under the cap and on unlimited plans", () => {
    expect(canRestoreArchivedStudent(90, 100)).toBe(true);
    expect(canRestoreArchivedStudent(1000, null)).toBe(true);
  });

  it("prefers the server active student_count over the loaded array length", () => {
    const students = [
      ...Array.from({ length: 90 }, () => ({ status: "active" })),
      ...Array.from({ length: 20 }, () => ({ status: "archived" })),
    ];
    expect(planLimitHeadcount(90, students)).toBe(90);
    expect(atStudentPlanLimit(90, 100)).toBe(false);
  });
});
