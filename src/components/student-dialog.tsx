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
import { useBatches, useUpsertStudent, type Student } from "@/hooks/use-data";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatUserError } from "@/lib/format-error";

export function StudentDialog({
  open,
  onOpenChange,
  student,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  student?: Student;
}) {
  const batches = useBatches();
  const mut = useUpsertStudent();
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    guardian_name: "",
    guardian_phone: "",
    address: "",
    joining_date: new Date().toISOString().slice(0, 10),
    status: "active",
    batch_id: "",
    fee_total: "0",
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
        joining_date: student?.joining_date ?? new Date().toISOString().slice(0, 10),
        status: student?.status ?? "active",
        batch_id: student?.batch_id ?? "",
        fee_total: String(student?.fee_total ?? 0),
        fee_due_date: student?.fee_due_date ?? "",
        notes: student?.notes ?? "",
      });
    }
  }, [open, student]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) return toast.error("Name is required");
    try {
      await mut.mutateAsync({
        id: student?.id,
        full_name: form.full_name.trim(),
        phone: form.phone || null,
        guardian_name: form.guardian_name || null,
        guardian_phone: form.guardian_phone || null,
        address: form.address || null,
        joining_date: form.joining_date,
        status: form.status,
        batch_id: form.batch_id || null,
        fee_total: Number(form.fee_total) || 0,
        fee_due_date: form.fee_due_date || null,
        notes: form.notes || null,
      });
      toast.success(student ? "Student updated" : "Student added");
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(formatUserError(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{student ? "Edit student" : "Add student"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Full name *</Label>
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Phone (optional if guardian phone is set)</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Guardian name (optional)</Label>
            <Input
              value={form.guardian_name}
              onChange={(e) => setForm({ ...form, guardian_name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Guardian phone (optional)</Label>
            <Input
              value={form.guardian_phone}
              onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Joining date</Label>
            <Input
              type="date"
              value={form.joining_date}
              onChange={(e) => setForm({ ...form, joining_date: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
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
              onValueChange={(v) => setForm({ ...form, batch_id: v === "_none" ? "" : v })}
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
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
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
          <div className="space-y-1.5">
            <Label>Total fee (₹)</Label>
            <Input
              type="number"
              min="0"
              step="1"
              value={form.fee_total}
              onChange={(e) => setForm({ ...form, fee_total: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Fee due date (optional)</Label>
            <Input
              type="date"
              value={form.fee_due_date}
              onChange={(e) => setForm({ ...form, fee_due_date: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Notes (optional)</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <DialogFooter className="sm:col-span-2 mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mut.isPending}>
              {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {student ? "Save changes" : "Add student"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
