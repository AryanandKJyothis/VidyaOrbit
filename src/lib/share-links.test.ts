import { describe, expect, it } from "vitest";
import { SITE_URL } from "./site";
import {
  buildReportShareMessage,
  isShareTokenShape,
  parsePublicReceipt,
  parsePublicReport,
  PUBLIC_RECEIPT_KEYS,
  PUBLIC_REPORT_KEYS,
  PUBLIC_SHARE_FORBIDDEN_KEYS,
  publicReceiptPath,
  publicReceiptUrl,
  publicReportPath,
  publicReportUrl,
} from "./share-links";

describe("share link helpers", () => {
  it("builds unguessable public paths, never a sequential payment id", () => {
    const token = "a".repeat(48);
    expect(publicReceiptPath(token)).toBe(`/r/${token}`);
    expect(publicReportPath(token)).toBe(`/report/${token}`);
    expect(publicReceiptUrl(token)).toBe(`${SITE_URL}/r/${token}`);
    expect(publicReportUrl(token, "https://preview.example")).toBe(
      `https://preview.example/report/${token}`,
    );
    expect(isShareTokenShape(token)).toBe(true);
    expect(isShareTokenShape("1")).toBe(false);
    expect(isShareTokenShape("not a token")).toBe(false);
  });

  it("keeps the public receipt allowlist free of phones and other students", () => {
    for (const key of PUBLIC_SHARE_FORBIDDEN_KEYS) {
      expect(PUBLIC_RECEIPT_KEYS).not.toContain(key);
      expect(PUBLIC_REPORT_KEYS).not.toContain(key);
    }
  });

  it("parses a revoked token as a miss", () => {
    expect(parsePublicReceipt({ ok: false, reason: "revoked" })).toEqual({
      ok: false,
      reason: "revoked",
    });
    expect(parsePublicReport({ ok: false, reason: "revoked" })).toEqual({
      ok: false,
      reason: "revoked",
    });
  });

  it("treats expired as not found and rate-limited as unavailable", () => {
    expect(parsePublicReceipt({ ok: false, reason: "expired" })).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(parsePublicReport({ ok: false, reason: "expired" })).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(parsePublicReceipt({ ok: false, reason: "unavailable" })).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(parsePublicReceipt({ ok: false, reason: "rate_limited" })).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("builds a parent WhatsApp summary with the report URL", () => {
    const share = buildReportShareMessage({
      centreName: "Orbit Coaching",
      studentName: "Amina",
      month: "October 2026",
      attendancePercent: 86,
      daysPresent: 18,
      daysAbsent: 3,
      feeStatus: "due",
      feePaidAmount: 500,
      feeDueAmount: 2000,
      reportUrl: "https://www.vidyaorbit.in/report/tok",
      guardianPhone: "9876543210",
    });
    expect(share.message).toContain("Amina's report card — October 2026");
    expect(share.message).toContain("Attendance: 86%");
    expect(share.message).toContain("Fee: Due");
    expect(share.message).toContain(
      "Open report: https://www.vidyaorbit.in/report/tok",
    );
    expect(share.href).toContain("https://wa.me/919876543210?text=");
  });
});
