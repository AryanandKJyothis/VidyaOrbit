import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import {
  useBatches,
  useInstitute,
  usePayments,
  useStudents,
  useUpdateInstitute,
  useUpsertBatch,
  useUpsertStudent,
} from "@/hooks/use-data";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useOwnerOnboarding } from "@/hooks/use-owner-onboarding";
import { supabase } from "@/integrations/supabase/client";
import { formatUserError } from "@/lib/format-error";
import { todayISO } from "@/lib/format";
import {
  deriveGettingStarted,
  firstIncompleteStep,
  looksLikeNewCentre,
  mergeDraftWithInstitute,
  nextWizardStep,
  normalizeIndianMobile,
  prevWizardStep,
  readJoiningTeamFlag,
  shouldAutoOpenTour,
  shouldAutoOpenWizard,
  shouldSkipOwnerOnboarding,
  validateWizardStep,
  type WizardFieldErrors,
  type WizardStepId,
  TOUR_STEPS,
} from "@/lib/owner-onboarding";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import {
  OwnerSetupOverlay,
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
  const payments = usePayments();
  const updateInstitute = useUpdateInstitute();
  const upsertBatch = useUpsertBatch();
  const upsertStudent = useUpsertStudent();
  const { dismissedChecklist, dismissChecklist } = useOnboarding();
  const onboarding = useOwnerOnboarding(user?.id ?? null);
  const navigate = useNavigate();

  const [resumeRequested, setResumeRequested] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<WizardFieldErrors>({});

  const skipOwner = shouldSkipOwnerOnboarding({
    joiningTeam: readJoiningTeamFlag(
      user?.user_metadata as Record<string, unknown> | undefined,
    ),
    role: active?.role ?? null,
    isOwnWorkspace: active?.isOwn ?? null,
  });

  const activeStudents = useMemo(
    () => (students.data ?? []).filter((s) => s.status !== "archived").length,
    [students.data],
  );
  const batchCount = batches.data?.length ?? 0;

  const attendanceStarted = useQuery({
    queryKey: ["onboarding-attendance", active?.ownerId],
    enabled: !!user && !!active?.ownerId && !skipOwner,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("attendance_sessions")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", active!.ownerId);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });

  const checklist = deriveGettingStarted({
    batchCount,
    activeStudentCount: activeStudents,
    paymentCount: payments.data?.length ?? 0,
    attendanceStarted: attendanceStarted.data === true,
  });

  const newCentre = looksLikeNewCentre({
    instituteName: institute.data?.name,
    contactPhone: institute.data?.contact_phone,
    batchCount,
    activeStudentCount: activeStudents,
  });

  const autoWizard =
    !workspacesLoading &&
    !!active &&
    !institute.isLoading &&
    shouldAutoOpenWizard({
      skipOwnerOnboarding: skipOwner,
      persisted: onboarding.state,
      resumeRequested,
      looksLikeNewCentre: newCentre,
    });

  const autoTour =
    !wizardOpen &&
    shouldAutoOpenTour({
      skipOwnerOnboarding: skipOwner,
      persisted: onboarding.state,
    });

  useEffect(() => {
    if (skipOwner || !institute.data) return;
    const merged = mergeDraftWithInstitute(
      onboarding.state.draft,
      institute.data,
    );
    if (
      merged.name !== onboarding.state.draft.name ||
      merged.contactPhone !== onboarding.state.draft.contactPhone ||
      merged.address !== onboarding.state.draft.address ||
      merged.upiVpa !== onboarding.state.draft.upiVpa
    ) {
      onboarding.setDraft(merged);
    }
    // Hydrate once from institute columns; draft is the source of truth after.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipOwner, institute.data?.id]);

  useEffect(() => {
    if (autoWizard) setWizardOpen(true);
  }, [autoWizard]);

  useEffect(() => {
    if (autoTour) setTourOpen(true);
  }, [autoTour]);

  useEffect(() => {
    if (!wizardOpen) return;
    const next = firstIncompleteStep({
      draft: onboarding.state.draft,
      batchCount,
      activeStudentCount: activeStudents,
      skippedSteps: onboarding.state.skippedSteps,
    });
    if (next !== "done" && next !== onboarding.state.currentStep) {
      onboarding.setStep(next);
    }
    // Only snap to the first incomplete step when the overlay opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardOpen]);

  const step = onboarding.state.currentStep;
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
      setTourIndex(0);
      setTourOpen(true);
      return;
    }
    onboarding.setStep(next);
    setErrors(validateWizardStep(next, onboarding.state.draft));
  };

  const handleContinue = async () => {
    const nextErrors = validateWizardStep(step, draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setBusy(true);
    try {
      if (step === "centre") {
        await updateInstitute.mutateAsync({
          name: draft.name.trim(),
          contact_phone: normalizeIndianMobile(draft.contactPhone),
          address: draft.address.trim() || null,
        });
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
      goTo(nextWizardStep(step));
    } catch (e) {
      toast.error(formatUserError(e, "Could not save this step."));
    } finally {
      setBusy(false);
    }
  };

  const handleSkipStep = () => {
    onboarding.skipStep(step);
    goTo(nextWizardStep(step));
  };

  const handleSkipSetup = () => {
    onboarding.skipSetup();
    setWizardOpen(false);
    setResumeRequested(false);
    setTourIndex(0);
    setTourOpen(true);
  };

  const handleResume = () => {
    onboarding.resumeSetup();
    setResumeRequested(true);
    setWizardOpen(true);
  };

  if (skipOwner) return null;

  const showChecklist =
    !dismissedChecklist && !checklist.allDone && !wizardOpen && !!active;

  return (
    <>
      {showChecklist && (
        <OnboardingChecklist
          items={checklist.items}
          doneCount={checklist.doneCount}
          allDone={checklist.allDone}
          onDismiss={dismissChecklist}
          showResumeSetup={
            onboarding.state.skipped && !onboarding.state.completed
          }
          onResumeSetup={handleResume}
        />
      )}

      {wizardOpen && (
        <OwnerSetupOverlay>
          <OwnerSetupWizardView
            step={step}
            draft={draft}
            errors={errors}
            busy={busy}
            onChange={changeDraft}
            onContinue={handleContinue}
            onBack={() => {
              const prev = prevWizardStep(step);
              if (prev) goTo(prev);
            }}
            onSkipStep={handleSkipStep}
            onSkipSetup={handleSkipSetup}
            onImportStudents={() => setImportOpen(true)}
          />
        </OwnerSetupOverlay>
      )}

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
