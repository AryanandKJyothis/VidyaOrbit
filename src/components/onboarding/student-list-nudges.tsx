import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Phone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatUserError } from "@/lib/format-error";
import { SAMPLE_DATA_ENABLED } from "@/lib/feature-flags";
import { countMissingParentPhones } from "@/lib/onboarding-v2";
import type { Student } from "@/hooks/use-data";

/** Soft nudge for quick-added students with no phone; never blocks anything. */
export function MissingPhonesNudge({ students }: { students: Student[] }) {
  const missing = countMissingParentPhones(students);
  if (missing === 0) return null;
  return (
    <div
      role="status"
      className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      <Phone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>
        Add parent phones later — {missing} student{missing === 1 ? "" : "s"}{" "}
        {missing === 1 ? "has" : "have"} no phone yet, so WhatsApp updates can't
        reach them. Tap ✎ on a student to add one.
        <span lang="ml" className="block text-xs opacity-80">
          രക്ഷിതാക്കളുടെ ഫോൺ നമ്പർ പിന്നീട് ചേർക്കാം.
        </span>
      </span>
    </div>
  );
}

/** Owner-only, flagged: removes onboarding demo students (is_sample = true). */
export function ClearSampleDataButton({ ownerId }: { ownerId: string | null }) {
  const qc = useQueryClient();
  const count = useQuery({
    queryKey: ["sample-students", ownerId],
    enabled: SAMPLE_DATA_ENABLED && !!ownerId,
    queryFn: async () => {
      const { count: n, error } = await supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", ownerId!)
        .eq("is_sample" as never, true as never);
      if (error) throw error;
      return n ?? 0;
    },
  });
  const clear = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("students")
        .delete()
        .eq("owner_id", ownerId!)
        .eq("is_sample" as never, true as never);
      if (error) throw error;
      const { error: bErr } = await supabase
        .from("batches")
        .delete()
        .eq("owner_id", ownerId!)
        .eq("is_sample" as never, true as never);
      if (bErr) throw bErr;
    },
    onSuccess: () => {
      toast.success("Sample data cleared");
      void qc.invalidateQueries({ queryKey: ["students"] });
      void qc.invalidateQueries({ queryKey: ["batches"] });
      void qc.invalidateQueries({ queryKey: ["sample-students"] });
    },
    onError: (e) =>
      toast.error(formatUserError(e, "Could not clear sample data.")),
  });
  if (!SAMPLE_DATA_ENABLED || !count.data) return null;
  return (
    <Button
      variant="outline"
      className="h-11"
      disabled={clear.isPending}
      onClick={() => clear.mutate()}
    >
      <Trash2 className="mr-1.5 h-4 w-4" /> Clear sample data ({count.data})
    </Button>
  );
}
