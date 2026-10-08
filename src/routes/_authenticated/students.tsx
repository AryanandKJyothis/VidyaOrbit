import { useMemo, useState } from "react";
import {
  createFileRoute,
  Link,
  Outlet,
  useChildMatches,
} from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Pencil,
  Archive,
  Phone,
  Upload,
  Download,
  ChevronDown,
  Sparkles,
  Users,
  ExternalLink,
} from "lucide-react";
import { ImportStudentsDialog } from "@/components/import-students-dialog";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/query-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useStudents,
  useBatches,
  usePayments,
  type Student,
} from "@/hooks/use-data";
import { useSubscription } from "@/hooks/use-subscription";
import { formatLimit, isUnlimited } from "@/lib/plan-limits";
import { StudentDialog } from "@/components/student-dialog";
import { formatINR, formatDate } from "@/lib/format";
import { exportToExcel, exportToCsv } from "@/lib/export";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatUserError } from "@/lib/format-error";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/empty-state";
import { OverLimitBanner } from "@/components/over-limit-banner";
import { useActiveWorkspace, useCan } from "@/hooks/use-active-workspace";
import {
  getContactMessage,
  getContactLink,
  getContactLabel,
  hasAnyContact,
} from "@/lib/contact-config";

export const Route = createFileRoute("/_authenticated/students")({
  component: StudentsLayout,
});

function StudentsLayout() {
  const childMatches = useChildMatches();

  // If there's a child route (e.g., /students/$id), render it
  if (childMatches.length > 0) {
    return <Outlet />;
  }

  // Otherwise render the list
  return <StudentsList />;
}

function StudentsList() {
  const students = useStudents();
  const batches = useBatches();
  const payments = usePayments();
  const sub = useSubscription();
  const { active } = useActiveWorkspace();
  const qc = useQueryClient();
  const canViewFees = useCan("fees", "read");

  const [q, setQ] = useState("");
  const [batchFilter, setBatchFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [editing, setEditing] = useState<Student | undefined>();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const paidByStudent = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of payments.data ?? [])
      m[p.student_id] = (m[p.student_id] ?? 0) + Number(p.amount);
    return m;
  }, [payments.data]);

  const batchById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const b of batches.data ?? []) m[b.id] = b.name;
    return m;
  }, [batches.data]);

  const filtered = (students.data ?? []).filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (batchFilter !== "all" && s.batch_id !== batchFilter) return false;
    if (
      q &&
      !`${s.full_name} ${s.phone ?? ""} ${s.guardian_name ?? ""}`
        .toLowerCase()
        .includes(q.toLowerCase())
    )
      return false;
    return true;
  });

  const currentCount = students.data?.length ?? 0;
  const planLimit = sub.data?.limit ?? Infinity;
  const unlimited = isUnlimited(planLimit);
  const pct = unlimited
    ? 0
    : Math.min(100, (currentCount / planLimit) * 100);
  const atLimit = !unlimited && currentCount >= planLimit;

  const isOwner = active?.role === "owner";
  const contactMsg = getContactMessage(isOwner);
  const contactUrl = getContactLink();
  const contactLabel = getContactLabel();
  const showContact = hasAnyContact();

  const archive = async (s: Student) => {
    const next = s.status === "archived" ? "active" : "archived";
    if (!active?.ownerId) {
      toast.error("No active workspace selected.");
      return;
    }
    const { error } = await supabase
      .from("students")
      .update({ status: next })
      .eq("id", s.id)
      .eq("owner_id", active.ownerId);
    if (error)
      toast.error(formatUserError(error, "Could not update student status."));
    else {
      toast.success(next === "archived" ? "Archived" : "Restored");
      qc.invalidateQueries({ queryKey: ["students"] });
    }
  };

  return (
    <div>
      <PageHeader
        title="Students"
        description="Manage all students, their batches and fee plans."
        actions={
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="mr-1.5 h-4 w-4" /> Export{" "}
                  <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={async () => {
                    const rows = filtered.map((s) => {
                      const baseRow: Record<string, string | number> = {
                        Name: s.full_name,
                        Phone: s.phone ?? "",
                        Guardian: s.guardian_name ?? "",
                        "Guardian phone": s.guardian_phone ?? "",
                        Batch: s.batch_id ? (batchById[s.batch_id] ?? "") : "",
                        "Joining date": s.joining_date,
                        Status: s.status,
                      };

                      // Only include fee columns if user has fees permission
                      if (canViewFees) {
                        baseRow["Total fee"] = Number(s.fee_total);
                        baseRow["Paid"] = paidByStudent[s.id] ?? 0;
                        baseRow["Balance"] = Math.max(
                          0,
                          Number(s.fee_total) - (paidByStudent[s.id] ?? 0),
                        );
                        baseRow["Due date"] = s.fee_due_date ?? "";
                      }

                      baseRow["Address"] = s.address ?? "";
                      return baseRow;
                    });
                    await exportToExcel(rows, "students", "Students");
                    toast.success(`Exported ${rows.length} students (.xlsx)`);
                  }}
                >
                  Spreadsheet (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const rows = filtered.map((s) => {
                      const baseRow: Record<string, string | number> = {
                        Name: s.full_name,
                        Phone: s.phone ?? "",
                        Guardian: s.guardian_name ?? "",
                        "Guardian phone": s.guardian_phone ?? "",
                        Batch: s.batch_id ? (batchById[s.batch_id] ?? "") : "",
                        "Joining date": s.joining_date,
                        Status: s.status,
                      };

                      if (canViewFees) {
                        baseRow["Total fee"] = Number(s.fee_total);
                        baseRow["Paid"] = paidByStudent[s.id] ?? 0;
                        baseRow["Balance"] = Math.max(
                          0,
                          Number(s.fee_total) - (paidByStudent[s.id] ?? 0),
                        );
                        baseRow["Due date"] = s.fee_due_date ?? "";
                      }

                      baseRow["Address"] = s.address ?? "";
                      return baseRow;
                    });
                    exportToCsv(rows, "students");
                    toast.success(`Exported ${rows.length} students (.csv)`);
                  }}
                >
                  CSV (.csv)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              onClick={() => setImportOpen(true)}
              disabled={atLimit}
            >
              <Upload className="mr-1.5 h-4 w-4" /> Import
            </Button>
            <Button
              onClick={() => {
                setEditing(undefined);
                setOpen(true);
              }}
              disabled={atLimit}
              title={
                atLimit
                  ? `You've reached the ${formatLimit(planLimit)}-student limit`
                  : undefined
              }
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add student
            </Button>
          </div>
        }
      />

      <OverLimitBanner />

      {sub.data &&
        !unlimited &&
        !sub.data.over_limit &&
        pct >= 80 && (
          <Card
            className={`mb-4 border-${atLimit ? "destructive/40" : "primary/30"} ${atLimit ? "bg-destructive/5" : "bg-primary/5"}`}
          >
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Sparkles
                  className={`mt-0.5 h-4 w-4 ${atLimit ? "text-destructive" : "text-primary"}`}
                />
                <div>
                  <p className="text-sm font-medium">
                    {atLimit
                      ? `You've reached your ${sub.data.plan} plan limit (${formatLimit(planLimit)} students).`
                      : `Heads up — you're using ${currentCount} of ${formatLimit(planLimit)} students.`}
                  </p>
                  {contactMsg && (
                    <p className="text-xs text-muted-foreground">
                      {contactMsg}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  asChild
                  size="sm"
                  variant={atLimit ? "default" : "outline"}
                >
                  <Link to="/plan">View plan</Link>
                </Button>
                {showContact && contactUrl && (
                  <Button asChild size="sm" variant="outline">
                    <a
                      href={contactUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {contactLabel}{" "}
                      <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, phone, guardian…"
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
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {students.isError ? (
            <QueryErrorState
              error={students.error as Error}
              onRetry={() => qc.invalidateQueries({ queryKey: ["students"] })}
            />
          ) : students.isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : (students.data ?? []).length === 0 ? (
            <EmptyState
              icon={Users}
              title="No students yet"
              description="Add learners manually or import a spreadsheet — match batches later from the Students page."
            >
              <Button
                onClick={() => {
                  setEditing(undefined);
                  setOpen(true);
                }}
                disabled={atLimit}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Add student
              </Button>
              <Button
                variant="outline"
                onClick={() => setImportOpen(true)}
                disabled={atLimit}
              >
                <Upload className="mr-1.5 h-4 w-4" /> Import spreadsheet
              </Button>
            </EmptyState>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No matches"
              description="Try clearing search or filters — no student fits what you typed."
            >
              <Button
                variant="outline"
                onClick={() => {
                  setQ("");
                  setBatchFilter("all");
                  setStatusFilter("active");
                }}
              >
                Reset filters
              </Button>
            </EmptyState>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Batch</th>
                      <th className="px-4 py-3">Joined</th>
                      {canViewFees && (
                        <>
                          <th className="px-4 py-3 text-right">Fee</th>
                          <th className="px-4 py-3 text-right">Balance</th>
                        </>
                      )}
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((s) => {
                      const bal = Math.max(
                        0,
                        Number(s.fee_total) - (paidByStudent[s.id] ?? 0),
                      );
                      const overdue =
                        s.fee_due_date &&
                        new Date(s.fee_due_date) < new Date() &&
                        bal > 0;
                      return (
                        <tr key={s.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <Link
                              to="/students/$id"
                              params={{ id: s.id }}
                              className="font-medium hover:underline"
                            >
                              {s.full_name}
                            </Link>
                            {s.phone && (
                              <div className="text-xs text-muted-foreground">
                                {s.phone}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {s.batch_id ? (batchById[s.batch_id] ?? "—") : "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDate(s.joining_date)}
                          </td>
                          {canViewFees && (
                            <>
                              <td className="px-4 py-3 text-right font-mono">
                                {formatINR(Number(s.fee_total))}
                              </td>
                              <td
                                className={`px-4 py-3 text-right font-mono ${bal > 0 ? "font-semibold" : "text-muted-foreground"}`}
                              >
                                {formatINR(bal)}
                              </td>
                            </>
                          )}
                          <td className="px-4 py-3">
                            {canViewFees && overdue ? (
                              <Badge variant="destructive">Overdue</Badge>
                            ) : s.status === "active" ? (
                              <Badge variant="secondary">Active</Badge>
                            ) : s.status === "archived" ? (
                              <Badge variant="outline">Archived</Badge>
                            ) : (
                              <Badge variant="outline">Inactive</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                setEditing(s);
                                setOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => archive(s)}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-border">
                {filtered.map((s) => {
                  const bal = Math.max(
                    0,
                    Number(s.fee_total) - (paidByStudent[s.id] ?? 0),
                  );
                  const overdue =
                    s.fee_due_date &&
                    new Date(s.fee_due_date) < new Date() &&
                    bal > 0;
                  return (
                    <Link
                      key={s.id}
                      to="/students/$id"
                      params={{ id: s.id }}
                      className="block px-4 py-3.5 hover:bg-muted/30 active:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">
                              {s.full_name}
                            </span>
                            {canViewFees && overdue ? (
                              <Badge
                                variant="destructive"
                                className="text-[10px] px-1.5 py-0"
                              >
                                Overdue
                              </Badge>
                            ) : s.status !== "active" ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0"
                              >
                                {s.status}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {s.batch_id ? batchById[s.batch_id] : "No batch"}
                          </div>
                          {s.phone && (
                            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {s.phone}
                            </div>
                          )}
                        </div>
                        {canViewFees && (
                          <div className="text-right shrink-0">
                            <div className="font-mono text-sm font-semibold">
                              {formatINR(bal)}
                            </div>
                            <div className="text-[10px] uppercase text-muted-foreground">
                              balance
                            </div>
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <StudentDialog open={open} onOpenChange={setOpen} student={editing} />
      <ImportStudentsDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
