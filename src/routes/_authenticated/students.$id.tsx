import { useMemo, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  Pencil,
  Plus,
  Phone,
  MapPin,
  Calendar,
  Receipt,
  Users,
  ArrowRightLeft,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { subDays, format } from "date-fns";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useStudent,
  useBatches,
  usePayments,
  useUpsertStudent,
} from "@/hooks/use-data";
import { StudentDialog } from "@/components/student-dialog";
import { PaymentDialog } from "@/components/payment-dialog";
import { formatINR, formatDate } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useActiveWorkspace, useCan } from "@/hooks/use-active-workspace";

export const Route = createFileRoute("/_authenticated/students/$id")({
  component: StudentDetail,
});

function StudentDetail() {
  const { id } = useParams({ from: "/_authenticated/students/$id" });
  const student = useStudent(id);
  const batches = useBatches();
  const payments = usePayments(id);
  const { active } = useActiveWorkspace();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const canViewFees = useCan("fees", "read");

  const updateStudent = useUpsertStudent();

  const attendance = useQuery({
    queryKey: ["att-student", id],
    enabled: !!id && !!active?.ownerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select(
          "status, session_id, attendance_sessions(session_date, batch_id)",
        )
        .eq("student_id", id)
        .eq("owner_id", active!.ownerId)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data as Array<{
        status: string;
        session_id: string;
        attendance_sessions: { session_date: string; batch_id: string } | null;
      }>;
    },
  });

  const paid = (payments.data ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const balance = Math.max(0, Number(student.data?.fee_total ?? 0) - paid);
  const feeTotal = Number(student.data?.fee_total ?? 0);
  const paidPct = feeTotal > 0 ? Math.round((paid / feeTotal) * 100) : 0;

  const batchName = useMemo(() => {
    const b = (batches.data ?? []).find((b) => b.id === student.data?.batch_id);
    return b?.name ?? "—";
  }, [batches.data, student.data]);

  const handleBatchChange = async (batchId: string) => {
    if (!student.data) return;
    try {
      await updateStudent.mutateAsync({
        id: student.data.id,
        batch_id: batchId === "none" ? null : batchId,
      });
      toast.success("Batch updated");
      qc.invalidateQueries({ queryKey: ["student", id] });
      qc.invalidateQueries({ queryKey: ["students"] });
    } catch {
      toast.error("Could not update batch");
    }
  };

  if (student.isLoading) return <Skeleton className="h-64" />;
  
  if (student.isError || !student.data) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Student not found</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              This student doesn't exist or isn't visible to you.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/students">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to students
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const s = student.data;
  const attStats = (() => {
    const recs = attendance.data ?? [];
    const p = recs.filter(
      (r) => r.status === "present" || r.status === "late",
    ).length;
    return {
      total: recs.length,
      present: p,
      rate: recs.length ? Math.round((p / recs.length) * 100) : 0,
    };
  })();

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link to="/students">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> All students
        </Link>
      </Button>

      <PageHeader
        title={s.full_name}
        description={`Joined ${formatDate(s.joining_date)} · ${batchName}`}
        actions={
          <>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-4 w-4" /> Edit
            </Button>
            {canViewFees && (
              <Button onClick={() => setPayOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> Add payment
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              {s.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {s.phone}
                </div>
              )}
              {s.guardian_name && (
                <div className="text-muted-foreground">
                  Guardian:{" "}
                  <span className="text-foreground">{s.guardian_name}</span>
                  {s.guardian_phone && ` · ${s.guardian_phone}`}
                </div>
              )}
              {s.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <span>{s.address}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {formatDate(s.joining_date)}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Badge
                  variant={s.status === "active" ? "secondary" : "outline"}
                >
                  {s.status}
                </Badge>
              </div>
              <div className="pt-2 border-t border-border">
                <div className="flex items-center gap-2 mb-1.5 text-xs text-muted-foreground">
                  <ArrowRightLeft className="h-3 w-3" />
                  Batch
                </div>
                <Select
                  value={s.batch_id ?? "none"}
                  onValueChange={handleBatchChange}
                  disabled={updateStudent.isPending}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No batch</SelectItem>
                    {(batches.data ?? []).map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {canViewFees && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fee summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Row label="Total fee" value={formatINR(feeTotal)} />
                <Row label="Paid" value={formatINR(paid)} tone="success" />
                <Row
                  label="Balance"
                  value={formatINR(balance)}
                  tone={balance > 0 ? "warning" : "default"}
                  bold
                />
                {feeTotal > 0 && (
                  <div className="pt-1">
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${paidPct}%` }}
                      />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground text-right">
                      {paidPct}% paid
                    </div>
                  </div>
                )}
                {s.fee_due_date && (
                  <div className="text-xs text-muted-foreground">
                    Due {formatDate(s.fee_due_date)}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Attendance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="font-display text-3xl font-semibold">
                {attStats.rate}%
              </div>
              <div className="text-xs text-muted-foreground">
                {attStats.present} of {attStats.total} sessions
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Tabs defaultValue={canViewFees ? "payments" : "attendance"}>
            <TabsList>
              {canViewFees && (
                <TabsTrigger value="payments">Fee history</TabsTrigger>
              )}
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
              {s.notes && <TabsTrigger value="notes">Notes</TabsTrigger>}
            </TabsList>
            {canViewFees && (
              <TabsContent value="payments" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  {(payments.data ?? []).length === 0 ? (
                    <div className="p-10 text-center text-sm text-muted-foreground">
                      No payments yet.
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3">Receipt</th>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Method</th>
                          <th className="px-4 py-3 text-right">Amount</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {payments.data!.map((p) => (
                          <tr key={p.id}>
                            <td className="px-4 py-3 font-mono text-xs">
                              {p.receipt_number}
                            </td>
                            <td className="px-4 py-3">
                              {formatDate(p.payment_date)}
                            </td>
                            <td className="px-4 py-3 uppercase text-xs">
                              {p.method}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-medium">
                              {formatINR(Number(p.amount))}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button asChild size="sm" variant="ghost">
                                <Link
                                  to="/receipts/$paymentId"
                                  params={{ paymentId: p.id }}
                                >
                                  <Receipt className="mr-1 h-3.5 w-3.5" />
                                  Receipt
                                </Link>
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            )}
            <TabsContent value="attendance" className="mt-4 space-y-4">
              <AttendanceMiniCalendar records={attendance.data ?? []} />
              <Card>
                <CardContent className="p-0">
                  {(attendance.data ?? []).length === 0 ? (
                    <div className="p-10 text-center text-sm text-muted-foreground">
                      No attendance records yet.
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {(attendance.data ?? []).map((r, i) => (
                          <tr key={i}>
                            <td className="px-4 py-3">
                              {formatDate(r.attendance_sessions?.session_date)}
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                variant={
                                  r.status === "present"
                                    ? "secondary"
                                    : r.status === "late"
                                      ? "outline"
                                      : "destructive"
                                }
                              >
                                {r.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            {s.notes && (
              <TabsContent value="notes" className="mt-4">
                <Card>
                  <CardContent className="p-4 text-sm whitespace-pre-wrap">
                    {s.notes}
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>

      <StudentDialog open={editOpen} onOpenChange={setEditOpen} student={s} />
      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        defaultStudentId={s.id}
      />
    </div>
  );
}

function Row({
  label,
  value,
  tone,
  bold,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning" | "default";
  bold?: boolean;
}) {
  const cls =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-destructive"
        : "";
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono ${bold ? "font-semibold" : ""} ${cls}`}>
        {value}
      </span>
    </div>
  );
}

function AttendanceMiniCalendar({
  records,
}: {
  records: Array<{
    status: string;
    attendance_sessions: { session_date: string; batch_id: string } | null;
  }>;
}) {
  const days = useMemo(() => {
    const result: { date: string; label: string; status: string | null }[] = [];
    for (let i = 27; i >= 0; i--) {
      const d = subDays(new Date(), i);
      result.push({
        date: format(d, "yyyy-MM-dd"),
        label: format(d, "d"),
      } as { date: string; label: string; status: string | null });
    }
    // Map latest record per date
    const byDate: Record<string, string> = {};
    for (const r of records) {
      const d = r.attendance_sessions?.session_date;
      if (!d) continue;
      // Keep the most recent status for this date (records are ordered desc)
      if (!(d in byDate)) byDate[d] = r.status;
    }
    for (const day of result) {
      day.status = byDate[day.date] ?? null;
    }
    return result;
  }, [records]);

  if (records.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm text-muted-foreground">
          Last 28 days
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d) => (
            <div key={d.date} className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "h-6 w-6 rounded-md transition-colors",
                  d.status === "present"
                    ? "bg-success/80"
                    : d.status === "late"
                      ? "bg-warning/80"
                      : d.status === "absent"
                        ? "bg-destructive/60"
                        : "bg-muted",
                )}
                title={
                  d.status ? `${d.date}: ${d.status}` : `${d.date}: no session`
                }
              />
              <span className="text-[10px] text-muted-foreground">
                {d.label}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-success/80" />{" "}
            Present
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-warning/80" />{" "}
            Late
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-destructive/60" />{" "}
            Absent
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-muted" /> No
            session
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
