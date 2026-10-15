import { useMemo, useState } from "react";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, MessageCircle, Printer, RefreshCw, Ban } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoutePermissionGate } from "@/components/route-permission-gate";
import {
  QueryErrorState,
  QueryLoadingSkeleton,
} from "@/components/query-state";
import { ReportCardDocument } from "@/components/public/report-card-document";
import {
  useBatches,
  useInstitute,
  usePayments,
  useStudents,
} from "@/hooks/use-data";
import { useActiveWorkspace, useCan } from "@/hooks/use-active-workspace";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { openWhatsApp } from "@/lib/fee-reminder";
import { formatUserError } from "@/lib/format-error";
import {
  canSendReportCard,
  canViewReportCard,
  listRecentReportMonths,
  reportMonthEnd,
  reportMonthLabel,
  reportMonthStart,
  summarizeMonthlyAttendance,
  summarizeMonthlyFee,
} from "@/lib/report-card";
import {
  buildReportShareMessage,
  publicReportUrl,
  type PublicReport,
} from "@/lib/share-links";
import { toast } from "sonner";

const searchSchema = z.object({
  batch: z.string().optional(),
  student: z.string().optional(),
  month: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/reports")({
  validateSearch: (search) => searchSchema.parse(search),
  component: () => (
    <RoutePermissionGate resource="students" level="read">
      <ReportsPage />
    </RoutePermissionGate>
  ),
});

function ReportsPage() {
  const search = useSearch({ from: "/_authenticated/reports" });
  const months = useMemo(() => listRecentReportMonths(12), []);
  const [month, setMonth] = useState(
    search.month ? reportMonthStart(search.month) : months[0]!.value,
  );
  const [batchId, setBatchId] = useState(search.batch ?? "all");
  const [selectedId, setSelectedId] = useState(search.student ?? "");
  const [remark, setRemark] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);

  const { active } = useActiveWorkspace();
  const canStudents = useCan("students", "read");
  const canAttendanceWrite = useCan("attendance", "write");
  const canAttendanceRead = useCan("attendance", "read");
  const canView = canViewReportCard(
    canStudents ? "read" : "none",
    canAttendanceRead ? "read" : "none",
  );
  const canSend = canSendReportCard(
    canStudents ? "read" : "none",
    canAttendanceWrite ? "write" : "none",
  );

  const students = useStudents();
  const batches = useBatches();
  const payments = usePayments();
  const institute = useInstitute();
  const qc = useQueryClient();

  const attendance = useQuery({
    queryKey: ["att-month", active?.ownerId, month],
    enabled: !!active?.ownerId && canView,
    queryFn: async () => {
      const start = reportMonthStart(month);
      const end = reportMonthEnd(month);
      return fetchAllRows<{
        student_id: string;
        status: string;
        attendance_sessions: { session_date: string } | null;
      }>((from, to) =>
        supabase
          .from("attendance_records")
          .select("student_id, status, attendance_sessions!inner(session_date)")
          .eq("owner_id", active!.ownerId)
          .gte("attendance_sessions.session_date", start)
          .lte("attendance_sessions.session_date", end)
          .range(from, to),
      );
    },
  });

  const shares = useQuery({
    queryKey: ["report-shares", active?.ownerId, month],
    enabled: !!active?.ownerId && canView,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_shares")
        .select("student_id, share_token, revoked_at, teacher_remark")
        .eq("owner_id", active!.ownerId)
        .eq("report_month", reportMonthStart(month));
      if (error) throw error;
      return data ?? [];
    },
  });

  const roster = useMemo(() => {
    return (students.data ?? []).filter((s) => {
      if (s.status === "archived") return false;
      if (batchId !== "all" && s.batch_id !== batchId) return false;
      return true;
    });
  }, [students.data, batchId]);

  const marks = useMemo(
    () =>
      (attendance.data ?? []).map((row) => ({
        student_id: row.student_id,
        status: row.status,
        session_date: row.attendance_sessions?.session_date ?? "",
      })),
    [attendance.data],
  );

  const reports = useMemo(() => {
    const centre = institute.data?.name ?? "Centre";
    return roster.map((student) => {
      const att = summarizeMonthlyAttendance(marks, month, student.id);
      const fee = summarizeMonthlyFee(
        payments.data ?? [],
        month,
        Number(student.fee_total ?? 0),
        student.id,
      );
      const share = shares.data?.find((s) => s.student_id === student.id);
      const batchName =
        batches.data?.find((b) => b.id === student.batch_id)?.name ?? null;
      const card: PublicReport = {
        ok: true,
        centre_name: centre,
        student_name: student.full_name,
        batch_name: batchName,
        month: reportMonthLabel(month),
        report_month: reportMonthStart(month),
        attendance_percent: att.percent,
        days_present: att.daysPresent,
        days_absent: att.daysAbsent,
        fee_status: fee.status,
        fee_paid_amount: fee.paidAmount,
        fee_due_amount: fee.dueAmount,
        teacher_remark: share?.teacher_remark ?? (remark || null),
      };
      return { student, att, fee, share, card };
    });
  }, [
    roster,
    marks,
    payments.data,
    month,
    institute.data?.name,
    batches.data,
    shares.data,
    remark,
  ]);

  const selected =
    reports.find((r) => r.student.id === selectedId) ?? reports[0] ?? null;

  const issue = useMutation({
    mutationFn: async (input: {
      studentId: string;
      remark?: string;
      rotate?: boolean;
    }) => {
      if (input.rotate) {
        const { data, error } = await supabase.rpc("regenerate_report_share", {
          _student_id: input.studentId,
          _report_month: reportMonthStart(month),
        });
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.rpc("issue_report_share", {
        _student_id: input.studentId,
        _report_month: reportMonthStart(month),
        _teacher_remark: input.remark ?? (remark || null),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["report-shares"] });
    },
  });

  const revoke = useMutation({
    mutationFn: async (studentId: string) => {
      const { data, error } = await supabase.rpc("revoke_report_share", {
        _student_id: studentId,
        _report_month: reportMonthStart(month),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["report-shares"] });
      toast.success("Link turned off.");
    },
    onError: (e) => toast.error(formatUserError(e)),
  });

  const tokenFrom = (raw: unknown): string | null => {
    if (!raw || typeof raw !== "object") return null;
    const token = (raw as { token?: unknown }).token;
    return typeof token === "string" ? token : null;
  };

  const sendToParent = async () => {
    if (!selected) return;
    let url: string | null = null;
    try {
      const raw = await issue.mutateAsync({
        studentId: selected.student.id,
        remark,
      });
      const token = tokenFrom(raw);
      if (token) url = publicReportUrl(token, window.location.origin);
    } catch {
      url = null;
    }
    const share = buildReportShareMessage({
      centreName: selected.card.centre_name,
      studentName: selected.student.full_name,
      month: selected.card.month,
      attendancePercent: selected.card.attendance_percent,
      daysPresent: selected.card.days_present,
      daysAbsent: selected.card.days_absent,
      feeStatus: selected.card.fee_status,
      feePaidAmount: selected.card.fee_paid_amount,
      feeDueAmount: selected.card.fee_due_amount,
      reportUrl: url,
      guardianPhone: selected.student.guardian_phone,
      studentPhone: selected.student.phone,
    });
    if (!share.href) {
      toast.error("Add a parent phone for this student first.");
      return;
    }
    if (!openWhatsApp(share.href)) {
      toast.error("Allow pop-ups to open WhatsApp.");
    }
  };

  if (!canView) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-sm text-muted-foreground">
          You can view students, but you also need attendance access to open
          report cards.
        </CardContent>
      </Card>
    );
  }

  if (students.isLoading || attendance.isLoading) {
    return <QueryLoadingSkeleton />;
  }

  if (students.isError || attendance.isError) {
    return (
      <QueryErrorState
        error={(students.error ?? attendance.error) as Error}
        title="Could not load report cards"
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Report cards"
        description="Pick a month. Print one student or a whole batch. Send a short WhatsApp note to the parent from your own phone."
      />

      <Card className="mb-4">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Month</Label>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Batch</Label>
            <Select value={batchId} onValueChange={setBatchId}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All batches</SelectItem>
                {(batches.data ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Student</Label>
            <Select
              value={selected?.student.id ?? ""}
              onValueChange={setSelectedId}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Pick a student" />
              </SelectTrigger>
              <SelectContent>
                {reports.map((r) => (
                  <SelectItem key={r.student.id} value={r.student.id}>
                    {r.student.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {reports.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-sm text-muted-foreground">
            No students in this batch.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div>
            <div className="no-print mb-3 flex flex-wrap gap-2">
              <Button onClick={() => window.print()}>
                <Printer className="mr-1.5 h-4 w-4" /> Print / Save PDF
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setBulkOpen(true);
                  window.setTimeout(() => window.print(), 50);
                }}
              >
                <Download className="mr-1.5 h-4 w-4" /> Download batch
              </Button>
              {canSend && (
                <Button variant="outline" onClick={() => void sendToParent()}>
                  <MessageCircle className="mr-1.5 h-4 w-4" /> Send to parent
                </Button>
              )}
              {canSend && selected && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      void issue
                        .mutateAsync({
                          studentId: selected.student.id,
                          rotate: true,
                        })
                        .then(() => toast.success("New link ready."))
                        .catch((e) => toast.error(formatUserError(e)))
                    }
                  >
                    <RefreshCw className="mr-1.5 h-4 w-4" /> New link
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void revoke.mutateAsync(selected.student.id)}
                  >
                    <Ban className="mr-1.5 h-4 w-4" /> Turn off link
                  </Button>
                </>
              )}
            </div>

            <div className="print-root space-y-8">
              {bulkOpen
                ? reports.map((r) => (
                    <ReportCardDocument key={r.student.id} report={r.card} />
                  ))
                : selected && <ReportCardDocument report={selected.card} />}
            </div>
            {bulkOpen && (
              <div className="no-print mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBulkOpen(false)}
                >
                  Show one student
                </Button>
              </div>
            )}
          </div>

          <div className="no-print space-y-4">
            {canSend && (
              <Card>
                <CardContent className="space-y-2 p-4">
                  <Label htmlFor="teacher-remark">Teacher remark</Label>
                  <Textarea
                    id="teacher-remark"
                    rows={4}
                    maxLength={500}
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder="Optional note for the parent."
                  />
                  <p className="text-xs text-muted-foreground">
                    Saved on the share link when you send or print with a new
                    link.
                  </p>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardContent className="p-4 text-sm">
                <p className="font-medium">This month</p>
                <p className="mt-1 text-muted-foreground">
                  {reports.length} student{reports.length === 1 ? "" : "s"}
                  {batchId !== "all" ? " in this batch" : ""}.
                </p>
                <Button asChild variant="link" className="px-0">
                  <Link to="/students">Back to students</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
