import type { Student } from "@/hooks/use-data";
import writeXlsxFile, { type SheetData } from "write-excel-file/browser";

/** Match `studentSchema` / import dialog */
export const IMPORT_PHONE_REGEX = /^[0-9+\-\s()]{6,20}$/;

/** Last 10 digits for dedupe (India-style). */
export function normalizePhoneKey(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  if (digits.length >= 6) return digits;
  return null;
}

function normKeyFromRow(phone: string | null, name: string): string {
  const p = normalizePhoneKey(phone);
  if (p) return `p:${p}`;
  return `n:${name.trim().toLowerCase()}`;
}

export type ImportRowIssue = "none" | "invalid_phone" | "invalid_name" | "dup_file" | "dup_db";

export type PreparedImportRow = {
  sourceRow: number;
  full_name: string;
  phone: string | null;
  guardian_name: string | null;
  fee_total: number;
  joining_date: string | null;
  batch_id: string | null;
  /** Original batch name from sheet, if it didn't match any known batch */
  batch_name_raw?: string | null;
  issue: ImportRowIssue;
  /** When issue is dup_file: first row index (1-based) that claimed this key */
  dupFileRow?: number;
  /** When issue is dup_db: existing student id */
  existingStudentId?: string;
};

// ── Field mapping ───────────────────────────────────────────────────

export type ImportField = "name" | "phone" | "guardian" | "batch" | "fee" | "joining_date";

export const FIELD_LABELS: Record<ImportField, string> = {
  name: "Name",
  phone: "Phone",
  guardian: "Guardian",
  batch: "Batch",
  fee: "Fee total",
  joining_date: "Joining date",
};

/** Lowercase, normalized aliases (incl. transliterated Malayalam/Hindi). */
export const FIELD_ALIASES: Record<ImportField, string[]> = {
  name: [
    "name",
    "full name",
    "student name",
    "student",
    "studentname",
    "vidyarthi",
    "vidhyarthi",
    "peru",
    "naam",
    "nama",
  ],
  phone: [
    "phone",
    "mobile",
    "mobile number",
    "mobile no",
    "contact",
    "contact number",
    "phone number",
    "ph",
    "ph no",
    "whatsapp",
    "wa",
    "number",
    "phno",
  ],
  guardian: [
    "guardian",
    "guardian name",
    "parent",
    "parent name",
    "father",
    "father name",
    "mother",
    "mother name",
    "rakshakarthavu",
    "rakshakartha",
    "achan",
    "amma",
  ],
  batch: ["batch", "batch name", "class", "section", "course", "grade"],
  fee: ["fee", "fee total", "total fee", "tuition", "tuition fee", "amount", "fees", "course fee"],
  joining_date: [
    "joining date",
    "join date",
    "joined",
    "admission date",
    "doj",
    "start date",
    "joined on",
  ],
};

export type ColumnMapping = Partial<Record<ImportField, string>>;

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ");
}

/** Find the most likely header row (handles leading title/blank rows). */
export function detectHeaderRow(matrix: unknown[][]): number {
  const aliasSet = new Set(
    Object.values(FIELD_ALIASES)
      .flat()
      .map((a) => normalizeHeader(a)),
  );
  let best = 0;
  let bestScore = -1;
  const limit = Math.min(matrix.length, 15);
  for (let i = 0; i < limit; i++) {
    const row = matrix[i] ?? [];
    const cells = row.map((c) => (c == null ? "" : String(c).trim())).filter(Boolean);
    if (cells.length < 2) continue;
    let score = 0;
    for (const c of cells) {
      const n = normalizeHeader(c);
      if (!n) continue;
      if (aliasSet.has(n)) score += 3;
      else if (n.length <= 30 && /[a-z]/.test(n)) score += 1;
    }
    // Prefer earlier rows with similar score
    if (score > bestScore) {
      bestScore = score;
      best = i;
      if (score >= 6) break;
    }
  }
  return best;
}

/** Convert a sheet matrix + header row index into headers + row objects. */
export function rowsFromMatrix(
  matrix: unknown[][],
  headerRow: number,
): { headers: string[]; rows: Record<string, unknown>[] } {
  const headerCells = (matrix[headerRow] ?? []).map((c, i) => {
    const s = c == null ? "" : String(c).trim();
    return s || `Column ${i + 1}`;
  });
  // Dedupe duplicate header names
  const seen = new Map<string, number>();
  const headers = headerCells.map((h) => {
    const n = seen.get(h) ?? 0;
    seen.set(h, n + 1);
    return n === 0 ? h : `${h} (${n + 1})`;
  });
  const rows: Record<string, unknown>[] = [];
  for (let i = headerRow + 1; i < matrix.length; i++) {
    const r = matrix[i] ?? [];
    const allEmpty = r.every((c) => c == null || String(c).trim() === "");
    if (allEmpty) continue;
    const obj: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      obj[h] = r[idx] ?? "";
    });
    rows.push(obj);
  }
  return { headers, rows };
}

/** Auto-guess header → field mapping. */
export function guessColumnMapping(headers: string[]): ColumnMapping {
  const out: ColumnMapping = {};
  const used = new Set<string>();
  const normHeaders = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));
  (Object.keys(FIELD_ALIASES) as ImportField[]).forEach((field) => {
    const aliases = FIELD_ALIASES[field].map(normalizeHeader);
    // exact match first
    for (const h of normHeaders) {
      if (used.has(h.raw)) continue;
      if (aliases.includes(h.norm)) {
        out[field] = h.raw;
        used.add(h.raw);
        return;
      }
    }
    // fuzzy contains
    for (const h of normHeaders) {
      if (used.has(h.raw)) continue;
      if (aliases.some((a) => h.norm.includes(a) || a.includes(h.norm))) {
        out[field] = h.raw;
        used.add(h.raw);
        return;
      }
    }
  });
  return out;
}

// ── Cell parsing ────────────────────────────────────────────────────

function parseDateCell(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number" && !Number.isNaN(v)) {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return s;
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    const yyyy = dmy[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

function pick(row: Record<string, unknown>, header: string | undefined): unknown {
  if (!header) return "";
  const v = row[header];
  return v ?? "";
}

// ── Validation helpers ──────────────────────────────────────────────

export function buildExistingIndex(students: Student[]) {
  const byPhone = new Map<string, Student>();
  const byName = new Map<string, Student>();
  for (const s of students) {
    if (s.status === "archived") continue;
    const k = normalizePhoneKey(s.phone);
    if (k) byPhone.set(k, s);
    byName.set(s.full_name.trim().toLowerCase(), s);
  }
  return { byPhone, byName };
}

export type ExistingIndex = ReturnType<typeof buildExistingIndex>;

/** Re-validate a single row after inline edit. Returns updated copy. */
export function revalidateRow(
  row: PreparedImportRow,
  ctx: {
    existing: ExistingIndex;
    seenKeys: Map<string, number>; // key -> firstRow (excluding this row)
  },
): PreparedImportRow {
  const name = (row.full_name ?? "").trim();
  const phoneRaw = (row.phone ?? "").trim() || null;
  let issue: ImportRowIssue = "none";
  let phone: string | null = phoneRaw;
  let existingStudentId: string | undefined;
  let dupFileRow: number | undefined;

  if (!name || name.length > 120) issue = "invalid_name";
  else if (phoneRaw && !IMPORT_PHONE_REGEX.test(phoneRaw)) {
    issue = "invalid_phone";
    phone = null;
  }

  if (issue === "none") {
    const key = normKeyFromRow(phone, name);
    const first = ctx.seenKeys.get(key);
    if (first !== undefined && first !== row.sourceRow) {
      issue = "dup_file";
      dupFileRow = first;
    } else {
      const k = normalizePhoneKey(phone);
      if (k && ctx.existing.byPhone.has(k)) {
        existingStudentId = ctx.existing.byPhone.get(k)!.id;
        issue = "dup_db";
      } else if (!k) {
        const byName = ctx.existing.byName.get(name.toLowerCase());
        if (byName) {
          existingStudentId = byName.id;
          issue = "dup_db";
        }
      }
    }
  }

  return {
    ...row,
    full_name: name.slice(0, 120),
    phone,
    issue,
    dupFileRow,
    existingStudentId,
  };
}

/**
 * Parse spreadsheet rows into prepared rows with validation + duplicate flags,
 * using an explicit column mapping.
 */
export function prepareStudentImportRows(
  rawRows: Record<string, unknown>[],
  opts: {
    mapping: ColumnMapping;
    defaultBatchId: string | null;
    defaultFee: number;
    batchNameToId: Map<string, string>;
    existingStudents: Student[];
    /** Row offset to compute display row numbers (header row + 2). */
    rowOffset?: number;
  },
): PreparedImportRow[] {
  const existing = buildExistingIndex(opts.existingStudents);
  const prepared: PreparedImportRow[] = [];
  const fileFirstRowByKey = new Map<string, number>();
  const offset = opts.rowOffset ?? 2;
  const m = opts.mapping;

  rawRows.forEach((r, idx) => {
    const sourceRow = idx + offset;
    const nameRaw = String(pick(r, m.name) ?? "").trim();
    const phoneRaw = String(pick(r, m.phone) ?? "").trim();
    const guardian = String(pick(r, m.guardian) ?? "").trim() || null;
    const feeCell = pick(r, m.fee);
    const feeNum =
      feeCell === "" || feeCell == null ? opts.defaultFee : Math.max(0, Number(feeCell) || 0);
    const join = parseDateCell(pick(r, m.joining_date));
    const batchName = String(pick(r, m.batch) ?? "").trim();
    let batchId = opts.defaultBatchId;
    let batchNameRaw: string | null = null;
    if (batchName) {
      const id = opts.batchNameToId.get(batchName.toLowerCase());
      if (id) batchId = id;
      else batchNameRaw = batchName; // unknown name
    }

    let phone: string | null = phoneRaw || null;
    if (phone && !IMPORT_PHONE_REGEX.test(phone)) phone = null;

    let issue: ImportRowIssue = "none";
    if (!nameRaw || nameRaw.length > 120) issue = "invalid_name";
    else if (phoneRaw && !IMPORT_PHONE_REGEX.test(phoneRaw)) issue = "invalid_phone";

    const key = normKeyFromRow(phone, nameRaw);
    if (issue === "none") {
      const first = fileFirstRowByKey.get(key);
      if (first !== undefined) {
        issue = "dup_file";
        prepared.push({
          sourceRow,
          full_name: nameRaw.slice(0, 120),
          phone,
          guardian_name: guardian,
          fee_total: feeNum,
          joining_date: join,
          batch_id: batchId,
          batch_name_raw: batchNameRaw,
          issue,
          dupFileRow: first,
        });
        return;
      }
      fileFirstRowByKey.set(key, sourceRow);
    }

    let existingStudentId: string | undefined;
    if (issue === "none") {
      const k = normalizePhoneKey(phone);
      if (k && existing.byPhone.has(k)) existingStudentId = existing.byPhone.get(k)!.id;
      else if (!k) {
        const byName = existing.byName.get(nameRaw.toLowerCase());
        if (byName) existingStudentId = byName.id;
      }
      if (existingStudentId) issue = "dup_db";
    }

    prepared.push({
      sourceRow,
      full_name: nameRaw ? nameRaw.slice(0, 120) : "",
      phone,
      guardian_name: guardian,
      fee_total: feeNum,
      joining_date: join,
      batch_id: batchId,
      batch_name_raw: batchNameRaw,
      issue,
      existingStudentId,
    });
  });

  return prepared;
}

export function issueLabel(issue: ImportRowIssue): string {
  switch (issue) {
    case "invalid_name":
      return "Missing or invalid name";
    case "invalid_phone":
      return "Invalid phone";
    case "dup_file":
      return "Duplicate in file";
    case "dup_db":
      return "Already in Vidya";
    default:
      return "Ready";
  }
}

/** Download an .xlsx of just the rejected rows, with a Reason column. */
export async function downloadRejectedRows(rows: PreparedImportRow[]) {
  const rejected = rows.filter(
    (r) => r.issue === "invalid_name" || r.issue === "invalid_phone" || r.issue === "dup_file",
  );
  if (!rejected.length) return;
  const data = rejected.map((r) => ({
    "Source row": r.sourceRow,
    Name: r.full_name,
    Phone: r.phone ?? "",
    Guardian: r.guardian_name ?? "",
    Batch: r.batch_name_raw ?? "",
    "Fee total": r.fee_total || "",
    "Joining date": r.joining_date ?? "",
    Reason:
      r.issue === "dup_file"
        ? `Duplicate of row ${r.dupFileRow ?? "?"} in this file`
        : issueLabel(r.issue),
  }));
  const headers = Object.keys(data[0]);
  const sheet: SheetData = [
    headers.map((value) => ({ value, fontWeight: "bold" as const })),
    ...data.map((row) => headers.map((h) => row[h as keyof typeof row] ?? "")),
  ];
  const blob = await writeXlsxFile([{ sheet: "Rejected rows", data: sheet }]).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "vidya-import-rejected.xlsx";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
