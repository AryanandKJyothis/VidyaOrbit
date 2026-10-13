import { describe, expect, it } from "vitest";
import {
  deriveGettingStarted,
  firstIncompleteStep,
  isIndianMobile,
  isRealInstituteName,
  looksLikeNewCentre,
  mergeDraftWithInstitute,
  normalizeIndianMobile,
  parseOwnerSetupPersisted,
  readJoiningTeamFlag,
  shouldAutoOpenTour,
  shouldAutoOpenWizard,
  shouldSkipOwnerOnboarding,
  validateWizardStep,
  type OwnerSetupDraft,
  EMPTY_OWNER_SETUP_DRAFT,
  EMPTY_OWNER_SETUP_PERSISTED,
} from "./owner-onboarding";

function draft(patch: Partial<OwnerSetupDraft> = {}): OwnerSetupDraft {
  return { ...EMPTY_OWNER_SETUP_DRAFT, ...patch };
}

describe("Indian mobile validation", () => {
  it("accepts 10-digit numbers starting with 6–9, with or without +91", () => {
    expect(isIndianMobile("9876543210")).toBe(true);
    expect(isIndianMobile("6876543210")).toBe(true);
    expect(isIndianMobile("+91 98765 43210")).toBe(true);
    expect(isIndianMobile("919876543210")).toBe(true);
    expect(isIndianMobile("09876543210")).toBe(true);
    expect(normalizeIndianMobile("+91-98765-43210")).toBe("9876543210");
  });

  it("rejects landlines, short, and non-Indian prefixes", () => {
    expect(isIndianMobile("")).toBe(false);
    expect(isIndianMobile("123")).toBe(false);
    expect(isIndianMobile("5876543210")).toBe(false);
    expect(isIndianMobile("987654321")).toBe(false);
    expect(isIndianMobile("+1 555 123 4567")).toBe(false);
    expect(isIndianMobile("abcdefghij")).toBe(false);
  });
});

describe("wizard step validation", () => {
  it("requires a real centre name and Indian mobile on step 1", () => {
    expect(validateWizardStep("centre", draft())).toMatchObject({
      name: "Enter your centre name",
      contactPhone: "Contact phone is required",
    });
    expect(
      validateWizardStep(
        "centre",
        draft({ name: "My Institute", contactPhone: "9876543210" }),
      ).name,
    ).toMatch(/receipts/);
    expect(
      validateWizardStep(
        "centre",
        draft({ name: "Samriddhi", contactPhone: "555" }),
      ).contactPhone,
    ).toMatch(/Indian mobile/);
    expect(
      validateWizardStep(
        "centre",
        draft({
          name: "Samriddhi Centre",
          contactPhone: "+91 9876543210",
          address: "Kottayam",
        }),
      ),
    ).toEqual({});
  });

  it("requires centre type and accepts a blank or valid UPI on step 2", () => {
    expect(validateWizardStep("profile", draft()).centreType).toMatch(/type/);
    expect(
      validateWizardStep(
        "profile",
        draft({ centreType: "tuition", upiVpa: "" }),
      ),
    ).toEqual({});
    expect(
      validateWizardStep(
        "profile",
        draft({ centreType: "psc", upiVpa: "centre@oksbi" }),
      ),
    ).toEqual({});
    expect(
      validateWizardStep(
        "profile",
        draft({ centreType: "cbse", upiVpa: "not a vpa" }),
      ).upiVpa,
    ).toMatch(/UPI ID/);
  });

  it("lets the first batch stay empty, but names it when timing is filled", () => {
    expect(validateWizardStep("batch", draft())).toEqual({});
    expect(
      validateWizardStep(
        "batch",
        draft({
          batchName: "Class 10 Maths",
          batchTiming: "4:00 PM – 5:30 PM",
        }),
      ),
    ).toEqual({});
    expect(
      validateWizardStep("batch", draft({ batchTiming: "4:00 PM" })).batchName,
    ).toMatch(/name/);
  });

  it("lets first students stay empty, and validates a partial add", () => {
    expect(validateWizardStep("students", draft())).toEqual({});
    expect(
      validateWizardStep("students", draft({ studentName: "Anjali" }))
        .studentPhone,
    ).toMatch(/mobile/);
    expect(
      validateWizardStep(
        "students",
        draft({ studentName: "Anjali", studentPhone: "9876543210" }),
      ),
    ).toEqual({});
  });
});

describe("invited staff skip owner onboarding", () => {
  it("skips when joining_team is set on the user", () => {
    expect(readJoiningTeamFlag({ joining_team: true })).toBe(true);
    expect(readJoiningTeamFlag({ joining_team: "true" })).toBe(true);
    expect(readJoiningTeamFlag({ institute_name: "X" })).toBe(false);
    expect(
      shouldSkipOwnerOnboarding({
        joiningTeam: true,
        role: "owner",
        isOwnWorkspace: true,
      }),
    ).toBe(true);
  });

  it("skips non-owner roles and workspaces that are not their own", () => {
    expect(
      shouldSkipOwnerOnboarding({
        joiningTeam: false,
        role: "staff",
        isOwnWorkspace: false,
      }),
    ).toBe(true);
    expect(
      shouldSkipOwnerOnboarding({
        joiningTeam: false,
        role: "manager",
        isOwnWorkspace: false,
      }),
    ).toBe(true);
    expect(
      shouldSkipOwnerOnboarding({
        joiningTeam: false,
        role: "owner",
        isOwnWorkspace: false,
      }),
    ).toBe(true);
    expect(
      shouldSkipOwnerOnboarding({
        joiningTeam: false,
        role: "owner",
        isOwnWorkspace: true,
      }),
    ).toBe(false);
  });

  it("never auto-opens the wizard or tour for invited staff", () => {
    const persisted = {
      ...EMPTY_OWNER_SETUP_PERSISTED,
      tourReady: true,
    };
    expect(
      shouldAutoOpenWizard({
        skipOwnerOnboarding: true,
        persisted,
        resumeRequested: false,
        looksLikeNewCentre: true,
      }),
    ).toBe(false);
    expect(
      shouldAutoOpenWizard({
        skipOwnerOnboarding: true,
        persisted,
        resumeRequested: true,
        looksLikeNewCentre: true,
      }),
    ).toBe(false);
    expect(
      shouldAutoOpenTour({
        skipOwnerOnboarding: true,
        persisted,
      }),
    ).toBe(false);
  });
});

describe("getting started checklist derivation", () => {
  it("ticks items from real counts and hides when every item is done", () => {
    const empty = deriveGettingStarted({
      batchCount: 0,
      activeStudentCount: 0,
      paymentCount: 0,
      attendanceStarted: false,
    });
    expect(empty.doneCount).toBe(0);
    expect(empty.allDone).toBe(false);
    expect(empty.items.map((i) => i.done)).toEqual([
      false,
      false,
      false,
      false,
    ]);

    const partial = deriveGettingStarted({
      batchCount: 1,
      activeStudentCount: 2,
      paymentCount: 0,
      attendanceStarted: false,
    });
    expect(partial.doneCount).toBe(2);
    expect(partial.items.find((i) => i.id === "batch")?.done).toBe(true);
    expect(partial.items.find((i) => i.id === "student")?.done).toBe(true);
    expect(partial.items.find((i) => i.id === "fee")?.done).toBe(false);
    expect(partial.allDone).toBe(false);

    const done = deriveGettingStarted({
      batchCount: 1,
      activeStudentCount: 1,
      paymentCount: 1,
      attendanceStarted: true,
    });
    expect(done.allDone).toBe(true);
    expect(done.doneCount).toBe(4);
  });

  it("does not count archived-only centres as having students", () => {
    const result = deriveGettingStarted({
      batchCount: 1,
      activeStudentCount: 0,
      paymentCount: 3,
      attendanceStarted: true,
    });
    expect(result.items.find((i) => i.id === "student")?.done).toBe(false);
    expect(result.allDone).toBe(false);
  });
});

describe("resume and first-run gates", () => {
  it("opens the wizard for a new centre, not for a settled one", () => {
    expect(
      looksLikeNewCentre({
        instituteName: "My Institute",
        contactPhone: null,
        batchCount: 0,
        activeStudentCount: 0,
      }),
    ).toBe(true);
    expect(
      looksLikeNewCentre({
        instituteName: "Samriddhi Centre",
        contactPhone: "9876543210",
        batchCount: 3,
        activeStudentCount: 40,
      }),
    ).toBe(false);

    expect(
      shouldAutoOpenWizard({
        skipOwnerOnboarding: false,
        persisted: EMPTY_OWNER_SETUP_PERSISTED,
        resumeRequested: false,
        looksLikeNewCentre: true,
      }),
    ).toBe(true);
    expect(
      shouldAutoOpenWizard({
        skipOwnerOnboarding: false,
        persisted: { ...EMPTY_OWNER_SETUP_PERSISTED, skipped: true },
        resumeRequested: false,
        looksLikeNewCentre: true,
      }),
    ).toBe(false);
    expect(
      shouldAutoOpenWizard({
        skipOwnerOnboarding: false,
        persisted: { ...EMPTY_OWNER_SETUP_PERSISTED, skipped: true },
        resumeRequested: true,
        looksLikeNewCentre: true,
      }),
    ).toBe(true);
  });

  it("resumes at the first incomplete step and treats skipped steps as done", () => {
    expect(
      firstIncompleteStep({
        draft: draft(),
        batchCount: 0,
        activeStudentCount: 0,
        skippedSteps: [],
      }),
    ).toBe("centre");
    expect(
      firstIncompleteStep({
        draft: draft({
          name: "Samriddhi",
          contactPhone: "9876543210",
          centreType: "tuition",
        }),
        batchCount: 0,
        activeStudentCount: 0,
        skippedSteps: [],
      }),
    ).toBe("batch");
    expect(
      firstIncompleteStep({
        draft: draft({
          name: "Samriddhi",
          contactPhone: "9876543210",
          centreType: "cbse",
        }),
        batchCount: 0,
        activeStudentCount: 0,
        skippedSteps: ["batch", "students"],
      }),
    ).toBe("done");
  });

  it("hydrates the draft from existing institute columns without clobbering", () => {
    const merged = mergeDraftWithInstitute(draft({ name: "Kept" }), {
      name: "From DB",
      contact_phone: "9876543210",
      address: "Kottayam",
      upi_vpa: "centre@oksbi",
    });
    expect(merged.name).toBe("Kept");
    expect(merged.contactPhone).toBe("9876543210");
    expect(merged.address).toBe("Kottayam");
    expect(isRealInstituteName("My Institute")).toBe(false);
  });

  it("parses persisted JSON per user without throwing on junk", () => {
    expect(parseOwnerSetupPersisted(null).currentStep).toBe("centre");
    expect(parseOwnerSetupPersisted({ currentStep: "nope" }).currentStep).toBe(
      "centre",
    );
    expect(
      parseOwnerSetupPersisted({
        currentStep: "batch",
        draft: { centreType: "psc", name: "X" },
        tourReady: true,
      }).draft.centreType,
    ).toBe("psc");
  });

  it("opens the tour only after the wizard has finished or been skipped", () => {
    expect(
      shouldAutoOpenTour({
        skipOwnerOnboarding: false,
        persisted: EMPTY_OWNER_SETUP_PERSISTED,
      }),
    ).toBe(false);
    expect(
      shouldAutoOpenTour({
        skipOwnerOnboarding: false,
        persisted: { ...EMPTY_OWNER_SETUP_PERSISTED, tourReady: true },
      }),
    ).toBe(true);
    expect(
      shouldAutoOpenTour({
        skipOwnerOnboarding: false,
        persisted: {
          ...EMPTY_OWNER_SETUP_PERSISTED,
          tourReady: true,
          tourDismissed: true,
        },
      }),
    ).toBe(false);
  });
});
