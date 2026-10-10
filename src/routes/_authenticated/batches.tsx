import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  Users,
  Pencil,
  Power,
  Download,
  ChevronDown,
  Layers,
} from "lucide-react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useBatches,
  useStudents,
  useUpsertBatch,
  type Batch,
} from "@/hooks/use-data";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { exportToExcel, exportToCsv } from "@/lib/export";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/empty-state";
import { QueryErrorState } from "@/components/query-state";
import { formatUserError } from "@/lib/format-error";
import { useActiveWorkspace, useCan } from "@/hooks/use-active-workspace";

export const Route = createFileRoute("/_authenticated/batches")({
  component: BatchesPage,
});

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function BatchesPage() {
  const batches = useBatches();
  const students = useStudents();
  const qc = useQueryClient();
  const { active } = useActiveWorkspace();
  const canWriteBatches = useCan("batches", "write");
  const [editing, setEditing] = useState<Batch | undefined>();
  const [open, setOpen] = useState(false);

  const countByBatch = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of students.data ?? [])
      if (s.batch_id && s.status !== "archived")
        m[s.batch_id] = (m[s.batch_id] ?? 0) + 1;
    return m;
  }, [students.data]);

  const toggle = async (b: Batch) => {
    if (!active?.ownerId) {
      toast.error("No active workspace selected.");
      return;
    }
    const { error } = await supabase
      .from("batches")
      .update({ is_active: !b.is_active })
      .eq("id", b.id)
      .eq("owner_id", active.ownerId);
    if (error)
      toast.error(formatUserError(error, "Could not update batch status."));
    else qc.invalidateQueries({ queryKey: ["batches"] });
  };

  return (
    <div>
      <PageHeader
        title="Batches"
        description="Create class batches and manage capacity."
        actions={
          <div className="flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  disabled={!(batches.data ?? []).length}
                >
                  <Download className="mr-1.5 h-4 w-4" /> Export{" "}
                  <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={async () => {
                    const rows = (batches.data ?? []).map((b) => ({
                      Name: b.name,
                      Subject: b.subject ?? "",
                      Teacher: b.teacher_name ?? "",
                      Timing: b.timing ?? "",
                      Days: (b.days_of_week ?? []).join(", "),
                      Capacity: b.capacity,
                      Active: b.is_active ? "Yes" : "No",
                      Students: countByBatch[b.id] ?? 0,
                    }));
                    await exportToExcel(rows, "batches", "Batches");
                    toast.success(`Exported ${rows.length} batches (.xlsx)`);
                  }}
                >
                  Spreadsheet (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const rows = (batches.data ?? []).map((b) => ({
                      Name: b.name,
                      Subject: b.subject ?? "",
                      Teacher: b.teacher_name ?? "",
                      Timing: b.timing ?? "",
                      Days: (b.days_of_week ?? []).join(", "),
                      Capacity: b.capacity,
                      Active: b.is_active ? "Yes" : "No",
                      Students: countByBatch[b.id] ?? 0,
                    }));
                    exportToCsv(rows, "batches");
                    toast.success(`Exported ${rows.length} batches (.csv)`);
                  }}
                >
                  CSV (.csv)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              onClick={() => {
                setEditing(undefined);
                setOpen(true);
              }}
              disabled={!canWriteBatches}
            >
              <Plus className="mr-1.5 h-4 w-4" /> New batch
            </Button>
          </div>
        }
      />

      {batches.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : batches.isError ? (
        <QueryErrorState
          error={batches.error as Error}
          title="Failed to load batches"
          onRetry={() => qc.invalidateQueries({ queryKey: ["batches"] })}
        />
      ) : (batches.data ?? []).length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Create your first batch"
          description="Batches group students by timing or programme — you’ll need one before marking attendance."
        >
          <Button onClick={() => setOpen(true)} disabled={!canWriteBatches}>
            <Plus className="mr-1.5 h-4 w-4" /> New batch
          </Button>
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {batches.data!.map((b, i) => {
            const count = countByBatch[b.id] ?? 0;
            const pct = Math.min(
              100,
              Math.round((count / Math.max(1, b.capacity)) * 100),
            );
            return (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card className="card-elevated overflow-hidden transition-shadow hover:shadow-[var(--shadow-lift)]">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-display text-lg font-semibold leading-tight">
                          {b.name}
                        </h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {b.subject ?? "—"} · {b.teacher_name ?? "No teacher"}
                        </p>
                      </div>
                      <Badge
                        variant={b.is_active ? "secondary" : "outline"}
                        className={b.is_active ? "" : "opacity-60"}
                      >
                        {b.is_active ? "Active" : "Paused"}
                      </Badge>
                    </div>
                    {b.timing && (
                      <div className="mt-3 text-sm text-muted-foreground">
                        {b.timing}
                      </div>
                    )}
                    {(b.days_of_week ?? []).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {b.days_of_week!.map((d) => (
                          <Badge
                            key={d}
                            variant="outline"
                            className="text-[10px] px-1.5"
                          >
                            {d}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" /> {count}/{b.capacity}
                        </span>
                        <span className="font-medium">{pct}%</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-warning" : "bg-accent"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      {canWriteBatches && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                              setEditing(b);
                              setOpen(true);
                            }}
                          >
                            <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggle(b)}
                            title={
                              b.is_active ? "Pause batch" : "Activate batch"
                            }
                          >
                            <Power className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <BatchDialog open={open} onOpenChange={setOpen} batch={editing} />
    </div>
  );
}

function BatchDialog({
  open,
  onOpenChange,
  batch,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  batch?: Batch;
}) {
  const mut = useUpsertBatch();
  const [form, setForm] = useState({
    name: "",
    subject: "",
    teacher_name: "",
    timing: "",
    days_of_week: [] as string[],
    capacity: "30",
    is_active: true,
    notes: "",
  });
  useEffect(() => {
    if (open) {
      setForm({
        name: batch?.name ?? "",
        subject: batch?.subject ?? "",
        teacher_name: batch?.teacher_name ?? "",
        timing: batch?.timing ?? "",
        days_of_week: batch?.days_of_week ?? [],
        capacity: String(batch?.capacity ?? 30),
        is_active: batch?.is_active ?? true,
        notes: batch?.notes ?? "",
      });
    }
  }, [open, batch]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Batch name is required");
    try {
      await mut.mutateAsync({
        id: batch?.id,
        name: form.name.trim(),
        subject: form.subject || null,
        teacher_name: form.teacher_name || null,
        timing: form.timing || null,
        days_of_week: form.days_of_week,
        capacity: Number(form.capacity) || 30,
        is_active: form.is_active,
        notes: form.notes || null,
      });
      toast.success(batch ? "Batch updated" : "Batch created");
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(
        formatUserError(error, "Could not save batch. Please try again."),
      );
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{batch ? "Edit batch" : "New batch"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Batch name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="Class 10 — Morning"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Subject / course (optional)</Label>
              <Input
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Mathematics"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Teacher (optional)</Label>
              <Input
                value={form.teacher_name}
                onChange={(e) =>
                  setForm({ ...form, teacher_name: e.target.value })
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Timing (optional)</Label>
              <Input
                value={form.timing}
                onChange={(e) => setForm({ ...form, timing: e.target.value })}
                placeholder="6:00 AM - 8:00 AM"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Capacity</Label>
              <Input
                type="number"
                min="1"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Days</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => {
                const checked = form.days_of_week.includes(d);
                return (
                  <label
                    key={d}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs ${checked ? "border-accent bg-accent/10 text-accent" : "border-border"}`}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(c) => {
                        setForm((f) => ({
                          ...f,
                          days_of_week: c
                            ? [...f.days_of_week, d]
                            : f.days_of_week.filter((x) => x !== d),
                        }));
                      }}
                    />
                    {d}
                  </label>
                );
              })}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.is_active}
              onCheckedChange={(c) => setForm({ ...form, is_active: !!c })}
            />
            Batch is active
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mut.isPending}>
              {batch ? "Save" : "Create batch"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
