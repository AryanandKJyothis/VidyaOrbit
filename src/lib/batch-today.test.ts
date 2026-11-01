import { describe, expect, it } from "vitest";
import { batchesScheduledOn, pickTodayBatch } from "./batch-time";

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri"];
const batches = [
  {
    id: "m",
    name: "Morning batch",
    timing: "7:00 AM",
    is_active: true,
    days_of_week: WEEKDAYS,
  },
  {
    id: "e",
    name: "Evening batch",
    timing: "5:00 PM",
    is_active: true,
    days_of_week: WEEKDAYS,
  },
  {
    id: "w",
    name: "Weekend batch",
    timing: null,
    is_active: true,
    days_of_week: ["Sat", "Sun"],
  },
  {
    id: "x",
    name: "Old batch",
    timing: "6:00 AM",
    is_active: false,
    days_of_week: ["sat"],
  },
];

describe("today's batch (attendance default = dashboard rule)", () => {
  it("picks the Weekend batch on Saturday and Sunday", () => {
    expect(pickTodayBatch(batches, "sat", 600)?.id).toBe("w");
    expect(pickTodayBatch(batches, "sun", 600)?.id).toBe("w");
  });
  it("on a weekday picks the next batch by clock, else the first", () => {
    expect(pickTodayBatch(batches, "mon", 6 * 60)?.id).toBe("m");
    expect(pickTodayBatch(batches, "mon", 12 * 60)?.id).toBe("e");
    expect(pickTodayBatch(batches, "mon", 20 * 60)?.id).toBe("m");
  });
  it("ignores inactive batches and returns undefined when none today", () => {
    expect(batchesScheduledOn(batches, "sat").map((b) => b.id)).toEqual(["w"]);
    expect(pickTodayBatch(batches.slice(0, 2), "sun", 600)).toBeUndefined();
  });
});
