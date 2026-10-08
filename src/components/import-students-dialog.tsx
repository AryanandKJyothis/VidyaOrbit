import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import readXlsxFile from "read-excel-file/browser";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useBatches, useStudents } from "@/hooks/use-data";
import { useSubscription, PLAN_LIMITS } from "@/hooks/use-subscription";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useActiveWorkspace, useCan } from "@/hooks/use-active-workspace";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatUserError } from "@/lib/format-error";
import { downloadStudentImportTemplate } from "@/lib/export";
import {
  Upload,
  FileSpreadsheet,
  FileDown,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  RotateCcw,
  Filter,
} from "lucide-react";
import {
  prepareStudentImportRows,
  issueLabel,
  detectHeaderRow,
  rowsFromMatrix,
  guessColumnMapping,
  buildExistingIndex,
  revalidateRow,
  downloadRejectedRows,
  FIELD_LABELS,
  type PreparedImportRow,
  type ColumnMapping,
  type ImportField,
  type ImportRowIssue,
} from "@/lib/student-import";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type DupStrategy = "skip" | "update";
type Step = 1 | 2 | 3 | 4;
type FilterBucket = "all" | "ready" | "fix" | "dup_db" | "dup_file";

const STEP_LABELS: Record<Step, string> = {
  1: "Upload",
  2: "Map columns",
  3: "Review & fix",
  4: "Import",
};

const FIELD_ORDER: ImportField[] = [
  "name",
  "phone",
  "guardian",
  "guardian_phone",
  "batch",
  "fee",
  "joining_date",
];
const MAX_IMPORT_ROWS = 500;
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function ImportStudentsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const batches = useBatches();
  const students = useStudents();
  const { user } = useAuth();
  const { active } = useActiveWorkspace();
  const ownerId = active?.ownerId ?? user?.id ?? null;
  const sub = useSubscription();
  const qc = useQueryClient();
  const canWriteFees = useCan("fees", "write");

  const [step, setStep] = useState<Step>(1);
  const [fileName, setFileName] = useState("");
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [sheetRows, setSheetRows] = useState<Record<string, unknown>[]>([]);
  const [headerRowIndex, setHeaderRowIndex] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [prepared, setPrepared] = useState<PreparedImportRow[]>([]);
  const [filter, setFilter] = useState<FilterBucket>("all");
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [batchId, setBatchId] = useState<string>("none");
  const [feeTotal, setFeeTotal] = useState<string>("0");
  const [dupStrategy, setDupStrategy] = useState<DupStrategy>("skip");
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [importResult, setImportResult] = useState<{
    inserted: number;
    updated: number;
    skipped: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const batchNameToId = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of batches.data ?? [])
      m.set(b.name.trim().toLowerCase(), b.id);
    return m;
  }, [batches.data]);

  const planLimit = sub.data ? PLAN_LIMITS[sub.data.plan] : Infinity;
  const currentCount = sub.data?.student_count ?? 0;
  const remainingSlots = Math.max(0, planLimit - currentCount);

  const reset = () => {
    setStep(1);
    setFileName("");
    setSheetHeaders([]);
    setSheetRows([]);
    setHeaderRowIndex(0);
    setMapping({});
    setPrepared([]);
    setFilter("all");
    setEditingRow(null);
    setBatchId("none");
    setFeeTotal("0");
    setDupStrategy("skip");
    setImportResult(null);
  };

  // ── Step 1: file parsing ──────────────────────────────────────────
  const handleFile = async (file: File) => {
    try {
      if (file.size > MAX_IMPORT_BYTES) {
        toast.error("That file is too large.", {
          description:
            "Upload a spreadsheet under 2 MB with up to 500 student rows.",
        });
        return;
      }
      const buf = await file.arrayBuffer();
      const matrix = await matrixFromSpreadsheet(file, buf);
      if (!matrix.length) {
        toast.error("That file looks empty.", {
          description:
            "Make sure the first sheet has a header row and at least one student.",
        });
        return;
      }
      const headerRow = detectHeaderRow(matrix);
      const { headers, rows } = rowsFromMatrix(matrix, headerRow);
      if (!rows.length) {
        toast.error("No student rows found.", {
          description:
            "The header row was detected but no data rows follow it.",
        });
        return;
      }
      if (rows.length > MAX_IMPORT_ROWS) {
        toast.error("Too many rows.", {
          description: `Import up to ${MAX_IMPORT_ROWS} students at a time. Split this file and try again.`,
        });
        return;
      }
      const guess = guessColumnMapping(headers);
      setFileName(file.name);
      setSheetHeaders(headers);
      setSheetRows(rows);
      setHeaderRowIndex(headerRow);
      setMapping(guess);
      setStep(2);
    } catch (e) {
      toast.error(formatUserError(e, "Couldn't read that file."), {
        description:
          "Use a .xlsx, .xls, or .csv exported from Excel/Google Sheets.",
      });
    }
  };

  // ── Step 2 → 3: prepare rows ──────────────────────────────────────
  const buildPrepared = () => {
    if (!mapping.name) {
      toast.error("Pick the Name column to continue.");
      return;
    }
    const defaultFee = Math.max(0, Number(feeTotal) || 0);
    const defaultBatch = batchId === "none" ? null : batchId;
    const rows = prepareStudentImportRows(sheetRows, {
      mapping,
      defaultBatchId: defaultBatch,
      defaultFee,
      batchNameToId,
      existingStudents: students.data ?? [],
      rowOffset: headerRowIndex + 2,
    });
    setPrepared(rows);
    setStep(3);
  };

  // ── Step 3: inline edit ───────────────────────────────────────────
  const existingIndex = useMemo(
    () => buildExistingIndex(students.data ?? []),
    [students.data],
  );

  const saveEdit = (sourceRow: number, patch: Partial<PreparedImportRow>) => {
    setPrepared((prev) => {
      // rebuild seenKeys excluding this row, so dup_file recomputes properly
      const seenKeys = new Map<string, number>();
      for (const r of prev) {
        if (r.sourceRow === sourceRow) continue;
        if (r.issue === "invalid_name" || r.issue === "invalid_phone") continue;
        const name = (r.full_name ?? "").trim().toLowerCase();
        const phoneKey = r.phone ? r.phone.replace(/\D/g, "").slice(-10) : "";
        const key = phoneKey ? `p:${phoneKey}` : `n:${name}`;
        if (!seenKeys.has(key)) seenKeys.set(key, r.sourceRow);
      }
      return prev.map((r) => {
        if (r.sourceRow !== sourceRow) return r;
        const merged = { ...r, ...patch };
        return revalidateRow(merged, { existing: existingIndex, seenKeys });
      });
    });
  };

  // ── Counts & filtered preview ─────────────────────────────────────
  const counts = useMemo(() => {
    let ready = 0,
      invalid = 0,
      dupFile = 0,
      dupDb = 0;
    for (const r of prepared) {
      if (r.issue === "none") ready++;
      else if (r.issue === "dup_db") dupDb++;
      else if (r.issue === "dup_file") dupFile++;
      else invalid++;
    }
    return { ready, invalid, dupFile, dupDb };
  }, [prepared]);

  const filteredPrepared = useMemo(() => {
    return prepared.filter((r) => {
      if (filter === "all") return true;
      if (filter === "ready") return r.issue === "none";
      if (filter === "dup_db") return r.issue === "dup_db";
      if (filter === "dup_file") return r.issue === "dup_file";
      if (filter === "fix")
        return r.issue === "invalid_name" || r.issue === "invalid_phone";
      return true;
    });
  }, [prepared, filter]);

  // ── Plan-limit preflight ──────────────────────────────────────────
  const willInsertAll = counts.ready;
  const willUpdate = dupStrategy === "update" ? counts.dupDb : 0;
  const overBy = Math.max(0, willInsertAll - remainingSlots);
  const willInsertCapped = Math.max(0, willInsertAll - overBy);

  // ── Step 4: import ────────────────────────────────────────────────
  const importAll = async () => {
    if (!user || !ownerId) return;
    const defaultFee = Math.max(0, Number(feeTotal) || 0);
    const defaultBatch = batchId === "none" ? null : batchId;

    const insertCandidates = prepared.filter((r) => r.issue === "none");
    const toInsert = insertCandidates.slice(0, remainingSlots);
    const toUpdate =
      dupStrategy === "update"
        ? prepared.filter((r) => r.issue === "dup_db" && r.existingStudentId)
        : [];

    if (!toInsert.length && !toUpdate.length) {
      toast.error("Nothing to import.", {
        description:
          remainingSlots === 0
            ? "Your plan is at its student limit. Upgrade or archive students first."
            : "All rows are duplicates or need fixing.",
      });
      return;
    }

    setBusy(true);
    try {
      let updated = 0;
      for (const r of toUpdate) {
        const updatePayload: {
          full_name: string;
          phone: string | null;
          guardian_name: string | null;
          guardian_phone: string | null;
          batch_id: string | null;
          joining_date?: string;
          fee_total?: number;
        } = {
          full_name: r.full_name,
          phone: r.phone,
          guardian_name: r.guardian_name,
          guardian_phone: r.guardian_phone,
          batch_id: r.batch_id ?? defaultBatch,
          ...(r.joining_date ? { joining_date: r.joining_date } : {}),
        };
        // Only include fee fields if user has fees:write permission
        if (canWriteFees && r.fee_total) {
          updatePayload.fee_total = r.fee_total;
        }
        const { error } = await supabase
          .from("students")
          .update(updatePayload)
          .eq("id", r.existingStudentId!)
          .eq("owner_id", ownerId);
        if (error) throw error;
        updated++;
      }

      const payload = toInsert.map((r) => {
        const row: Record<string, unknown> = {
          owner_id: ownerId,
          full_name: r.full_name,
          phone: r.phone,
          guardian_name: r.guardian_name,
          guardian_phone: r.guardian_phone,
          batch_id: r.batch_id ?? defaultBatch,
          joining_date: r.joining_date ?? new Date().toISOString().slice(0, 10),
          status: "active",
        };
        // Only include fee_total if user has fees:write permission
        if (canWriteFees) {
          row.fee_total = r.fee_total || defaultFee;
        }
        return row;
      });

      let inserted = 0;
      for (const part of chunk(payload, 40)) {
        const { error } = await supabase
          .from("students")
          .insert(part as never[]);
        if (error) throw error;
        inserted += part.length;
      }

      const skipped = prepared.length - inserted - updated; // invalid + dup_file + over-limit + skipped dups
      setImportResult({ inserted, updated, skipped });
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["subscription"] });
      toast.success(
        `Imported ${inserted} new${updated ? ` · updated ${updated}` : ""}`,
      );
    } catch (e) {
      toast.error(formatUserError(e, "Import failed."), {
        description:
          "Some rows may have already been saved. Re-open import to see what's left.",
      });
    } finally {
      setBusy(false);
    }
  };

  // ── Close handler ─────────────────────────────────────────────────
  const handleOpenChange = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  // Track edits — clear editing row when prepared changes
  useEffect(() => {
    if (step !== 3) setEditingRow(null);
  }, [step]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col gap-0 p-0">
        <div className="p-6 pb-4 border-b">
          <DialogHeader>
            <DialogTitle>Import students</DialogTitle>
            <DialogDescription>
              Upload your spreadsheet and we'll guide you through it.
            </DialogDescription>
          </DialogHeader>
          <StepStrip current={step} />
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-6">
          {step === 1 && (
            <StepUpload
              fileName={fileName}
              dragOver={dragOver}
              setDragOver={setDragOver}
              onFile={handleFile}
              fileInputRef={fileInputRef}
              onDownloadTemplate={() =>
                void downloadStudentImportTemplate(
                  (batches.data ?? []).map((b) => b.name),
                )
              }
              hasBatches={(batches.data ?? []).length > 0}
            />
          )}

          {step === 2 && (
            <StepMap
              headers={sheetHeaders}
              rows={sheetRows}
              mapping={mapping}
              setMapping={setMapping}
              batchId={batchId}
              setBatchId={setBatchId}
              feeTotal={feeTotal}
              setFeeTotal={setFeeTotal}
              batches={batches.data ?? []}
              canWriteFees={canWriteFees}
            />
          )}

          {step === 3 && (
            <StepReview
              prepared={prepared}
              filtered={filteredPrepared}
              counts={counts}
              filter={filter}
              setFilter={setFilter}
              editingRow={editingRow}
              setEditingRow={setEditingRow}
              saveEdit={saveEdit}
              dupStrategy={dupStrategy}
              setDupStrategy={setDupStrategy}
              remainingSlots={remainingSlots}
              planLimit={planLimit}
              planName={sub.data?.plan ?? "free"}
              overBy={overBy}
              willInsertCapped={willInsertCapped}
              willUpdate={willUpdate}
            />
          )}

          {step === 4 && (
            <StepResult
              result={importResult}
              prepared={prepared}
              fileName={fileName}
            />
          )}
        </div>

        <DialogFooter className="p-4 border-t bg-muted/20 flex items-center justify-between sm:justify-between gap-2">
          <div className="flex gap-2">
            {step > 1 && step < 4 && !importResult && (
              <Button
                variant="ghost"
                onClick={() => setStep((s) => (s - 1) as Step)}
              >
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              {importResult ? "Done" : "Cancel"}
            </Button>
            {step === 1 && (
              <Button onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-1.5 h-4 w-4" /> Choose file
              </Button>
            )}
            {step === 2 && (
              <Button onClick={buildPrepared} disabled={!mapping.name}>
                Continue
              </Button>
            )}
            {step === 3 && (
              <Button
                onClick={() => setStep(4)}
                disabled={willInsertCapped + willUpdate === 0}
              >
                Continue to import
              </Button>
            )}
            {step === 4 && !importResult && (
              <Button onClick={importAll} disabled={busy}>
                <Upload className="mr-1.5 h-4 w-4" />
                {busy
                  ? "Importing…"
                  : `Import ${willInsertCapped + willUpdate} students`}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Step strip ──────────────────────────────────────────────────────
function StepStrip({ current }: { current: Step }) {
  const steps: Step[] = [1, 2, 3, 4];
  return (
    <div className="mt-4 flex items-center gap-1.5 text-xs">
      {steps.map((s, i) => {
        const active = s === current;
        const done = s < current;
        return (
          <div key={s} className="flex items-center gap-1.5">
            <div
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full font-medium",
                done && "bg-success text-success-foreground",
                active && "bg-primary text-primary-foreground",
                !done && !active && "bg-muted text-muted-foreground",
              )}
            >
              {done ? <CheckCircle2 className="h-3 w-3" /> : s}
            </div>
            <span
              className={cn(
                active
                  ? "font-medium text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {STEP_LABELS[s]}
            </span>
            {i < steps.length - 1 && (
              <div className="mx-1 h-px w-6 bg-border" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1: Upload ──────────────────────────────────────────────────
function StepUpload({
  fileName,
  dragOver,
  setDragOver,
  onFile,
  fileInputRef,
  onDownloadTemplate,
  hasBatches,
}: {
  fileName: string;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  onFile: (f: File) => void;
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  onDownloadTemplate: () => void;
  hasBatches: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/20 p-4 text-sm">
        <p className="font-medium">What we need</p>
        <ul className="mt-1.5 ml-4 list-disc text-muted-foreground space-y-0.5">
          <li>
            <span className="text-foreground font-medium">Name</span> — required
          </li>
          <li>Phone, Guardian, Batch, Fee total, Joining date — optional</li>
          <li>
            Don't worry about exact column names — we'll match them in the next
            step.
          </li>
        </ul>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        className={cn(
          "rounded-lg border-2 border-dashed p-8 text-center transition",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border bg-background",
        )}
      >
        <FileSpreadsheet className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">
          Drag &amp; drop your spreadsheet here
        </p>
        <p className="text-xs text-muted-foreground">
          .xlsx, .xls, or .csv — up to 500 rows
        </p>
        {fileName && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-success/10 px-2.5 py-1 text-xs text-success">
            <CheckCircle2 className="h-3 w-3" /> {fileName}
          </p>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
        <div className="mt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" /> Choose file
          </Button>
        </div>
      </div>

      <div className="rounded-lg border p-3 flex items-start gap-3">
        <FileDown className="mt-0.5 h-4 w-4 text-primary" />
        <div className="flex-1 text-sm">
          <p className="font-medium">Don't have a file yet?</p>
          <p className="text-xs text-muted-foreground">
            Download our template — it includes example rows, instructions in
            English &amp; Malayalam,{" "}
            {hasBatches
              ? "and your existing batch names."
              : "and a batches sheet."}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onDownloadTemplate}
        >
          Download template
        </Button>
      </div>
    </div>
  );
}

// ── Step 2: Map columns ─────────────────────────────────────────────
function StepMap({
  headers,
  rows,
  mapping,
  setMapping,
  batchId,
  setBatchId,
  feeTotal,
  setFeeTotal,
  batches,
  canWriteFees,
}: {
  headers: string[];
  rows: Record<string, unknown>[];
  mapping: ColumnMapping;
  setMapping: (m: ColumnMapping) => void;
  batchId: string;
  setBatchId: (s: string) => void;
  feeTotal: string;
  setFeeTotal: (s: string) => void;
  batches: { id: string; name: string }[];
  canWriteFees: boolean;
}) {
  // header -> field (inverse for the select per header)
  const headerToField: Record<string, ImportField | undefined> = {};
  (Object.keys(mapping) as ImportField[]).forEach((f) => {
    const h = mapping[f];
    if (h) headerToField[h] = f;
  });

  const setForHeader = (header: string, field: ImportField | "ignore") => {
    const next: ColumnMapping = { ...mapping };
    // clear any previous assignment of this header
    (Object.keys(next) as ImportField[]).forEach((f) => {
      if (next[f] === header) delete next[f];
    });
    if (field !== "ignore") {
      // clear any previous header assigned to this field
      (Object.keys(next) as ImportField[]).forEach((f) => {
        if (f === field) delete next[f];
      });
      next[field] = header;
    }
    setMapping(next);
  };

  const sample = (h: string) =>
    rows
      .slice(0, 3)
      .map((r) => (r[h] == null ? "" : String(r[h]).trim()))
      .filter(Boolean)
      .join(", ") || "—";

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">
          Match your columns to Vidya fields
        </p>
        <p className="text-xs text-muted-foreground">
          We auto-matched what we could.{" "}
          <span className="font-medium">Name is required.</span> Set anything
          you don't need to "Ignore".
        </p>
      </div>

      {!mapping.name && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-xs text-destructive flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5" /> Pick which column has the
          student's name.
        </div>
      )}

      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Your column</th>
              <th className="px-3 py-2 text-left font-medium">Sample values</th>
              <th className="px-3 py-2 text-left font-medium w-44">
                Vidya field
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {headers.map((h) => (
              <tr key={h}>
                <td className="px-3 py-2 font-medium">{h}</td>
                <td className="px-3 py-2 text-muted-foreground truncate max-w-[220px]">
                  {sample(h)}
                </td>
                <td className="px-3 py-1.5">
                  <Select
                    value={headerToField[h] ?? "ignore"}
                    onValueChange={(v) =>
                      setForHeader(h, v as ImportField | "ignore")
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ignore">— Ignore —</SelectItem>
                      {FIELD_ORDER.filter(
                        (f) => canWriteFees || f !== "fee",
                      ).map((f) => (
                        <SelectItem key={f} value={f}>
                          {FIELD_LABELS[f]}
                          {f === "name" ? " *" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/10 p-3">
        <div>
          <Label className="text-xs">Default batch (when row has none)</Label>
          <Select value={batchId} onValueChange={setBatchId}>
            <SelectTrigger className="mt-1.5 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No batch</SelectItem>
              {batches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canWriteFees && (
          <div>
            <Label className="text-xs">Default fee (₹)</Label>
            <Input
              type="number"
              min={0}
              className="mt-1.5 h-9"
              value={feeTotal}
              onChange={(e) => setFeeTotal(e.target.value)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 3: Review & fix ────────────────────────────────────────────
function StepReview({
  prepared,
  filtered,
  counts,
  filter,
  setFilter,
  editingRow,
  setEditingRow,
  saveEdit,
  dupStrategy,
  setDupStrategy,
  remainingSlots,
  planLimit,
  planName,
  overBy,
  willInsertCapped,
  willUpdate,
}: {
  prepared: PreparedImportRow[];
  filtered: PreparedImportRow[];
  counts: { ready: number; invalid: number; dupFile: number; dupDb: number };
  filter: FilterBucket;
  setFilter: (f: FilterBucket) => void;
  editingRow: number | null;
  setEditingRow: (r: number | null) => void;
  saveEdit: (sourceRow: number, patch: Partial<PreparedImportRow>) => void;
  dupStrategy: DupStrategy;
  setDupStrategy: (s: DupStrategy) => void;
  remainingSlots: number;
  planLimit: number;
  planName: string;
  overBy: number;
  willInsertCapped: number;
  willUpdate: number;
}) {
  return (
    <div className="space-y-3">
      {/* Counts */}
      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label={`All ${prepared.length}`}
        />
        <FilterChip
          active={filter === "ready"}
          onClick={() => setFilter("ready")}
          tone="success"
          label={`Ready ${counts.ready}`}
        />
        <FilterChip
          active={filter === "fix"}
          onClick={() => setFilter("fix")}
          tone="destructive"
          label={`Needs fix ${counts.invalid}`}
        />
        <FilterChip
          active={filter === "dup_db"}
          onClick={() => setFilter("dup_db")}
          tone="warn"
          label={`Already in Vidya ${counts.dupDb}`}
        />
        <FilterChip
          active={filter === "dup_file"}
          onClick={() => setFilter("dup_file")}
          tone="muted"
          label={`Duplicates in file ${counts.dupFile}`}
        />
        {(counts.invalid > 0 || counts.dupFile > 0) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 ml-auto text-xs"
            onClick={() => void downloadRejectedRows(prepared)}
          >
            <FileDown className="mr-1 h-3 w-3" /> Download rejected rows
          </Button>
        )}
      </div>

      {/* Plan-limit warning */}
      {Number.isFinite(planLimit) && overBy > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
          <p className="font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Your {planName} plan only
            fits {remainingSlots} more students
          </p>
          <p className="mt-0.5 text-muted-foreground">
            This file has {counts.ready} ready rows — only the first{" "}
            <span className="font-medium text-foreground">
              {willInsertCapped}
            </span>{" "}
            will import. The remaining {overBy} are saved nowhere — upgrade your
            plan to add them.
          </p>
        </div>
      )}

      {/* Duplicate strategy */}
      {counts.dupDb > 0 && (
        <div className="rounded-md border bg-muted/20 p-3 space-y-2">
          <Label className="text-xs">
            Students already in Vidya ({counts.dupDb})
          </Label>
          <RadioGroup
            value={dupStrategy}
            onValueChange={(v) => setDupStrategy(v as DupStrategy)}
            className="flex flex-col gap-1.5"
          >
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <RadioGroupItem value="skip" id="dup-skip" />
              Skip them (recommended) — won't touch existing data
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <RadioGroupItem value="update" id="dup-upd" />
              Update existing rows with the new values
            </label>
          </RadioGroup>
        </div>
      )}

      {/* Preview table */}
      <div className="rounded-md border overflow-hidden">
        <div className="max-h-[42vh] overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 sticky top-0">
              <tr>
                <th className="px-2 py-1.5 text-left w-12">Row</th>
                <th className="px-2 py-1.5 text-left">Name</th>
                <th className="px-2 py-1.5 text-left">Phone</th>
                <th className="px-2 py-1.5 text-left">Status</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-muted-foreground"
                  >
                    <Filter className="mx-auto h-4 w-4 mb-1" />
                    No rows in this filter.
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <PreviewRow
                  key={r.sourceRow}
                  row={r}
                  isEditing={editingRow === r.sourceRow}
                  onStartEdit={() => setEditingRow(r.sourceRow)}
                  onCancelEdit={() => setEditingRow(null)}
                  onSave={(patch) => {
                    saveEdit(r.sourceRow, patch);
                    setEditingRow(null);
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Will import:{" "}
        <span className="font-medium text-foreground">
          {willInsertCapped} new
        </span>
        {willUpdate ? <> · {willUpdate} updated</> : null}
      </p>
    </div>
  );
}

function PreviewRow({
  row,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSave,
}: {
  row: PreparedImportRow;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (patch: Partial<PreparedImportRow>) => void;
}) {
  const [name, setName] = useState(row.full_name);
  const [phone, setPhone] = useState(row.phone ?? "");
  useEffect(() => {
    setName(row.full_name);
    setPhone(row.phone ?? "");
  }, [isEditing, row.full_name, row.phone]);

  const editable =
    row.issue === "invalid_name" ||
    row.issue === "invalid_phone" ||
    row.issue === "dup_file";

  const issueColor: Record<ImportRowIssue, string> = {
    none: "text-success",
    dup_db: "text-amber-700 dark:text-amber-400",
    invalid_name: "text-destructive",
    invalid_phone: "text-destructive",
    dup_file: "text-destructive",
  };

  if (isEditing) {
    return (
      <tr className="bg-muted/30">
        <td className="px-2 py-1.5 text-muted-foreground align-top">
          {row.sourceRow}
        </td>
        <td className="px-2 py-1.5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-7 text-xs"
            placeholder="Full name"
            autoFocus
          />
        </td>
        <td className="px-2 py-1.5">
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-7 text-xs"
            placeholder="Phone"
          />
        </td>
        <td className="px-2 py-1.5" colSpan={2}>
          <div className="flex gap-1.5 justify-end">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={onCancelEdit}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onSave({ full_name: name, phone: phone || null })}
            >
              Save
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className={cn(editable && "hover:bg-muted/30")}>
      <td className="px-2 py-1.5 text-muted-foreground">{row.sourceRow}</td>
      <td className="px-2 py-1.5 max-w-[180px] truncate">
        {row.full_name || "—"}
      </td>
      <td className="px-2 py-1.5 text-muted-foreground max-w-[120px] truncate">
        {row.phone ?? "—"}
      </td>
      <td className="px-2 py-1.5">
        <span className={cn(issueColor[row.issue])}>
          {issueLabel(row.issue)}
          {row.issue === "dup_file" && row.dupFileRow
            ? ` (row ${row.dupFileRow})`
            : ""}
        </span>
      </td>
      <td className="px-2 py-1.5 text-right">
        {editable && (
          <button
            type="button"
            onClick={onStartEdit}
            className="text-muted-foreground hover:text-foreground"
            title="Edit row"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </td>
    </tr>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  tone = "default",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone?: "default" | "success" | "destructive" | "warn" | "muted";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px] border transition",
        active &&
          tone === "success" &&
          "border-success bg-success/10 text-success",
        active &&
          tone === "destructive" &&
          "border-destructive bg-destructive/10 text-destructive",
        active &&
          tone === "warn" &&
          "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400",
        active &&
          tone === "muted" &&
          "border-foreground/40 bg-muted text-foreground",
        active &&
          tone === "default" &&
          "border-primary bg-primary/10 text-primary",
        !active && "border-border text-muted-foreground hover:bg-muted/50",
      )}
    >
      {label}
    </button>
  );
}

// ── Step 4: Result/confirm ──────────────────────────────────────────
function StepResult({
  result,
  prepared,
  fileName,
}: {
  result: { inserted: number; updated: number; skipped: number } | null;
  prepared: PreparedImportRow[];
  fileName: string;
}) {
  if (!result) {
    const ready = prepared.filter((r) => r.issue === "none").length;
    const dupDb = prepared.filter((r) => r.issue === "dup_db").length;
    return (
      <div className="space-y-3">
        <div className="rounded-lg border bg-muted/20 p-4">
          <p className="text-sm font-medium">Ready to import from {fileName}</p>
          <ul className="mt-2 text-xs text-muted-foreground space-y-1">
            <li>• {ready} new students will be added</li>
            <li>
              • {dupDb} already in Vidya (skipped or updated based on your
              choice)
            </li>
            <li>
              • Anything left will stay in your file — download the rejected
              rows from the previous step.
            </li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          Click "Import" below to start. You can keep using Vidya in another
          tab.
        </p>
      </div>
    );
  }

  const hadRejects = prepared.some(
    (r) =>
      r.issue === "invalid_name" ||
      r.issue === "invalid_phone" ||
      r.issue === "dup_file",
  );

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-success/40 bg-success/5 p-4 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
        <p className="mt-2 text-sm font-medium">Import complete</p>
        <p className="text-xs text-muted-foreground">
          {result.inserted} added · {result.updated} updated · {result.skipped}{" "}
          skipped
        </p>
      </div>
      {hadRejects && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => void downloadRejectedRows(prepared)}
        >
          <FileDown className="mr-1.5 h-4 w-4" /> Download rejected rows
        </Button>
      )}
      <button
        type="button"
        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mx-auto"
        onClick={() => window.location.reload()}
      >
        <RotateCcw className="h-3 w-3" /> Refresh student list
      </button>
    </div>
  );
}

async function matrixFromSpreadsheet(
  file: File,
  buf: ArrayBuffer,
): Promise<unknown[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    const text = new TextDecoder("utf-8").decode(buf);
    const parsed = Papa.parse<unknown[]>(text, {
      skipEmptyLines: false,
    });
    if (parsed.errors.length) {
      throw new Error(parsed.errors[0]?.message ?? "Could not parse CSV");
    }
    return parsed.data;
  }

  const sheets = await readXlsxFile(file);
  const selected =
    sheets.find((sheet) => /student/i.test(sheet.sheet)) ?? sheets[0];
  return selected?.data ?? [];
}
