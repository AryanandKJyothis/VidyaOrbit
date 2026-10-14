import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import type { Student } from "@/hooks/use-data";
import {
  applyPlanLimit,
  buildRejectedRowsWorkbook,
  buildStudentImportWorkbook,
  detectHeaderRow,
  formatImportSummary,
  guessColumnMapping,
  importContactIssue,
  importOverLimitCopy,
  INSTRUCTIONS_SHEET_NAME,
  isValidImportPhone,
  issueLabel,
  parseImportDate,
  parseSpreadsheetBuffer,
  prepareStudentImportRows,
  rowsFromMatrix,
  TEMPLATE_EXAMPLE_ROWS,
  TEMPLATE_HEADERS,
  TEMPLATE_SHEET_NAME,
  unknownBatchNames,
  workbookToArrayBuffer,
} from "./student-import";

function student(partial: Partial<Student> & { full_name: string }): Student {
  return {
    id: partial.id ?? "s1",
    owner_id: "owner-1",
    full_name: partial.full_name,
    phone: partial.phone ?? null,
    guardian_name: partial.guardian_name ?? null,
    guardian_phone: partial.guardian_phone ?? null,
    address: partial.address ?? null,
    joining_date: partial.joining_date ?? "2025-06-01",
    status: partial.status ?? "active",
    batch_id: partial.batch_id ?? null,
    fee_total: partial.fee_total ?? 0,
    fee_due_date: partial.fee_due_date ?? null,
    notes: partial.notes ?? null,
    created_at: "2025-01-01T00:00:00Z",
  };
}

const defaultOpts = {
  mapping: {
    name: "Name",
    phone: "Phone",
    guardian: "Parent name",
    guardian_phone: "Parent phone",
    batch: "Batch",
    fee: "Monthly fee",
    joining_date: "Joining date",
  },
  defaultBatchId: null as string | null,
  defaultFee: 0,
  batchNameToId: new Map<string, string>(),
  existingStudents: [] as Student[],
};

describe("import contact phone (VO-032)", () => {
  it("allowed a blank phone before the fix", () => {
    const before = (phone: string, guardian: string) => {
      if (phone && !/^[0-9+\-\s()]{6,20}$/.test(phone)) return "invalid_phone";
      return null;
    };
    expect(before("", "")).toBeNull();
  });

  it("rejects import rows with no student or guardian phone", () => {
    expect(importContactIssue(null, null)).toBe("missing_phone");
    expect(importContactIssue("", "")).toBe("missing_phone");
    expect(issueLabel("missing_phone")).toBe("Phone or parent phone required");
  });

  it("accepts a guardian phone when the student phone is blank", () => {
    expect(importContactIssue("", "9876543210")).toBeNull();
  });

  it("rejects a malformed phone when no valid contact exists", () => {
    expect(importContactIssue("12", "")).toBe("invalid_phone");
  });
});

describe("isValidImportPhone", () => {
  it("accepts 10 digits and common +91 / 0 wrappers", () => {
    expect(isValidImportPhone("9000000001")).toBe(true);
    expect(isValidImportPhone("+91 9000000001")).toBe(true);
    expect(isValidImportPhone("09000000001")).toBe(true);
    expect(isValidImportPhone("90000 00001")).toBe(true);
  });

  it("rejects short, empty, or extra-digit numbers", () => {
    expect(isValidImportPhone("")).toBe(false);
    expect(isValidImportPhone("12345")).toBe(false);
    expect(isValidImportPhone("12")).toBe(false);
    expect(isValidImportPhone("900000000")).toBe(false);
    expect(isValidImportPhone("9190000000111")).toBe(false);
  });
});

describe("parseImportDate", () => {
  it("parses DD-MM-YYYY and DD/MM/YYYY", () => {
    expect(parseImportDate("01-06-2025")).toBe("2025-06-01");
    expect(parseImportDate("15/06/2025")).toBe("2025-06-15");
    expect(parseImportDate("1.6.2025")).toBe("2025-06-01");
  });

  it("parses ISO and Excel serial dates", () => {
    expect(parseImportDate("2025-06-01")).toBe("2025-06-01");
    expect(parseImportDate(45809)).toBe("2025-06-01");
    expect(parseImportDate(new Date("2025-06-15T00:00:00Z"))).toBe(
      "2025-06-15",
    );
  });

  it("returns null for blanks and junk", () => {
    expect(parseImportDate("")).toBeNull();
    expect(parseImportDate(null)).toBeNull();
    expect(parseImportDate("next week")).toBeNull();
  });
});

describe("header detection and mapping", () => {
  it("skips a title row and finds Students headers", () => {
    const matrix = [
      ["Vidya Orbit student list"],
      [],
      [...TEMPLATE_HEADERS],
      ["Example Student One", "Example Batch", "9000000001"],
    ];
    expect(detectHeaderRow(matrix)).toBe(2);
    const { headers, rows } = rowsFromMatrix(matrix, 2);
    expect(headers[0]).toBe("Name");
    expect(rows).toHaveLength(1);
    expect(rows[0].Name).toBe("Example Student One");
  });

  it("maps template headers including monthly fee and parent phone", () => {
    const mapping = guessColumnMapping([...TEMPLATE_HEADERS]);
    expect(mapping.name).toBe("Name");
    expect(mapping.batch).toBe("Batch");
    expect(mapping.phone).toBe("Phone");
    expect(mapping.guardian).toBe("Parent name");
    expect(mapping.guardian_phone).toBe("Parent phone");
    expect(mapping.fee).toBe("Monthly fee");
    expect(mapping.joining_date).toBe("Joining date");
    expect(mapping.address).toBe("Address");
    expect(mapping.notes).toBe("Notes");
  });

  it("maps common aliases from centre spreadsheets", () => {
    const mapping = guessColumnMapping([
      "Student name",
      "Mobile",
      "Parent",
      "Parent mobile",
      "Class",
      "Tuition",
      "DOJ",
    ]);
    expect(mapping.name).toBe("Student name");
    expect(mapping.phone).toBe("Mobile");
    expect(mapping.guardian).toBe("Parent");
    expect(mapping.guardian_phone).toBe("Parent mobile");
    expect(mapping.batch).toBe("Class");
    expect(mapping.fee).toBe("Tuition");
    expect(mapping.joining_date).toBe("DOJ");
  });
});

describe("prepareStudentImportRows", () => {
  it("flags missing name, bad phone, and file duplicates by name and phone", () => {
    const rows = prepareStudentImportRows(
      [
        {
          Name: "",
          Phone: "9000000001",
          "Parent name": "",
          "Parent phone": "",
          Batch: "",
          "Monthly fee": "",
          "Joining date": "",
        },
        {
          Name: "Asha",
          Phone: "12",
          "Parent name": "",
          "Parent phone": "",
          Batch: "",
          "Monthly fee": "",
          "Joining date": "",
        },
        {
          Name: "Example Student One",
          Phone: "9000000001",
          "Parent name": "Parent",
          "Parent phone": "",
          Batch: "Morning",
          "Monthly fee": 1000,
          "Joining date": "01-06-2025",
        },
        {
          Name: "Example Student One",
          Phone: "9000000001",
          "Parent name": "Parent",
          "Parent phone": "",
          Batch: "Morning",
          "Monthly fee": 1000,
          "Joining date": "01-06-2025",
        },
      ],
      defaultOpts,
    );
    expect(rows[0].issue).toBe("invalid_name");
    expect(rows[1].issue).toBe("invalid_phone");
    expect(rows[2].issue).toBe("none");
    expect(rows[2].joining_date).toBe("2025-06-01");
    expect(rows[3].issue).toBe("dup_file");
    expect(rows[3].dupFileRow).toBe(4);
  });

  it("does not treat the same phone with a different name as a file duplicate", () => {
    const rows = prepareStudentImportRows(
      [
        {
          Name: "Asha",
          Phone: "9000000001",
          "Parent name": "",
          "Parent phone": "",
        },
        {
          Name: "Ravi",
          Phone: "9000000001",
          "Parent name": "",
          "Parent phone": "",
        },
      ],
      defaultOpts,
    );
    expect(rows.map((r) => r.issue)).toEqual(["none", "none"]);
  });

  it("flags existing students by name and phone, not phone alone", () => {
    const existing = [
      student({
        id: "existing",
        full_name: "Asha Nair",
        phone: "9000000001",
      }),
    ];
    const rows = prepareStudentImportRows(
      [
        {
          Name: "Asha Nair",
          Phone: "9000000001",
          "Parent name": "",
          "Parent phone": "",
        },
        {
          Name: "Different Person",
          Phone: "9000000001",
          "Parent name": "",
          "Parent phone": "",
        },
      ],
      { ...defaultOpts, existingStudents: existing },
    );
    expect(rows[0].issue).toBe("dup_db");
    expect(rows[0].existingStudentId).toBe("existing");
    expect(rows[1].issue).toBe("none");
  });

  it("keeps unknown batch names so they can be created", () => {
    const rows = prepareStudentImportRows(
      [
        {
          Name: "Asha",
          Phone: "9000000001",
          Batch: "New Evening",
        },
      ],
      {
        ...defaultOpts,
        batchNameToId: new Map([["morning jee", "b1"]]),
      },
    );
    expect(rows[0].batch_id).toBeNull();
    expect(rows[0].batch_name_raw).toBe("New Evening");
    expect(unknownBatchNames(rows)).toEqual(["New Evening"]);
  });

  it("validates 1,000+ rows without dropping the last ones", () => {
    const raw = Array.from({ length: 1200 }, (_, i) => ({
      Name: `Student ${i + 1}`,
      Phone: String(9000000000 + i).slice(0, 10),
      "Parent name": `Parent ${i + 1}`,
      "Parent phone": "",
      Batch: "Morning",
      "Monthly fee": 500,
      "Joining date": "01-06-2025",
    }));
    const rows = prepareStudentImportRows(raw, defaultOpts);
    expect(rows).toHaveLength(1200);
    expect(rows.every((r) => r.issue === "none")).toBe(true);
    expect(rows[1199].full_name).toBe("Student 1200");
  });
});

describe("plan limit and summary", () => {
  it("marks extra ready rows as over_limit", () => {
    const ready = prepareStudentImportRows(
      [
        { Name: "A", Phone: "9000000001" },
        { Name: "B", Phone: "9000000002" },
        { Name: "C", Phone: "9000000003" },
      ],
      defaultOpts,
    );
    const capped = applyPlanLimit(ready, 2);
    expect(capped.map((r) => r.issue)).toEqual(["none", "none", "over_limit"]);
    expect(issueLabel("over_limit")).toBe("Over plan limit");
  });

  it("does not cap unlimited remaining slots", () => {
    const ready = prepareStudentImportRows(
      [{ Name: "A", Phone: "9000000001" }],
      defaultOpts,
    );
    expect(applyPlanLimit(ready, Infinity)[0].issue).toBe("none");
  });

  it("formats the import summary and over-limit copy", () => {
    expect(formatImportSummary({ inserted: 952, skipped: 8 })).toBe(
      "952 imported, 8 skipped",
    );
    expect(formatImportSummary({ inserted: 952, updated: 3, skipped: 8 })).toBe(
      "952 imported, 3 updated, 8 skipped",
    );
    const copy = importOverLimitCopy({
      planName: "Starter",
      remainingSlots: 5,
      readyCount: 20,
      willInsert: 5,
      overBy: 15,
    });
    expect(copy).toContain("Starter");
    expect(copy).toContain("5");
    expect(copy).toContain("Growth is 500");
    expect(copy).toContain("Large is unlimited");
  });
});

describe("Excel template and error report", () => {
  it("builds a Students sheet with the real fields and two fake rows", () => {
    const wb = buildStudentImportWorkbook(["Morning JEE"]);
    expect(wb.SheetNames).toEqual([
      TEMPLATE_SHEET_NAME,
      INSTRUCTIONS_SHEET_NAME,
    ]);
    const students = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      wb.Sheets[TEMPLATE_SHEET_NAME],
    );
    expect(Object.keys(students[0])).toEqual([...TEMPLATE_HEADERS]);
    expect(students).toHaveLength(2);
    expect(students[0].Name).toBe("Example Student One");
    expect(students[1].Name).toBe("Example Student Two");
    expect(TEMPLATE_EXAMPLE_ROWS).toHaveLength(2);
  });

  it("explains 10-digit phones, DD-MM-YYYY dates, and batch creation", () => {
    const wb = buildStudentImportWorkbook(["Morning JEE"]);
    const text = XLSX.utils
      .sheet_to_csv(wb.Sheets[INSTRUCTIONS_SHEET_NAME])
      .toLowerCase();
    expect(text).toContain("10 digits");
    expect(text).toContain("dd-mm-yyyy");
    expect(text).toContain("create that batch");
    expect(text).toContain("morning jee");
  });

  it("round-trips the template through the spreadsheet parser", () => {
    const buf = workbookToArrayBuffer(buildStudentImportWorkbook());
    const matrix = parseSpreadsheetBuffer(buf, "template.xlsx");
    const headerRow = detectHeaderRow(matrix);
    const { headers, rows } = rowsFromMatrix(matrix, headerRow);
    const mapping = guessColumnMapping(headers);
    const prepared = prepareStudentImportRows(rows, {
      ...defaultOpts,
      mapping,
    });
    expect(prepared).toHaveLength(2);
    expect(prepared.every((r) => r.issue === "none")).toBe(true);
    expect(prepared[0].full_name).toBe("Example Student One");
    expect(prepared[0].joining_date).toBe("2025-06-01");
    expect(prepared[0].batch_name_raw).toBe("Example Batch");
  });

  it("parses CSV with the same validator", () => {
    const csv = [
      "Name,Phone,Parent name,Parent phone,Batch,Monthly fee,Joining date",
      "Asha,9000000001,Ravi,9000000002,Morning,1000,01-06-2025",
      ",9000000003,,,,,",
    ].join("\n");
    const buf = new TextEncoder().encode(csv).buffer;
    const matrix = parseSpreadsheetBuffer(buf, "students.csv");
    const { headers, rows } = rowsFromMatrix(matrix, detectHeaderRow(matrix));
    const prepared = prepareStudentImportRows(rows, {
      ...defaultOpts,
      mapping: guessColumnMapping(headers),
    });
    expect(prepared).toHaveLength(2);
    expect(prepared[0].issue).toBe("none");
    expect(prepared[1].issue).toBe("invalid_name");
  });

  it("builds an error report with a Reason column", () => {
    const prepared = prepareStudentImportRows(
      [
        { Name: "", Phone: "9000000001" },
        { Name: "Asha", Phone: "12" },
      ],
      defaultOpts,
    );
    const wb = buildRejectedRowsWorkbook(prepared);
    expect(wb).not.toBeNull();
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(
      wb!.Sheets["Skipped rows"],
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].Reason).toBe("Missing or invalid name");
    expect(rows[1].Reason).toBe("Phone must be 10 digits");
  });
});
