import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import {
  studentSchema,
  studentSchemaWithPhone,
  batchSchema,
  paymentSchema,
  instituteSchema,
} from "@/lib/validation";

export type Student = {
  id: string;
  owner_id: string;
  full_name: string;
  phone: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  address: string | null;
  joining_date: string;
  status: string;
  batch_id: string | null;
  fee_total: number;
  fee_due_date: string | null;
  notes: string | null;
  created_at: string;
};

export type Batch = {
  id: string;
  owner_id: string;
  name: string;
  subject: string | null;
  teacher_name: string | null;
  timing: string | null;
  days_of_week: string[];
  capacity: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
};

export type Payment = {
  id: string;
  owner_id: string;
  student_id: string;
  amount: number;
  payment_date: string;
  method: string;
  reference: string | null;
  notes: string | null;
  receipt_number: string | null;
  created_at: string;
};

export type Institute = {
  id: string;
  owner_id: string;
  name: string;
  logo_url: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  address: string | null;
  receipt_prefix: string;
  receipt_footer: string | null;
  currency: string;
  timezone: string;
};

// All data access is scoped to the ACTIVE workspace's owner_id so that
// members never accidentally read or write into their personal workspace
// when they're operating inside someone else's. The server-side RLS still
// enforces permissions; this prevents the client from sending the wrong
// owner_id and bypassing the read/write permission check.
function useOwnerId() {
  const { active } = useActiveWorkspace();
  return active?.ownerId ?? null;
}

// Read in bounded pages so Supabase's response cap can never silently truncate
// a growing institute. Callers still receive the same array-shaped API.
const PAGE_SIZE = 1000;
async function fetchAllRows<T>(buildQuery: (from: number, to: number) => any): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

export function useStudents() {
  const ownerId = useOwnerId();

  return useQuery({
    queryKey: ["students", ownerId],
    enabled: !!ownerId,
    staleTime: 60_000,
    queryFn: async () => {
      // All users (owners and staff) query via students_gated view
      // View handles permission gating: shows fee columns only to fees:read+ users
      return fetchAllRows<Student>((from, to) =>
        supabase
          .from("students_gated" as "students")
          .select("*")
          .eq("owner_id", ownerId!)
          .order("created_at", { ascending: false })
          .range(from, to),
      );
    },
  });
}

export function useStudent(id: string | undefined) {
  const ownerId = useOwnerId();

  return useQuery({
    queryKey: ["student", id, ownerId],
    enabled: !!id && !!ownerId,
    staleTime: 30_000,
    queryFn: async () => {
      // All users query via students_gated view
      const { data, error } = await supabase
        .from("students_gated" as "students")
        .select("*")
        .eq("id", id!)
        .eq("owner_id", ownerId!)
        .single();

      if (error) throw error;
      return data as Student;
    },
  });
}

export function useBatches() {
  const ownerId = useOwnerId();
  return useQuery({
    queryKey: ["batches", ownerId],
    enabled: !!ownerId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      return fetchAllRows<Batch>((from, to) =>
        supabase
          .from("batches")
          .select("*")
          .eq("owner_id", ownerId!)
          .order("created_at", { ascending: false })
          .range(from, to),
      );
    },
  });
}

export function usePayments(studentId?: string) {
  const ownerId = useOwnerId();
  return useQuery({
    queryKey: ["payments", studentId ?? "all", ownerId],
    enabled: !!ownerId,
    staleTime: 30_000,
    queryFn: async () => {
      return fetchAllRows<Payment>((from, to) => {
        let q = supabase
          .from("fee_payments")
          .select("*")
          .eq("owner_id", ownerId!)
          .order("payment_date", { ascending: false })
          .range(from, to);
        if (studentId) q = q.eq("student_id", studentId);
        return q;
      });
    },
  });
}

export function useInstitute() {
  const ownerId = useOwnerId();
  return useQuery({
    queryKey: ["institute", ownerId],
    enabled: !!ownerId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("institutes")
        .select(
          "id, owner_id, name, logo_url, contact_phone, contact_email, address, receipt_prefix, receipt_footer, currency, timezone",
        )
        .eq("owner_id", ownerId!)
        .maybeSingle();
      if (error) throw error;
      return data as Institute | null;
    },
  });
}

export function useUpsertStudent() {
  const qc = useQueryClient();
  const ownerId = useOwnerId();
  return useMutation({
    mutationFn: async (s: Partial<Student> & { id?: string }) => {
      if (!ownerId) throw new Error("No active workspace selected");
      const { id, ...rest } = s;
      const validated = studentSchemaWithPhone.parse(rest);
      // Prevent zod from re-adding fee fields that weren't in the original input
      // This prevents staff edits from wiping fee_due_date or fee_total
      const payload: Record<string, unknown> = {
        ...validated,
        owner_id: ownerId,
      };
      if (!("fee_due_date" in rest)) delete payload.fee_due_date;
      if (!("fee_total" in rest)) delete payload.fee_total;
      if (id) {
        const { error } = await supabase
          .from("students")
          .update(payload as never)
          .eq("id", id)
          .eq("owner_id", ownerId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("students")
          .insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["students"] });
    },
  });
}

export function useUpsertBatch() {
  const qc = useQueryClient();
  const ownerId = useOwnerId();
  return useMutation({
    mutationFn: async (b: Partial<Batch> & { id?: string }) => {
      if (!ownerId) throw new Error("No active workspace selected");
      const { id, ...rest } = b;
      const validated = batchSchema.parse(rest);
      const payload = { ...validated, owner_id: ownerId };
      if (id) {
        const { error } = await supabase
          .from("batches")
          .update(payload)
          .eq("id", id)
          .eq("owner_id", ownerId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("batches")
          .insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batches"] });
    },
  });
}

export function useAddPayment() {
  const qc = useQueryClient();
  const ownerId = useOwnerId();
  return useMutation({
    mutationFn: async (p: Partial<Payment>) => {
      if (!ownerId) throw new Error("No active workspace selected");
      const validated = paymentSchema.parse({
        student_id: p.student_id,
        amount: typeof p.amount === "number" ? p.amount : Number(p.amount),
        payment_date: p.payment_date,
        method: p.method,
        reference: p.reference ?? null,
        notes: p.notes ?? null,
      });
      const { data, error } = await supabase
        .from("fee_payments")
        .insert({ ...validated, owner_id: ownerId } as never)
        .select()
        .single();
      if (error) throw error;
      return data as Payment;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["students"] });
    },
  });
}

export function useUpdateInstitute() {
  const qc = useQueryClient();
  const ownerId = useOwnerId();
  return useMutation({
    mutationFn: async (i: Partial<Institute>) => {
      if (!ownerId) throw new Error("No active workspace selected");
      const validated = instituteSchema.partial().parse(i);
      const { error } = await supabase
        .from("institutes")
        .update(validated)
        .eq("owner_id", ownerId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["institute"] });
    },
  });
}
