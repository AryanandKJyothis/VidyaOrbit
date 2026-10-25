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
  FileDown,
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
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/query-state";
import {
  useStudents,
  useBatches,
  usePayments,
  type Student,
} from "@/hooks/use-data";
import { useSubscription } from "@/hooks/use-subscription";
import {
  atStudentPlanLimit,
  canRestoreArchivedStudent,
  formatLimit,
  isUnlimited,
  planLimitHeadcount,
} from "@/lib/plan-limits";
import { StudentDialog } from "@/components/student-dialog";
import { formatINR } from "@/lib/format";
import {
  exportToExcel,
  exportToCsv,
  downloadStudentImportTemplate,
} from "@/lib/export";
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
import { FilterChips } from "@/components/app/filter-chips";
import { InitialsAvatar } from "@/components/app/initials-avatar";
import { isPastIstDate } from "@/lib/format";
import {
  useActiveWorkspace,
  useCan,
  useCanExport,
} from "@/hooks/use-active-workspace";
import { RoutePermissionGate } from "@/components/route-permission-gate";
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
  return (
    <RoutePermissionGate resource="students" level="read">
      <StudentsList />
    </RoutePermissionGate>
  );
}

function StudentsList() {
  const students = useStudents();
  const batches = useBatches();
  const payments = usePayments();
  const sub = useSubscription();
  const { active } = useActiveWorkspace();
  const qc = useQueryClient();
  const canViewFees = useCan("fees", "read");
  const canWriteStudents = useCan("students", "write");
  const canExport = useCanExport();

  const [q, setQ] = useState("");
  const [batchFilter, setBatchFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [editing, setEditing] = useState<Student | undefined>();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [feeFocus, setFeeFocus] = useState<"all" | "overdue">("all");

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
    if (feeFocus === "overdue" && canViewFees) {
      const bal = Math.max(0, Number(s.fee_total) - (paidByStudent[s.id] ?? 0));
      const overdue = !!(
        s.fee_due_date &&
        isPastIstDate(s.fee_due_date) &&
        bal > 0
      );
      if (!overdue) return false;
    }
    return true;
  });

  const currentCount = planLimitHeadcount(
    sub.data?.student_count,
    students.data,
  );
  const planLimit = sub.data?.limit ?? Infinity;
  const unlimited = isUnlimited(planLimit);
  const pct = unlimited ? 0 : Math.min(100, (currentCount / planLimit) * 100);
  const atLimit = atStudentPlanLimit(currentCount, planLimit);

  const canBill = useCan("billing", "write");
  const contactMsg = getContactMessage(canBill);
  const contactUrl = getContactLink();
  const contactLabel = getContactLabel();
  const showContact = hasAnyContact();

  const archive = async (s: Student) => {
    const next = s.status === "archived" ? "active" : "archived";
    if (!active?.ownerId) {
      toast.error("No active workspace selected.");
      return;
    }
    if (
      next === "active" &&
      !canRestoreArchivedStudent(currentCount, planLimit)
    ) {
      toast.error(
        `You've reached your plan limit of ${formatLimit(planLimit)} students. Archive another student or upgrade before restoring.`,
      );
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
            {canExport && (
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
                          Batch: s.batch_id
                            ? (batchById[s.batch_id] ?? "")
                            : "",
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
                          Batch: s.batch_id
                            ? (batchById[s.batch_id] ?? "")
                            : "",
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
            )}
            {canWriteStudents && (
              <>
                <Button
                  variant="outline"
                  onClick={() =>
                    void downloadStudentImportTemplate(
                      (batches.data ?? []).map((b) => b.name),
                    )
                  }
                >
                  <FileDown className="mr-1.5 h-4 w-4" /> Download template
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setImportOpen(true)}
                  disabled={atLimit}
                >
                  <Upload className="mr-1.5 h-4 w-4" /> Import from Excel
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
              </>
            )}
          </div>
        }
      />

      <OverLimitBanner />

      {sub.data && !unlimited && !sub.data.over_limit && pct >= 80 && (
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
                  <p className="text-xs text-muted-foreground">{contactMsg}</p>
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

      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by student name, roll no, or phone"
            className="h-12 rounded-2xl pl-9"
          />
        </div>
        <FilterChips
          ariaLabel="Batches"
          value={batchFilter}
          onChange={setBatchFilter}
          chips={[
            {
              id: "all",
              label: "All batches",
              count: (students.data ?? []).filter((s) =>
                statusFilter === "all" ? true : s.status === statusFilter,
              ).length,
            },
            ...(batches.data ?? []).map((b) => ({
              id: b.id,
              label: b.name,
              count: (students.data ?? []).filter(
                (s) =>
                  s.batch_id === b.id &&
                  (statusFilter === "all" ? true : s.status === statusFilter),
              ).length,
            })),
          ]}
        />
        <FilterChips
          ariaLabel="Student filters"
          value={feeFocus === "overdue" ? "overdue" : statusFilter}
          onChange={(id) => {
            if (id === "overdue") {
              setFeeFocus("overdue");
              setStatusFilter("active");
              return;
            }
            setFeeFocus("all");
            setStatusFilter(id);
          }}
          chips={[
            { id: "active", label: "All students" },
            ...(canViewFees
              ? [
                  {
                    id: "overdue",
                    label: "Fee overdue",
                    tone: "danger" as const,
                  },
                ]
              : []),
            { id: "archived", label: "Archived" },
          ]}
        />
      </div>

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
              description="Import your register from Excel — names, phones, and batches in one go."
              reassurance="You can add or edit anyone afterwards. Nothing is sent to parents until you tap WhatsApp."
            >
              {canWriteStudents && (
                <Button onClick={() => setImportOpen(true)} disabled={atLimit}>
                  <Upload className="mr-1.5 h-4 w-4" /> Import students
                </Button>
              )}
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
            <ul className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((s) => {
                const paid = paidByStudent[s.id] ?? 0;
                const bal = Math.max(0, Number(s.fee_total) - paid);
                const overdue = !!(
                  s.fee_due_date &&
                  isPastIstDate(s.fee_due_date) &&
                  bal > 0
                );
                const dueSoon =
                  !overdue &&
                  bal > 0 &&
                  paid > 0 &&
                  s.fee_due_date &&
                  !isPastIstDate(s.fee_due_date);
                return (
                  <li key={s.id}>
                    <article className="rounded-2xl border border-border/80 bg-card p-4 shadow-[var(--shadow-xs)] transition-[box-shadow,border-color] duration-150 [transition-timing-function:var(--ease-out)] [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[var(--shadow-card)]">
                      <div className="flex items-start gap-3">
                        <InitialsAvatar name={s.full_name} />
                        <div className="min-w-0 flex-1">
                          <Link
                            to="/students/$id"
                            params={{ id: s.id }}
                            className="block truncate font-semibold hover:underline"
                          >
                            {s.full_name}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">
                            {s.batch_id ? batchById[s.batch_id] : "No batch"}
                          </p>
                        </div>
                        {canWriteStudents && (
                          <div className="flex shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-11 w-11"
                              aria-label={`Edit ${s.full_name}`}
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
                              className="h-11 w-11"
                              aria-label={
                                s.status === "archived"
                                  ? `Restore ${s.full_name}`
                                  : `Archive ${s.full_name}`
                              }
                              onClick={() => archive(s)}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                      {canViewFees && (
                        <div className="mt-3 flex items-center justify-between gap-2">
                          {overdue ? (
                            <span className="pill pill-danger">
                              Overdue {formatINR(bal)}
                            </span>
                          ) : bal === 0 ? (
                            <span className="pill pill-success">Paid</span>
                          ) : dueSoon ? (
                            <span className="pill pill-muted">
                              Due {formatINR(bal)}
                            </span>
                          ) : (
                            <span className="pill pill-muted">
                              Balance {formatINR(bal)}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {s.guardian_name && (
                          <span className="truncate">{s.guardian_name}</span>
                        )}
                        {(s.guardian_phone || s.phone) && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {s.guardian_phone || s.phone}
                          </span>
                        )}
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Showing {filtered.length} student{filtered.length === 1 ? "" : "s"}
      </p>

      {canWriteStudents && (
        <button
          type="button"
          onClick={() => {
            setEditing(undefined);
            setOpen(true);
          }}
          disabled={atLimit}
          aria-label="Add student"
          className="fab-shadow fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground md:hidden active:scale-[0.97] motion-reduce:active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      <StudentDialog open={open} onOpenChange={setOpen} student={editing} />
      <ImportStudentsDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
