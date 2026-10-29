import { describe, expect, it } from "vitest";
import {
  batchLabel,
  istNowMinutes,
  parseStartMinutes,
  pickNextBatch,
  sortBatchesByTime,
} from "./batch-time";

describe("parseStartMinutes", () => {
  it.each([
    ["7:00 AM - 8:30 AM", 420],
    ["4 PM", 960],
    ["18:00", 1080],
    ["10.00 am", 600],
    ["12:30 PM", 750],
    ["12 AM", 0],
    ["6pm-7pm", 1080],
  ])("%s -> %i", (s, v) => expect(parseStartMinutes(s)).toBe(v));
  it.each([null, undefined, "", "Evening", "Batch 5"])("%s -> null", (s) =>
    expect(parseStartMinutes(s)).toBeNull(),
  );
});

describe("sortBatchesByTime", () => {
  const demo = [
    { name: "Evening", timing: "6:00 PM - 7:30 PM" },
    { name: "Weekend", timing: "10:00 AM - 12:00 PM" },
    { name: "TBD", timing: null },
    { name: "Afternoon", timing: "4 PM" },
    { name: "Morning", timing: "7:00 AM - 8:30 AM" },
  ];
  it("orders by start, unparseable last, no mutation", () => {
    const copy = [...demo];
    expect(sortBatchesByTime(demo).map((b) => b.name)).toEqual([
      "Morning",
      "Weekend",
      "Afternoon",
      "Evening",
      "TBD",
    ]);
    expect(demo).toEqual(copy);
  });
  it("next batch by clock", () => {
    const s = sortBatchesByTime(demo);
    expect(pickNextBatch(s, 9 * 60)?.name).toBe("Weekend");
    expect(pickNextBatch(s, 17 * 60)?.name).toBe("Evening");
    expect(pickNextBatch(s, 23 * 60)?.name).toBe("Morning");
    expect(pickNextBatch([], 0)).toBeUndefined();
  });
});

it("istNowMinutes / batchLabel", () => {
  expect(istNowMinutes(new Date("2026-10-29T00:00:00Z"))).toBe(330);
  expect(batchLabel({ name: "A", timing: "4 PM" })).toBe("A · 4 PM");
  expect(batchLabel({ name: "A", timing: null })).toBe("A");
});
