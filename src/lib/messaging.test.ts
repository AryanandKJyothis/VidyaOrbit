import { describe, expect, it } from "vitest";
import { resolveParentWhatsAppPhone } from "./messaging/phone";
import {
  formatAckRupees,
  renderAbsenceTemplate,
  renderFeePaidTemplate,
} from "./messaging/templates";
import {
  absenceDedupeKey,
  canMarkOutboxSent,
  canSendFeePaidAck,
  feePaidDedupeKey,
  planAbsenceOutbox,
  planFeePaidOutbox,
  remainingFeeBalance,
  summarizeAbsencePlan,
} from "./messaging/policy";
import {
  formatAbsenceQueueToast,
  formatFeePaidQueueToast,
  summarizeOutboxRows,
} from "./messaging/summarize";
import { buildAssistedWhatsAppHref } from "./messaging/wa-me";
import { SITE_URL } from "./site";
import {
  createWhatsAppWorker,
  dispatchAutoSend,
  shouldAutoSend,
} from "./messaging/worker";
import {
  callerCanWriteAttendance,
  callerCanWriteFees,
  callerCanWriteMessages,
} from "./messaging/workspace";

const SESSION = "11111111-1111-4111-8111-111111111111";
const DATE = "2026-10-25";

function mark(
  id: string,
  status: string,
  name: string,
  guardian?: string | null,
  phone?: string | null,
) {
  return {
    studentId: id,
    status,
    studentName: name,
    guardianPhone: guardian,
    studentPhone: phone,
    phone: resolveParentWhatsAppPhone({
      guardian_phone: guardian,
      phone,
    }),
  };
}

describe("parent phone", () => {
  it("prefers guardian and stores +91", () => {
    const resolved = resolveParentWhatsAppPhone({
      guardian_phone: "9876543210",
      phone: "9123456789",
    });
    expect(resolved).toEqual({
      e164: "+919876543210",
      waMe: "919876543210",
      source: "guardian",
    });
  });

  it("falls back to the student phone and skips invalid numbers", () => {
    expect(
      resolveParentWhatsAppPhone({
        guardian_phone: "123",
        phone: "8123456789",
      })?.e164,
    ).toBe("+918123456789");
    expect(
      resolveParentWhatsAppPhone({
        guardian_phone: null,
        phone: "555",
      }),
    ).toBeNull();
  });
});

describe("absence template", () => {
  it("renders the English parent copy with date, batch, and centre", () => {
    const { body, locale } = renderAbsenceTemplate({
      studentName: "Amina",
      centreName: "Orbit Coaching",
      sessionDate: DATE,
      batchName: "Class 10 Maths",
    });
    expect(locale).toBe("en");
    expect(body).toBe(
      "Dear parent, Amina was absent today (25 Oct 2026, Class 10 Maths) at Orbit Coaching. Please contact us if this is unexpected.",
    );
  });

  it("falls back to English when Malayalam is not wired yet", () => {
    const { locale } = renderAbsenceTemplate(
      {
        studentName: "Amina",
        centreName: "Orbit",
        sessionDate: DATE,
        batchName: "Maths",
      },
      "ml",
    );
    expect(locale).toBe("en");
  });
});

describe("absence outbox plan", () => {
  const base = {
    sessionId: SESSION,
    sessionDate: DATE,
    batchName: "Class 10 Maths",
    centreName: "Orbit Coaching",
  };

  it("queues one row per absent student and ignores Late", () => {
    const plan = planAbsenceOutbox({
      ...base,
      marks: [
        mark("s1", "absent", "Amina", "9876543210"),
        mark("s2", "absent", "Rahul", null, "9123456789"),
        mark("s3", "absent", "Diya", "9000000000"),
        mark("s4", "late", "Late kid", "9111111111"),
        mark("s5", "present", "Present kid", "9222222222"),
      ],
      existing: [],
    });
    expect(plan.inserts).toHaveLength(3);
    expect(plan.inserts.every((row) => row.status === "queued")).toBe(true);
    expect(plan.inserts.map((row) => row.dedupeKey)).toEqual([
      absenceDedupeKey(SESSION, "s1"),
      absenceDedupeKey(SESSION, "s2"),
      absenceDedupeKey(SESSION, "s3"),
    ]);
    expect(plan.skipDedupeKeys).toEqual([]);
  });

  it("does not insert again on re-save (dedupe)", () => {
    const first = planAbsenceOutbox({
      ...base,
      marks: [mark("s1", "absent", "Amina", "9876543210")],
      existing: [],
    });
    const second = planAbsenceOutbox({
      ...base,
      marks: [mark("s1", "absent", "Amina", "9876543210")],
      existing: first.inserts.map((row) => ({
        dedupe_key: row.dedupeKey,
        status: "queued" as const,
      })),
    });
    expect(second.inserts).toEqual([]);
    expect(
      summarizeAbsencePlan(second, [
        {
          dedupe_key: first.inserts[0]!.dedupeKey,
          status: "queued",
          skip_reason: null,
        },
      ]).already,
    ).toBe(1);
  });

  it("skips a queued row when the student is flipped back to Present", () => {
    const key = absenceDedupeKey(SESSION, "s1");
    const plan = planAbsenceOutbox({
      ...base,
      marks: [mark("s1", "present", "Amina", "9876543210")],
      existing: [{ dedupe_key: key, status: "queued" }],
    });
    expect(plan.inserts).toEqual([]);
    expect(plan.skipDedupeKeys).toEqual([key]);
  });

  it("does not skip a row that was already sent", () => {
    const key = absenceDedupeKey(SESSION, "s1");
    const plan = planAbsenceOutbox({
      ...base,
      marks: [mark("s1", "present", "Amina", "9876543210")],
      existing: [{ dedupe_key: key, status: "sent" }],
    });
    expect(plan.skipDedupeKeys).toEqual([]);
  });

  it("skips missing parent phones and still stores the intended body", () => {
    const plan = planAbsenceOutbox({
      ...base,
      marks: [mark("s1", "absent", "Amina", null, null)],
      existing: [],
    });
    expect(plan.inserts).toHaveLength(1);
    expect(plan.inserts[0]?.status).toBe("skipped");
    expect(plan.inserts[0]?.skipReason).toBe("no_phone");
    expect(plan.inserts[0]?.body).toContain("Amina was absent today");
  });
});

describe("assisted wa.me", () => {
  it("opens the guardian number with the stored body", () => {
    const href = buildAssistedWhatsAppHref(
      "+919876543210",
      "Dear parent, Amina was absent today (25 Oct 2026, Class 10 Maths) at Orbit Coaching. Please contact us if this is unexpected.",
    );
    expect(href).toContain("https://wa.me/919876543210?text=");
    expect(decodeURIComponent(href!)).toContain("Amina was absent today");
  });

  it("returns null without a valid phone", () => {
    expect(buildAssistedWhatsAppHref(null, "hello")).toBeNull();
  });
});

describe("Tier 2 worker stub", () => {
  it("stays off by default and never auto-sends", () => {
    expect(shouldAutoSend(false)).toBe(false);
    expect(shouldAutoSend(true)).toBe(true);
  });

  it("does not fake success when credentials are missing", async () => {
    const worker = createWhatsAppWorker({
      accessToken: null,
      phoneNumberId: null,
      apiVersion: "v21.0",
    });
    const result = await dispatchAutoSend({
      waAuto: true,
      row: { id: "1", phone: "+919876543210", body: "hi", kind: "absence" },
      worker,
    });
    expect(result).toEqual({
      ok: false,
      code: "NOT_CONFIGURED",
      message: "WhatsApp auto-send is not configured. Use assisted wa.me send.",
    });
  });

  it("short-circuits when wa_auto is off even if a worker exists", async () => {
    const worker = createWhatsAppWorker({
      accessToken: "tok",
      phoneNumberId: "pnid",
      apiVersion: "v21.0",
    });
    const result = await dispatchAutoSend({
      waAuto: false,
      row: { id: "1", phone: "+919876543210", body: "hi", kind: "fee_paid" },
      worker,
    });
    expect(result).toEqual({ ok: false, code: "WA_AUTO_OFF" });
  });
});

describe("queue copy and send rules", () => {
  it("tells staff how many parents to notify", () => {
    expect(
      formatAbsenceQueueToast({
        queued: 3,
        sent: 0,
        skippedNoPhone: 0,
        skippedNotAbsent: 0,
        failed: 0,
        already: 0,
      }).title,
    ).toBe("3 parents to notify");
    expect(
      formatAbsenceQueueToast({
        queued: 0,
        sent: 0,
        skippedNoPhone: 1,
        skippedNotAbsent: 0,
        failed: 0,
        already: 0,
      }).title,
    ).toBe("No parent phone on file");
  });

  it("counts outbox rows and only lets queued/failed be marked sent", () => {
    expect(
      summarizeOutboxRows([
        { status: "queued", skip_reason: null },
        { status: "skipped", skip_reason: "no_phone" },
        { status: "sent", skip_reason: null },
      ]),
    ).toEqual({
      queued: 1,
      sent: 1,
      skippedNoPhone: 1,
      skippedNotAbsent: 0,
      failed: 0,
      already: 0,
    });
    expect(canMarkOutboxSent("queued")).toBe(true);
    expect(canMarkOutboxSent("sent")).toBe(false);
    expect(canMarkOutboxSent("skipped")).toBe(false);
  });
});

const PAYMENT = "33333333-3333-4333-8333-333333333333";
const SHARE = "a".repeat(48);

describe("fee-paid acknowledgement", () => {
  it("renders the English ack with amount, date, receipt number, public link, and balance", () => {
    const { body, locale } = renderFeePaidTemplate({
      studentName: "Amina",
      amount: 1500,
      paymentDate: "2026-10-25",
      receiptNumber: "RCT-2026-00012",
      shareToken: SHARE,
      balance: 500,
    });
    expect(locale).toBe("en");
    expect(body).toBe(
      `Payment received: ₹1,500 for Amina on 25 Oct 2026. Receipt RCT-2026-00012: ${SITE_URL}/r/${SHARE}. Balance: ₹500.`,
    );
  });

  it("uses Indian grouping and falls back to English for Malayalam", () => {
    expect(formatAckRupees(150000)).toBe("₹1,50,000");
    const { locale } = renderFeePaidTemplate(
      {
        studentName: "Amina",
        amount: 200,
        paymentDate: DATE,
        receiptNumber: null,
        shareToken: SHARE,
        balance: 0,
      },
      "ml",
    );
    expect(locale).toBe("en");
  });

  it("queues one row per payment and ignores webhook replay", () => {
    const first = planFeePaidOutbox({
      paymentId: PAYMENT,
      studentId: "s1",
      studentName: "Amina",
      amount: 1500,
      paymentDate: DATE,
      receiptNumber: "RCT-1",
      shareToken: SHARE,
      feeTotal: 2000,
      paidTotal: 1500,
      phone: resolveParentWhatsAppPhone({ guardian_phone: "9876543210" }),
      existing: [],
    });
    expect(first.insert?.status).toBe("queued");
    expect(first.insert?.dedupeKey).toBe(feePaidDedupeKey(PAYMENT));
    expect(first.insert?.payload.balance).toBe(500);
    expect(first.insert?.body).toContain(`${SITE_URL}/r/${SHARE}`);
    expect(first.already).toBe(false);

    const replay = planFeePaidOutbox({
      paymentId: PAYMENT,
      studentId: "s1",
      studentName: "Amina",
      amount: 1500,
      paymentDate: DATE,
      receiptNumber: "RCT-1",
      shareToken: SHARE,
      feeTotal: 2000,
      paidTotal: 1500,
      phone: resolveParentWhatsAppPhone({ guardian_phone: "9876543210" }),
      existing: [{ dedupe_key: feePaidDedupeKey(PAYMENT), status: "queued" }],
    });
    expect(replay.insert).toBeNull();
    expect(replay.already).toBe(true);
  });

  it("skips missing parent phones and still stores the receipt link", () => {
    const plan = planFeePaidOutbox({
      paymentId: PAYMENT,
      studentId: "s1",
      studentName: "Amina",
      amount: 800,
      paymentDate: DATE,
      receiptNumber: "RCT-2",
      shareToken: SHARE,
      feeTotal: 800,
      paidTotal: 800,
      phone: null,
      existing: [],
    });
    expect(plan.insert?.status).toBe("skipped");
    expect(plan.insert?.skipReason).toBe("no_phone");
    expect(plan.insert?.body).toContain("Payment received: ₹800");
    expect(remainingFeeBalance(2000, 2500)).toBe(0);
  });

  it("opens wa.me with the guardian number and prefilled ack", () => {
    const { body } = renderFeePaidTemplate({
      studentName: "Amina",
      amount: 1500,
      paymentDate: DATE,
      receiptNumber: "RCT-1",
      shareToken: SHARE,
      balance: 500,
    });
    const href = buildAssistedWhatsAppHref("+919876543210", body);
    expect(href).toContain("https://wa.me/919876543210?text=");
    expect(decodeURIComponent(href!)).toContain("Payment received: ₹1,500");
    expect(decodeURIComponent(href!)).toContain(`${SITE_URL}/r/${SHARE}`);
  });

  it("toasts send-receipt copy after a new payment", () => {
    expect(
      formatFeePaidQueueToast({
        queued: 1,
        sent: 0,
        skippedNoPhone: 0,
        skippedNotAbsent: 0,
        failed: 0,
        already: 0,
      }).title,
    ).toBe("Send receipt to parent");
  });
});

describe("A5 messages permission on the server", () => {
  const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const staff = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const viewer = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

  it("lets staff send parent messages and forbids viewers", () => {
    expect(
      callerCanWriteMessages({
        userId: staff,
        centreOwnerId: owner,
        membership: { role: "staff", permissions: {} },
      }),
    ).toBe(true);
    expect(
      callerCanWriteMessages({
        userId: viewer,
        centreOwnerId: owner,
        membership: { role: "viewer", permissions: {} },
      }),
    ).toBe(false);
    expect(
      callerCanWriteAttendance({
        userId: staff,
        centreOwnerId: owner,
        membership: { role: "staff" },
      }),
    ).toBe(true);
    expect(
      callerCanWriteMessages({
        userId: owner,
        centreOwnerId: owner,
        membership: null,
      }),
    ).toBe(true);
    expect(canSendFeePaidAck("write")).toBe(true);
    expect(canSendFeePaidAck("read")).toBe(false);
    expect(canSendFeePaidAck("none")).toBe(false);
    expect(
      callerCanWriteFees({
        userId: viewer,
        centreOwnerId: owner,
        membership: {
          role: "viewer",
          permissions: { fees: "read", messages: "none" },
        },
      }),
    ).toBe(false);
    expect(
      callerCanWriteMessages({
        userId: viewer,
        centreOwnerId: owner,
        membership: {
          role: "viewer",
          permissions: { fees: "read", messages: "none" },
        },
      }),
    ).toBe(false);
  });
});
