import { describe, expect, it } from "vitest";
import {
  addCalendarDaysISO,
  isPastIstDate,
  istMonthStartISO,
  istPrevMonthRangeISO,
  istWeekdayKey,
  personInitials,
  todayISO,
  yesterdayISO,
} from "./format";

const oneAmIst = new Date("2026-10-12T01:00:00+05:30");
const tenAmIst = new Date("2026-10-12T10:00:00+05:30");

describe("IST calendar dates (VO-011)", () => {
  it("todayISO is the IST calendar day at 01:00 IST (UTC toISOString was yesterday)", () => {
    expect(oneAmIst.toISOString().slice(0, 10)).toBe("2026-10-11");
    expect(todayISO(oneAmIst)).toBe("2026-10-12");
  });

  it("todayISO stays 12 Oct after 05:30 IST", () => {
    expect(todayISO(tenAmIst)).toBe("2026-10-12");
  });

  it("yesterdayISO is the previous IST day, not UTC minus two", () => {
    const broken = (() => {
      const y = new Date(oneAmIst);
      y.setDate(y.getDate() - 1);
      return y.toISOString().slice(0, 10);
    })();
    expect(broken).toBe("2026-10-10");
    expect(yesterdayISO(oneAmIst)).toBe("2026-10-11");
  });

  it("due today is not overdue at 10:00 IST (UTC Date parse was)", () => {
    const due = "2026-10-12";
    expect(new Date(due) < tenAmIst).toBe(true);
    expect(isPastIstDate(due, tenAmIst)).toBe(false);
    expect(isPastIstDate("2026-10-11", tenAmIst)).toBe(true);
    expect(isPastIstDate(null, tenAmIst)).toBe(false);
  });

  it("addCalendarDaysISO crosses months without toISOString", () => {
    expect(addCalendarDaysISO("2026-10-01", -1)).toBe("2026-09-30");
    expect(addCalendarDaysISO("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("ist month helpers use the IST calendar, not UTC midnight", () => {
    expect(istMonthStartISO(oneAmIst)).toBe("2026-10-01");
    expect(istPrevMonthRangeISO(oneAmIst)).toEqual({
      start: "2026-09-01",
      end: "2026-09-30",
    });
    expect(istWeekdayKey(oneAmIst)).toBe("mon");
  });
});

describe("personInitials", () => {
  it("uses first and last letters of a two-part name", () => {
    expect(personInitials("Anjali Menon")).toBe("AM");
  });
  it("uses the first two letters of a single name", () => {
    expect(personInitials("Devika")).toBe("DE");
  });
  it("returns ? for empty input", () => {
    expect(personInitials("")).toBe("?");
    expect(personInitials(null)).toBe("?");
  });
});
