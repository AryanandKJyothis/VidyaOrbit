import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import {
  Plus,
  Search,
  Receipt,
  Wallet,
  AlertCircle,
  CheckCircle2,
  Download,
  ChevronDown,
  MessageCircle,
} from "lucide-react";
import { RoutePermissionGate } from "@/components/route-permission-gate";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/empty-state";
import { QueryErrorState } from "@/components/query-state";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useStudents,
  useBatches,
  usePayments,
  useInstitute,
} from "@/hooks/use-data";
import { PaymentDialog } from "@/components/payment-dialog";
import {
  FeeReminderQueue,
  type ReminderQueueItem,
} from "@/components/fee-reminder-queue";
import { formatINR, formatDate } from "@/lib/format";
import { exportToExcel, exportToCsv } from "@/lib/export";
import {
  buildFeeReminder,
  canSendFeeReminders,
  feeCollectionStatus,
  feeStatusLabel,
  openWhatsApp,
  type FeeCollectionStatus,
} from "@/lib/fee-reminder";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useCan } from "@/hooks/use-active-workspace";

const FEE_STATUSES = ["all", "pending", "partial", "overdue", "paid"] as const;
type FeeStatusFilter = (typeof FEE_STATUSES)[number];

export const Route = createFileRoute("/_authenticated/fees")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { status?: FeeStatusFilter } => {
    const status = search.status;
    if (
      typeof status === "string" &&
      (FEE_STATUSES as readonly string[]).includes(status)
    ) {
      return { status: status as FeeStatusFilter };
    }
    return {};
  },
  component: FeesPage,
});

function FeesPage() {
  return (
    <RoutePermissionGate resource="fees" level="read">
      <FeesPageContent />
    </RoutePermissionGate>
  );
}

function FeesPageContent() {
  const students = useStudents();
  const batches = useBatches();
  const payments = usePayments();
  const institute = useInstitute();
  const canRemind = canSendFeeReminders(useCan("fees", "write"));
  const qc = useQueryClient();
  const search = useSearch({ from: "/_authenticated/fees" });

  const [open, setOpen] = useState(false);
  const [paymentDefaults, setPaymentDefaults] = useState<{
    studentId?: string;
    amount?: number;
    method?: string;
  }>({});
  const [q, setQ] = useState("");
  const [batchFilter, setBatchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<FeeStatusFilter>(
    search.status ?? "all",
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [queueOpen, setQueueOpen] = useState(false);
  const [queue, setQueue] = useState<ReminderQueueItem[]>([]);

  useEffect(() => {
    if (search.status) setStatusFilter(search.status);
  }, [search.status]);

  const paidByStudent = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of payments.data ?? [])
      m[p.student_id] = (m[p.student_id] ?? 0) + Number(p.amount);
    return m;
  }, [payments.data]);

  const batchById = useMemo(
    () => Object.fromEntries((batches.data ?? []).map((b) => [b.id, b.name])),
    [batches.data],
  );

  const rows = useMemo(() => {
    return (students.data ?? [])
      .filter((s) => s.status !== "archived")
      .map((s) => {
        const paid = paidByStudent[s.id] ?? 0;
        const balance = Math.max(0, Number(s.fee_total) - paid);
        const overdue = !!(
          s.fee_due_date &&
          new Date(s.fee_due_date) < new Date() &&
          balance > 0
        );
        return { s, paid, balance, overdue };
      });
  }, [students.data, paidByStudent]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.totalFee += Number(r.s.fee_total);
        acc.paid += r.paid;
        acc.due += r.balance;
        if (r.overdue) acc.overdue += r.balance;
        return acc;
      },
      { totalFee: 0, paid: 0, due: 0, overdue: 0 },
    );
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter(({ s, paid, balance, overdue }) => {
      if (q && !s.full_name.toLowerCase().includes(q.toLowerCase()))
        return false;
      if (batchFilter !== "all" && s.batch_id !== batchFilter) return false;
      const status = feeCollectionStatus({ paid, balance, overdue });
      if (statusFilter === "paid" && status !== "paid") return false;
      if (statusFilter === "pending" && status !== "pending") return false;
      if (statusFilter === "partial" && status !== "partial") return false;
      if (statusFilter === "overdue" && status !== "overdue") return false;
      return true;
    });
  }, [rows, q, batchFilter, statusFilter]);

  const studentById = useMemo(
    () => Object.fromEntries((students.data ?? []).map((s) => [s.id, s])),
    [students.data],
  );

  const centreName = institute.data?.name ?? "your centre";
  const upiVpa = institute.data?.upi_vpa;

  const remindRows = (
    targets: { s: (typeof rows)[number]["s"]; balance: number }[],
  ) => {
    if (!canRemind) {
      toast.error("You need permission to send fee reminders.");
      return;
    }
    if (!upiVpa?.trim()) {
      toast.error(
        "Add your centre UPI ID in Settings before sending reminders.",
      );
      return;
    }
    if (targets.length === 0) {
      toast.error("Select at least one student.");
      return;
    }
    const items: ReminderQueueItem[] = targets.map(({ s, balance }) => ({
      studentId: s.id,
      studentName: s.full_name,
      result: buildFeeReminder({
        centreName,
        upiVpa,
        studentName: s.full_name,
        guardianPhone: s.guardian_phone,
        studentPhone: s.phone,
        feeDueDate: s.fee_due_date,
        balance,
      }),
    }));
    if (items.length === 1 && items[0].result.ok) {
      if (!openWhatsApp(items[0].result.href)) {
        toast.error("Allow pop-ups to open WhatsApp.");
      }
      return;
    }
    setQueue(items);
    setQueueOpen(true);
  };

  const selectOverdueInBatch = () => {
    setQ("");
    setStatusFilter("overdue");
    setSelected(
      new Set(
        rows
          .filter(
            (r) =>
              r.overdue &&
              (batchFilter === "all" || r.s.batch_id === batchFilter),
          )
          .map((r) => r.s.id),
      ),
    );
  };

  const selectAllOverdue = () => {
    setQ("");
    setBatchFilter("all");
    setStatusFilter("overdue");
    setSelected(new Set(rows.filter((r) => r.overdue).map((r) => r.s.id)));
  };

  const markReceived = (studentId: string, balance: number) => {
    setPaymentDefaults({ studentId, amount: balance, method: "upi" });
    setOpen(true);
  };

  const loading = students.isLoading || batches.isLoading || payments.isLoading;
  const loadError =
    students.isError || batches.isError || payments.isError
      ? ((students.error ?? batches.error ?? payments.error) as Error)
      : null;

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Fees"
          description="Track fee collection and pending dues"
        />
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Fees"
          description="Track fee collection and pending dues"
        />
        <QueryErrorState
          error={loadError}
          title="Failed to load fees"
          onRetry={() => {
            void qc.invalidateQueries({ queryKey: ["students"] });
            void qc.invalidateQueries({ queryKey: ["batches"] });
            void qc.invalidateQueries({ queryKey: ["payments"] });
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Fees"
        description="Collect payments, track dues and view recent receipts."
        actions={
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="mr-1.5 h-4 w-4" /> Export dues{" "}
                  <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={async () => {
                    const duesRows = filtered.map(
                      ({ s, paid, balance, overdue }) => ({
                        Student: s.full_name,
                        Batch: s.batch_id ? batchById[s.batch_id] : "",
                        "Due date": s.fee_due_date ?? "",
                        "Total fee": Number(s.fee_total),
                        Paid: paid,
                        Balance: balance,
                        Status: feeStatusLabel(
                          feeCollectionStatus({ paid, balance, overdue }),
                        ),
                      }),
                    );
                    await exportToExcel(duesRows, "fee-dues", "Dues");
                    toast.success(`Exported ${duesRows.length} dues (.xlsx)`);
                  }}
                >
                  Dues (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const duesRows = filtered.map(
                      ({ s, paid, balance, overdue }) => ({
                        Student: s.full_name,
                        Batch: s.batch_id ? batchById[s.batch_id] : "",
                        "Due date": s.fee_due_date ?? "",
                        "Total fee": Number(s.fee_total),
                        Paid: paid,
                        Balance: balance,
                        Status: feeStatusLabel(
                          feeCollectionStatus({ paid, balance, overdue }),
                        ),
                      }),
                    );
                    exportToCsv(duesRows, "fee-dues");
                    toast.success(`Exported ${duesRows.length} dues (.csv)`);
                  }}
                >
                  Dues (.csv)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              onClick={() => {
                setPaymentDefaults({});
                setOpen(true);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Record payment
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <StatCard
          label="Total fee"
          value={formatINR(totals.totalFee)}
          icon={Wallet}
        />
        <StatCard
          label="Collected"
          value={formatINR(totals.paid)}
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          label="Pending"
          value={formatINR(totals.due)}
          icon={AlertCircle}
          tone="warning"
        />
        <StatCard
          label="Overdue"
          value={formatINR(totals.overdue)}
          icon={AlertCircle}
          tone={totals.overdue ? "destructive" : "default"}
        />
      </div>

      <Tabs defaultValue="dues" className="mt-6">
        <TabsList>
          <TabsTrigger value="dues">Dues</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="dues" className="mt-4">
          <Card className="mb-4">
            <CardContent className="flex flex-col gap-2 p-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search student"
                  className="pl-9"
                />
              </div>
              <Select value={batchFilter} onValueChange={setBatchFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Batch" />
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
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as FeeStatusFilter)}
              >
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {!upiVpa?.trim() && (
            <div className="mb-4 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
              Add your centre UPI ID so reminders include a pay link. Parents
              pay that ID directly.{" "}
              <Link to="/settings" className="font-medium underline">
                Open settings
              </Link>
            </div>
          )}

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={selectOverdueInBatch}
            >
              Select overdue in this batch
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={selectAllOverdue}
            >
              Select all overdue
            </Button>
            {canRemind && (
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  remindRows(
                    rows
                      .filter((r) => selected.has(r.s.id))
                      .map((r) => ({ s: r.s, balance: r.balance })),
                  )
                }
              >
                <MessageCircle className="mr-1.5 h-4 w-4" />
                Remind on WhatsApp
                {selected.size > 0 ? ` (${selected.size})` : ""}
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              {filtered.length === 0 ? (
                <EmptyState
                  className="border-0 rounded-none bg-transparent"
                  title={
                    rows.length === 0
                      ? "No fee records yet"
                      : "No matching dues"
                  }
                  description={
                    rows.length === 0
                      ? "Add students with fee totals, then record payments from here."
                      : "Adjust filters or search to see outstanding balances."
                  }
                >
                  <Button asChild>
                    <Link to="/students">Manage students</Link>
                  </Button>
                </EmptyState>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 w-10"></th>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Batch</th>
                      <th className="px-4 py-3">Due</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-right">Paid</th>
                      <th className="px-4 py-3 text-right">Balance</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map(({ s, paid, balance, overdue }) => {
                      const status = feeCollectionStatus({
                        paid,
                        balance,
                        overdue,
                      });
                      return (
                        <tr
                          key={s.id}
                          className="transition-colors duration-100 hover:bg-muted/30"
                        >
                          <td className="px-4 py-3">
                            {balance > 0 ? (
                              <Checkbox
                                checked={selected.has(s.id)}
                                onCheckedChange={(checked) => {
                                  setSelected((prev) => {
                                    const next = new Set(prev);
                                    if (checked === true) next.add(s.id);
                                    else next.delete(s.id);
                                    return next;
                                  });
                                }}
                                aria-label={`Select ${s.full_name}`}
                              />
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              to="/students/$id"
                              params={{ id: s.id }}
                              className="font-medium hover:underline"
                            >
                              {s.full_name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {s.batch_id ? batchById[s.batch_id] : "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDate(s.fee_due_date)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            {formatINR(Number(s.fee_total))}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            {formatINR(paid)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold">
                            {formatINR(balance)}
                          </td>
                          <td className="px-4 py-3">
                            <FeeStatusBadge status={status} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            {balance > 0 ? (
                              <div className="flex justify-end gap-1">
                                {canRemind && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => remindRows([{ s, balance }])}
                                  >
                                    Remind
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => markReceived(s.id, balance)}
                                >
                                  Mark received
                                </Button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <div className="mb-3 flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="mr-1.5 h-4 w-4" /> Export payments{" "}
                  <ChevronDown className="ml-1 h-3 w-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={async () => {
                    const payRows = (payments.data ?? []).map((p) => ({
                      "Receipt #": p.receipt_number ?? "",
                      Student: studentById[p.student_id]?.full_name ?? "",
                      Date: p.payment_date,
                      Method: p.method,
                      Amount: Number(p.amount),
                      Reference: p.reference ?? "",
                      Notes: p.notes ?? "",
                    }));
                    await exportToExcel(payRows, "payments", "Payments");
                    toast.success(
                      `Exported ${payRows.length} payments (.xlsx)`,
                    );
                  }}
                >
                  Payments (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const payRows = (payments.data ?? []).map((p) => ({
                      "Receipt #": p.receipt_number ?? "",
                      Student: studentById[p.student_id]?.full_name ?? "",
                      Date: p.payment_date,
                      Method: p.method,
                      Amount: Number(p.amount),
                      Reference: p.reference ?? "",
                      Notes: p.notes ?? "",
                    }));
                    exportToCsv(payRows, "payments");
                    toast.success(`Exported ${payRows.length} payments (.csv)`);
                  }}
                >
                  Payments (.csv)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              {(payments.data ?? []).length === 0 ? (
                <EmptyState
                  className="border-0 rounded-none bg-transparent"
                  icon={Receipt}
                  title="No payments yet"
                  description="Record cash, UPI, or bank transfers — receipts are generated automatically."
                >
                  <Button
                    onClick={() => {
                      setPaymentDefaults({});
                      setOpen(true);
                    }}
                  >
                    <Plus className="mr-1.5 h-4 w-4" /> Record payment
                  </Button>
                </EmptyState>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Receipt</th>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {payments.data!.map((p) => (
                      <tr
                        key={p.id}
                        className="transition-colors duration-100 hover:bg-muted/30"
                      >
                        <td className="px-4 py-3 font-mono text-xs">
                          {p.receipt_number}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            to="/students/$id"
                            params={{ id: p.student_id }}
                            className="hover:underline"
                          >
                            {studentById[p.student_id]?.full_name ?? "—"}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
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
      </Tabs>

      <PaymentDialog
        open={open}
        onOpenChange={setOpen}
        defaultStudentId={paymentDefaults.studentId}
        defaultAmount={paymentDefaults.amount}
        defaultMethod={paymentDefaults.method}
      />
      <FeeReminderQueue
        open={queueOpen}
        onOpenChange={setQueueOpen}
        items={queue}
      />
    </div>
  );
}

function FeeStatusBadge({ status }: { status: FeeCollectionStatus }) {
  const variant =
    status === "paid"
      ? "secondary"
      : status === "overdue"
        ? "destructive"
        : status === "partial"
          ? "default"
          : "outline";
  return <Badge variant={variant}>{feeStatusLabel(status)}</Badge>;
}
