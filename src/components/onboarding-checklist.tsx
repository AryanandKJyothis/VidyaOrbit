import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOnboarding } from "@/hooks/use-onboarding";
import type { Batch, Institute, Payment, Student } from "@/hooks/use-data";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";

type Props = {
  institute: Institute | null | undefined;
  batches: Batch[] | undefined;
  students: Student[] | undefined;
  payments: Payment[] | undefined;
};

export function OnboardingChecklist({
  institute,
  batches,
  students,
  payments,
}: Props) {
  const { user } = useAuth();
  const { active } = useActiveWorkspace();
  const { dismissedChecklist, dismissChecklist } = useOnboarding();
  const [open, setOpen] = useState(true);

  const attendanceStarted = useQuery({
    queryKey: ["onboarding-attendance", active?.ownerId],
    enabled: !!user && !!active?.ownerId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("attendance_sessions")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", active!.ownerId);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });

  const steps = useMemo(() => {
    const named = !!(
      institute &&
      institute.name &&
      institute.name !== "My Institute"
    );
    const hasBatch = !!(batches && batches.length > 0);
    const hasStudent = !!(
      students && students.some((s) => s.status !== "archived")
    );
    const hasPayment = !!(payments && payments.length > 0);
    const markedAttendance = attendanceStarted.data === true;

    return [
      {
        id: "institute",
        done: named,
        title: "Name your institute",
        hint: "Shown on receipts and dashboards.",
        to: "/settings" as const,
        label: "Open settings",
      },
      {
        id: "batch",
        done: hasBatch,
        title: "Create your first batch",
        hint: "Group students by class or timing.",
        to: "/batches" as const,
        label: "Go to batches",
      },
      {
        id: "student",
        done: hasStudent,
        title: "Add students",
        hint: "Manually or import from Excel.",
        to: "/students" as const,
        label: "Add students",
      },
      {
        id: "fee",
        done: hasPayment,
        title: "Record a fee payment",
        hint: "Try recording cash or UPI once.",
        to: "/fees" as const,
        label: "Open fees",
      },
      {
        id: "attendance",
        done: markedAttendance,
        title: "Mark attendance",
        hint: "Pick a batch and save today’s attendance.",
        to: "/attendance" as const,
        label: "Mark attendance",
      },
    ];
  }, [institute, batches, students, payments, attendanceStarted.data]);

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  if (dismissedChecklist) return null;

  if (allDone) {
    return (
      <Card className="mb-6 border-success/30 bg-success/5">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Setup complete
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your institute basics are in place — students, batches,
                attendance and fees are ready to run.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 self-start sm:self-center"
            onClick={dismissChecklist}
          >
            Got it
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6 border-primary/25 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 text-primary shrink-0" />
          <div>
            <CardTitle className="text-base font-semibold">
              Getting started
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {doneCount}/{steps.length} complete — finish these to run your
              institute smoothly.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => setOpen(!open)}
          >
            {open ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2 pt-0">
          <ul className="space-y-2">
            {steps.map((step, idx) => (
              <li
                key={step.id}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border border-border/80 bg-card/80 p-3 sm:flex-row sm:items-center sm:justify-between",
                  step.done && "opacity-70 bg-muted/30",
                )}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
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
                    variant="secondary"
                    className="shrink-0 self-start sm:self-center"
                  >
                    <Link to={step.to}>{step.label}</Link>
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <div className="flex justify-end pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-8"
              onClick={dismissChecklist}
            >
              Dismiss checklist
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
