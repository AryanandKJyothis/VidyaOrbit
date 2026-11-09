import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useBatches,
  useStudents,
  useUpsertStudent,
  type Student,
} from "@/hooks/use-data";
import { useCan } from "@/hooks/use-active-workspace";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatUserError } from "@/lib/format-error";
import { todayISO } from "@/lib/format";
import { isDuplicateStudentName } from "@/lib/onboarding-v2";

export function StudentDialog({
  open,
  onOpenChange,
  student,
  defaultBatchId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  student?: Student;
  /** New students default to the batch the list is filtered by. */
  defaultBatchId?: string;
}) {
  const batches = useBatches();
  const allStudents = useStudents();
  const [showMore, setShowMore] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const mut = useUpsertStudent();
  const canSeeFees = useCan("fees", "read");

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    guardian_name: "",
    guardian_phone: "",
    address: "",
    joining_date: todayISO(),
    status: "active",
    batch_id: "",
    fee_total: "",
    fee_due_date: "",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        full_name: student?.full_name ?? "",
        phone: student?.phone ?? "",
        guardian_name: student?.guardian_name ?? "",
        guardian_phone: student?.guardian_phone ?? "",
        address: student?.address ?? "",
        joining_date: student?.joining_date ?? todayISO(),
        status: student?.status ?? "active",
        batch_id: student ? (student.batch_id ?? "") : (defaultBatchId ?? ""),
        fee_total: student?.fee_total != null ? String(student.fee_total) : "",
        fee_due_date: student?.fee_due_date ?? "",
        notes: student?.notes ?? "",
      });
      setShowMore(!!student);
      setPhoneError(null);
    }
  }, [open, student, defaultBatchId]);

  const duplicateName = isDuplicateStudentName(
    form.full_name,
    (allStudents.data ?? [])
      .filter((s) => s.id !== student?.id && s.status !== "archived")
      .map((s) => s.full_name),
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast.error(
        "Student name is required. Enter the full name as it should appear on receipts.",
      );
      return;
    }
    if (!form.phone.trim() && !form.guardian_phone.trim()) {
      setPhoneError(
        "Add at least one phone number. We need the student's phone or a guardian phone to send receipts and reminders.",
      );
      return;
    }
    try {
      const payload: Parameters<typeof mut.mutateAsync>[0] = {
        id: student?.id,
        full_name: form.full_name.trim(),
        phone: form.phone || null,
        guardian_name: form.guardian_name || null,
        guardian_phone: form.guardian_phone || null,
        address: form.address || null,
        joining_date: form.joining_date,
        status: form.status,
        batch_id: form.batch_id || null,
        notes: form.notes || null,
      };

      // Only include fee fields if user has fees permission
      if (canSeeFees) {
        payload.fee_total = form.fee_total ? Number(form.fee_total) : undefined;
        payload.fee_due_date = form.fee_due_date || null;
      }

      await mut.mutateAsync(payload);
      toast.success(student ? "Student updated" : "Student added");
      onOpenChange(false);
    } catch (e: unknown) {
      const msg = formatUserError(
        e,
        student
          ? "Couldn't update this student. Check your connection and try again."
          : "Couldn't add this student. Check your connection and try again.",
      );
      if (/phone/i.test(msg)) setPhoneError(msg);
      else toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{student ? "Edit student" : "Add student"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={submit}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Full name *</Label>
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
            />
            {duplicateName && (
              <p className="text-xs text-amber-700" role="status">
                A student with this name already exists. Add a surname or class
                to tell them apart.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Phone (student or guardian — one is needed)</Label>
            <Input
              inputMode="tel"
              value={form.phone}
              aria-invalid={!!phoneError}
              onChange={(e) => {
                setPhoneError(null);
                setForm({ ...form, phone: e.target.value });
              }}
            />
            {phoneError && (
              <p className="text-xs text-destructive" role="alert">
                {phoneError}
              </p>
            )}
          </div>
          <div className={`space-y-1.5 ${showMore ? "" : "hidden"}`}>
            <Label>Guardian name (optional)</Label>
            <Input
              value={form.guardian_name}
              onChange={(e) =>
                setForm({ ...form, guardian_name: e.target.value })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Guardian phone (optional)</Label>
            <Input
              value={form.guardian_phone}
              onChange={(e) => {
                setPhoneError(null);
                setForm({ ...form, guardian_phone: e.target.value });
              }}
            />
          </div>
          <div className={`space-y-1.5 ${showMore ? "" : "hidden"}`}>
            <Label>Joining date</Label>
            <Input
              type="date"
              value={form.joining_date}
              onChange={(e) =>
                setForm({ ...form, joining_date: e.target.value })
              }
            />
          </div>
          <div
            className={`space-y-1.5 sm:col-span-2 ${showMore ? "" : "hidden"}`}
          >
            <Label>Address (optional)</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Batch (optional)</Label>
            <Select
              value={form.batch_id || "_none"}
              onValueChange={(v) =>
                setForm({ ...form, batch_id: v === "_none" ? "" : v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select batch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">No batch</SelectItem>
                {(batches.data ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className={`space-y-1.5 ${showMore ? "" : "hidden"}`}>
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => setForm({ ...form, status: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {canSeeFees && (
            <>
              <div className="space-y-1.5">
                <Label>Total fee (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={form.fee_total}
                  onChange={(e) =>
                    setForm({ ...form, fee_total: e.target.value })
                  }
                />
              </div>
              <div className={`space-y-1.5 ${showMore ? "" : "hidden"}`}>
                <Label>Fee due date (optional)</Label>
                <Input
                  type="date"
                  value={form.fee_due_date}
                  onChange={(e) =>
                    setForm({ ...form, fee_due_date: e.target.value })
                  }
                />
              </div>
            </>
          )}
          <div
            className={`space-y-1.5 sm:col-span-2 ${showMore ? "" : "hidden"}`}
          >
            <Label>Notes (optional)</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          {!showMore && (
            <Button
              type="button"
              variant="link"
              className="h-11 justify-start px-0 sm:col-span-2"
              onClick={() => setShowMore(true)}
            >
              More details (guardian, address, notes…)
            </Button>
          )}
          <DialogFooter className="sticky bottom-0 -mx-6 -mb-6 mt-2 border-t bg-background px-6 py-3 sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mut.isPending}>
              {mut.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {student ? "Save changes" : "Add student"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
