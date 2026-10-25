import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { useBatches, usePayments, useStudents } from "@/hooks/use-data";
import { useOnboarding } from "@/hooks/use-onboarding";
import { supabase } from "@/integrations/supabase/client";
import {
  isInvitedStaff,
  readJoiningTeamFlag,
  type GettingStartedItem,
} from "@/lib/owner-onboarding";

type Props = {
  items: GettingStartedItem[];
  doneCount: number;
  allDone: boolean;
  onDismiss?: () => void;
  onResumeSetup?: () => void;
  showResumeSetup?: boolean;
};

export function OnboardingChecklist({
  items,
  doneCount,
  allDone,
  onDismiss,
  onResumeSetup,
  showResumeSetup = false,
}: Props) {
  const [open, setOpen] = useState(true);

  if (allDone) return null;
  if (items.length === 0) return null;

  return (
    <Card className="mb-6 border-border">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <div>
          <CardTitle className="font-display text-base font-semibold tracking-tight">
            Getting started
          </CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {doneCount}/{items.length} complete — import students, make a batch,
            then mark a day or take a fee.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-11 min-h-11 px-2"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="getting-started-list"
        >
          {open ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          <span className="sr-only">
            {open ? "Collapse checklist" : "Expand checklist"}
          </span>
        </Button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 pt-0" id="getting-started-list">
          {showResumeSetup && onResumeSetup && (
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={onResumeSetup}
            >
              Resume centre setup
            </Button>
          )}
          <ul className="space-y-2">
            {items.map((step, idx) => (
              <li
                key={step.id}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border border-border/80 bg-card p-3 sm:flex-row sm:items-center sm:justify-between",
                  step.done && "opacity-70 bg-muted/30",
                )}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                      step.done
                        ? "border-success bg-success/15 text-success"
                        : "border-muted-foreground/30 text-muted-foreground",
                    )}
                  >
                    {step.done ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium leading-snug">
                      {step.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {step.hint}
                    </div>
                  </div>
                </div>
                {!step.done && (
                  <Button
                    asChild
                    size="sm"
                    variant={step.primary ? "default" : "secondary"}
                    className="shrink-0 self-start sm:self-center"
                  >
                    <Link to={step.to}>{step.label}</Link>
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {onDismiss && (
            <div className="flex justify-end pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-11 min-h-11 text-muted-foreground"
                onClick={onDismiss}
              >
                Dismiss checklist
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

/** Dashboard Getting started card. First-win for new owners — not behind the wizard. */
export function OwnerGettingStartedCard() {
  const { user } = useAuth();
  const { active } = useActiveWorkspace();
  const batches = useBatches();
  const students = useStudents();
  const payments = usePayments();
  const { dismissedChecklist, dismissChecklist, checklistFromCounts } =
    useOnboarding();
  const metadata = user?.user_metadata as Record<string, unknown> | undefined;
  const staff = isInvitedStaff({
    joiningTeam: readJoiningTeamFlag(metadata),
    role: active?.role ?? null,
    isOwnWorkspace: active?.isOwn ?? null,
  });

  const activeStudents = useMemo(
    () => (students.data ?? []).filter((s) => s.status !== "archived").length,
    [students.data],
  );

  const attendanceStarted = useQuery({
    queryKey: ["onboarding-attendance", active?.ownerId],
    enabled: !!user && !!active?.ownerId && !staff,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("attendance_sessions")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", active!.ownerId);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });

  const checklist = checklistFromCounts({
    batchCount: batches.data?.length ?? 0,
    activeStudentCount: activeStudents,
    paymentCount: payments.data?.length ?? 0,
    attendanceStarted: attendanceStarted.data === true,
  });

  if (staff) return null;
  if (dismissedChecklist) return null;
  if (!active) return null;

  return (
    <OnboardingChecklist
      items={checklist.items}
      doneCount={checklist.doneCount}
      allDone={checklist.allDone}
      onDismiss={dismissChecklist}
    />
  );
}
