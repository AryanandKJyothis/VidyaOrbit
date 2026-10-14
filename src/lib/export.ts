import writeXlsxFile, { type SheetData } from "write-excel-file/browser";
import { downloadStudentImportWorkbook } from "@/lib/student-import";

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

/** Multi-sheet import template generated with SheetJS. */
export async function downloadStudentImportTemplate(batchNames: string[] = []) {
  downloadStudentImportWorkbook(batchNames);
}

async function downloadWorkbook(
  sheets: Array<{ sheet: string; data: SheetData }>,
  filename: string,
) {
  const blob = await writeXlsxFile(sheets).toBlob();
  triggerDownload(blob, filename);
}
