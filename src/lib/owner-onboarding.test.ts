import { describe, expect, it } from "vitest";
import {
  deriveGettingStarted,
  firstIncompleteStep,
  isIndianMobile,
  isInvitedStaff,
  isRealInstituteName,
  looksLikeIncompleteIdentity,
  looksLikeNewCentre,
  mergeDraftWithInstitute,
  normalizeIndianMobile,
  parseOwnerSetupPersisted,
  readInstituteNameFromMetadata,
  readJoiningTeamFlag,
  readUserIdentity,
  setupIsIncomplete,
  shouldAutoOpenOwnerWizard,
  shouldAutoOpenTour,
  shouldAutoOpenWizard,
  shouldCaptureClicksToResume,
  shouldCaptureOwnerClicksToResume,
  shouldShowSetupPrompt,
  setupModeFor,
  validateWizardStep,
  nextWizardStep,
  type OwnerSetupDraft,
  EMPTY_OWNER_SETUP_DRAFT,
  EMPTY_OWNER_SETUP_PERSISTED,
} from "./owner-onboarding";
import { isGoogleAuthEnabled } from "./feature-flags";
import { signupSchema } from "./validation";

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

describe("signup is email and password only", () => {
  it("accepts credentials without institute name or phone", () => {
    const parsed = signupSchema.safeParse({
      email: "owner@centre.in",
      password: "password1",
    });
    expect(parsed.success).toBe(true);
  });

  it("treats institute name as optional and never requires phone", () => {
    const named = signupSchema.safeParse({
      email: "owner@centre.in",
      password: "password1",
      institute_name: "Samriddhi Centre",
    });
    expect(named.success).toBe(true);
    expect("institute_name" in signupSchema.shape).toBe(true);
    expect("phone" in signupSchema.shape).toBe(false);
  });

  it("still requires a valid email and 8-character password", () => {
    expect(
      signupSchema.safeParse({ email: "nope", password: "password1" }).success,
    ).toBe(false);
    expect(
      signupSchema.safeParse({ email: "owner@centre.in", password: "short" })
        .success,
    ).toBe(false);
  });
});

describe("Google auth flag", () => {
  it("stays off unless VITE_GOOGLE_AUTH_ENABLED is the exact string true", () => {
    expect(isGoogleAuthEnabled(undefined)).toBe(false);
    expect(isGoogleAuthEnabled("")).toBe(false);
    expect(isGoogleAuthEnabled("TRUE")).toBe(false);
    expect(isGoogleAuthEnabled("1")).toBe(false);
    expect(isGoogleAuthEnabled("true")).toBe(true);
  });
});

describe("wizard step validation", () => {
  it("requires name and centre name on the owner you-step; phone is optional", () => {
    expect(validateWizardStep("you", draft())).toMatchObject({
      ownerName: "Enter your name",
      name: "Enter your centre name",
    });
    expect(validateWizardStep("you", draft()).contactPhone).toBeUndefined();
    expect(
      validateWizardStep(
        "you",
        draft({
          ownerName: "Anjali",
          name: "My Institute",
          contactPhone: "9876543210",
        }),
      ).name,
    ).toMatch(/receipts/);
    expect(
      validateWizardStep(
        "you",
        draft({
          ownerName: "Anjali",
          name: "Samriddhi",
          contactPhone: "555",
        }),
      ).contactPhone,
    ).toMatch(/Indian mobile/);
    expect(
      validateWizardStep(
        "you",
        draft({
          ownerName: "Anjali Krishnan",
          name: "Samriddhi Centre",
          contactPhone: "+91 9876543210",
          address: "Kottayam",
        }),
      ),
    ).toEqual({});
    expect(
      validateWizardStep(
        "you",
        draft({
          ownerName: "Anjali Krishnan",
          name: "Samriddhi Centre",
        }),
      ),
    ).toEqual({});
  });

  it("asks invited staff only for name and phone", () => {
    expect(validateWizardStep("you", draft(), "staff")).toMatchObject({
      ownerName: "Enter your name",
      contactPhone: "Contact phone is required",
    });
    expect(validateWizardStep("you", draft(), "staff").name).toBeUndefined();
    expect(
      validateWizardStep(
        "you",
        draft({ ownerName: "Ravi", contactPhone: "9876543210" }),
        "staff",
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

  it("never blocks the optional marketing updates step", () => {
    expect(validateWizardStep("updates", draft())).toEqual({});
    expect(
      validateWizardStep("updates", draft({ marketingOptIn: true })),
    ).toEqual({});
    expect(nextWizardStep("updates", "owner", true)).toBe("you");
    expect(nextWizardStep("updates", "staff", true)).toBe("you");
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

describe("invited staff get name and phone only", () => {
  it("detects joining_team and non-owner workspaces", () => {
    expect(readJoiningTeamFlag({ joining_team: true })).toBe(true);
    expect(readJoiningTeamFlag({ joining_team: "true" })).toBe(true);
    expect(readJoiningTeamFlag({ institute_name: "X" })).toBe(false);
    expect(
      isInvitedStaff({
        joiningTeam: true,
        role: "owner",
        isOwnWorkspace: true,
      }),
    ).toBe(true);
    expect(
      setupModeFor({
        joiningTeam: true,
        role: "owner",
        isOwnWorkspace: true,
      }),
    ).toBe("staff");
  });

  it("treats non-owner roles and other workspaces as staff", () => {
    expect(
      isInvitedStaff({
        joiningTeam: false,
        role: "staff",
        isOwnWorkspace: false,
      }),
    ).toBe(true);
    expect(
      isInvitedStaff({
        joiningTeam: false,
        role: "manager",
        isOwnWorkspace: false,
      }),
    ).toBe(true);
    expect(
      isInvitedStaff({
        joiningTeam: false,
        role: "owner",
        isOwnWorkspace: false,
      }),
    ).toBe(true);
    expect(
      isInvitedStaff({
        joiningTeam: false,
        role: "owner",
        isOwnWorkspace: true,
      }),
    ).toBe(false);
  });

  it("opens the identity modal for staff, never the owner tour", () => {
    const persisted = {
      ...EMPTY_OWNER_SETUP_PERSISTED,
      tourReady: true,
    };
    expect(
      shouldAutoOpenWizard({
        setupComplete: false,
        resumeRequested: false,
        looksIncomplete: true,
      }),
    ).toBe(true);
    expect(
      shouldAutoOpenTour({
        isInvitedStaff: true,
        persisted,
      }),
    ).toBe(false);
    expect(
      firstIncompleteStep({
        draft: draft({ ownerName: "Ravi", contactPhone: "9876543210" }),
        batchCount: 0,
        activeStudentCount: 0,
        skippedSteps: [],
        mode: "staff",
      }),
    ).toBe("done");
  });
});

describe("getting started checklist derivation", () => {
  it("starts at 0/3 with Import as the primary CTA", () => {
    const empty = deriveGettingStarted({
      batchCount: 0,
      activeStudentCount: 0,
      paymentCount: 0,
      attendanceStarted: false,
    });
    expect(empty.doneCount).toBe(0);
    expect(empty.allDone).toBe(false);
    expect(empty.items).toHaveLength(3);
    expect(empty.items.map((i) => i.id)).toEqual([
      "student",
      "batch",
      "action",
    ]);
    expect(empty.items.map((i) => i.done)).toEqual([false, false, false]);
    expect(empty.items[0]?.label).toBe("Import");
    expect(empty.items[0]?.primary).toBe(true);
  });

  it("ticks items from real counts and treats attendance or a fee as one step", () => {
    const partial = deriveGettingStarted({
      batchCount: 1,
      activeStudentCount: 2,
      paymentCount: 0,
      attendanceStarted: false,
    });
    expect(partial.doneCount).toBe(2);
    expect(partial.items.find((i) => i.id === "batch")?.done).toBe(true);
    expect(partial.items.find((i) => i.id === "student")?.done).toBe(true);
    expect(partial.items.find((i) => i.id === "action")?.done).toBe(false);
    expect(partial.allDone).toBe(false);

    const feeOnly = deriveGettingStarted({
      batchCount: 1,
      activeStudentCount: 1,
      paymentCount: 1,
      attendanceStarted: false,
    });
    expect(feeOnly.items.find((i) => i.id === "action")?.done).toBe(true);
    expect(feeOnly.doneCount).toBe(3);
    expect(feeOnly.allDone).toBe(true);

    const done = deriveGettingStarted({
      batchCount: 1,
      activeStudentCount: 1,
      paymentCount: 1,
      attendanceStarted: true,
    });
    expect(done.allDone).toBe(true);
    expect(done.doneCount).toBe(3);
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
    expect(result.doneCount).toBe(2);
  });

  it("does not bump progress just because the centre is named", () => {
    const named = deriveGettingStarted({
      batchCount: 0,
      activeStudentCount: 0,
      paymentCount: 0,
      attendanceStarted: false,
    });
    expect(named.doneCount).toBe(0);
    expect(shouldShowSetupPrompt({ instituteName: "Samriddhi Centre" })).toBe(
      false,
    );
  });
});

describe("SetupPrompt institute-name path", () => {
  it("prompts only for the placeholder or a blank name", () => {
    expect(shouldShowSetupPrompt({ instituteName: "My Institute" })).toBe(true);
    expect(shouldShowSetupPrompt({ instituteName: "" })).toBe(true);
    expect(shouldShowSetupPrompt({ instituteName: "Samriddhi Centre" })).toBe(
      false,
    );
    expect(
      shouldShowSetupPrompt({
        instituteName: "My Institute",
        metadataInstituteName: "Samriddhi Centre",
      }),
    ).toBe(false);
    expect(readInstituteNameFromMetadata({ institute_name: "X" })).toBe("X");
  });
});

describe("resume, dismiss, and first-run gates", () => {
  it("treats empty or unnamed workspaces as new; a named centre with students is settled without a phone", () => {
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
      looksLikeNewCentre({
        instituteName: "Samriddhi Centre",
        contactPhone: null,
        batchCount: 3,
        activeStudentCount: 40,
      }),
    ).toBe(false);
    expect(
      looksLikeIncompleteIdentity({ fullName: "", phone: "9876543210" }),
    ).toBe(true);
    expect(
      looksLikeIncompleteIdentity({
        fullName: "Ravi",
        phone: "9876543210",
      }),
    ).toBe(false);

    expect(
      shouldAutoOpenWizard({
        setupComplete: false,
        resumeRequested: false,
        looksIncomplete: true,
      }),
    ).toBe(true);
    expect(
      shouldAutoOpenWizard({
        setupComplete: false,
        resumeRequested: false,
        looksIncomplete: true,
        dismissedUntilInteraction: true,
      }),
    ).toBe(false);
    expect(
      shouldAutoOpenWizard({
        setupComplete: true,
        resumeRequested: false,
        looksIncomplete: true,
      }),
    ).toBe(false);
    expect(
      shouldAutoOpenWizard({
        setupComplete: true,
        resumeRequested: true,
        looksIncomplete: true,
      }),
    ).toBe(true);
  });

  it("does not auto-open or click-capture a new owner who has no phone", () => {
    for (const instituteName of ["My Institute", "Samriddhi Centre"] as const) {
      expect(
        shouldAutoOpenOwnerWizard({
          setupComplete: false,
          resumeRequested: false,
        }),
      ).toBe(false);
      expect(shouldCaptureOwnerClicksToResume()).toBe(false);
      const checklist = deriveGettingStarted({
        batchCount: 0,
        activeStudentCount: 0,
        paymentCount: 0,
        attendanceStarted: false,
      });
      expect(checklist.doneCount).toBe(0);
      expect(checklist.items).toHaveLength(3);
      expect(checklist.items[0]?.label).toBe("Import");
      expect(
        looksLikeNewCentre({
          instituteName,
          contactPhone: null,
          batchCount: 0,
          activeStudentCount: 0,
        }),
      ).toBe(true);
    }
    expect(
      shouldAutoOpenOwnerWizard({
        setupComplete: false,
        resumeRequested: true,
      }),
    ).toBe(true);
  });

  it("reopens from a dashboard click after the backdrop dismisses", () => {
    expect(
      shouldCaptureClicksToResume({
        setupIncomplete: true,
        modalOpen: false,
      }),
    ).toBe(true);
    expect(
      shouldCaptureClicksToResume({
        setupIncomplete: true,
        modalOpen: true,
      }),
    ).toBe(false);
    expect(
      shouldCaptureClicksToResume({
        setupIncomplete: false,
        modalOpen: false,
      }),
    ).toBe(false);
    expect(setupIsIncomplete({ completed: false, looksIncomplete: true })).toBe(
      true,
    );
    expect(setupIsIncomplete({ completed: true, looksIncomplete: true })).toBe(
      false,
    );
    expect(
      setupIsIncomplete({
        completed: false,
        looksIncomplete: false,
        started: true,
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
    ).toBe("you");
    expect(
      firstIncompleteStep({
        draft: draft(),
        batchCount: 0,
        activeStudentCount: 0,
        skippedSteps: [],
        includeMarketingStep: true,
      }),
    ).toBe("updates");
    expect(
      firstIncompleteStep({
        draft: draft({
          ownerName: "Anjali",
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
          ownerName: "Anjali",
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
    const merged = mergeDraftWithInstitute(
      draft({ name: "Kept", ownerName: "Anjali" }),
      {
        name: "From DB",
        contact_phone: "9876543210",
        address: "Kottayam",
        upi_vpa: "centre@oksbi",
      },
      { fullName: "Ignored", phone: "9000000000" },
    );
    expect(merged.name).toBe("Kept");
    expect(merged.ownerName).toBe("Anjali");
    expect(merged.contactPhone).toBe("9876543210");
    expect(merged.address).toBe("Kottayam");
    expect(isRealInstituteName("My Institute")).toBe(false);
  });

  it("reads Google / signup identity from user metadata", () => {
    expect(
      readUserIdentity({ full_name: "Anjali Krishnan", phone: "9876543210" }),
    ).toEqual({ fullName: "Anjali Krishnan", phone: "9876543210" });
    expect(readUserIdentity({ name: "Google User" }).fullName).toBe(
      "Google User",
    );
  });

  it("parses persisted JSON per user and maps the old centre step to you", () => {
    expect(parseOwnerSetupPersisted(null).currentStep).toBe("you");
    expect(parseOwnerSetupPersisted({ currentStep: "nope" }).currentStep).toBe(
      "you",
    );
    expect(
      parseOwnerSetupPersisted({ currentStep: "centre" }).currentStep,
    ).toBe("you");
    expect(
      parseOwnerSetupPersisted({
        currentStep: "updates",
        draft: { marketingOptIn: true },
      }),
    ).toMatchObject({
      currentStep: "updates",
      draft: { marketingOptIn: true },
    });
    expect(
      parseOwnerSetupPersisted({
        currentStep: "batch",
        draft: { centreType: "psc", name: "X", ownerName: "Anjali" },
        tourReady: true,
      }).draft,
    ).toMatchObject({ centreType: "psc", ownerName: "Anjali" });
  });

  it("opens the tour only after the modal has been completed, never for staff", () => {
    expect(
      shouldAutoOpenTour({
        isInvitedStaff: false,
        persisted: EMPTY_OWNER_SETUP_PERSISTED,
      }),
    ).toBe(false);
    expect(
      shouldAutoOpenTour({
        isInvitedStaff: false,
        persisted: { ...EMPTY_OWNER_SETUP_PERSISTED, tourReady: true },
      }),
    ).toBe(true);
    expect(
      shouldAutoOpenTour({
        isInvitedStaff: false,
        persisted: {
          ...EMPTY_OWNER_SETUP_PERSISTED,
          tourReady: true,
          tourDismissed: true,
        },
      }),
    ).toBe(false);
  });
});
