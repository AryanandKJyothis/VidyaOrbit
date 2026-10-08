import { formatINR } from "@/lib/format";

/**
 * Clearly fake Kerala-style fixtures for landing product previews.
 * Never load these into Supabase. Labelled "Sample data" in the UI.
 */
export const SAMPLE_LABEL = "Sample data";
export const SAMPLE_CENTRE = "Valanchery Science Hub";

export const SAMPLE_BATCHES = [
  {
    id: "b1",
    name: "SSLC Evening",
    timing: "4:30–6:30 pm",
    count: 18,
  },
  {
    id: "b2",
    name: "Plus One Science",
    timing: "7:00–8:30 pm",
    count: 16,
  },
  {
    id: "b3",
    name: "Spoken English",
    timing: "Sat 10–12",
    count: 8,
  },
] as const;

export type SampleFeeStatus = "overdue" | "pending" | "paid";

export const SAMPLE_FEES: {
  id: string;
  name: string;
  batch: string;
  due: string;
  total: number;
  paid: number;
  status: SampleFeeStatus;
}[] = [
  {
    id: "s1",
    name: "Anjali Nair",
    batch: "SSLC Evening",
    due: "28 Sep",
    total: 3500,
    paid: 1000,
    status: "overdue",
  },
  {
    id: "s2",
    name: "Muhammed Rafi",
    batch: "SSLC Evening",
    due: "30 Sep",
    total: 3500,
    paid: 0,
    status: "overdue",
  },
  {
    id: "s3",
    name: "Fathima K",
    batch: "Plus One Science",
    due: "12 Oct",
    total: 4500,
    paid: 1500,
    status: "pending",
  },
  {
    id: "s4",
    name: "Adithyan P",
    batch: "Spoken English",
    due: "5 Oct",
    total: 2000,
    paid: 2000,
    status: "paid",
  },
  {
    id: "s5",
    name: "Sneha Menon",
    batch: "Plus One Science",
    due: "15 Oct",
    total: 4500,
    paid: 0,
    status: "pending",
  },
];

export type SampleAttStatus = "present" | "late" | "absent";

export const SAMPLE_ATTENDANCE: {
  id: string;
  name: string;
  phone: string;
  status: SampleAttStatus;
}[] = [
  { id: "a1", name: "Anjali Nair", phone: "9847××××21", status: "present" },
  { id: "a2", name: "Muhammed Rafi", phone: "9895××××08", status: "present" },
  { id: "a3", name: "Arjun V", phone: "9746××××44", status: "late" },
  { id: "a4", name: "Niveditha S", phone: "9562××××73", status: "absent" },
  { id: "a5", name: "Fathima K", phone: "8129××××16", status: "present" },
];

export const SAMPLE_DASHBOARD = {
  students: 42,
  batches: 3,
  dues: SAMPLE_FEES.filter((r) => r.status !== "paid").reduce(
    (sum, r) => sum + (r.total - r.paid),
    0,
  ),
  overdueCount: SAMPLE_FEES.filter((r) => r.status === "overdue").length,
  attendancePct: 94,
  collectedMonth: 28600,
};

export function sampleBalance(row: (typeof SAMPLE_FEES)[number]): string {
  return formatINR(row.total - row.paid);
}
