import { describe, expect, it } from "vitest";
import {
  buildFeeReminder,
  buildReceiptShare,
  buildUpiPayUri,
  canSendFeeReminders,
  feeCollectionStatus,
  feeMonthLabel,
  formatUpiAmount,
  UPI_NOTE_MAX,
} from "./fee-reminder";
import { instituteSchema } from "./validation";

describe("buildUpiPayUri", () => {
  it("builds an intent for the outstanding amount", () => {
    const uri = buildUpiPayUri({
      vpa: "centre@oksbi",
      payeeName: "Valanchery Science Hub",
      amount: 2500,
      note: "Fee Amina",
    });
    expect(uri).toBe(
      "upi://pay?pa=centre%40oksbi&pn=Valanchery%20Science%20Hub&am=2500&cu=INR&tn=Fee%20Amina",
    );
  });

  it("keeps paise and encodes an ampersand in the centre name", () => {
    const uri = buildUpiPayUri({
      vpa: "orbit.fees@okaxis",
      payeeName: "Bright & Co",
      amount: 2500.5,
      note: "Fee",
    });
    expect(uri).toContain("am=2500.50");
    expect(uri).toContain("pn=Bright%20%26%20Co");
    expect(uri).toContain("pa=orbit.fees%40okaxis");
  });

  it("truncates the transaction note", () => {
    const uri = buildUpiPayUri({
      vpa: "centre@upi",
      payeeName: "Centre",
      amount: 10,
      note: "x".repeat(80),
    });
    const tn = new URL(uri!).searchParams.get("tn");
    expect(tn?.length).toBe(UPI_NOTE_MAX);
  });

  it("refuses a missing VPA, a bad VPA, and a zero balance", () => {
    expect(
      buildUpiPayUri({
        vpa: "",
        payeeName: "Centre",
        amount: 100,
        note: "Fee",
      }),
    ).toBeNull();
    expect(
      buildUpiPayUri({
        vpa: "not a vpa",
        payeeName: "Centre",
        amount: 100,
        note: "Fee",
      }),
    ).toBeNull();
    expect(
      buildUpiPayUri({
        vpa: "centre@upi",
        payeeName: "Centre",
        amount: 0,
        note: "Fee",
      }),
    ).toBeNull();
    expect(formatUpiAmount(-1)).toBeNull();
  });
});

describe("buildFeeReminder", () => {
  const base = {
    centreName: "Orbit Coaching",
    upiVpa: "orbit@oksbi",
    studentName: "Amina",
    guardianPhone: "+91 98765 43210",
    studentPhone: "9123456789",
    feeDueDate: "2026-03-15",
    balance: 2500,
  };

  it("prefers the guardian phone and names the due month", () => {
    const result = buildFeeReminder(base);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.phoneSource).toBe("guardian");
    expect(result.href.startsWith("https://wa.me/919876543210?text=")).toBe(
      true,
    );
    expect(result.message).toContain("Fee reminder from Orbit Coaching");
    expect(result.message).toContain("Amina — March 2026 fee");
    expect(result.message).toContain("Amount due:");
    expect(result.message).toContain("2,500");
    expect(result.message).toContain(result.upiUri);
    expect(result.upiUri).toContain("am=2500");
    expect(feeMonthLabel("2026-03-15")).toBe("March 2026");
  });

  it("falls back to the student phone", () => {
    const result = buildFeeReminder({ ...base, guardianPhone: null });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.phoneSource).toBe("student");
    expect(result.href).toContain("https://wa.me/919123456789?text=");
  });

  it("skips a student with no usable phone", () => {
    expect(
      buildFeeReminder({ ...base, guardianPhone: "123", studentPhone: null }),
    ).toEqual({ ok: false, reason: "no_phone" });
  });

  it("does not invent a pay link without a centre UPI ID or a balance", () => {
    expect(buildFeeReminder({ ...base, upiVpa: "  " })).toEqual({
      ok: false,
      reason: "missing_vpa",
    });
    expect(buildFeeReminder({ ...base, upiVpa: "bad" })).toEqual({
      ok: false,
      reason: "invalid_vpa",
    });
    expect(buildFeeReminder({ ...base, balance: 0 })).toEqual({
      ok: false,
      reason: "zero_balance",
    });
  });
});

describe("fee collection status", () => {
  it("lets overdue win over a partial payment", () => {
    expect(
      feeCollectionStatus({ paid: 500, balance: 1500, overdue: true }),
    ).toBe("overdue");
    expect(
      feeCollectionStatus({ paid: 500, balance: 1500, overdue: false }),
    ).toBe("partial");
    expect(feeCollectionStatus({ paid: 2000, balance: 0, overdue: true })).toBe(
      "paid",
    );
    expect(
      feeCollectionStatus({ paid: 0, balance: 2000, overdue: false }),
    ).toBe("pending");
  });
});

describe("institute UPI ID", () => {
  it("stores a VPA and clears a blank one", () => {
    expect(
      instituteSchema.partial().parse({ upi_vpa: "centre@oksbi" }).upi_vpa,
    ).toBe("centre@oksbi");
    expect(instituteSchema.partial().parse({ upi_vpa: "  " }).upi_vpa).toBe(
      null,
    );
    expect(() =>
      instituteSchema.partial().parse({ upi_vpa: "not a vpa" }),
    ).toThrow();
  });
});

describe("canSendFeeReminders (VO-064)", () => {
  it("fees:read cannot send WhatsApp overdue reminders", () => {
    const before = (fees: "none" | "read" | "write") =>
      fees === "read" || fees === "write";
    expect(before("read")).toBe(true);
    expect(canSendFeeReminders("read")).toBe(false);
    expect(canSendFeeReminders("none")).toBe(false);
    expect(canSendFeeReminders(undefined)).toBe(false);
    expect(canSendFeeReminders("write")).toBe(true);
    expect(canSendFeeReminders(true)).toBe(true);
  });
});

describe("buildReceiptShare", () => {
  it("includes the receipt number and does not add a public URL", () => {
    const share = buildReceiptShare({
      centreName: "Orbit Coaching",
      studentName: "Amina",
      guardianPhone: "9876543210",
      studentPhone: null,
      amount: 2500,
      receiptNumber: "RCT-2026-00012",
    });
    expect(share.message).toContain(
      "Receipt RCT-2026-00012 from Orbit Coaching",
    );
    expect(share.message).toContain("Amina paid");
    expect(share.message).not.toContain("http");
    expect(share.href).toContain("https://wa.me/919876543210?text=");
  });
});
