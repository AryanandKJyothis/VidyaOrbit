import { describe, expect, it } from "vitest";
import {
  formatLimit,
  isUnlimited,
  PLAN_STUDENT_LIMITS,
  remainingStudentSlots,
  studentLimitForPlan,
  toClientLimit,
  UNLIMITED_STUDENT_SENTINEL,
} from "@/lib/plan-limits";

describe("plan-limits", () => {
  it("treats pro/Large and any cap >= 2147483647 as Infinity", () => {
    expect(PLAN_STUDENT_LIMITS.pro).toBeNull();
    expect(studentLimitForPlan("pro")).toBeNull();
    expect(toClientLimit(PLAN_STUDENT_LIMITS.pro)).toBe(Infinity);
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

  it("does not stop Large imports at 1,000 students", () => {
    expect(
      remainingStudentSlots(toClientLimit(PLAN_STUDENT_LIMITS.pro), 1000),
    ).toBe(Infinity);
    expect(
      remainingStudentSlots(toClientLimit(UNLIMITED_STUDENT_SENTINEL), 1000),
    ).toBe(Infinity);
    expect(remainingStudentSlots(1000, 1000)).toBe(0);
    expect(remainingStudentSlots(500, 12)).toBe(488);
  });
});
