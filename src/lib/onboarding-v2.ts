/**
 * Onboarding v2 ("quick start") — pure logic. No React, no Supabase.
 * Spec: vidya-orbit/ONBOARDING-100M-2026-11-01.md
 */

export type Bilingual = { en: string; ml: string };

export type ChoiceOption = {
  id: string;
  label: Bilingual;
  /** Representative count used for branching when this option is picked. */
  value: number;
};

export const STUDENT_BUCKETS: readonly ChoiceOption[] = [
  { id: "lt25", label: { en: "Under 25", ml: "25-ൽ താഴെ" }, value: 20 },
  { id: "25-50", label: { en: "25–50", ml: "25–50" }, value: 50 },
  { id: "50-150", label: { en: "50–150", ml: "50–150" }, value: 150 },
  { id: "150-400", label: { en: "150–400", ml: "150–400" }, value: 400 },
  { id: "400+", label: { en: "400+", ml: "400-ൽ കൂടുതൽ" }, value: 401 },
];

export const STAFF_BUCKETS: readonly ChoiceOption[] = [
  { id: "0", label: { en: "Just me", ml: "ഞാൻ മാത്രം" }, value: 0 },
  { id: "1-2", label: { en: "1–2", ml: "1–2" }, value: 2 },
  { id: "3-5", label: { en: "3–5", ml: "3–5" }, value: 5 },
  { id: "6+", label: { en: "6+", ml: "6-ൽ കൂടുതൽ" }, value: 6 },
];

export type FirstGoal = "attendance" | "fees" | "parents";

export const FIRST_GOALS: readonly {
  id: FirstGoal;
  label: Bilingual;
  comingSoon?: boolean;
}[] = [
  { id: "attendance", label: { en: "Attendance", ml: "ഹാജർ" } },
  { id: "fees", label: { en: "Fees", ml: "ഫീസ്" } },
  {
    id: "parents",
    label: { en: "Parent updates", ml: "രക്ഷിതാക്കൾക്ക് അറിയിപ്പ്" },
    comingSoon: true,
  },
];

export const TIMING_CHIPS: readonly { id: string; label: string }[] = [
  { id: "06-07", label: "6–7 AM" },
  { id: "07-08", label: "7–8 AM" },
  { id: "16-17", label: "4–5 PM" },
  { id: "17-18", label: "5–6 PM" },
  { id: "18-19", label: "6–7 PM" },
  { id: "19-20", label: "7–8 PM" },
  { id: "weekend", label: "Weekend" },
];

/** "Other: enter number" — positive integer up to 100k, else null. */
export function parseOtherNumber(
  raw: string | null | undefined,
): number | null {
  const t = (raw ?? "").trim().replace(/,/g, "");
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isSafeInteger(n) || n < 0 || n > 100_000) return null;
  return n;
}

export type Answer = { optionId: string | null; other: string };

export function answerValue(
  options: readonly ChoiceOption[],
  answer: Answer | null | undefined,
): number | null {
  if (!answer) return null;
  if (answer.optionId === "other") return parseOtherNumber(answer.other);
  const opt = options.find((o) => o.id === answer.optionId);
  return opt ? opt.value : null;
}

export type Segment = "small" | "mid" | "large";

/** small < 50, mid 50–400, large > 400. */
export function segmentFor(students: number): Segment {
  if (students > 400) return "large";
  if (students > 50) return "mid";
  return "small";
}

/**
 * Small centres (≤50) never see the staff question, so a solo tutor reaches
 * attendance in ≤4 screens (students → timings → goal → names).
 */
export function shouldAskStaff(students: number | null): boolean {
  return students === null || students > 50;
}

export type PlanRecommendation = {
  code: "free" | "spark" | "orbit" | "centre" | "campus" | "custom";
  name: string;
  monthlyPrice: number | null;
  cap: string;
};

/**
 * Caps: Free <25 · Spark ≤50 · Orbit ≤150 · Centre ≤400 · Campus 400+ ·
 * Custom >800 or multi-branch. Display only — checkout lives on /plan.
 */
export function recommendedPlan(
  students: number,
  multiBranch = false,
): PlanRecommendation {
  if (multiBranch || students > 800)
    return {
      code: "custom",
      name: "Custom",
      monthlyPrice: null,
      cap: "800+ or multi-branch",
    };
  if (students < 25)
    return {
      code: "free",
      name: "Free",
      monthlyPrice: 0,
      cap: "Under 25 students",
    };
  if (students <= 50)
    return {
      code: "spark",
      name: "Spark",
      monthlyPrice: 499,
      cap: "Up to 50 students",
    };
  if (students <= 150)
    return {
      code: "orbit",
      name: "Orbit",
      monthlyPrice: 999,
      cap: "Up to 150 students",
    };
  if (students <= 400)
    return {
      code: "centre",
      name: "Centre",
      monthlyPrice: 1499,
      cap: "Up to 400 students",
    };
  return {
    code: "campus",
    name: "Campus",
    monthlyPrice: 2499,
    cap: "400+ students",
  };
}

export type QuickStep =
  | "name"
  | "students"
  | "staff"
  | "timings"
  | "goal"
  | "names"
  | "invite"
  | "import"
  | "done";

/** Ordered steps for the answers so far. Branch steps follow the 4 questions. */
export function quickStepsFor(students: number | null): QuickStep[] {
  // Centre name is prefilled and edited inline in the header — no own screen.
  const steps: QuickStep[] = ["students"];
  if (shouldAskStaff(students)) steps.push("staff");
  steps.push("timings", "goal");
  const seg = students === null ? "small" : segmentFor(students);
  if (seg === "small") steps.push("names");
  if (seg === "mid") steps.push("invite", "names");
  if (seg === "large") steps.push("import", "invite");
  steps.push("done");
  return steps;
}

export function nextQuickStep(
  step: QuickStep,
  students: number | null,
): QuickStep {
  const s = quickStepsFor(students);
  const i = s.indexOf(step);
  return i < 0 || i >= s.length - 1 ? "done" : s[i + 1]!;
}

export function prevQuickStep(
  step: QuickStep,
  students: number | null,
): QuickStep | null {
  const s = quickStepsFor(students);
  const i = s.indexOf(step);
  return i <= 0 ? null : s[i - 1]!;
}

/* ---------------- timings ---------------- */

function fmtHour(h: number): string {
  const suffix = h < 12 || h === 24 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${suffix}`;
}

/** Parse a clock like "5", "5pm", "5:30 pm", "17:30". Returns minutes or null. */
function parseClock(
  raw: string,
  defaultMeridiem: "am" | "pm" | null,
): number | null {
  const m = raw
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (min > 59) return null;
  const mer = m[3] ? (m[3].startsWith("p") ? "pm" : "am") : defaultMeridiem;
  if (h > 23) return null;
  if (mer && h > 12) return null;
  if (mer === "pm" && h < 12) h += 12;
  if (mer === "am" && h === 12) h = 0;
  return h * 60 + min;
}

function fmtClock(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return fmtHour(h);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export type ParsedTiming = { label: string; startMinutes: number | null };

/**
 * Custom timing text → normalized label. Accepts "5-6pm", "5:30 to 6:30 PM",
 * "17:00-18:00", "6 am". Unparseable text is kept as-is (trimmed, ≤ 40 chars).
 */
export function parseCustomTiming(raw: string): ParsedTiming | null {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return null;
  const range = text.match(/^(.+?)\s*(?:-|–|—|to)\s*(.+)$/i);
  if (range) {
    const endRaw = range[2]!;
    const endMer = /p\.?m\.?$/i.test(endRaw)
      ? "pm"
      : /a\.?m\.?$/i.test(endRaw)
        ? "am"
        : null;
    const end = parseClock(endRaw, null);
    let start = parseClock(range[1]!, endMer);
    if (start !== null && end !== null) {
      // "11-12pm": start inherits PM but must be before end → try AM.
      if (start >= end && endMer === "pm") {
        const alt = parseClock(range[1]!, "am");
        if (alt !== null && alt < end) start = alt;
      }
      if (start < end) {
        return {
          label: `${fmtClock(start)}–${fmtClock(end)}`.replace(
            / (AM|PM)–(.+ \1)$/,
            "–$2",
          ),
          startMinutes: start,
        };
      }
    }
  } else {
    const single = parseClock(text, null);
    if (single !== null && /[ap]\.?m|:/i.test(text)) {
      return { label: fmtClock(single), startMinutes: single };
    }
  }
  return { label: text.slice(0, 40), startMinutes: null };
}

export function timingChipLabel(id: string): string | null {
  return TIMING_CHIPS.find((c) => c.id === id)?.label ?? null;
}

export type BatchSeed = {
  name: string;
  timing: string | null;
  days_of_week: string[];
};

/** Batches with no days never appear in attendance/today — always seed days. */
export const DEFAULT_BATCH_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKEND_DAYS = ["Sat", "Sun"];

/**
 * Selected chips + custom timings → one batch per distinct timing, in chip
 * order then custom order. Case/space-insensitive dedupe; max 12.
 */
export function batchesFromTimings(
  chipIds: readonly string[],
  custom: readonly string[] = [],
): BatchSeed[] {
  const out: BatchSeed[] = [];
  const seen = new Set<string>();
  const push = (label: string) => {
    const key = label.toLowerCase().replace(/[\s–-]/g, "");
    if (!key || seen.has(key) || out.length >= 12) return;
    seen.add(key);
    const isWeekend = label.toLowerCase() === "weekend";
    out.push({
      name: isWeekend ? "Weekend batch" : `${label} batch`,
      timing: isWeekend ? null : label,
      days_of_week: isWeekend ? [...WEEKEND_DAYS] : [...DEFAULT_BATCH_DAYS],
    });
  };
  for (const c of TIMING_CHIPS) if (chipIds.includes(c.id)) push(c.label);
  for (const raw of custom) {
    const p = parseCustomTiming(raw);
    if (p) push(p.label);
  }
  return out;
}

/**
 * Like batchesFromTimings, but skips seeds whose name already exists so a
 * retry never creates duplicates.
 */
export function newBatchSeeds(
  seeds: readonly BatchSeed[],
  existingNames: readonly string[],
): BatchSeed[] {
  const have = new Set(existingNames.map((n) => n.trim().toLowerCase()));
  return seeds.filter((s) => !have.has(s.name.trim().toLowerCase()));
}

/* ---------------- pasted names ---------------- */

export type PastedName = { name: string; phone: string | null };

const MAX_PASTED = 500;

/**
 * One student per line (from WhatsApp, Notes, Excel column). Strips list
 * numbering/bullets, pulls out an Indian mobile if present, dedupes
 * case-insensitively, caps at 500. Comma-separated single line also works.
 */
export function parsePastedNames(text: string): PastedName[] {
  const raw = (text ?? "").replace(/\r/g, "");
  let lines = raw.split("\n");
  if (lines.filter((l) => l.trim()).length === 1 && raw.includes(",")) {
    lines = raw.split(",");
  }
  const out: PastedName[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    let l = line.replace(/\u200b/g, "").trim();
    if (!l) continue;
    l = l.replace(/^(?:\d{1,3}\s*[.)\]:-]\s*|[-*•·]\s*)/, "");
    let phone: string | null = null;
    const pm = l.match(/(?:\+?91[\s-]?|0)?([6-9]\d{4}[\s-]?\d{5})(?!\d)/);
    if (pm) {
      phone = pm[1]!.replace(/\D/g, "");
      l = (l.slice(0, pm.index) + l.slice(pm.index! + pm[0].length)).trim();
    }
    l = l
      .replace(/[\t,;|:-]+$/g, "")
      .replace(/^[\t,;|:-]+/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (l.length < 1 || /^\d+$/.test(l)) continue;
    const name = l.slice(0, 120);
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, phone });
    if (out.length >= MAX_PASTED) break;
  }
  return out;
}

/* ---------------- staff invite ---------------- */

/** wa.me link the owner taps; WhatsApp opens with text prefilled. Never auto-sends. */
export function staffInviteWhatsAppUrl(input: {
  phone?: string | null;
  staffName?: string | null;
  centreName: string;
  joinUrl: string;
}): string {
  const first = (input.staffName ?? "").trim().split(/\s+/)[0];
  const msg = `${first ? `Hi ${first}, ` : "Hi, "}join ${input.centreName.trim() || "our centre"} on Vidya Orbit to mark attendance: ${input.joinUrl}`;
  let digits = (input.phone ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  const base = /^[6-9]\d{9}$/.test(digits)
    ? `https://wa.me/91${digits}`
    : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(msg)}`;
}

/** What invited staff can and cannot do (mirrors ROLE_DESCRIPTIONS.staff). */
export const STAFF_PREVIEW = {
  can: ["Mark attendance", "See students and batches", "Record fee payments"],
  cannot: ["Manage staff or billing", "Export data", "Delete students"],
} as const;

/* ---------------- copy ---------------- */

export const QS_COPY = {
  nameTitle: {
    en: "What should parents see as your centre's name?",
    ml: "സെന്ററിന്റെ പേര് എന്താണ്?",
  },
  studentsTitle: {
    en: "How many students do you have?",
    ml: "എത്ര കുട്ടികൾ ഉണ്ട്?",
  },
  staffTitle: {
    en: "How many teachers besides you?",
    ml: "നിങ്ങളെ കൂടാതെ എത്ര അധ്യാപകർ?",
  },
  timingsTitle: { en: "When are your classes?", ml: "ക്ലാസുകൾ എപ്പോഴാണ്?" },
  timingsHint: {
    en: "Pick all that apply. We'll make a batch for each.",
    ml: "ഓരോ സമയത്തിനും ഒരു ബാച്ച് ഉണ്ടാക്കാം.",
  },
  goalTitle: {
    en: "What do you want to sort out first?",
    ml: "ആദ്യം എന്ത് ശരിയാക്കണം?",
  },
  namesTitle: {
    en: "Paste student names, one per line",
    ml: "പേരുകൾ ഓരോ വരിയിൽ ഒന്ന് വീതം",
  },
  namesHint: {
    en: "Copy from WhatsApp, Notes or Excel. Phone numbers are optional.",
    ml: "ഫോൺ നമ്പർ നിർബന്ധമില്ല.",
  },
  inviteTitle: { en: "Add your staff", ml: "സ്റ്റാഫിനെ ചേർക്കുക" },
  inviteHint: {
    en: "Invite on WhatsApp — you tap Send",
    ml: "WhatsApp-ൽ ക്ഷണിക്കുക — Send നിങ്ങൾ അമർത്തണം",
  },
  importTitle: { en: "Free guided import", ml: "സൗജന്യമായി ഡാറ്റ ചേർത്തുതരാം" },
  importHint: {
    en: "Send us your Excel. We set it up within 1 working day.",
    ml: "Excel അയച്ചാൽ ഒരു പ്രവൃത്തി ദിവസത്തിനകം ഞങ്ങൾ ചേർത്തുതരും.",
  },
  sample: {
    en: "Sample data — clear anytime",
    ml: "ഡെമോ ഡാറ്റ — എപ്പോൾ വേണമെങ്കിലും മായ്ക്കാം",
  },
  parentsSoon: {
    en: "Parent alerts — coming soon",
    ml: "രക്ഷിതാക്കൾക്ക് അലേർട്ട് — ഉടൻ വരുന്നു",
  },
  guidedAttendance: {
    en: "Tap anyone who's absent, then Save.",
    ml: "ഹാജരില്ലാത്തവരെ തൊട്ട് Save അമർത്തുക.",
  },
  firstWin: {
    en: "Done! Today's attendance is saved ✓",
    ml: "കഴിഞ്ഞു! ഇന്നത്തെ ഹാജർ സേവ് ചെയ്തു ✓",
  },
} as const satisfies Record<string, Bilingual>;

export function defaultCentreName(fullName: string | null | undefined): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0];
  return first ? `${first}'s Tuition` : "";
}

export const GUIDED_ATTENDANCE_KEY = "vidya:onboarding-v2:guided-attendance";

/**
 * Quick start shows only to owners of their own, truly empty workspace once
 * all counts are known (no flash), and never after it is completed/dismissed
 * or when the legacy wizard was already started.
 */
export function shouldShowQuickStart(input: {
  enabled: boolean;
  isStaff: boolean;
  isOwnWorkspace: boolean | null;
  dataLoaded: boolean;
  batchCount: number;
  studentCount: number;
  completed: boolean;
  dismissed: boolean;
  legacyWizardStarted: boolean;
}): boolean {
  if (!input.enabled || input.isStaff || input.isOwnWorkspace !== true)
    return false;
  if (!input.dataLoaded) return false;
  if (input.completed || input.dismissed || input.legacyWizardStarted)
    return false;
  return input.batchCount === 0 && input.studentCount === 0;
}

/** True only when every query the checklist counts from has resolved. */
export function checklistDataReady(q: {
  batches: boolean;
  students: boolean;
  payments: boolean;
  attendance: boolean;
}): boolean {
  return q.batches && q.students && q.payments && q.attendance;
}

/** Case/space-insensitive exact-name match against existing students. */
export function isDuplicateStudentName(
  name: string,
  existing: readonly string[],
): boolean {
  const key = name.trim().toLowerCase().replace(/\s+/g, " ");
  if (key.length < 2) return false;
  return existing.some(
    (n) => n.trim().toLowerCase().replace(/\s+/g, " ") === key,
  );
}

/** Fee badge: never show "Paid" when no fee was ever set. */
export function feeBadgeKind(input: {
  feeTotal: number | null | undefined;
  balance: number;
  overdue: boolean;
  dueSoon: boolean;
}): "overdue" | "paid" | "due" | "balance" | "none" {
  if (!input.feeTotal || Number(input.feeTotal) <= 0) return "none";
  if (input.overdue) return "overdue";
  if (input.balance === 0) return "paid";
  return input.dueSoon ? "due" : "balance";
}

/** Active students with neither a student nor guardian phone. */
export function countMissingParentPhones(
  students: readonly {
    phone?: string | null;
    guardian_phone?: string | null;
    status?: string | null;
  }[],
): number {
  return students.filter(
    (s) =>
      s.status !== "archived" &&
      !(s.phone ?? "").trim() &&
      !(s.guardian_phone ?? "").trim(),
  ).length;
}

/**
 * Step counter. Before the size question is answered we assume the small
 * path (the most common), so a solo tutor sees 1/4 → 2/4 → 3/4 → 4/4.
 */
export function quickStepPosition(
  step: QuickStep,
  students: number | null,
): { index: number; total: number } {
  const steps = quickStepsFor(students ?? 0).filter((s) => s !== "done");
  const i = (steps as QuickStep[]).indexOf(step);
  return { index: i < 0 ? 1 : i + 1, total: steps.length };
}

/**
 * Pre-fill for an unsaved attendance session: everyone defaults to Present
 * so staff only need to tap absentees (Tesler's law - absorb complexity).
 * Saved sessions always show exactly what was saved.
 */
export function prefillAttendanceMarks<S extends string>(input: {
  rosterIds: readonly string[];
  savedRecords: Record<string, S>;
  guided: boolean;
  present: S;
}): Record<string, S> {
  if (Object.keys(input.savedRecords).length > 0) return input.savedRecords;
  // Always default to present (not just in guided mode)
  const out: Record<string, S> = {};
  for (const id of input.rosterIds) out[id] = input.present;
  return out;
}

/** Greeting name: first name, else centre name, else none (never "there"). */
export function greetingName(
  fullName: string | null | undefined,
  centreName?: string | null,
): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0];
  if (first) return first;
  const c = (centreName ?? "").trim();
  return c && c !== "My Institute" ? c : "";
}
