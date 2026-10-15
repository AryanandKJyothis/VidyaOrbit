import { GraduationCap } from "lucide-react";
import { formatDate, formatINR } from "@/lib/format";
import type { PublicReceipt } from "@/lib/share-links";

export function ReceiptDocument({ receipt }: { receipt: PublicReceipt }) {
  return (
    <div className="print-card relative overflow-hidden rounded-2xl border border-border bg-card p-8 shadow-sm sm:p-10">
      <div
        aria-hidden
        className="pointer-events-none absolute right-6 top-24 rotate-[-18deg] rounded-md border-2 border-primary/40 px-4 py-1 font-display text-2xl font-bold uppercase tracking-[0.2em] text-primary/50"
      >
        Paid
      </div>

      <div className="flex items-start justify-between gap-4 border-b border-border pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold leading-tight">
              {receipt.centre_name || "Centre"}
            </h1>
            <p className="text-xs text-muted-foreground">Fee receipt</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Receipt
          </div>
          <div className="mt-1 font-mono text-sm">
            {receipt.receipt_number ?? "—"}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatDate(receipt.payment_date)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 py-6">
        <Field label="Student">{receipt.student_name}</Field>
        <Field label="Period">{receipt.period || "—"}</Field>
        <Field label="Payment mode">
          {receipt.payment_mode ? receipt.payment_mode.toUpperCase() : "—"}
        </Field>
        <Field label="Date">{formatDate(receipt.payment_date)}</Field>
      </div>

      <div className="rounded-xl bg-primary-soft p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">Amount paid</div>
          <div className="font-display text-3xl font-semibold text-primary">
            {formatINR(Number(receipt.amount))}
          </div>
        </div>
        <p className="mt-2 text-xs font-medium uppercase tracking-wider text-primary">
          {receipt.status}
        </p>
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Thank you for your payment.
      </p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 font-medium">{children}</div>
    </div>
  );
}
