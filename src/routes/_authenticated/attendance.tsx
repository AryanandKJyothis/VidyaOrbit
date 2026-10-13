import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Save,
  CalendarCheck,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { InitialsAvatar } from "@/components/app/initials-avatar";
import { addCalendarDaysISO } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBatches, useStudents } from "@/hooks/use-data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveWorkspace, useCan } from "@/hooks/use-active-workspace";
import { RoutePermissionGate } from "@/components/route-permission-gate";
import {
  buildAttendanceSaveRows,
  isMissingAttendanceRpc,
  planAttendanceSave,
  resolveAttendanceDate,
  summarizeAttendanceMarks,
  type AttendanceStatus,
} from "@/lib/attendance";
import { formatDate, todayISO } from "@/lib/format";
import { toast } from "sonner";
import { formatUserError } from "@/lib/format-error";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { QueryErrorState } from "@/components/query-state";

export const Route = createFileRoute("/_authenticated/attendance")({
  component: () => (
    <RoutePermissionGate resource="attendance" level="read">
      <AttendancePage />
    </RoutePermissionGate>
  ),
});

type Status = AttendanceStatus;

const ATT_BATCH_KEY = "vidya:attendance:last-batch";
const ATT_DATE_KEY = "vidya:attendance:last-date";

function AttendancePage() {
  const { user } = useAuth();
  const { active } = useActiveWorkspace();
  const canWriteAttendance = useCan("attendance", "write");
  const ownerId = active?.ownerId ?? null;
  const batches = useBatches();
  const students = useStudents();
  const qc = useQueryClient();

  const [batchId, setBatchId] = useState<string>("");
  const [date, setDate] = useState<string>(todayISO());
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!batches.data?.length) return;
    try {
      const savedBatch = localStorage.getItem(ATT_BATCH_KEY);
      if (savedBatch && batches.data.some((b) => b.id === savedBatch)) {
        setBatchId(savedBatch);
        return;
      }
    } catch {
      /* ignore */
    }
    const first = batches.data.find((b) => b.is_active) ?? batches.data[0];
    setBatchId(first.id);
  }, [batches.data]);

  useEffect(() => {
    if (!batchId) return;
    try {
      localStorage.setItem(ATT_BATCH_KEY, batchId);
    } catch {
      /* ignore */
    }
  }, [batchId]);

  useEffect(() => {
    try {
      const savedDate = localStorage.getItem(ATT_DATE_KEY);
      setDate(resolveAttendanceDate(savedDate, todayISO()));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(ATT_DATE_KEY, date);
    } catch {
      /* ignore */
    }
  }, [date]);

  const session = useQuery({
    queryKey: ["att-session", batchId, date],
    enabled: !!batchId && !!ownerId,
    queryFn: async () => {
      const { data: sess, error: sessionError } = await supabase
        .from("attendance_sessions")
        .select("id")
        .eq("batch_id", batchId)
        .eq("owner_id", ownerId!)
        .eq("session_date", date)
        .maybeSingle();
      if (sessionError) throw sessionError;
      if (!sess)
        return {
          sessionId: null as string | null,
          records: {} as Record<string, Status>,
        };
      const { data: recs, error: recordsError } = await supabase
        .from("attendance_records")
        .select("student_id, status")
        .eq("session_id", sess.id)
        .eq("owner_id", ownerId!);
      if (recordsError) throw recordsError;
      const map: Record<string, Status> = {};
      for (const r of recs ?? []) map[r.student_id] = r.status as Status;
      return { sessionId: sess.id, records: map };
    },
  });

  useEffect(() => {
    if (session.data) setMarks(session.data.records);
  }, [session.data]);

  const roster = useMemo(
    () =>
      (students.data ?? []).filter(
        (s) => s.batch_id === batchId && s.status !== "archived",
      ),
    [students.data, batchId],
  );

  const setAll = (status: Status) => {
    const next: Record<string, Status> = {};
    for (const s of roster) next[s.id] = status;
    setMarks(next);
  };

  const save = async () => {
    if (!canWriteAttendance) return;
    if (!batchId || !user || !ownerId) return;
    const plannedRows = buildAttendanceSaveRows(roster, marks, {
      ownerId,
      sessionId: session.data?.sessionId ?? "pending",
    });
    if (plannedRows.length === 0) {
      toast.error("Mark at least one student before saving.");
      return;
    }
    setSaving(true);
    try {
      let sessionId = session.data?.sessionId;
      if (!sessionId) {
        const { data, error } = await supabase
          .from("attendance_sessions")
          .insert({ owner_id: ownerId, batch_id: batchId, session_date: date })
          .select("id")
          .single();
        if (error) throw error;
        sessionId = data.id;
      }
      const existingStudentIds = Object.keys(session.data?.records ?? {});
      const plan = planAttendanceSave(
        roster,
        marks,
        { ownerId, sessionId },
        existingStudentIds,
      );
      const rpc = await supabase.rpc(
        "save_attendance_session" as never,
        {
          p_owner_id: ownerId,
          p_session_id: sessionId,
          p_rows: plan.upsertRows,
        } as never,
      );
      if (rpc.error && !isMissingAttendanceRpc(rpc.error)) throw rpc.error;
      if (rpc.error) {
        const { error: upsertError } = await supabase
          .from("attendance_records")
          .upsert(plan.upsertRows, { onConflict: "session_id,student_id" });
        if (upsertError) throw upsertError;
        if (plan.deleteStudentIds.length > 0) {
          const { error: scopedDeleteError } = await supabase
            .from("attendance_records")
            .delete()
            .eq("session_id", sessionId)
            .eq("owner_id", ownerId)
            .in("student_id", plan.deleteStudentIds);
          if (scopedDeleteError) throw scopedDeleteError;
        }
      }
      const rows = plan.upsertRows;
      const unmarked = roster.length - rows.length;
      toast.success(
        unmarked > 0
          ? `Attendance saved. ${unmarked} unmarked student${unmarked === 1 ? " was" : "s were"} not recorded.`
          : "Attendance saved",
      );
      qc.invalidateQueries({ queryKey: ["att-session"] });
      qc.invalidateQueries({ queryKey: ["att-summary"] });
      qc.invalidateQueries({ queryKey: ["att-all"] });
    } catch (e) {
      toast.error(formatUserError(e, "Could not save attendance."));
    } finally {
      setSaving(false);
    }
  };

  const summary = useMemo(
    () => summarizeAttendanceMarks(roster, marks),
    [marks, roster],
  );

  const noBatches = !batches.isLoading && (batches.data ?? []).length === 0;

  if (batches.isLoading || students.isLoading) {
    return (
      <div className="pb-8">
        <PageHeader
          title="Attendance"
          description="Mark daily attendance by batch"
        />
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (batches.isError || students.isError) {
    return (
      <div className="pb-24 md:pb-6">
        <PageHeader
          title="Attendance"
          description="Mark daily attendance — optimised for phones and tablets."
        />
        <QueryErrorState
          error={(batches.error ?? students.error) as Error}
          title="Failed to load attendance data"
          onRetry={() => {
            void qc.invalidateQueries({ queryKey: ["batches"] });
            void qc.invalidateQueries({ queryKey: ["students"] });
          }}
        />
      </div>
    );
  }

  const selectedBatch = (batches.data ?? []).find((b) => b.id === batchId);

  return (
    <div className="pb-28 md:pb-6">
      <PageHeader
        title={selectedBatch?.name ?? "Attendance"}
        description={
          selectedBatch
            ? `${roster.length} student${roster.length === 1 ? "" : "s"} · ${formatDate(date)}`
            : "Mark daily attendance by batch."
        }
      />

      {noBatches ? (
        <EmptyState
          icon={CalendarCheck}
          title="Create a batch first"
          description="Attendance is tracked per batch. Add a batch, assign students to it, then come back here."
        >
          <Button asChild>
            <Link to="/batches">Go to batches</Link>
          </Button>
        </EmptyState>
      ) : (
        <>
          <Card className="mb-4">
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="space-y-1.5 min-w-0">
                <Label>Batch</Label>
                <Select value={batchId} onValueChange={setBatchId}>
                  <SelectTrigger className="h-11 w-full touch-manipulation">
                    <SelectValue placeholder="Select batch" />
                  </SelectTrigger>
                  <SelectContent>
                    {(batches.data ?? []).map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-xl bg-muted/50 px-2 py-1.5">
                <button
                  type="button"
                  aria-label="Previous day"
                  className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-card active:scale-[0.97] motion-reduce:active:scale-100"
                  onClick={() => setDate(addCalendarDaysISO(date, -1))}
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0 text-center">
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="h-11 touch-manipulation border-0 bg-transparent text-center shadow-none"
                  />
                  {date === todayISO() && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      Today
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Next day"
                  className="flex h-11 w-11 items-center justify-center rounded-xl hover:bg-card active:scale-[0.97] motion-reduce:active:scale-100"
                  onClick={() => setDate(addCalendarDaysISO(date, 1))}
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
              {canWriteAttendance && (
                <Button
                  onClick={save}
                  disabled={!batchId || saving || roster.length === 0}
                  className="hidden md:inline-flex min-h-11 shrink-0"
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save attendance
                </Button>
              )}
            </CardContent>
          </Card>

          {batchId && (
            <Card className="overflow-hidden">
              <CardContent className="p-4 md:p-5">
                <div className="mb-4 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-2xl bg-success/12 px-3 py-3 text-center">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-success">
                        Present
                      </p>
                      <p className="mt-0.5 font-display text-2xl font-bold tabular-nums text-success">
                        {summary.present}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-destructive/12 px-3 py-3 text-center">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-destructive">
                        Absent
                      </p>
                      <p className="mt-0.5 font-display text-2xl font-bold tabular-nums text-destructive">
                        {summary.absent}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-muted px-3 py-3 text-center">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Unmarked
                      </p>
                      <p className="mt-0.5 font-display text-2xl font-bold tabular-nums">
                        {summary.unmarked}
                      </p>
                    </div>
                  </div>
                  {summary.late > 0 && (
                    <Badge variant="outline">Late {summary.late}</Badge>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Roll call · {roster.length} shown
                    </p>
                    {canWriteAttendance && (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="min-h-11 touch-manipulation"
                          onClick={() => setAll("present")}
                        >
                          All present
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="min-h-11 touch-manipulation"
                          onClick={() => setAll("absent")}
                        >
                          All absent
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {roster.length === 0 ? (
                  <EmptyState
                    title="No students in this batch"
                    description="Assign active students to this batch from the Students page, then return to mark attendance."
                  >
                    <Button asChild variant="secondary">
                      <Link to="/students">Manage students</Link>
                    </Button>
                  </EmptyState>
                ) : (
                  <ul className="space-y-2">
                    {roster.map((s, index) => {
                      const v = marks[s.id];
                      return (
                        <li
                          key={s.id}
                          className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card px-3 py-3"
                        >
                          <div className="min-w-[2.25rem] text-center">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                          </div>
                          <InitialsAvatar name={s.full_name} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold leading-tight">
                              {s.full_name}
                            </div>
                            {s.phone && (
                              <div className="truncate text-xs text-muted-foreground">
                                {s.phone}
                              </div>
                            )}
                          </div>
                          {canWriteAttendance && (
                            <div className="flex shrink-0 gap-1.5">
                              <ToggleBtn
                                active={v === "present"}
                                tone="success"
                                label="Present"
                                onClick={() =>
                                  setMarks({ ...marks, [s.id]: "present" })
                                }
                              >
                                P
                              </ToggleBtn>
                              <ToggleBtn
                                active={v === "late"}
                                tone="warning"
                                label="Late"
                                onClick={() =>
                                  setMarks({ ...marks, [s.id]: "late" })
                                }
                              >
                                L
                              </ToggleBtn>
                              <ToggleBtn
                                active={v === "absent"}
                                tone="destructive"
                                label="Absent"
                                onClick={() =>
                                  setMarks({ ...marks, [s.id]: "absent" })
                                }
                              >
                                A
                              </ToggleBtn>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          {/* Mobile-first sticky actions */}
          {canWriteAttendance && !noBatches && batchId && roster.length > 0 && (
            <div className="pointer-events-none fixed inset-x-0 bottom-[calc(3.85rem+env(safe-area-inset-bottom))] z-30 md:hidden">
              <div className="pointer-events-auto mx-auto max-w-lg px-3 pb-2">
                <Button
                  className="h-12 w-full touch-manipulation text-sm font-semibold shadow-[var(--shadow-elevated)]"
                  onClick={save}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-5 w-5" />
                  )}
                  Save attendance ({summary.present} present, {summary.absent}{" "}
                  absent
                  {summary.unmarked > 0 ? `, ${summary.unmarked} unmarked` : ""}
                  )
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ToggleBtn({
  children,
  active,
  tone,
  label,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  tone: "success" | "warning" | "destructive";
  label?: string;
  onClick: () => void;
}) {
  const tones = {
    success: "border-success text-success bg-success/10",
    warning: "border-warning text-warning bg-warning/10",
    destructive: "border-destructive text-destructive bg-destructive/10",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-xl border text-sm font-bold transition-[transform,background-color,border-color,color,box-shadow] duration-150 [transition-timing-function:var(--ease-out)] touch-manipulation active:scale-[0.98] motion-reduce:active:scale-100",
        active
          ? `${tones[tone]} shadow-sm ring-2 ring-offset-2 ring-offset-background ring-current/25`
          : "border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
