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

// Supabase caps a single response at 1000 rows by default. Lift it explicitly
// so growing institutes don't silently lose data; pair with staleTime so the
// browser stops re-hammering the API when navigating between screens.
const ROW_LIMIT = 5000;

export function useStudents() {
  const ownerId = useOwnerId();
  const { active } = useActiveWorkspace();
  const isOwner = active?.role === "owner";

  return useQuery({
    queryKey: ["students", ownerId],
    enabled: !!ownerId,
    staleTime: 60_000,
    queryFn: async () => {
      // Owners query the students table directly (faster, no permission check)
      // Non-owners try students_gated view first (hides fee amounts for non-fees members)
      // If view doesn't exist yet, fall back to students table (fee columns hidden in UI anyway)
      let table: "students" = "students";
      if (!isOwner) {
        table = "students_gated" as "students";
      }
      
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("owner_id", ownerId!)
        .order("created_at", { ascending: false })
        .limit(ROW_LIMIT);
      
      // Fallback: if students_gated doesn't exist, retry with students table
      if (error && !isOwner && error.message?.includes("does not exist")) {
        const fallback = await supabase
          .from("students")
          .select("*")
          .eq("owner_id", ownerId!)
          .order("created_at", { ascending: false })
          .limit(ROW_LIMIT);
        if (fallback.error) throw fallback.error;
        return fallback.data as Student[];
      }
      
      if (error) throw error;
      return data as Student[];
    },
  });
}

export function useStudent(id: string | undefined) {
  const ownerId = useOwnerId();
  const { active } = useActiveWorkspace();
  const isOwner = active?.role === "owner";

  return useQuery({
    queryKey: ["student", id, ownerId],
    enabled: !!id && !!ownerId,
    staleTime: 30_000,
    queryFn: async () => {
      let table: "students" = "students";
      if (!isOwner) {
        table = "students_gated" as "students";
      }
      
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("id", id!)
        .eq("owner_id", ownerId!)
        .single();
      
      // Fallback: if students_gated doesn't exist, retry with students table
      if (error && !isOwner && error.message?.includes("does not exist")) {
        const fallback = await supabase
          .from("students")
          .select("*")
          .eq("id", id!)
          .eq("owner_id", ownerId!)
          .single();
        if (fallback.error) throw fallback.error;
        return fallback.data as Student;
      }
      
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
      const { data, error } = await supabase
        .from("batches")
        .select("*")
        .eq("owner_id", ownerId!)
        .order("created_at", { ascending: false })
        .limit(ROW_LIMIT);
      if (error) throw error;
      return data as Batch[];
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
      let q = supabase
        .from("fee_payments")
        .select("*")
        .eq("owner_id", ownerId!)
        .order("payment_date", { ascending: false })
        .limit(ROW_LIMIT);
      if (studentId) q = q.eq("student_id", studentId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Payment[];
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
      const payload = { ...validated, owner_id: ownerId };
      if (id) {
        const { error } = await supabase
          .from("students")
          .update(payload)
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
