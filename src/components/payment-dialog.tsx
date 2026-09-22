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
import { useStudents, useAddPayment } from "@/hooks/use-data";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatUserError } from "@/lib/format-error";
import { useNavigate } from "@tanstack/react-router";

export function PaymentDialog({
  open,
  onOpenChange,
  defaultStudentId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultStudentId?: string;
}) {
  const students = useStudents();
  const mut = useAddPayment();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    student_id: defaultStudentId ?? "",
    amount: "",
    payment_date: new Date().toISOString().slice(0, 10),
    method: "cash",
    reference: "",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        student_id: defaultStudentId ?? "",
        amount: "",
        payment_date: new Date().toISOString().slice(0, 10),
        method: "cash",
        reference: "",
        notes: "",
      });
    }
  }, [open, defaultStudentId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.student_id) return toast.error("Pick a student");
    const amt = Number(form.amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    try {
      const p = await mut.mutateAsync({
        student_id: form.student_id,
        amount: amt,
        payment_date: form.payment_date,
        method: form.method,
        reference: form.reference || null,
        notes: form.notes || null,
      });
      toast.success("Payment recorded");
      onOpenChange(false);
      navigate({ to: "/receipts/$paymentId", params: { paymentId: p.id } });
    } catch (error: unknown) {
      toast.error(formatUserError(error, "Could not record payment. Please try again."));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record fee payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Student *</Label>
            <Select
              value={form.student_id}
              onValueChange={(v) => setForm({ ...form, student_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select student" />
              </SelectTrigger>
              <SelectContent>
                {(students.data ?? [])
                  .filter((s) => s.status !== "archived")
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount (₹) *</Label>
              <Input
                type="number"
                min="1"
                step="1"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.payment_date}
                onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="bank">Bank transfer</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Reference (optional)</Label>
              <Input
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
                placeholder="UPI ref, cheque no."
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mut.isPending}>
              {mut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record &amp; generate receipt
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
