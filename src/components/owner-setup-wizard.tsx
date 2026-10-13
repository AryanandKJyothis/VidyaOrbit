import type { ReactNode } from "react";
import { usePrefers } from "@/hooks/use-prefers";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  CENTRE_TYPES,
  stepsFor,
  wizardStepIndex,
  wizardStepMeta,
  type OwnerSetupDraft,
  type SetupMode,
  type WizardFieldErrors,
  type WizardStepId,
} from "@/lib/owner-onboarding";
import { fadeOnly, springDefault } from "@/lib/motion";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2, Upload } from "lucide-react";

export function OwnerSetupWizardView({
  step,
  draft,
  errors,
  busy = false,
  mode = "owner",
  onChange,
  onContinue,
  onBack,
  onSkipStep,
  onImportStudents,
  className,
}: {
  step: WizardStepId;
  draft: OwnerSetupDraft;
  errors: WizardFieldErrors;
  busy?: boolean;
  mode?: SetupMode;
  onChange: (patch: Partial<OwnerSetupDraft>) => void;
  onContinue: () => void;
  onBack: () => void;
  onSkipStep?: () => void;
  onImportStudents?: () => void;
  className?: string;
}) {
  const { reducedMotion } = usePrefers();
  const transition = reducedMotion ? fadeOnly : springDefault;
  const list = stepsFor(mode);
  const index = wizardStepIndex(step, mode);
  const meta = wizardStepMeta(step, mode);
  const total = list.length;
  const progress = ((index + 1) / total) * 100;
  const canGoBack = index > 0;
  const last = index === total - 1;
  const skippable =
    mode === "owner" && (step === "batch" || step === "students");

  return (
    <div className={cn("flex flex-col bg-card", className)}>
      <div className="flex w-full flex-col px-5 pb-5 pt-5 sm:px-6">
        <div className="mb-4 flex items-center gap-2.5 pr-10">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft ring-1 ring-primary/15">
            <Logo size={26} />
          </div>
          <div>
            <p className="type-kicker text-muted-foreground">Set up</p>
            <p className="font-display text-base font-semibold leading-tight">
              {mode === "staff" ? "Your profile" : "Your centre"}
            </p>
          </div>
        </div>

        <div className="mb-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Step {index + 1} of {total}
            </span>
            <span className="font-semibold text-foreground">{meta.title}</span>
          </div>
          <Progress
            value={progress}
            aria-label={`Setup step ${index + 1} of ${total}`}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${mode}-${step}`}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            transition={transition}
            className="flex flex-1 flex-col"
          >
            <h2
              id="owner-setup-title"
              className="font-display text-xl font-bold leading-[1.15] tracking-[-0.022em] text-balance sm:text-2xl"
            >
              {meta.title}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">
              {meta.blurb}
            </p>

            <div className="mt-5 flex-1 space-y-4">
              {step === "you" && (
                <YouFields
                  draft={draft}
                  errors={errors}
                  busy={busy}
                  mode={mode}
                  onChange={onChange}
                />
              )}
              {step === "profile" && mode === "owner" && (
                <ProfileFields
                  draft={draft}
                  errors={errors}
                  busy={busy}
                  onChange={onChange}
                />
              )}
              {step === "batch" && mode === "owner" && (
                <BatchFields
                  draft={draft}
                  errors={errors}
                  busy={busy}
                  onChange={onChange}
                />
              )}
              {step === "students" && mode === "owner" && (
                <StudentFields
                  draft={draft}
                  errors={errors}
                  busy={busy}
                  onChange={onChange}
                  onImportStudents={onImportStudents}
                />
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 space-y-3">
          {errors.centreType && step === "profile" && (
            <p className="text-xs text-destructive" role="alert">
              {errors.centreType}
            </p>
          )}
          <div className="flex gap-2">
            {canGoBack && (
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                onClick={onBack}
                disabled={busy}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            )}
            <Button
              type="button"
              className="min-w-0 flex-1"
              onClick={onContinue}
              disabled={busy}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : last ? (
                "Finish setup"
              ) : (
                <>
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
          {skippable && onSkipStep && (
            <Button
              type="button"
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={onSkipStep}
              disabled={busy}
            >
              Skip this step
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-destructive" role="alert">
      {message}
    </p>
  );
}

function YouFields({
  draft,
  errors,
  busy,
  mode,
  onChange,
}: {
  draft: OwnerSetupDraft;
  errors: WizardFieldErrors;
  busy: boolean;
  mode: SetupMode;
  onChange: (patch: Partial<OwnerSetupDraft>) => void;
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="setup-owner-name">
          Your name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="setup-owner-name"
          value={draft.ownerName}
          onChange={(e) => onChange({ ownerName: e.target.value })}
          placeholder="Anjali Krishnan"
          autoComplete="name"
          disabled={busy}
          aria-invalid={!!errors.ownerName}
          aria-describedby={
            errors.ownerName ? "setup-owner-name-error" : undefined
          }
        />
        <FieldError id="setup-owner-name-error" message={errors.ownerName} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="setup-phone">
          Phone <span className="text-destructive">*</span>
        </Label>
        <Input
          id="setup-phone"
          type="tel"
          inputMode="tel"
          value={draft.contactPhone}
          onChange={(e) => onChange({ contactPhone: e.target.value })}
          placeholder="98765 43210"
          autoComplete="tel"
          disabled={busy}
          aria-invalid={!!errors.contactPhone}
          aria-describedby={
            errors.contactPhone ? "setup-phone-error" : "setup-phone-help"
          }
        />
        <FieldError id="setup-phone-error" message={errors.contactPhone} />
        {!errors.contactPhone && (
          <p id="setup-phone-help" className="text-xs text-muted-foreground">
            10-digit Indian mobile
            {mode === "owner" ? ". Shown on receipts." : "."}
          </p>
        )}
      </div>
      {mode === "owner" && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="setup-name">
              Centre name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="setup-name"
              value={draft.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="Samriddhi Centre"
              autoComplete="organization"
              disabled={busy}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "setup-name-error" : undefined}
            />
            <FieldError id="setup-name-error" message={errors.name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="setup-address">Area / address</Label>
            <Textarea
              id="setup-address"
              rows={2}
              value={draft.address}
              onChange={(e) => onChange({ address: e.target.value })}
              placeholder="Near Civil Station, Kottayam"
              disabled={busy}
              aria-invalid={!!errors.address}
            />
            <FieldError id="setup-address-error" message={errors.address} />
          </div>
        </>
      )}
    </>
  );
}

function ProfileFields({
  draft,
  errors,
  busy,
  onChange,
}: {
  draft: OwnerSetupDraft;
  errors: WizardFieldErrors;
  busy: boolean;
  onChange: (patch: Partial<OwnerSetupDraft>) => void;
}) {
  return (
    <>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          Type of centre <span className="text-destructive">*</span>
        </legend>
        <div
          className="grid grid-cols-1 gap-2"
          role="radiogroup"
          aria-label="Type of centre"
        >
          {CENTRE_TYPES.map((t) => {
            const selected = draft.centreType === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={busy}
                onClick={() => onChange({ centreType: t.id })}
                className={cn(
                  "min-h-11 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-[transform,background-color,border-color] duration-150 [transition-timing-function:var(--ease-out)] active:scale-[0.97] motion-reduce:active:scale-100",
                  selected
                    ? "border-primary bg-primary-soft text-foreground ring-1 ring-primary/20"
                    : "border-border bg-card text-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:border-primary/30",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor="setup-upi">UPI ID (optional)</Label>
        <Input
          id="setup-upi"
          value={draft.upiVpa}
          onChange={(e) => onChange({ upiVpa: e.target.value })}
          placeholder="centre@oksbi"
          autoComplete="off"
          spellCheck={false}
          disabled={busy}
          aria-invalid={!!errors.upiVpa}
          aria-describedby={
            errors.upiVpa ? "setup-upi-error" : "setup-upi-help"
          }
        />
        <FieldError id="setup-upi-error" message={errors.upiVpa} />
        {!errors.upiVpa && (
          <p id="setup-upi-help" className="text-xs text-muted-foreground">
            For fee receipts. Parents pay this ID directly — we never take the
            money.
          </p>
        )}
      </div>
    </>
  );
}

function BatchFields({
  draft,
  errors,
  busy,
  onChange,
}: {
  draft: OwnerSetupDraft;
  errors: WizardFieldErrors;
  busy: boolean;
  onChange: (patch: Partial<OwnerSetupDraft>) => void;
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="setup-batch-name">Batch name</Label>
        <Input
          id="setup-batch-name"
          value={draft.batchName}
          onChange={(e) => onChange({ batchName: e.target.value })}
          placeholder="Class 10 Mathematics"
          disabled={busy}
          aria-invalid={!!errors.batchName}
        />
        <FieldError id="setup-batch-error" message={errors.batchName} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="setup-batch-timing">Timing</Label>
        <Input
          id="setup-batch-timing"
          value={draft.batchTiming}
          onChange={(e) => onChange({ batchTiming: e.target.value })}
          placeholder="4:00 PM – 5:30 PM"
          disabled={busy}
          aria-invalid={!!errors.batchTiming}
        />
        <FieldError id="setup-timing-error" message={errors.batchTiming} />
      </div>
    </>
  );
}

function StudentFields({
  draft,
  errors,
  busy,
  onChange,
  onImportStudents,
}: {
  draft: OwnerSetupDraft;
  errors: WizardFieldErrors;
  busy: boolean;
  onChange: (patch: Partial<OwnerSetupDraft>) => void;
  onImportStudents?: () => void;
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="setup-student-name">Student name</Label>
        <Input
          id="setup-student-name"
          value={draft.studentName}
          onChange={(e) => onChange({ studentName: e.target.value })}
          placeholder="Anjali Krishnan"
          disabled={busy}
          aria-invalid={!!errors.studentName}
        />
        <FieldError
          id="setup-student-name-error"
          message={errors.studentName}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="setup-student-phone">Mobile</Label>
        <Input
          id="setup-student-phone"
          type="tel"
          inputMode="tel"
          value={draft.studentPhone}
          onChange={(e) => onChange({ studentPhone: e.target.value })}
          placeholder="98765 43210"
          disabled={busy}
          aria-invalid={!!errors.studentPhone}
        />
        <FieldError
          id="setup-student-phone-error"
          message={errors.studentPhone}
        />
      </div>
      {onImportStudents && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onImportStudents}
          disabled={busy}
        >
          <Upload className="h-4 w-4" />
          Import spreadsheet
        </Button>
      )}
    </>
  );
}

export function OwnerSetupWizardModal({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[min(88dvh,720px)] overflow-y-auto p-0 sm:max-w-[28rem]"
        aria-labelledby="owner-setup-title"
      >
        <DialogTitle className="sr-only">Centre setup</DialogTitle>
        <DialogDescription className="sr-only">
          Finish setup, or tap the blurred backdrop to look around and continue
          later.
        </DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function OwnerSetupCaptureOverlay({
  onResume,
}: {
  onResume: () => void;
}) {
  return (
    <button
      type="button"
      className="fixed inset-0 z-[45] cursor-default bg-transparent"
      aria-label="Continue setup"
      onClick={onResume}
    />
  );
}
