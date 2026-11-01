import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  STAFF_BUCKETS,
  STUDENT_BUCKETS,
  answerValue,
  batchesFromTimings,
  defaultCentreName,
  newBatchSeeds,
  nextQuickStep,
  parseCustomTiming,
  parseOtherNumber,
  parsePastedNames,
  quickStepsFor,
  recommendedPlan,
  segmentFor,
  shouldAskStaff,
  shouldShowQuickStart,
  staffInviteWhatsAppUrl,
  QS_COPY,
  checklistDataReady,
  feeBadgeKind,
  countMissingParentPhones,
  isDuplicateStudentName,
} from "./onboarding-v2";
import { isOnboardingV2Enabled, isSampleDataEnabled } from "./feature-flags";
import { parseQuickStart } from "@/hooks/use-quick-start";

describe("Other: enter number", () => {
  it.each([
    ["80", 80],
    [" 1,200 ", 1200],
    ["0", 0],
    ["", null],
    ["abc", null],
    ["-5", null],
    ["2.5", null],
    ["999999", null],
  ])("%s → %s", (raw, want) => expect(parseOtherNumber(raw)).toBe(want));

  it("answerValue uses bucket value or parsed Other", () => {
    expect(answerValue(STUDENT_BUCKETS, { optionId: "lt25", other: "" })).toBe(
      20,
    );
    expect(
      answerValue(STUDENT_BUCKETS, { optionId: "other", other: "120" }),
    ).toBe(120);
    expect(
      answerValue(STUDENT_BUCKETS, { optionId: "other", other: "x" }),
    ).toBeNull();
    expect(answerValue(STAFF_BUCKETS, null)).toBeNull();
  });
});

describe("branching", () => {
  it.each([
    [0, "small"],
    [24, "small"],
    [25, "small"],
    [50, "small"],
    [51, "mid"],
    [400, "mid"],
    [401, "large"],
    [801, "large"],
  ])("%i students → %s", (n, seg) => expect(segmentFor(n)).toBe(seg));

  it("under 25 skips the staff question", () => {
    expect(shouldAskStaff(20)).toBe(false);
    expect(quickStepsFor(20)).toEqual([
      "students",
      "timings",
      "goal",
      "names",
      "done",
    ]);
  });
  it("25–50 skips staff (small), no invite step", () => {
    expect(quickStepsFor(50)).toEqual([
      "students",
      "timings",
      "goal",
      "names",
      "done",
    ]);
  });
  it("mid gets invite-staff then names", () => {
    expect(quickStepsFor(150)).toEqual([
      "students",
      "staff",
      "timings",
      "goal",
      "invite",
      "names",
      "done",
    ]);
  });
  it("large gets guided import offer then invite", () => {
    expect(quickStepsFor(401)).toEqual([
      "students",
      "staff",
      "timings",
      "goal",
      "import",
      "invite",
      "done",
    ]);
  });
  it("at most 4 questions before branch steps", () => {
    for (const n of [20, 50, 150, 1000]) {
      const q = quickStepsFor(n).filter((s) =>
        ["students", "staff", "timings", "goal"].includes(s),
      );
      expect(q.length).toBeLessThanOrEqual(4);
    }
  });
  it("nextQuickStep follows the branch", () => {
    expect(nextQuickStep("students", 20)).toBe("timings");
    expect(nextQuickStep("goal", 150)).toBe("invite");
    expect(nextQuickStep("names", 20)).toBe("done");
  });
});

describe("plan recommendation caps", () => {
  it.each([
    [0, "free"],
    [24, "free"],
    [25, "spark"],
    [50, "spark"],
    [51, "orbit"],
    [150, "orbit"],
    [151, "centre"],
    [400, "centre"],
    [401, "campus"],
    [800, "campus"],
    [801, "custom"],
  ])("%i → %s", (n, code) => expect(recommendedPlan(n).code).toBe(code));
  it("multi-branch is custom; prices", () => {
    expect(recommendedPlan(30, true).code).toBe("custom");
    expect(recommendedPlan(40).monthlyPrice).toBe(499);
    expect(recommendedPlan(100).monthlyPrice).toBe(999);
    expect(recommendedPlan(300).monthlyPrice).toBe(1499);
    expect(recommendedPlan(500).monthlyPrice).toBe(2499);
  });
});

describe("timings", () => {
  it.each([
    ["5-6pm", "5–6 PM", 17 * 60],
    ["5:30 to 6:30 PM", "5:30–6:30 PM", 17 * 60 + 30],
    ["17:00-18:00", "5–6 PM", 17 * 60],
    ["11-12pm", "11 AM–12 PM", 11 * 60],
    ["6 am", "6 AM", 6 * 60],
    ["7.30-8.30 am", "7:30–8:30 AM", 7 * 60 + 30],
  ])("%s → %s", (raw, label, start) => {
    expect(parseCustomTiming(raw)).toEqual({ label, startMinutes: start });
  });
  it("keeps unparseable text, trims, caps length; blank → null", () => {
    expect(parseCustomTiming("  Sunday morning ")).toEqual({
      label: "Sunday morning",
      startMinutes: null,
    });
    expect(parseCustomTiming("x".repeat(60))!.label).toHaveLength(40);
    expect(parseCustomTiming("   ")).toBeNull();
  });
  it("chips + custom → one batch each, deduped, chip order", () => {
    const b = batchesFromTimings(
      ["17-18", "06-07", "weekend"],
      ["5-6 pm", "3:30-4:30pm"],
    );
    expect(b).toEqual([
      {
        name: "6–7 AM batch",
        timing: "6–7 AM",
        days_of_week: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      },
      {
        name: "5–6 PM batch",
        timing: "5–6 PM",
        days_of_week: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      },
      { name: "Weekend batch", timing: null, days_of_week: ["Sat", "Sun"] },
      {
        name: "3:30–4:30 PM batch",
        timing: "3:30–4:30 PM",
        days_of_week: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      },
    ]);
  });
  it("caps at 12 and retry skips existing names", () => {
    const many = Array.from({ length: 20 }, (_, i) => `slot ${i}`);
    expect(batchesFromTimings([], many)).toHaveLength(12);
    const seeds = batchesFromTimings(["16-17", "17-18"]);
    expect(newBatchSeeds(seeds, ["4–5 pm BATCH"])).toEqual([
      {
        name: "5–6 PM batch",
        timing: "5–6 PM",
        days_of_week: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      },
    ]);
  });
});

describe("paste names", () => {
  it("one per line, strips numbering/bullets, blank lines, dedupes", () => {
    const r = parsePastedNames(
      "1. Anu\n2) Rahul\n\n- Fathima\n• anu\n  Arjun K  \n42\n",
    );
    expect(r.map((x) => x.name)).toEqual([
      "Anu",
      "Rahul",
      "Fathima",
      "Arjun K",
    ]);
  });
  it("extracts Indian mobiles", () => {
    expect(
      parsePastedNames(
        "Anu 9876543210\nRahul - +91 98765 43211\nDiya, 09876543212",
      ),
    ).toEqual([
      { name: "Anu", phone: "9876543210" },
      { name: "Rahul", phone: "9876543211" },
      { name: "Diya", phone: "9876543212" },
    ]);
  });
  it("single comma-separated line", () => {
    expect(parsePastedNames("Anu, Rahul ,Diya").map((x) => x.name)).toEqual([
      "Anu",
      "Rahul",
      "Diya",
    ]);
  });
  it("Malayalam names and CRLF", () => {
    expect(parsePastedNames("അനു\r\nരാഹുൽ\r\n").map((x) => x.name)).toEqual([
      "അനു",
      "രാഹുൽ",
    ]);
  });
  it("caps at 500 and 120 chars", () => {
    const text = Array.from({ length: 600 }, (_, i) => `Student ${i}`).join(
      "\n",
    );
    expect(parsePastedNames(text)).toHaveLength(500);
    expect(parsePastedNames("a".repeat(200))[0]!.name).toHaveLength(120);
  });
});

describe("staff invite wa.me", () => {
  it("normalizes to 91XXXXXXXXXX and encodes text", () => {
    const url = staffInviteWhatsAppUrl({
      phone: "098765 43210",
      staffName: "Meera T",
      centreName: "Bright & Co",
      joinUrl: "https://vidyaorbit.in/join/abc",
    });
    expect(url.startsWith("https://wa.me/919876543210?text=")).toBe(true);
    const text = decodeURIComponent(url.split("?text=")[1]!);
    expect(text).toBe(
      "Hi Meera, join Bright & Co on Vidya Orbit to mark attendance: https://vidyaorbit.in/join/abc",
    );
  });
  it("invalid phone → contact picker link", () => {
    expect(
      staffInviteWhatsAppUrl({
        phone: "123",
        centreName: "X",
        joinUrl: "u",
      }).startsWith("https://wa.me/?text="),
    ).toBe(true);
  });
});

describe("quick start visibility", () => {
  const base = {
    enabled: true,
    isStaff: false,
    isOwnWorkspace: true,
    dataLoaded: true,
    batchCount: 0,
    studentCount: 0,
    completed: false,
    dismissed: false,
    legacyWizardStarted: false,
  };
  it("new empty owner sees it", () =>
    expect(shouldShowQuickStart(base)).toBe(true));
  it.each([
    ["flag off", { enabled: false }],
    ["staff", { isStaff: true }],
    ["not own", { isOwnWorkspace: false }],
    ["loading", { dataLoaded: false }],
    ["has batch", { batchCount: 1 }],
    ["has student", { studentCount: 3 }],
    ["completed", { completed: true }],
    ["dismissed", { dismissed: true }],
    ["legacy wizard", { legacyWizardStarted: true }],
  ])("hidden when %s", (_n, o) =>
    expect(shouldShowQuickStart({ ...base, ...o })).toBe(false),
  );
  it("persisted state parses old/garbage safely", () => {
    expect(parseQuickStart(null).step).toBe("students");
    expect(
      parseQuickStart({ chips: ["a", 1], goal: "nope", completed: 1 }),
    ).toMatchObject({ chips: ["a"], goal: null, completed: true });
  });
});

describe("flags, checklist, copy", () => {
  it("v2 default on; sample data default off", () => {
    expect(isOnboardingV2Enabled(undefined)).toBe(true);
    expect(isOnboardingV2Enabled("false")).toBe(false);
    expect(isSampleDataEnabled(undefined)).toBe(false);
    expect(isSampleDataEnabled("true")).toBe(true);
  });
  it("checklist waits for every query", () => {
    expect(
      checklistDataReady({
        batches: true,
        students: true,
        payments: true,
        attendance: false,
      }),
    ).toBe(false);
    expect(
      checklistDataReady({
        batches: true,
        students: true,
        payments: true,
        attendance: true,
      }),
    ).toBe(true);
  });
  it("every copy string has English and Malayalam", () => {
    for (const c of Object.values(QS_COPY)) {
      expect(c.en.length).toBeGreaterThan(0);
      expect(c.ml).toMatch(/[\u0D00-\u0D7F]/);
    }
  });
  it("never claims automatic WhatsApp sending; parent alerts are coming soon", () => {
    const src =
      readFileSync("src/components/onboarding/quick-start.tsx", "utf8") +
      JSON.stringify(QS_COPY);
    expect(src).not.toMatch(/auto(matically)?[- ]?(send|sent)/i);
    expect(QS_COPY.parentsSoon.en).toMatch(/coming soon/i);
    expect(QS_COPY.inviteHint.en).toMatch(/you tap Send/);
  });
  it("default centre name", () => {
    expect(defaultCentreName("Aryanand K")).toBe("Aryanand's Tuition");
    expect(defaultCentreName("")).toBe("");
  });
  it("migration is additive only", () => {
    const sql = readFileSync(
      "supabase/migrations/20261101100000_add_is_sample.sql",
      "utf8",
    )
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");
    expect(sql).not.toMatch(/\bdrop\b|\brename\b|alter column|\btype\b\s/i);
    expect(sql).toMatch(
      /add column if not exists is_sample boolean not null default false/,
    );
  });
});

describe("audit fixes", () => {
  it("seeded batches always have days so they show in attendance", () => {
    for (const b of batchesFromTimings(
      ["06-07", "weekend"],
      ["Sunday morning"],
    ))
      expect(b.days_of_week.length).toBeGreaterThan(0);
    expect(batchesFromTimings(["weekend"])[0]!.days_of_week).toEqual([
      "Sat",
      "Sun",
    ]);
  });
  it("duplicate names", () => {
    expect(isDuplicateStudentName(" anu  k ", ["Anu K"])).toBe(true);
    expect(isDuplicateStudentName("Anu", ["Anu K"])).toBe(false);
    expect(isDuplicateStudentName("a", ["a"])).toBe(false);
  });
  it("no 'Paid' badge without a fee", () => {
    expect(
      feeBadgeKind({ feeTotal: 0, balance: 0, overdue: false, dueSoon: false }),
    ).toBe("none");
    expect(
      feeBadgeKind({
        feeTotal: null,
        balance: 0,
        overdue: false,
        dueSoon: false,
      }),
    ).toBe("none");
    expect(
      feeBadgeKind({
        feeTotal: 1000,
        balance: 0,
        overdue: false,
        dueSoon: false,
      }),
    ).toBe("paid");
    expect(
      feeBadgeKind({
        feeTotal: 1000,
        balance: 500,
        overdue: true,
        dueSoon: false,
      }),
    ).toBe("overdue");
  });
});

describe("product decisions 2026-11-01", () => {
  it("AC2: every small path is <=4 screens before attendance, no name screen", () => {
    for (const n of [0, 20, 24, 25, 50]) {
      const screens = quickStepsFor(n).filter((x) => x !== "done");
      expect(screens).not.toContain("name");
      expect(screens.length).toBeLessThanOrEqual(4);
    }
    expect(quickStepsFor(20)).toEqual([
      "students",
      "timings",
      "goal",
      "names",
      "done",
    ]);
  });
  it("staff question only above 50", () => {
    expect(shouldAskStaff(50)).toBe(false);
    expect(shouldAskStaff(51)).toBe(true);
  });
  it("old persisted 'name' step resumes at students", () => {
    expect(parseQuickStart({ step: "name" }).step).toBe("students");
  });
  it("missing parent phones nudge count", () => {
    expect(
      countMissingParentPhones([
        { phone: null, guardian_phone: null, status: "active" },
        { phone: "", guardian_phone: "9876543210", status: "active" },
        { phone: null, guardian_phone: null, status: "archived" },
      ]),
    ).toBe(1);
  });
  it("normal add-student form still requires a phone", () => {
    const dialog = readFileSync("src/components/student-dialog.tsx", "utf8");
    expect(dialog).toMatch(/one is needed/);
    expect(dialog).toContain("useUpsertStudent");
  });
});
