import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, MessageCircle, UserX } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/empty-state";
import {
  QueryErrorState,
  QueryLoadingSkeleton,
} from "@/components/query-state";
import { RoutePermissionGate } from "@/components/route-permission-gate";
import { InitialsAvatar } from "@/components/app/initials-avatar";
import { useBatches, useInstitute, useStudents } from "@/hooks/use-data";
import { useActiveWorkspace, useCan } from "@/hooks/use-active-workspace";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { todayISO } from "@/lib/format";
import {
  ABSENTEE_SENT_STORAGE_KEY,
  absenteeSentKey,
  buildAbsenteeMessage,
  canMessageAbsentees,
  groupTodaysAbsentees,
  markAbsenteeSent,
  parseSentAbsenteeKeys,
  serializeSentAbsenteeKeys,
} from "@/lib/absentees";
import { openWhatsApp } from "@/lib/fee-reminder";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/absentees")({
  component: () => (
    <RoutePermissionGate resource="attendance" level="read">
      <AbsenteesPage />
    </RoutePermissionGate>
  ),
});

function AbsenteesPage() {
  const { active } = useActiveWorkspace();
  const canWrite = useCan("attendance", "write");
  const canSend = canMessageAbsentees(canWrite ? "write" : "read");
  const students = useStudents();
  const batches = useBatches();
  const institute = useInstitute();
  const today = todayISO();
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      setSent(
        parseSentAbsenteeKeys(localStorage.getItem(ABSENTEE_SENT_STORAGE_KEY)),
      );
    } catch {
      /* ignore */
    }
  }, []);

  const records = useQuery({
    queryKey: ["att-absentees", active?.ownerId, today],
    enabled: !!active?.ownerId,
    queryFn: async () => {
      return fetchAllRows<{
        student_id: string;
        status: string;
        attendance_sessions: { session_date: string; batch_id: string } | null;
      }>((from, to) =>
        supabase
          .from("attendance_records")
          .select(
            "student_id, status, attendance_sessions!inner(session_date, batch_id)",
          )
          .eq("owner_id", active!.ownerId)
          .eq("status", "absent")
          .eq("attendance_sessions.session_date", today)
          .range(from, to),
      );
    },
  });

  const groups = useMemo(() => {
    return groupTodaysAbsentees({
      today,
      students: students.data ?? [],
      batches: batches.data ?? [],
      records: (records.data ?? []).map((row) => ({
        student_id: row.student_id,
        status: row.status,
        session_date: row.attendance_sessions?.session_date ?? today,
        batch_id: row.attendance_sessions?.batch_id ?? null,
      })),
    });
  }, [records.data, students.data, batches.data, today]);

  const total = groups.reduce((sum, g) => sum + g.students.length, 0);

  const persistSent = (next: Set<string>) => {
    setSent(next);
    try {
      localStorage.setItem(
        ABSENTEE_SENT_STORAGE_KEY,
        serializeSentAbsenteeKeys(next),
      );
    } catch {
      /* ignore */
    }
  };

  const sendOne = (
    studentId: string,
    studentName: string,
    phone: {
      guardianPhone: string | null;
      studentPhone: string | null;
    },
  ) => {
    const extra = drafts[studentId];
    const share = buildAbsenteeMessage({
      studentName,
      centreName: institute.data?.name ?? "the centre",
      guardianPhone: phone.guardianPhone,
      studentPhone: phone.studentPhone,
      extra,
    });
    if (!share.href) {
      toast.error("Add a parent phone for this student first.");
      return;
    }
    if (!openWhatsApp(share.href)) {
      toast.error("Allow pop-ups to open WhatsApp.");
      return;
    }
    persistSent(markAbsenteeSent(sent, studentId, today));
  };

  if (records.isLoading || students.isLoading) {
    return <QueryLoadingSkeleton />;
  }

  if (records.isError) {
    return (
      <QueryErrorState
        error={records.error as Error}
        title="Could not load today's absentees"
        onRetry={() => void records.refetch()}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Today's absentees"
        description="Students marked absent today, grouped by batch. Messages open in your own WhatsApp — we do not send them."
        actions={
          <Button asChild variant="outline">
            <Link to="/attendance">Back to attendance</Link>
          </Button>
        }
      />

      {total === 0 ? (
        <EmptyState
          icon={UserX}
          title="No absentees yet"
          description="When you mark someone absent today, they show up here so you can message the parent."
        >
          <Button asChild>
            <Link to="/attendance">Mark attendance</Link>
          </Button>
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <Card key={group.batchId}>
              <CardContent className="p-4 sm:p-5">
                <h2 className="font-display text-base font-semibold">
                  {group.batchName}
                </h2>
                <p className="mb-3 text-xs text-muted-foreground">
                  {group.students.length} absent
                </p>
                <ul className="divide-y divide-border">
                  {group.students.map((row) => {
                    const already = sent.has(
                      absenteeSentKey(row.studentId, today),
                    );
                    return (
                      <li
                        key={row.studentId}
                        className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <InitialsAvatar name={row.studentName} size="sm" />
                          <div className="min-w-0">
                            <Link
                              to="/students/$id"
                              params={{ id: row.studentId }}
                              className="truncate text-sm font-semibold hover:underline"
                            >
                              {row.studentName}
                            </Link>
                            {already && (
                              <p className="mt-0.5 flex items-center gap-1 text-xs text-success">
                                <Check className="h-3.5 w-3.5" /> Message opened
                              </p>
                            )}
                          </div>
                        </div>
                        {canSend && (
                          <div className="w-full space-y-2 sm:max-w-sm">
                            <Textarea
                              rows={2}
                              value={
                                drafts[row.studentId] ??
                                "Please let us know if they will be back tomorrow."
                              }
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [row.studentId]: e.target.value,
                                }))
                              }
                              className="min-h-16 text-sm"
                            />
                            <Button
                              size="sm"
                              onClick={() =>
                                sendOne(row.studentId, row.studentName, {
                                  guardianPhone: row.guardianPhone,
                                  studentPhone: row.studentPhone,
                                })
                              }
                            >
                              <MessageCircle className="mr-1.5 h-4 w-4" />
                              {already ? "Open again" : "Message parent"}
                            </Button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
