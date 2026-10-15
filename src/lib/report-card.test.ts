import { describe, expect, it } from "vitest";
import {
  canSendReportCard,
  canViewReportCard,
  inReportMonth,
  listRecentReportMonths,
  reportMonthEnd,
  reportMonthLabel,
  reportMonthStart,
  summarizeMonthlyAttendance,
  summarizeMonthlyFee,
} from "./report-card";

describe("monthly report card", () => {
  it("uses the calendar month bounds, not a rolling 30 days", () => {
    expect(reportMonthStart("2026-10")).toBe("2026-10-01");
    expect(reportMonthEnd("2026-10-15")).toBe("2026-10-31");
    expect(reportMonthEnd("2026-02-01")).toBe("2026-02-28");
    expect(reportMonthLabel("2026-10-01")).toBe("October 2026");
    expect(inReportMonth("2026-10-31", "2026-10")).toBe(true);
    expect(inReportMonth("2026-11-01", "2026-10")).toBe(false);
  });

  it("counts late as present and ignores other months", () => {
    const summary = summarizeMonthlyAttendance(
      [
        { status: "present", session_date: "2026-10-01", student_id: "a" },
        { status: "late", session_date: "2026-10-02", student_id: "a" },
        { status: "absent", session_date: "2026-10-03", student_id: "a" },
        { status: "absent", session_date: "2026-09-30", student_id: "a" },
        { status: "present", session_date: "2026-10-01", student_id: "b" },
      ],
      "2026-10",
      "a",
    );
    expect(summary).toEqual({
      daysPresent: 2,
      daysAbsent: 1,
      marked: 3,
      percent: 67,
    });
  });

  it("treats the student fee as this month's fee", () => {
    const fee = summarizeMonthlyFee(
      [
        { student_id: "a", amount: 1000, payment_date: "2026-10-05" },
        { student_id: "a", amount: 500, payment_date: "2026-09-30" },
        { student_id: "b", amount: 2000, payment_date: "2026-10-05" },
      ],
      "2026-10",
      2500,
      "a",
    );
    expect(fee.status).toBe("due");
    expect(fee.paidAmount).toBe(1000);
    expect(fee.dueAmount).toBe(1500);
    expect(
      summarizeMonthlyFee(
        [{ student_id: "a", amount: 2500, payment_date: "2026-10-01" }],
        "2026-10",
        2500,
        "a",
      ).status,
    ).toBe("paid");
  });

  it("lists recent months newest first", () => {
    const months = listRecentReportMonths(
      3,
      new Date("2026-10-15T00:00:00+05:30"),
    );
    expect(months[0]).toEqual({ value: "2026-10-01", label: "October 2026" });
    expect(months[1]?.value).toBe("2026-09-01");
    expect(months).toHaveLength(3);
  });

  it("staff can send a report; viewers can only look", () => {
    expect(canViewReportCard("read", "read")).toBe(true);
    expect(canSendReportCard("read", "write")).toBe(true);
    expect(canSendReportCard("read", "read")).toBe(false);
    expect(canViewReportCard("none", "write")).toBe(false);
  });
});
