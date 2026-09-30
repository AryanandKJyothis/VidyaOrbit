import writeXlsxFile, { type SheetData } from "write-excel-file/browser";

type ExportRow = Record<string, string | number | null | undefined>;

export async function exportToExcel(
  rows: ExportRow[],
  fileName: string,
  sheetName = "Sheet1",
) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const data: SheetData = headers.length
    ? [
        headers.map((value) => ({ value, fontWeight: "bold" as const })),
        ...rows.map((row) => headers.map((h) => row[h] ?? "")),
      ]
    : [];
  await downloadWorkbook([{ sheet: sheetName, data }], `${fileName}.xlsx`);
}

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** UTF-8 CSV with BOM for Excel compatibility */
export function exportToCsv(rows: ExportRow[], fileName: string) {
  if (!rows.length) {
    const blob = new Blob(["\ufeff"], { type: "text/csv;charset=utf-8;" });
    triggerDownload(blob, `${fileName}.csv`);
    return;
  }
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(",")),
  ];
  const blob = new Blob([`\ufeff${lines.join("\n")}`], {
    type: "text/csv;charset=utf-8;",
  });
  triggerDownload(blob, `${fileName}.csv`);
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

/** Multi-sheet import template, optionally pre-filled with the institute's batches. */
export async function downloadStudentImportTemplate(batchNames: string[] = []) {
  // Sheet 1 — Students (header + realistic examples)
  const students = [
    {
      Name: "Priya Sharma",
      Phone: "9876543210",
      Guardian: "R. Sharma",
      Batch: batchNames[0] ?? "Morning JEE",
      "Fee total": 24000,
      "Joining date": "01/06/2025",
    },
    {
      Name: "Arjun Menon",
      Phone: "+91 98765 11122",
      Guardian: "Sreeja Menon",
      Batch: batchNames[0] ?? "Morning JEE",
      "Fee total": 18000,
      "Joining date": "15/06/2025",
    },
    {
      Name: "Fathima K",
      Phone: "",
      Guardian: "Abdul K",
      Batch: batchNames[1] ?? batchNames[0] ?? "",
      "Fee total": "",
      "Joining date": "",
    },
  ];
  const studentHeaders = Object.keys(students[0]);
  const studentSheet: SheetData = [
    studentHeaders.map((value) => ({ value, fontWeight: "bold" as const })),
    ...students.map((row) =>
      studentHeaders.map((h) => row[h as keyof typeof row] ?? ""),
    ),
  ];

  // Sheet 2 — Instructions
  const instructions = [
    ["Vidya — Student import template"],
    [],
    ["How to use / എങ്ങനെ ഉപയോഗിക്കാം"],
    [
      "1.",
      "Fill the Students sheet — one row per student. Don't change the header names.",
    ],
    ["2.", "Name is required. Everything else is optional but recommended."],
    [
      "3.",
      "Phone: any of 9876543210, +91 9876543210, 98765-43210 work. Leave blank if unknown.",
    ],
    [
      "4.",
      "Batch must match a name from the 'Your batches' sheet. Unknown batches will use the default batch you pick at import time.",
    ],
    [
      "5.",
      "Joining date: DD/MM/YYYY (01/06/2025) or YYYY-MM-DD. Leave blank for today.",
    ],
    [
      "6.",
      "Fee total: a number in ₹. Leave blank to use the default fee at import time.",
    ],
    [],
    ["മലയാളം"],
    ["•", "Name (പേര്) നിർബന്ധമാണ്."],
    ["•", "Phone ഇല്ലെങ്കിൽ വെറുതെ വിടാം."],
    ["•", "Batch പേര് 'Your batches' ഷീറ്റിൽ ഉള്ളതുപോലെ തന്നെ ടൈപ്പ് ചെയ്യണം."],
    [],
    [
      "The importer also auto-recognises columns like Mobile, Contact, Parent, Class, Tuition, DOJ etc.",
    ],
  ];
  const instructionSheet: SheetData = instructions;

  // Sheet 3 — Your batches (always present; empty if none yet)
  const batchRows: string[][] = [["Batch name"]];
  if (batchNames.length === 0) {
    batchRows.push([
      "(no batches yet — create batches first, then re-download this template)",
    ]);
  } else {
    batchNames.forEach((b) => batchRows.push([b]));
  }
  const batchSheet: SheetData = [
    [{ value: "Batch name", fontWeight: "bold" }],
    ...batchRows.slice(1),
  ];

  await downloadWorkbook(
    [
      { sheet: "Students", data: studentSheet },
      { sheet: "Instructions", data: instructionSheet },
      { sheet: "Your batches", data: batchSheet },
    ],
    "vidya-students-import-template.xlsx",
  );
}

async function downloadWorkbook(
  sheets: Array<{ sheet: string; data: SheetData }>,
  filename: string,
) {
  const blob = await writeXlsxFile(sheets).toBlob();
  triggerDownload(blob, filename);
}
