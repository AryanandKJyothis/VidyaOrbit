import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Plus,
  Search,
  Receipt,
  Wallet,
  AlertCircle,
  CheckCircle2,
  Download,
  ChevronDown,
} from "lucide-react";
import { RoutePermissionGate } from "@/components/route-permission-gate";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { useStudents, useBatches, usePayments } from "@/hooks/use-data";
import { PaymentDialog } from "@/components/payment-dialog";
import { formatINR, formatDate } from "@/lib/format";
import { exportToExcel, exportToCsv } from "@/lib/export";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/fees")({
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

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [batchFilter, setBatchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

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

  const rows = (students.data ?? [])
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

  const totals = rows.reduce(
    (acc, r) => {
      acc.totalFee += Number(r.s.fee_total);
      acc.paid += r.paid;
      acc.due += r.balance;
      if (r.overdue) acc.overdue += r.balance;
      return acc;
    },
    { totalFee: 0, paid: 0, due: 0, overdue: 0 },
  );

  const filtered = rows.filter(({ s, balance, overdue }) => {
    if (q && !s.full_name.toLowerCase().includes(q.toLowerCase())) return false;
    if (batchFilter !== "all" && s.batch_id !== batchFilter) return false;
    if (statusFilter === "paid" && balance > 0) return false;
    if (statusFilter === "pending" && balance === 0) return false;
    if (statusFilter === "overdue" && !overdue) return false;
    return true;
  });

  const studentById = useMemo(
    () => Object.fromEntries((students.data ?? []).map((s) => [s.id, s])),
    [students.data],
  );

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
                        Status:
                          balance === 0
                            ? "Paid"
                            : overdue
                              ? "Overdue"
                              : "Pending",
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
                        Status:
                          balance === 0
                            ? "Paid"
                            : overdue
                              ? "Overdue"
                              : "Pending",
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
            <Button onClick={() => setOpen(true)}>
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
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

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
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Batch</th>
                      <th className="px-4 py-3">Due</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-right">Paid</th>
                      <th className="px-4 py-3 text-right">Balance</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map(({ s, paid, balance, overdue }) => (
                      <tr key={s.id} className="hover:bg-muted/30">
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
                          {balance === 0 ? (
                            <Badge variant="secondary">Paid</Badge>
                          ) : overdue ? (
                            <Badge variant="destructive">Overdue</Badge>
                          ) : (
                            <Badge variant="outline">Pending</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
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
                  <Button onClick={() => setOpen(true)}>
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
                      <tr key={p.id} className="hover:bg-muted/30">
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

      <PaymentDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
