import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import {
  useBatches,
  useInstitute,
  useStudents,
  useUpdateInstitute,
  useUpsertBatch,
  useUpsertStudent,
} from "@/hooks/use-data";
import { useOwnerOnboarding } from "@/hooks/use-owner-onboarding";
import { supabase } from "@/integrations/supabase/client";
import { formatUserError } from "@/lib/format-error";
import { todayISO } from "@/lib/format";
import {
  isInvitedStaff,
  looksLikeIncompleteIdentity,
  looksLikeNewCentre,
  mergeDraftWithInstitute,
  nextWizardStep,
  normalizeIndianMobile,
  prevWizardStep,
  readJoiningTeamFlag,
  readUserIdentity,
  setupIsIncomplete,
  setupModeFor,
  shouldAutoOpenTour,
  shouldAutoOpenWizard,
  shouldCaptureClicksToResume,
  validateWizardStep,
  type WizardFieldErrors,
  type WizardStepId,
  TOUR_STEPS,
} from "@/lib/owner-onboarding";
import {
  OwnerSetupCaptureOverlay,
  OwnerSetupWizardModal,
  OwnerSetupWizardView,
} from "@/components/owner-setup-wizard";
import {
  AppGuidedTourOverlay,
  AppGuidedTourView,
} from "@/components/app-guided-tour";
import { ImportStudentsDialog } from "@/components/import-students-dialog";

export function OwnerOnboardingHost() {
  const { user } = useAuth();
  const { active, loading: workspacesLoading } = useActiveWorkspace();
  const institute = useInstitute();
  const batches = useBatches();
  const students = useStudents();
  const updateInstitute = useUpdateInstitute();
  const upsertBatch = useUpsertBatch();
  const upsertStudent = useUpsertStudent();
  const onboarding = useOwnerOnboarding(user?.id ?? null);
  const navigate = useNavigate();

  const [resumeRequested, setResumeRequested] = useState(false);
  const [userDismissed, setUserDismissed] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<WizardFieldErrors>({});

  const metadata = user?.user_metadata as Record<string, unknown> | undefined;
  const identity = readUserIdentity(metadata);
  const staff = isInvitedStaff({
    joiningTeam: readJoiningTeamFlag(metadata),
    role: active?.role ?? null,
    isOwnWorkspace: active?.isOwn ?? null,
  });
  const mode = setupModeFor({
    joiningTeam: readJoiningTeamFlag(metadata),
    role: active?.role ?? null,
    isOwnWorkspace: active?.isOwn ?? null,
  });

  const activeStudents = useMemo(
    () => (students.data ?? []).filter((s) => s.status !== "archived").length,
    [students.data],
  );
  const batchCount = batches.data?.length ?? 0;

  const looksIncomplete = staff
    ? looksLikeIncompleteIdentity({
        fullName: onboarding.state.draft.ownerName.trim() || identity.fullName,
        phone: onboarding.state.draft.contactPhone.trim() || identity.phone,
      })
    : looksLikeNewCentre({
        instituteName: institute.data?.name,
        contactPhone: institute.data?.contact_phone,
        batchCount,
        activeStudentCount: activeStudents,
      });

  const incomplete = setupIsIncomplete({
    completed: onboarding.state.completed,
    looksIncomplete,
    started: onboarding.state.started,
  });

  const autoWizard =
    !workspacesLoading &&
    !!active &&
    !institute.isLoading &&
    shouldAutoOpenWizard({
      setupComplete: onboarding.state.completed,
      resumeRequested,
      looksIncomplete,
      dismissedUntilInteraction: userDismissed,
    });

  const autoTour =
    !wizardOpen &&
    shouldAutoOpenTour({
      isInvitedStaff: staff,
      persisted: onboarding.state,
    });

  const captureClicks = shouldCaptureClicksToResume({
    setupIncomplete: incomplete && !!active && !workspacesLoading,
    modalOpen: wizardOpen,
  });

  useEffect(() => {
    if (!user) return;
    const merged = mergeDraftWithInstitute(
      onboarding.state.draft,
      staff ? null : (institute.data ?? null),
      identity,
    );
    if (
      merged.ownerName !== onboarding.state.draft.ownerName ||
      merged.name !== onboarding.state.draft.name ||
      merged.contactPhone !== onboarding.state.draft.contactPhone ||
      merged.address !== onboarding.state.draft.address ||
      merged.upiVpa !== onboarding.state.draft.upiVpa
    ) {
      onboarding.setDraft(merged);
    }
    // Hydrate once from institute / auth metadata; draft is the source of truth after.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, staff, institute.data?.id]);

  useEffect(() => {
    if (autoWizard) {
      setWizardOpen(true);
      if (!onboarding.state.started) onboarding.markStarted();
    }
    // markStarted is stable per user; only run when auto-open flips on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoWizard]);

  useEffect(() => {
    if (autoTour) setTourOpen(true);
  }, [autoTour]);

  useEffect(() => {
    const root = document.getElementById("app-shell");
    if (!root) return;
    if (captureClicks || wizardOpen) root.setAttribute("inert", "");
    else root.removeAttribute("inert");
    return () => root.removeAttribute("inert");
  }, [captureClicks, wizardOpen]);

  const step = mode === "staff" ? "you" : onboarding.state.currentStep;
  const draft = onboarding.state.draft;

  const changeDraft = (patch: Partial<typeof draft>) => {
    const next = { ...draft, ...patch };
    onboarding.setDraft(next);
    setErrors((prev) => {
      const nextErrors = { ...prev };
      for (const key of Object.keys(patch) as (keyof typeof patch)[]) {
        delete nextErrors[key as keyof WizardFieldErrors];
      }
      return nextErrors;
    });
  };

  const goTo = (next: WizardStepId | "done") => {
    if (next === "done") {
      onboarding.completeSetup();
      setWizardOpen(false);
      setResumeRequested(false);
      setUserDismissed(false);
      if (!staff) {
        setTourIndex(0);
        setTourOpen(true);
      }
      return;
    }
    onboarding.setStep(next);
    setErrors(validateWizardStep(next, onboarding.state.draft, mode));
  };

  const handleContinue = async () => {
    const nextErrors = validateWizardStep(step, draft, mode);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setBusy(true);
    try {
      if (step === "you") {
        const { error } = await supabase.auth.updateUser({
          data: {
            full_name: draft.ownerName.trim(),
            phone: normalizeIndianMobile(draft.contactPhone),
          },
        });
        if (error) throw error;
        if (mode === "owner") {
          await updateInstitute.mutateAsync({
            name: draft.name.trim(),
            contact_phone: normalizeIndianMobile(draft.contactPhone),
            address: draft.address.trim() || null,
          });
        }
      }
      if (step === "profile") {
        await updateInstitute.mutateAsync({
          upi_vpa: draft.upiVpa.trim() || null,
        });
      }
      if (step === "batch" && draft.batchName.trim()) {
        await upsertBatch.mutateAsync({
          name: draft.batchName.trim(),
          timing: draft.batchTiming.trim() || null,
        });
      }
      if (step === "students" && draft.studentName.trim()) {
        await upsertStudent.mutateAsync({
          full_name: draft.studentName.trim(),
          phone: normalizeIndianMobile(draft.studentPhone),
          joining_date: todayISO(),
        });
      }
      goTo(nextWizardStep(step, mode));
    } catch (e) {
      toast.error(formatUserError(e, "Could not save this step."));
    } finally {
      setBusy(false);
    }
  };

  const handleSkipStep = () => {
    onboarding.skipStep(step);
    goTo(nextWizardStep(step, mode));
  };

  const handleDismiss = (open: boolean) => {
    if (open) {
      setWizardOpen(true);
      return;
    }
    setWizardOpen(false);
    setUserDismissed(true);
    setResumeRequested(false);
  };

  const handleResume = () => {
    setResumeRequested(true);
    setWizardOpen(true);
    if (!onboarding.state.started) onboarding.markStarted();
  };

  return (
    <>
      {captureClicks && <OwnerSetupCaptureOverlay onResume={handleResume} />}

      <OwnerSetupWizardModal open={wizardOpen} onOpenChange={handleDismiss}>
        <OwnerSetupWizardView
          step={step}
          draft={draft}
          errors={errors}
          busy={busy}
          mode={mode}
          onChange={changeDraft}
          onContinue={handleContinue}
          onBack={() => {
            const prev = prevWizardStep(step, mode);
            if (prev) goTo(prev);
          }}
          onSkipStep={handleSkipStep}
          onImportStudents={() => setImportOpen(true)}
        />
      </OwnerSetupWizardModal>

      {tourOpen && (
        <AppGuidedTourOverlay>
          <AppGuidedTourView
            stepIndex={tourIndex}
            onBack={() => setTourIndex((i) => Math.max(0, i - 1))}
            onNext={() => {
              if (tourIndex >= TOUR_STEPS.length - 1) {
                onboarding.completeTour();
                setTourOpen(false);
                return;
              }
              setTourIndex((i) => i + 1);
            }}
            onSkip={() => {
              onboarding.dismissTour();
              setTourOpen(false);
            }}
            onGoToPage={(to) => {
              setTourOpen(false);
              onboarding.completeTour();
              void navigate({ to });
            }}
          />
        </AppGuidedTourOverlay>
      )}

      <ImportStudentsDialog open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
}
