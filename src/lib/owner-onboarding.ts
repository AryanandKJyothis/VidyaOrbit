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
    id: "you",
    title: "You and your centre",
    blurb: "Your name and phone, plus the name parents will see on receipts.",
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

export type WizardStepId = (typeof WIZARD_STEPS)[number]["id"] | "updates";

export type SetupMode = "owner" | "staff";

export const STAFF_YOU_STEP = {
  id: "you" as const,
  title: "Your details",
  blurb: "Add your name and mobile so the team knows who you are.",
};

export const UPDATES_STEP = {
  id: "updates" as const,
  title: "Stay in touch",
  blurb:
    "Optional. Unchecked unless you want product updates and tips by email.",
};

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
  ownerName: string;
  name: string;
  contactPhone: string;
  address: string;
  centreType: CentreTypeId | "";
  upiVpa: string;
  batchName: string;
  batchTiming: string;
  studentName: string;
  studentPhone: string;
  marketingOptIn: boolean;
};

export const EMPTY_OWNER_SETUP_DRAFT: OwnerSetupDraft = {
  ownerName: "",
  name: "",
  contactPhone: "",
  address: "",
  centreType: "",
  upiVpa: "",
  batchName: "",
  batchTiming: "",
  studentName: "",
  studentPhone: "",
  marketingOptIn: false,
};

export type OwnerSetupPersisted = {
  currentStep: WizardStepId;
  skipped: boolean;
  completed: boolean;
  started: boolean;
  skippedSteps: WizardStepId[];
  draft: OwnerSetupDraft;
  tourReady: boolean;
  tourDismissed: boolean;
  tourCompleted: boolean;
  completedAt?: string;
  skippedAt?: string;
};

export const EMPTY_OWNER_SETUP_PERSISTED: OwnerSetupPersisted = {
  currentStep: "you",
  skipped: false,
  completed: false,
  started: false,
  skippedSteps: [],
  draft: EMPTY_OWNER_SETUP_DRAFT,
  tourReady: false,
  tourDismissed: false,
  tourCompleted: false,
};

export type WizardFieldErrors = Partial<
  Record<
    | "ownerName"
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
  id: "student" | "batch" | "action";
  title: string;
  hint: string;
  to: "/batches" | "/students" | "/attendance" | "/fees";
  label: string;
  done: boolean;
  primary?: boolean;
};

/** Metadata key written by signup when the owner names the centre there. */
export function readInstituteNameFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): string {
  if (!metadata) return "";
  const candidate = [metadata.institute_name, metadata.instituteName].find(
    (v) => typeof v === "string" && v.trim().length > 0,
  );
  return typeof candidate === "string" ? candidate.trim() : "";
}

/**
 * SetupPrompt is the only institute-name path. Show it only for the
 * placeholder / blank default — never if signup or metadata already named it.
 */
export function shouldShowSetupPrompt(input: {
  instituteName?: string | null;
  metadataInstituteName?: string | null;
}): boolean {
  if (isRealInstituteName(input.instituteName)) return false;
  if (isRealInstituteName(input.metadataInstituteName)) return false;
  const current = (input.instituteName ?? "").trim();
  return current.length === 0 || current === PLACEHOLDER_INSTITUTE_NAME;
}

const LEGACY_WIZARD_STEPS: Record<string, WizardStepId> = {
  centre: "you",
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

export function readUserIdentity(
  metadata: Record<string, unknown> | null | undefined,
): { fullName: string; phone: string } {
  if (!metadata) return { fullName: "", phone: "" };
  const nameCandidate = [
    metadata.full_name,
    metadata.name,
    metadata.given_name,
  ].find((v) => typeof v === "string" && v.trim().length > 0);
  const phone =
    typeof metadata.phone === "string"
      ? metadata.phone
      : typeof metadata.contact_phone === "string"
        ? metadata.contact_phone
        : "";
  return {
    fullName: typeof nameCandidate === "string" ? nameCandidate.trim() : "",
    phone,
  };
}

/**
 * Invited staff (joining_team metadata, non-owner role, or a workspace that
 * is not their own). They get a name + phone modal only — no centre wizard,
 * tour, or getting-started checklist.
 */
export function isInvitedStaff(input: {
  joiningTeam?: boolean | null;
  role?: string | null;
  isOwnWorkspace?: boolean | null;
}): boolean {
  if (input.joiningTeam) return true;
  if (input.role && input.role !== "owner") return true;
  if (input.isOwnWorkspace === false) return true;
  return false;
}

export function setupModeFor(input: {
  joiningTeam?: boolean | null;
  role?: string | null;
  isOwnWorkspace?: boolean | null;
}): SetupMode {
  return isInvitedStaff(input) ? "staff" : "owner";
}

export function stepsFor(
  mode: SetupMode,
  includeMarketingStep = false,
): readonly { id: WizardStepId; title: string; blurb: string }[] {
  const core = mode === "staff" ? [STAFF_YOU_STEP] : WIZARD_STEPS;
  return includeMarketingStep ? [UPDATES_STEP, ...core] : core;
}

export function wizardStepMeta(
  step: WizardStepId,
  mode: SetupMode,
  includeMarketingStep = false,
) {
  if (step === "updates") return UPDATES_STEP;
  if (mode === "staff" && step === "you") return STAFF_YOU_STEP;
  return (
    stepsFor(mode, includeMarketingStep).find((s) => s.id === step) ??
    WIZARD_STEPS[0]
  );
}

export function looksLikeIncompleteIdentity(input: {
  fullName?: string | null;
  phone?: string | null;
}): boolean {
  return !(input.fullName ?? "").trim() || !isIndianMobile(input.phone ?? "");
}

export function validateWizardStep(
  step: WizardStepId,
  draft: OwnerSetupDraft,
  mode: SetupMode = "owner",
): WizardFieldErrors {
  const errors: WizardFieldErrors = {};

  if (step === "updates") {
    return errors;
  }

  if (step === "you") {
    if (!draft.ownerName.trim()) {
      errors.ownerName = "Enter your name";
    } else if (draft.ownerName.trim().length < 2) {
      errors.ownerName = "Enter your full name";
    } else if (draft.ownerName.trim().length > 120) {
      errors.ownerName = "Keep the name under 120 characters";
    }
    if (!draft.contactPhone.trim()) {
      errors.contactPhone = "Contact phone is required";
    } else if (!isIndianMobile(draft.contactPhone)) {
      errors.contactPhone = "Enter a 10-digit Indian mobile starting with 6–9";
    }
    if (mode === "owner") {
      if (!isRealInstituteName(draft.name)) {
        errors.name =
          draft.name.trim() === PLACEHOLDER_INSTITUTE_NAME
            ? "Pick the name parents will see on receipts"
            : "Enter your centre name";
      } else if (draft.name.trim().length > 160) {
        errors.name = "Keep the name under 160 characters";
      }
      if (draft.address.trim().length > 500) {
        errors.address = "Keep the address under 500 characters";
      }
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

export function wizardStepIndex(
  step: WizardStepId,
  mode: SetupMode = "owner",
  includeMarketingStep = false,
): number {
  const i = stepsFor(mode, includeMarketingStep).findIndex(
    (s) => s.id === step,
  );
  return i < 0 ? 0 : i;
}

export function nextWizardStep(
  step: WizardStepId,
  mode: SetupMode = "owner",
  includeMarketingStep = false,
): WizardStepId | "done" {
  const list = stepsFor(mode, includeMarketingStep);
  const i = list.findIndex((s) => s.id === step);
  if (i < 0 || i >= list.length - 1) return "done";
  return list[i + 1]!.id;
}

export function prevWizardStep(
  step: WizardStepId,
  mode: SetupMode = "owner",
  includeMarketingStep = false,
): WizardStepId | null {
  const list = stepsFor(mode, includeMarketingStep);
  const i = list.findIndex((s) => s.id === step);
  if (i <= 0) return null;
  return list[i - 1]!.id;
}

export function mergeDraftWithInstitute(
  draft: OwnerSetupDraft,
  institute: {
    name?: string | null;
    contact_phone?: string | null;
    address?: string | null;
    upi_vpa?: string | null;
  } | null,
  identity?: { fullName?: string | null; phone?: string | null },
): OwnerSetupDraft {
  return {
    ...draft,
    ownerName:
      draft.ownerName.trim() || (identity?.fullName ?? "").trim() || "",
    name:
      draft.name.trim() ||
      (isRealInstituteName(institute?.name) ? institute!.name!.trim() : ""),
    contactPhone: draft.contactPhone.trim()
      ? draft.contactPhone
      : ((institute?.contact_phone || identity?.phone) ?? ""),
    address: draft.address.trim() ? draft.address : (institute?.address ?? ""),
    upiVpa: draft.upiVpa.trim() ? draft.upiVpa : (institute?.upi_vpa ?? ""),
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
  mode?: SetupMode;
  includeMarketingStep?: boolean;
}): WizardStepId | "done" {
  const mode = input.mode ?? "owner";
  const skipped = new Set(input.skippedSteps);
  if (input.includeMarketingStep && !skipped.has("updates")) {
    return "updates";
  }
  if (
    !skipped.has("you") &&
    Object.keys(validateWizardStep("you", input.draft, mode)).length > 0
  ) {
    return "you";
  }
  if (mode === "staff") return "done";
  if (
    !skipped.has("profile") &&
    Object.keys(validateWizardStep("profile", input.draft, mode)).length > 0
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

export function setupIsIncomplete(input: {
  completed: boolean;
  looksIncomplete: boolean;
  started?: boolean;
}): boolean {
  if (input.completed) return false;
  return input.looksIncomplete || !!input.started;
}

export function shouldAutoOpenWizard(input: {
  setupComplete: boolean;
  resumeRequested: boolean;
  looksIncomplete: boolean;
  dismissedUntilInteraction?: boolean;
}): boolean {
  if (input.resumeRequested) return true;
  if (input.setupComplete) return false;
  if (input.dismissedUntilInteraction) return false;
  return input.looksIncomplete;
}

export function shouldCaptureClicksToResume(input: {
  setupIncomplete: boolean;
  modalOpen: boolean;
}): boolean {
  return input.setupIncomplete && !input.modalOpen;
}

export function shouldAutoOpenTour(input: {
  isInvitedStaff: boolean;
  persisted: Pick<
    OwnerSetupPersisted,
    "tourReady" | "tourDismissed" | "tourCompleted"
  >;
}): boolean {
  if (input.isInvitedStaff) return false;
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
  const actionDone = input.attendanceStarted || input.paymentCount > 0;
  const items: GettingStartedItem[] = [
    {
      id: "student",
      title: "Import or add students",
      hint: "Bring in your register from Excel, or add names one by one.",
      to: "/students",
      label: "Import",
      done: input.activeStudentCount > 0,
      primary: true,
    },
    {
      id: "batch",
      title: "Create a batch",
      hint: "Group students by class or timing.",
      to: "/batches",
      label: "Create batch",
      done: input.batchCount > 0,
    },
    {
      id: "action",
      title: "Mark attendance or record a fee",
      hint: "Either one counts — pick whichever you do first today.",
      to: input.attendanceStarted ? "/fees" : "/attendance",
      label: input.attendanceStarted ? "Record a fee" : "Mark attendance",
      done: actionDone,
    },
  ];
  const doneCount = items.filter((s) => s.done).length;
  return { items, doneCount, allDone: doneCount === items.length };
}

export function parseOwnerSetupPersisted(raw: unknown): OwnerSetupPersisted {
  if (!raw || typeof raw !== "object") return EMPTY_OWNER_SETUP_PERSISTED;
  const p = raw as Partial<OwnerSetupPersisted> & {
    draft?: Partial<OwnerSetupDraft>;
    currentStep?: string;
  };
  const mappedStep = p.currentStep
    ? (LEGACY_WIZARD_STEPS[p.currentStep] ?? p.currentStep)
    : "you";
  const knownSteps: WizardStepId[] = [
    "updates",
    ...WIZARD_STEPS.map((s) => s.id),
  ];
  const step = knownSteps.includes(mappedStep as WizardStepId)
    ? (mappedStep as WizardStepId)
    : "you";
  const skippedSteps = Array.isArray(p.skippedSteps)
    ? p.skippedSteps
        .map((id) => LEGACY_WIZARD_STEPS[id] ?? id)
        .filter((id): id is WizardStepId =>
          knownSteps.includes(id as WizardStepId),
        )
    : [];
  const d: Partial<OwnerSetupDraft> = p.draft ?? {};
  return {
    currentStep: step,
    skipped: !!p.skipped,
    completed: !!p.completed,
    started: !!p.started || !!p.completed,
    skippedSteps,
    draft: {
      ownerName: typeof d.ownerName === "string" ? d.ownerName : "",
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
      marketingOptIn: d.marketingOptIn === true,
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
