import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, CalendarCheck, Check, X, Clock, Loader2 } from "lucide-react";
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
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { formatDate, todayISO } from "@/lib/format";
import { toast } from "sonner";
import { formatUserError } from "@/lib/format-error";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/attendance")({
  component: AttendancePage,
});

type Status = "present" | "absent" | "late";

const ATT_BATCH_KEY = "vidya:attendance:last-batch";
const ATT_DATE_KEY = "vidya:attendance:last-date";

function AttendancePage() {
  const { user } = useAuth();
  const { active } = useActiveWorkspace();
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
      if (savedDate && /^\d{4}-\d{2}-\d{2}$/.test(savedDate))
        setDate(savedDate);
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
    if (!batchId || !user || !ownerId) return;
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
      const { error: deleteError } = await supabase
        .from("attendance_records")
        .delete()
        .eq("session_id", sessionId)
        .eq("owner_id", ownerId);
      if (deleteError) throw deleteError;
      const rows = roster.map((s) => ({
        owner_id: ownerId,
        session_id: sessionId!,
        student_id: s.id,
        status: marks[s.id] ?? "present",
      }));
      if (rows.length) {
        const { error } = await supabase
          .from("attendance_records")
          .insert(rows);
        if (error) throw error;
      }
      toast.success("Attendance saved");
      qc.invalidateQueries({ queryKey: ["att-session"] });
      qc.invalidateQueries({ queryKey: ["att-summary"] });
      qc.invalidateQueries({ queryKey: ["att-all"] });
    } catch (e) {
      toast.error(formatUserError(e, "Could not save attendance."));
    } finally {
      setSaving(false);
    }
  };

  const summary = useMemo(() => {
    const vals = roster.map((s) => marks[s.id] ?? "present");
    return {
      present: vals.filter((v) => v === "present").length,
      absent: vals.filter((v) => v === "absent").length,
      late: vals.filter((v) => v === "late").length,
    };
  }, [marks, roster]);

  const noBatches = !batches.isLoading && (batches.data ?? []).length === 0;

  if (batches.isLoading || students.isLoading) {
    return (
      <div className="pb-24 md:pb-6">
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

  return (
    <div className="pb-24 md:pb-6">
      <PageHeader
        title="Attendance"
        description="Mark daily attendance — optimised for phones and tablets."
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
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5 min-w-0">
                <Label>Batch</Label>
                <Select value={batchId} onValueChange={setBatchId}>
                  <SelectTrigger className="w-full touch-manipulation">
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
              <div className="space-y-1.5 w-full sm:w-auto sm:min-w-[160px]">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="touch-manipulation min-h-11 md:min-h-10"
                />
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs px-2"
                    onClick={() => setDate(todayISO())}
                  >
                    Today
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs px-2"
                    onClick={() => {
                      const y = new Date();
                      y.setDate(y.getDate() - 1);
                      setDate(y.toISOString().slice(0, 10));
                    }}
                  >
                    Yesterday
                  </Button>
                </div>
              </div>
              <Button
                onClick={save}
                disabled={!batchId || saving || roster.length === 0}
                className="hidden md:inline-flex shrink-0 min-h-11"
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save attendance
              </Button>
            </CardContent>
          </Card>

          {batchId && (
            <Card className="overflow-hidden">
              <CardContent className="p-4 md:p-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <CalendarCheck className="h-4 w-4 text-muted-foreground hidden sm:inline" />
                    <span className="text-muted-foreground">
                      {formatDate(date)}
                    </span>
                    <Badge variant="secondary">Present {summary.present}</Badge>
                    <Badge variant="outline">Late {summary.late}</Badge>
                    <Badge variant="destructive">Absent {summary.absent}</Badge>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="flex-1 sm:flex-none touch-manipulation min-h-11"
                      onClick={() => setAll("present")}
                    >
                      All present
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="flex-1 sm:flex-none touch-manipulation min-h-11"
                      onClick={() => setAll("absent")}
                    >
                      All absent
                    </Button>
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
                  <ul className="divide-y divide-border md:rounded-lg md:border md:border-border md:divide-y-0 md:p-1">
                    {roster.map((s) => {
                      const v = marks[s.id] ?? "present";
                      return (
                        <li
                          key={s.id}
                          className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-3 md:rounded-md md:px-2 md:hover:bg-muted/40"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-base md:text-sm font-semibold md:font-medium leading-tight">
                              {s.full_name}
                            </div>
                            {s.phone && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {s.phone}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2 sm:gap-1.5 shrink-0 justify-between sm:justify-end w-full sm:w-auto">
                            <ToggleBtn
                              active={v === "present"}
                              tone="success"
                              label="Present"
                              onClick={() =>
                                setMarks({ ...marks, [s.id]: "present" })
                              }
                            >
                              <Check className="h-5 w-5 sm:h-4 sm:w-4" />
                            </ToggleBtn>
                            <ToggleBtn
                              active={v === "late"}
                              tone="warning"
                              label="Late"
                              onClick={() =>
                                setMarks({ ...marks, [s.id]: "late" })
                              }
                            >
                              <Clock className="h-5 w-5 sm:h-4 sm:w-4" />
                            </ToggleBtn>
                            <ToggleBtn
                              active={v === "absent"}
                              tone="destructive"
                              label="Absent"
                              onClick={() =>
                                setMarks({ ...marks, [s.id]: "absent" })
                              }
                            >
                              <X className="h-5 w-5 sm:h-4 sm:w-4" />
                            </ToggleBtn>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          {/* Mobile-first sticky actions */}
          {!noBatches && batchId && roster.length > 0 && (
            <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 md:hidden">
              <div className="pointer-events-auto mx-auto max-w-lg border-t border-border bg-background/95 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md shadow-[0_-8px_30px_-12px_rgba(0,0,0,0.25)]">
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground mb-2">
                  <span>P {summary.present}</span>
                  <span>L {summary.late}</span>
                  <span>A {summary.absent}</span>
                </div>
                <Button
                  className="w-full min-h-12 touch-manipulation text-base font-semibold"
                  onClick={save}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-5 w-5" />
                  )}
                  Save attendance
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
        "flex flex-1 sm:flex-none sm:h-9 sm:w-9 min-h-[48px] sm:min-h-0 items-center justify-center rounded-xl sm:rounded-lg border transition-all duration-150 touch-manipulation active:scale-[0.98]",
        active
          ? `${tones[tone]} shadow-sm ring-2 ring-offset-2 ring-offset-background ring-current/25`
          : "border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
