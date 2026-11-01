import { describe, expect, it } from "vitest";
import { countUpFrame, parseCountUpTarget } from "./count-up";

describe("count-up", () => {
  it("parses Indian-grouped rupee values", () => {
    expect(parseCountUpTarget("₹1,57,000")).toMatchObject({
      prefix: "₹",
      end: 157000,
      decimals: null,
    });
  });
  it("shows interim values mid-animation (the 'wrong first load' symptom)", () => {
    const mid = countUpFrame("₹1,57,000", 0.7);
    expect(mid).not.toBe("₹1,57,000");
    expect(mid.startsWith("₹1,5")).toBe(true);
  });
  it("always lands exactly on the target", () => {
    expect(countUpFrame("₹1,57,000", 1)).toBe("₹1,57,000");
    expect(countUpFrame("₹1,57,000", 1.5)).toBe("₹1,57,000");
    expect(countUpFrame("92%", 1)).toBe("92%");
    expect(countUpFrame("n/a", 0.2)).toBe("n/a");
  });
});
