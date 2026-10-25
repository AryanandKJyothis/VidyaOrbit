import type { Student } from "@/hooks/use-data";
import { calendarDateISO } from "@/lib/format";
import * as XLSX from "xlsx";

/** @deprecated Prefer isValidImportPhone — kept for older call sites. */
export const IMPORT_PHONE_REGEX = /^[0-9+\-\s()]{6,20}$/;

export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_BYTES = 8 * 1024 * 1024;
export const IMPORT_INSERT_CHUNK = 80;

export const TEMPLATE_SHEET_NAME = "Students";
export const INSTRUCTIONS_SHEET_NAME = "Instructions";

export const TEMPLATE_HEADERS = [
  "Name",
  "Batch",
  "Phone",
  "Parent name",
  "Parent phone",
  "Monthly fee",
  "Joining date",
  "Address",
  "Notes",
] as const;

export type TemplateHeader = (typeof TEMPLATE_HEADERS)[number];

export const TEMPLATE_EXAMPLE_ROWS: Record<TemplateHeader, string | number>[] =
  [
    {
      Name: "Example Student One",
      Batch: "Example Batch",
      Phone: "9000000001",
      "Parent name": "Example Parent One",
      "Parent phone": "9000000002",
      "Monthly fee": 1000,
      "Joining date": "01-06-2025",
      Address: "12 Example Street, Town",
      Notes: "Delete this example row",
    },
    {
      Name: "Example Student Two",
      Batch: "Example Batch",
      Phone: "9000000003",
      "Parent name": "Example Parent Two",
      "Parent phone": "9000000004",
      "Monthly fee": 1500,
      "Joining date": "15-06-2025",
      Address: "34 Sample Road, Town",
      Notes: "Delete this example row",
    },
  ];

/** Last 10 digits for dedupe (India-style). */
export function normalizePhoneKey(
  phone: string | null | undefined,
): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  if (digits.length >= 6) return digits;
  return null;
}

/** 10-digit phone, optional +91 / leading 0 and punctuation. */
export function isValidImportPhone(phone: string | null | undefined): boolean {
  return nationalTenDigits(phone) !== null;
}

function nationalTenDigits(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = String(phone).trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return null;
}

function contactPhoneKey(
  phone: string | null | undefined,
  guardianPhone: string | null | undefined,
): string | null {
  return normalizePhoneKey(phone) ?? normalizePhoneKey(guardianPhone);
}

function identityKey(
  name: string,
  phone: string | null | undefined,
  guardianPhone?: string | null,
): string {
  const n = name.trim().toLowerCase();
  const p = contactPhoneKey(phone, guardianPhone);
  if (p) return `np:${n}|${p}`;
  return `n:${n}`;
}

export type ImportRowIssue =
  | "none"
  | "invalid_phone"
  | "missing_phone"
  | "invalid_name"
  | "dup_file"
  | "dup_db"
  | "over_limit";

/** Same rule as `studentSchemaWithPhone`: student or guardian phone, 10 digits. */
export function importContactIssue(
  phone: string | null | undefined,
  guardianPhone: string | null | undefined,
): "invalid_phone" | "missing_phone" | null {
  const p = (phone ?? "").trim();
  const g = (guardianPhone ?? "").trim();
  const pOk = Boolean(p && isValidImportPhone(p));
  const gOk = Boolean(g && isValidImportPhone(g));
  if (pOk || gOk) return null;
  if (p || g) return "invalid_phone";
  return "missing_phone";
}

export type PreparedImportRow = {
  sourceRow: number;
  full_name: string;
  phone: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  fee_total: number;
  joining_date: string | null;
  fee_due_date: string | null;
  address: string | null;
  notes: string | null;
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

export type ImportField =
  | "name"
  | "phone"
  | "guardian"
  | "guardian_phone"
  | "batch"
  | "fee"
  | "joining_date"
  | "address"
  | "notes"
  | "fee_due_date";

export const FIELD_LABELS: Record<ImportField, string> = {
  name: "Name",
  phone: "Phone",
  guardian: "Parent / guardian",
  guardian_phone: "Parent phone",
  batch: "Batch",
  fee: "Monthly fee",
  joining_date: "Joining date",
  address: "Address",
  notes: "Notes",
  fee_due_date: "Fee due date",
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
    "student phone",
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
  guardian_phone: [
    "guardian phone",
    "guardian mobile",
    "guardian number",
    "parent phone",
    "parent mobile",
    "parent number",
    "father phone",
    "father mobile",
    "mother phone",
    "mother mobile",
    "guardian contact",
    "parent contact",
  ],
  batch: ["batch", "batch name", "class", "section", "course", "grade"],
  fee: [
    "fee",
    "fee total",
    "total fee",
    "monthly fee",
    "monthly fees",
    "tuition",
    "tuition fee",
    "amount",
    "fees",
    "course fee",
  ],
  joining_date: [
    "joining date",
    "join date",
    "joined",
    "admission date",
    "doj",
    "start date",
    "joined on",
  ],
  address: ["address", "home address", "house", "location"],
  notes: ["notes", "note", "remarks", "remark", "comments"],
  fee_due_date: ["fee due date", "due date", "fees due", "due on", "next due"],
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
    const cells = row
      .map((c) => (c == null ? "" : String(c).trim()))
      .filter(Boolean);
    if (cells.length < 2) continue;
    let score = 0;
    for (const c of cells) {
      const n = normalizeHeader(c);
      if (!n) continue;
      if (aliasSet.has(n)) score += 3;
      else if (n.length <= 30 && /[a-z]/.test(n)) score += 1;
    }
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
  const normHeaders = headers.map((h) => ({
    raw: h,
    norm: normalizeHeader(h),
  }));
  (Object.keys(FIELD_ALIASES) as ImportField[]).forEach((field) => {
    const aliases = FIELD_ALIASES[field].map(normalizeHeader);
    for (const h of normHeaders) {
      if (used.has(h.raw)) continue;
      if (aliases.includes(h.norm)) {
        out[field] = h.raw;
        used.add(h.raw);
        return;
      }
    }
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

export function parseImportDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return calendarDateISO(v);
  }
  if (typeof v === "number" && !Number.isNaN(v)) {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    if (!Number.isNaN(d.getTime())) return calendarDateISO(d);
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

function pick(
  row: Record<string, unknown>,
  header: string | undefined,
): unknown {
  if (!header) return "";
  const v = row[header];
  return v ?? "";
}

function asTrimmed(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function asNullable(v: unknown, max: number): string | null {
  const s = asTrimmed(v);
  if (!s) return null;
  return s.slice(0, max);
}

// ── Spreadsheet parse ───────────────────────────────────────────────

export function parseSpreadsheetBuffer(
  buf: ArrayBuffer | Uint8Array,
  fileName: string,
): unknown[][] {
  const name = fileName.toLowerCase();
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const wb = name.endsWith(".csv")
    ? XLSX.read(new TextDecoder("utf-8").decode(bytes), {
        type: "string",
        raw: true,
      })
    : XLSX.read(bytes, { type: "array", cellDates: true, raw: true });
  if (!wb.SheetNames.length) return [];
  const sheetName =
    wb.SheetNames.find((s) => /student/i.test(s)) ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    raw: true,
    defval: "",
    blankrows: true,
  });
}

export function workbookToArrayBuffer(wb: XLSX.WorkBook): ArrayBuffer {
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const bytes = out instanceof Uint8Array ? out : new Uint8Array(out);
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
}

export function workbookToBlob(wb: XLSX.WorkBook): Blob {
  return new Blob([workbookToArrayBuffer(wb)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function instructionRows(batchNames: string[] = []): string[][] {
  const batchesBlock: string[][] = batchNames.length
    ? [
        [
          "Your batches (type these names exactly, or a new name to create one)",
        ],
        ...batchNames.map((b) => [b]),
      ]
    : [
        ["Your batches"],
        [
          "None yet. Type a batch name on the Students sheet — Vidya will create it if you can add batches.",
        ],
      ];

  return [
    ["Vidya Orbit — student import"],
    [],
    ["How to fill the Students sheet"],
    ["Column", "Required?", "Format"],
    ["Name", "Yes", "Student's full name"],
    [
      "Batch",
      "No",
      "Must match an existing batch name. If it does not, Vidya will create that batch when you can add batches.",
    ],
    [
      "Phone",
      "Yes, if parent phone is empty",
      "10 digits. Example: 9000000001. +91 is ok.",
    ],
    ["Parent name", "No", "Parent or guardian name"],
    [
      "Parent phone",
      "Yes, if student phone is empty",
      "10 digits. Example: 9000000002.",
    ],
    [
      "Monthly fee",
      "No",
      "Number in rupees, without the ₹ sign. This is the student's fee total.",
    ],
    [
      "Joining date",
      "No",
      "DD-MM-YYYY. Example: 01-06-2025. Leave blank for today.",
    ],
    ["Address", "No", "Home address"],
    ["Notes", "No", "Anything you want to remember"],
    [],
    ["Tips"],
    [
      "Delete the two example rows before you import, or we will try to import them.",
    ],
    ["You can keep your own column titles — we will ask you to match them."],
    ["A student or parent phone is required, same as Add student."],
    [],
    ...batchesBlock,
    [],
    ["മലയാളം"],
    ["•", "Name (പേര്) നിർബന്ധമാണ്."],
    ["•", "ഫോൺ 10 അക്കം. ഉദാ: 9000000001"],
    ["•", "തീയതി: DD-MM-YYYY (01-06-2025)"],
    [
      "•",
      "ബാച്ച് പേര് നിലവിലുള്ളതുമായി ചേരണം. ഇല്ലെങ്കിൽ പുതിയ ബാച്ച് ഉണ്ടാക്കും.",
    ],
  ];
}

export function buildStudentImportWorkbook(
  batchNames: string[] = [],
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const studentAoA: (string | number)[][] = [
    [...TEMPLATE_HEADERS],
    ...TEMPLATE_EXAMPLE_ROWS.map((row) =>
      TEMPLATE_HEADERS.map((h) => row[h] ?? ""),
    ),
  ];
  const studentsWs = XLSX.utils.aoa_to_sheet(studentAoA);
  studentsWs["!cols"] = TEMPLATE_HEADERS.map((h) => ({
    wch: Math.max(16, h.length + 6),
  }));
  XLSX.utils.book_append_sheet(wb, studentsWs, TEMPLATE_SHEET_NAME);

  const instructionsWs = XLSX.utils.aoa_to_sheet(instructionRows(batchNames));
  instructionsWs["!cols"] = [{ wch: 22 }, { wch: 28 }, { wch: 72 }];
  XLSX.utils.book_append_sheet(wb, instructionsWs, INSTRUCTIONS_SHEET_NAME);
  return wb;
}

export function downloadStudentImportWorkbook(batchNames: string[] = []) {
  const blob = workbookToBlob(buildStudentImportWorkbook(batchNames));
  triggerDownload(blob, "vidya-students-import-template.xlsx");
}

// ── Validation helpers ──────────────────────────────────────────────

export function buildExistingIndex(students: Student[]) {
  const byNamePhone = new Map<string, Student>();
  const byName = new Map<string, Student>();
  for (const s of students) {
    if (s.status === "archived") continue;
    const name = s.full_name.trim().toLowerCase();
    const phone = contactPhoneKey(s.phone, s.guardian_phone);
    if (phone) byNamePhone.set(`${name}|${phone}`, s);
    byName.set(name, s);
  }
  return { byNamePhone, byName };
}

export type ExistingIndex = ReturnType<typeof buildExistingIndex>;

function lookupExisting(
  existing: ExistingIndex,
  name: string,
  phone: string | null,
  guardianPhone: string | null,
): Student | undefined {
  const n = name.trim().toLowerCase();
  if (!n) return undefined;
  const p = contactPhoneKey(phone, guardianPhone);
  if (p) return existing.byNamePhone.get(`${n}|${p}`);
  return existing.byName.get(n);
}

function cleanPhone(raw: string | null): string | null {
  if (!raw) return null;
  return isValidImportPhone(raw) ? raw : null;
}

/** Re-validate a single row after inline edit. Returns updated copy. */
export function revalidateRow(
  row: PreparedImportRow,
  ctx: {
    existing: ExistingIndex;
    seenKeys: Map<string, number>;
  },
): PreparedImportRow {
  const name = (row.full_name ?? "").trim();
  const phoneRaw = (row.phone ?? "").trim() || null;
  const guardianPhoneRaw = (row.guardian_phone ?? "").trim() || null;
  let issue: ImportRowIssue = "none";
  const phone = cleanPhone(phoneRaw);
  const guardianPhone = cleanPhone(guardianPhoneRaw);
  let existingStudentId: string | undefined;
  let dupFileRow: number | undefined;

  if (!name || name.length > 120) issue = "invalid_name";
  else {
    const contactIssue = importContactIssue(phoneRaw, guardianPhoneRaw);
    if (contactIssue) issue = contactIssue;
  }

  if (issue === "none") {
    const key = identityKey(name, phone, guardianPhone);
    const first = ctx.seenKeys.get(key);
    if (first !== undefined && first !== row.sourceRow) {
      issue = "dup_file";
      dupFileRow = first;
    } else {
      const match = lookupExisting(ctx.existing, name, phone, guardianPhone);
      if (match) {
        existingStudentId = match.id;
        issue = "dup_db";
      }
    }
  }

  return {
    ...row,
    full_name: name.slice(0, 120),
    phone,
    guardian_phone: guardianPhone,
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
    const nameRaw = asTrimmed(pick(r, m.name));
    const phoneRaw = asTrimmed(pick(r, m.phone));
    const guardian = asNullable(pick(r, m.guardian), 120);
    const guardianPhoneRaw = asNullable(pick(r, m.guardian_phone), 20);
    const feeCell = pick(r, m.fee);
    const feeNum =
      feeCell === "" || feeCell == null
        ? opts.defaultFee
        : Math.max(0, Number(feeCell) || 0);
    const join = parseImportDate(pick(r, m.joining_date));
    const due = parseImportDate(pick(r, m.fee_due_date));
    const address = asNullable(pick(r, m.address), 500);
    const notes = asNullable(pick(r, m.notes), 1000);
    const batchName = asTrimmed(pick(r, m.batch));
    let batchId = opts.defaultBatchId;
    let batchNameRaw: string | null = null;
    if (batchName) {
      const id = opts.batchNameToId.get(batchName.toLowerCase());
      if (id) batchId = id;
      else batchNameRaw = batchName;
    }

    const phone = cleanPhone(phoneRaw || null);
    const guardianPhone = cleanPhone(guardianPhoneRaw);

    let issue: ImportRowIssue = "none";
    if (!nameRaw || nameRaw.length > 120) issue = "invalid_name";
    else {
      const contactIssue = importContactIssue(phoneRaw, guardianPhoneRaw);
      if (contactIssue) issue = contactIssue;
    }

    const key = identityKey(nameRaw, phone, guardianPhone);
    if (issue === "none") {
      const first = fileFirstRowByKey.get(key);
      if (first !== undefined) {
        prepared.push({
          sourceRow,
          full_name: nameRaw.slice(0, 120),
          phone,
          guardian_name: guardian,
          guardian_phone: guardianPhone,
          fee_total: feeNum,
          joining_date: join,
          fee_due_date: due,
          address,
          notes,
          batch_id: batchId,
          batch_name_raw: batchNameRaw,
          issue: "dup_file",
          dupFileRow: first,
        });
        return;
      }
      fileFirstRowByKey.set(key, sourceRow);
    }

    let existingStudentId: string | undefined;
    if (issue === "none") {
      const match = lookupExisting(existing, nameRaw, phone, guardianPhone);
      if (match) {
        existingStudentId = match.id;
        issue = "dup_db";
      }
    }

    prepared.push({
      sourceRow,
      full_name: nameRaw ? nameRaw.slice(0, 120) : "",
      phone,
      guardian_name: guardian,
      guardian_phone: guardianPhone,
      fee_total: feeNum,
      joining_date: join,
      fee_due_date: due,
      address,
      notes,
      batch_id: batchId,
      batch_name_raw: batchNameRaw,
      issue,
      existingStudentId,
    });
  });

  return prepared;
}

/** Flag ready rows that would exceed the plan's remaining seats. */
export function applyPlanLimit(
  rows: PreparedImportRow[],
  remainingSlots: number,
): PreparedImportRow[] {
  if (!Number.isFinite(remainingSlots)) return rows;
  let used = 0;
  return rows.map((r) => {
    if (r.issue !== "none") return r;
    if (used < remainingSlots) {
      used += 1;
      return r;
    }
    return { ...r, issue: "over_limit" as const };
  });
}

export function unknownBatchNames(rows: PreparedImportRow[]): string[] {
  const names = new Set<string>();
  for (const r of rows) {
    if (r.issue !== "none") continue;
    const n = (r.batch_name_raw ?? "").trim();
    if (n) names.add(n);
  }
  return [...names];
}

export function issueLabel(issue: ImportRowIssue): string {
  switch (issue) {
    case "invalid_name":
      return "Missing or invalid name";
    case "invalid_phone":
      return "Phone must be 10 digits";
    case "missing_phone":
      return "Phone or parent phone required";
    case "dup_file":
      return "Duplicate in file";
    case "dup_db":
      return "Already in Vidya";
    case "over_limit":
      return "Over plan limit";
    default:
      return "Ready";
  }
}

export function formatImportSummary(result: {
  inserted: number;
  updated?: number;
  skipped: number;
}): string {
  const parts = [`${result.inserted} imported`];
  if (result.updated) parts.push(`${result.updated} updated`);
  parts.push(`${result.skipped} skipped`);
  return parts.join(", ");
}

export function importOverLimitCopy(opts: {
  planName: string;
  remainingSlots: number;
  readyCount: number;
  willInsert: number;
  overBy: number;
}): string {
  const plan = opts.planName || "this";
  return `Your ${plan} plan only has room for ${opts.remainingSlots} more student${
    opts.remainingSlots === 1 ? "" : "s"
  }. This file has ${opts.readyCount} ready rows — we will import the first ${
    opts.willInsert
  } and skip the remaining ${opts.overBy}. Spark is 100 students, Orbit is 500, Centre is unlimited.`;
}

export function isRejectedIssue(issue: ImportRowIssue): boolean {
  return issue !== "none";
}

export function buildRejectedRowsWorkbook(
  rows: PreparedImportRow[],
): XLSX.WorkBook | null {
  const rejected = rows.filter((r) => isRejectedIssue(r.issue));
  if (!rejected.length) return null;
  const headers = [
    "Source row",
    "Name",
    "Phone",
    "Parent name",
    "Parent phone",
    "Batch",
    "Monthly fee",
    "Joining date",
    "Reason",
  ];
  const aoa: (string | number)[][] = [
    headers,
    ...rejected.map((r) => [
      r.sourceRow,
      r.full_name,
      r.phone ?? "",
      r.guardian_name ?? "",
      r.guardian_phone ?? "",
      r.batch_name_raw ?? "",
      r.fee_total || "",
      r.joining_date ?? "",
      r.issue === "dup_file"
        ? `Duplicate of row ${r.dupFileRow ?? "?"} in this file`
        : issueLabel(r.issue),
    ]),
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, "Skipped rows");
  return wb;
}

/** Download an .xlsx of skipped rows, with a Reason column. */
export async function downloadRejectedRows(rows: PreparedImportRow[]) {
  const wb = buildRejectedRowsWorkbook(rows);
  if (!wb) return;
  triggerDownload(workbookToBlob(wb), "vidya-import-skipped.xlsx");
}
