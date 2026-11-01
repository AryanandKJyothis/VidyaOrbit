import { describe, expect, it } from "vitest";
import { compareMonths, monthDeltaPct } from "./month-over-month";

describe("compareMonths", () => {
  it("day 1 with ₹0 is neutral, never -100%", () => {
    expect(compareMonths(0, 5000)).toEqual({ kind: "no-current" });
    expect(monthDeltaPct(0, 5000)).toBeUndefined();
  });
  it("no previous data skips the comparison (no divide by zero)", () => {
    expect(compareMonths(3000, 0)).toEqual({ kind: "no-previous" });
    expect(monthDeltaPct(3000, 0)).toBeUndefined();
    expect(compareMonths(0, 0)).toEqual({ kind: "no-current" });
  });
  it("handles NaN / negative input", () => {
    expect(monthDeltaPct(Number.NaN, 100)).toBeUndefined();
    expect(monthDeltaPct(100, Number.NaN)).toBeUndefined();
    expect(monthDeltaPct(100, -5)).toBeUndefined();
  });
  it("compares when both months have money", () => {
    expect(compareMonths(1500, 1000)).toEqual({
      kind: "compare",
      deltaPct: 50,
      diff: 500,
    });
    expect(monthDeltaPct(500, 1000)).toBe(-50);
  });
});
