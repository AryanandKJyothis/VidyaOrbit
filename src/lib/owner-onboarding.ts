import { isValidUpiVpa } from "@/lib/fee-reminder";

/** Default name written by handle_new_user when signup omits institute_name. */
export const PLACEHOLDER_INSTITUTE_NAME = "My Institute";

export const CENTRE_TYPES = [
  { id: "tuition", label: "Tuition / coaching" },
  { id: "psc", label: "PSC / competitive" },
  { id: "cbse", label: "CBSE school" },
  { id: "state", label: "State syllabus" },
  { id: "other", label: "Other" },
] as const;

export type CentreTypeId = (typeof CENTRE_TYPES)[number]["id"];

export const WIZARD_STEPS = [
  {
    id: "centre",
    title: "Your centre",
    blurb: "This name and phone go on receipts and the dashboard.",
  },
  {
    id: "profile",
    title: "How you teach",
    blurb: "A little context now saves a confusing empty workspace later.",
  },
  {
    id: "batch",
    title: "First batch",
    blurb: "Group students by class or timing. You can add more later.",
  },
  {
    id: "students",
    title: "First students",
    blurb: "Add one learner now, or import a spreadsheet when you are ready.",
  },
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];

export const TOUR_STEPS = [
  {
    id: "dashboard",
    title: "Your dashboard",
    body: "Today’s attendance, fees collected, and who still owes — in one place.",
    to: "/dashboard" as const,
    cta: "Open dashboard",
  },
  {
    id: "attendance",
    title: "Mark attendance",
    body: "Pick a batch, tap Present or Absent, then save. It takes a minute.",
    to: "/attendance" as const,
    cta: "Mark attendance",
  },
  {
    id: "fees",
    title: "Record a fee",
    body: "Log cash or UPI and print a receipt. Parents pay your UPI ID directly.",
    to: "/fees" as const,
    cta: "Record a fee",
  },
  {
    id: "students",
    title: "Students",
    body: "Add learners one by one, or import from Excel / CSV.",
    to: "/students" as const,
    cta: "Open students",
  },
  {
    id: "plan",
    title: "Your plan",
    body: "See your trial, student limit, and when to renew — no GST on this product.",
    to: "/plan" as const,
    cta: "View plan",
  },
] as const;

export type TourStepId = (typeof TOUR_STEPS)[number]["id"];

export type OwnerSetupDraft = {
  name: string;
  contactPhone: string;
  address: string;
  centreType: CentreTypeId | "";
  upiVpa: string;
  batchName: string;
  batchTiming: string;
  studentName: string;
  studentPhone: string;
};

export const EMPTY_OWNER_SETUP_DRAFT: OwnerSetupDraft = {
  name: "",
  contactPhone: "",
  address: "",
  centreType: "",
  upiVpa: "",
  batchName: "",
  batchTiming: "",
  studentName: "",
  studentPhone: "",
};

export type OwnerSetupPersisted = {
  currentStep: WizardStepId;
  skipped: boolean;
  completed: boolean;
  skippedSteps: WizardStepId[];
  draft: OwnerSetupDraft;
  tourReady: boolean;
  tourDismissed: boolean;
  tourCompleted: boolean;
  completedAt?: string;
  skippedAt?: string;
};

export const EMPTY_OWNER_SETUP_PERSISTED: OwnerSetupPersisted = {
  currentStep: "centre",
  skipped: false,
  completed: false,
  skippedSteps: [],
  draft: EMPTY_OWNER_SETUP_DRAFT,
  tourReady: false,
  tourDismissed: false,
  tourCompleted: false,
};

export type WizardFieldErrors = Partial<
  Record<
    | "name"
    | "contactPhone"
    | "address"
    | "centreType"
    | "upiVpa"
    | "batchName"
    | "batchTiming"
    | "studentName"
    | "studentPhone",
    string
  >
>;

export type GettingStartedItem = {
  id: "batch" | "student" | "attendance" | "fee";
  title: string;
  hint: string;
  to: "/batches" | "/students" | "/attendance" | "/fees";
  label: string;
  done: boolean;
};

/** 10-digit Indian mobile, optional +91 / 91 / 0 prefix. */
const INDIAN_MOBILE_CORE = /^[6-9]\d{9}$/;

export function indianMobileDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function normalizeIndianMobile(raw: string): string {
  const digits = indianMobileDigits(raw);
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function isIndianMobile(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return INDIAN_MOBILE_CORE.test(normalizeIndianMobile(raw));
}

export function isRealInstituteName(name: string | null | undefined): boolean {
  const n = (name ?? "").trim();
  return n.length >= 2 && n !== PLACEHOLDER_INSTITUTE_NAME;
}

export function isCentreTypeId(value: string): value is CentreTypeId {
  return CENTRE_TYPES.some((t) => t.id === value);
}

export function readJoiningTeamFlag(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  if (!metadata) return false;
  const v = metadata.joining_team;
  return v === true || v === "true";
}

/**
 * Invited staff (joining_team metadata, non-owner role, or a workspace that
 * is not their own) must never see owner setup, tour, or the getting-started
 * checklist.
 */
export function shouldSkipOwnerOnboarding(input: {
  joiningTeam?: boolean | null;
  role?: string | null;
  isOwnWorkspace?: boolean | null;
}): boolean {
  if (input.joiningTeam) return true;
  if (input.role && input.role !== "owner") return true;
  if (input.isOwnWorkspace === false) return true;
  return false;
}

export function validateWizardStep(
  step: WizardStepId,
  draft: OwnerSetupDraft,
): WizardFieldErrors {
  const errors: WizardFieldErrors = {};

  if (step === "centre") {
    if (!isRealInstituteName(draft.name)) {
      errors.name =
        draft.name.trim() === PLACEHOLDER_INSTITUTE_NAME
          ? "Pick the name parents will see on receipts"
          : "Enter your centre name";
    } else if (draft.name.trim().length > 160) {
      errors.name = "Keep the name under 160 characters";
    }
    if (!draft.contactPhone.trim()) {
      errors.contactPhone = "Contact phone is required";
    } else if (!isIndianMobile(draft.contactPhone)) {
      errors.contactPhone = "Enter a 10-digit Indian mobile starting with 6–9";
    }
    if (draft.address.trim().length > 500) {
      errors.address = "Keep the address under 500 characters";
    }
  }

  if (step === "profile") {
    if (!isCentreTypeId(draft.centreType)) {
      errors.centreType = "Choose the type of centre";
    }
    if (draft.upiVpa.trim() && !isValidUpiVpa(draft.upiVpa)) {
      errors.upiVpa = "Enter a UPI ID like name@bank";
    }
  }

  if (step === "batch") {
    const named = draft.batchName.trim();
    const timed = draft.batchTiming.trim();
    if (!named && timed) {
      errors.batchName = "Give this batch a name";
    }
    if (named && named.length > 120) {
      errors.batchName = "Keep the batch name under 120 characters";
    }
    if (timed && timed.length > 80) {
      errors.batchTiming = "Keep the timing under 80 characters";
    }
  }

  if (step === "students") {
    const named = draft.studentName.trim();
    const phone = draft.studentPhone.trim();
    if (named || phone) {
      if (!named) errors.studentName = "Enter the student’s name";
      else if (named.length > 120) {
        errors.studentName = "Keep the name under 120 characters";
      }
      if (!phone) errors.studentPhone = "Enter a mobile number";
      else if (!isIndianMobile(phone)) {
        errors.studentPhone =
          "Enter a 10-digit Indian mobile starting with 6–9";
      }
    }
  }

  return errors;
}

export function wizardStepIndex(step: WizardStepId): number {
  return WIZARD_STEPS.findIndex((s) => s.id === step);
}

export function nextWizardStep(step: WizardStepId): WizardStepId | "done" {
  const i = wizardStepIndex(step);
  if (i < 0 || i >= WIZARD_STEPS.length - 1) return "done";
  return WIZARD_STEPS[i + 1]!.id;
}

export function prevWizardStep(step: WizardStepId): WizardStepId | null {
  const i = wizardStepIndex(step);
  if (i <= 0) return null;
  return WIZARD_STEPS[i - 1]!.id;
}

export function mergeDraftWithInstitute(
  draft: OwnerSetupDraft,
  institute: {
    name?: string | null;
    contact_phone?: string | null;
    address?: string | null;
    upi_vpa?: string | null;
  } | null,
): OwnerSetupDraft {
  if (!institute) return draft;
  return {
    ...draft,
    name:
      draft.name.trim() ||
      (isRealInstituteName(institute.name) ? institute.name!.trim() : ""),
    contactPhone: draft.contactPhone.trim()
      ? draft.contactPhone
      : (institute.contact_phone ?? ""),
    address: draft.address.trim() ? draft.address : (institute.address ?? ""),
    upiVpa: draft.upiVpa.trim() ? draft.upiVpa : (institute.upi_vpa ?? ""),
  };
}

/** Empty workspace that still needs the owner walk-through. */
export function looksLikeNewCentre(input: {
  instituteName?: string | null;
  contactPhone?: string | null;
  batchCount: number;
  activeStudentCount: number;
}): boolean {
  const unnamed = !isRealInstituteName(input.instituteName);
  const noPhone = !isIndianMobile(input.contactPhone ?? "");
  const emptyOps = input.batchCount === 0 && input.activeStudentCount === 0;
  return unnamed || noPhone || emptyOps;
}

export function firstIncompleteStep(input: {
  draft: OwnerSetupDraft;
  batchCount: number;
  activeStudentCount: number;
  skippedSteps: WizardStepId[];
}): WizardStepId | "done" {
  const skipped = new Set(input.skippedSteps);
  if (
    !skipped.has("centre") &&
    Object.keys(validateWizardStep("centre", input.draft)).length > 0
  ) {
    return "centre";
  }
  if (
    !skipped.has("profile") &&
    Object.keys(validateWizardStep("profile", input.draft)).length > 0
  ) {
    return "profile";
  }
  if (
    !skipped.has("batch") &&
    input.batchCount === 0 &&
    !input.draft.batchName.trim()
  ) {
    return "batch";
  }
  if (!skipped.has("students") && input.activeStudentCount === 0) {
    return "students";
  }
  return "done";
}

export function shouldAutoOpenWizard(input: {
  skipOwnerOnboarding: boolean;
  persisted: Pick<OwnerSetupPersisted, "completed" | "skipped">;
  resumeRequested: boolean;
  looksLikeNewCentre: boolean;
}): boolean {
  if (input.skipOwnerOnboarding) return false;
  if (input.resumeRequested) return true;
  if (input.persisted.completed || input.persisted.skipped) return false;
  return input.looksLikeNewCentre;
}

export function shouldAutoOpenTour(input: {
  skipOwnerOnboarding: boolean;
  persisted: Pick<
    OwnerSetupPersisted,
    "tourReady" | "tourDismissed" | "tourCompleted"
  >;
}): boolean {
  if (input.skipOwnerOnboarding) return false;
  if (input.persisted.tourDismissed || input.persisted.tourCompleted) {
    return false;
  }
  return input.persisted.tourReady;
}

export function deriveGettingStarted(input: {
  batchCount: number;
  activeStudentCount: number;
  paymentCount: number;
  attendanceStarted: boolean;
}): {
  items: GettingStartedItem[];
  doneCount: number;
  allDone: boolean;
} {
  const items: GettingStartedItem[] = [
    {
      id: "batch",
      title: "Create a batch",
      hint: "Group students by class or timing.",
      to: "/batches",
      label: "Go to batches",
      done: input.batchCount > 0,
    },
    {
      id: "student",
      title: "Add a student",
      hint: "Manually or import from Excel.",
      to: "/students",
      label: "Add students",
      done: input.activeStudentCount > 0,
    },
    {
      id: "attendance",
      title: "Mark attendance",
      hint: "Pick a batch and save today’s sheet.",
      to: "/attendance",
      label: "Mark attendance",
      done: input.attendanceStarted,
    },
    {
      id: "fee",
      title: "Record a fee",
      hint: "Try cash or UPI once so receipts work.",
      to: "/fees",
      label: "Open fees",
      done: input.paymentCount > 0,
    },
  ];
  const doneCount = items.filter((s) => s.done).length;
  return { items, doneCount, allDone: doneCount === items.length };
}

export function parseOwnerSetupPersisted(raw: unknown): OwnerSetupPersisted {
  if (!raw || typeof raw !== "object") return EMPTY_OWNER_SETUP_PERSISTED;
  const p = raw as Partial<OwnerSetupPersisted> & {
    draft?: Partial<OwnerSetupDraft>;
  };
  const step = WIZARD_STEPS.some((s) => s.id === p.currentStep)
    ? (p.currentStep as WizardStepId)
    : "centre";
  const skippedSteps = Array.isArray(p.skippedSteps)
    ? p.skippedSteps.filter((id): id is WizardStepId =>
        WIZARD_STEPS.some((s) => s.id === id),
      )
    : [];
  const d: Partial<OwnerSetupDraft> = p.draft ?? {};
  return {
    currentStep: step,
    skipped: !!p.skipped,
    completed: !!p.completed,
    skippedSteps,
    draft: {
      name: typeof d.name === "string" ? d.name : "",
      contactPhone: typeof d.contactPhone === "string" ? d.contactPhone : "",
      address: typeof d.address === "string" ? d.address : "",
      centreType: isCentreTypeId(d.centreType ?? "")
        ? (d.centreType as CentreTypeId)
        : "",
      upiVpa: typeof d.upiVpa === "string" ? d.upiVpa : "",
      batchName: typeof d.batchName === "string" ? d.batchName : "",
      batchTiming: typeof d.batchTiming === "string" ? d.batchTiming : "",
      studentName: typeof d.studentName === "string" ? d.studentName : "",
      studentPhone: typeof d.studentPhone === "string" ? d.studentPhone : "",
    },
    tourReady: !!p.tourReady,
    tourDismissed: !!p.tourDismissed,
    tourCompleted: !!p.tourCompleted,
    completedAt: typeof p.completedAt === "string" ? p.completedAt : undefined,
    skippedAt: typeof p.skippedAt === "string" ? p.skippedAt : undefined,
  };
}

export function ownerSetupStorageKey(userId: string): string {
  return `vidya:owner-setup:v1:${userId}`;
}
