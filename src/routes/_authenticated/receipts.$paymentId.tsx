import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Printer,
  GraduationCap,
  Receipt,
  MessageCircle,
  Ban,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { RoutePermissionGate } from "@/components/route-permission-gate";
import { supabase } from "@/integrations/supabase/client";
import {
  useInstitute,
  useStudent,
  usePayments,
  useBatches,
} from "@/hooks/use-data";
import { formatINR, formatDate } from "@/lib/format";
import { buildReceiptShare, openWhatsApp } from "@/lib/fee-reminder";
import { formatUserError } from "@/lib/format-error";
import { publicReceiptUrl } from "@/lib/share-links";
import { toast } from "sonner";
import { useActiveWorkspace, useCan } from "@/hooks/use-active-workspace";

export const Route = createFileRoute("/_authenticated/receipts/$paymentId")({
  component: ReceiptPage,
});

function ReceiptPage() {
  return (
    <RoutePermissionGate resource="fees" level="read">
      <ReceiptPageContent />
    </RoutePermissionGate>
  );
}

function ReceiptPageContent() {
  const { paymentId } = useParams({
    from: "/_authenticated/receipts/$paymentId",
  });
  const { active } = useActiveWorkspace();
  const canWriteFees = useCan("fees", "write");
  const qc = useQueryClient();
  const payment = useQuery({
    queryKey: ["payment", paymentId, active?.ownerId],
    enabled: !!active?.ownerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fee_payments")
        .select("*")
        .eq("id", paymentId)
        .eq("owner_id", active!.ownerId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const student = useStudent(payment.data?.student_id);
  const studentPayments = usePayments(payment.data?.student_id);
  const inst = useInstitute();
  const batches = useBatches();
  const batchName = batches.data?.find(
    (b) => b.id === student.data?.batch_id,
  )?.name;
  const share = useQuery({
    queryKey: ["receipt-share", paymentId, active?.ownerId],
    enabled: !!paymentId && !!active?.ownerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("receipt_shares")
        .select("share_token, revoked_at")
        .eq("payment_id", paymentId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const ensureShare = useMutation({
    mutationFn: async (mode: "issue" | "revoke" | "regenerate") => {
      const fn =
        mode === "revoke"
          ? "revoke_receipt_share"
          : mode === "regenerate"
            ? "regenerate_receipt_share"
            : "issue_receipt_share";
      const { data, error } = await supabase.rpc(fn, {
        _payment_id: paymentId,
      });
      if (error) throw error;
      return data as { ok?: boolean; token?: string; revoked?: boolean };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["receipt-share", paymentId] });
    },
  });

  const shareToken = share.data?.share_token;
  const shareRevoked = !!share.data?.revoked_at;
  const receiptUrl = shareToken
    ? publicReceiptUrl(shareToken, window.location.origin)
    : null;

  if (payment.isLoading || student.isLoading)
    return <Skeleton className="h-96" />;

  if (payment.isError || !payment.data || student.isError || !student.data) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Receipt not found</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              This receipt doesn't exist or isn't visible to you.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/fees">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to fees
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const p = payment.data;
  const s = student.data;
  const i = inst.data;

  // Calculate remaining dues using payments up to and including this one
  const paidIncludingThis = (studentPayments.data ?? [])
    .filter(
      (x) =>
        x.payment_date < p.payment_date ||
        (x.payment_date === p.payment_date && x.created_at <= p.created_at),
    )
    .reduce((sum, x) => sum + Number(x.amount), 0);
  const remaining = Math.max(0, Number(s.fee_total) - paidIncludingThis);

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/students/$id" params={{ id: s.id }}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to student
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              let url = receiptUrl;
              if (!url && canWriteFees) {
                try {
                  const issued = await ensureShare.mutateAsync("issue");
                  if (issued?.token) {
                    url = publicReceiptUrl(
                      issued.token,
                      window.location.origin,
                    );
                  }
                } catch (e) {
                  toast.error(formatUserError(e));
                  return;
                }
              }
              const draft = buildReceiptShare({
                centreName: i?.name ?? "your centre",
                studentName: s.full_name,
                guardianPhone: s.guardian_phone,
                studentPhone: s.phone,
                amount: Number(p.amount),
                receiptNumber: p.receipt_number,
                receiptUrl: shareRevoked ? null : url,
              });
              if (!draft.href) {
                toast.error(
                  "Add a guardian or student phone to share this receipt.",
                );
                return;
              }
              if (!openWhatsApp(draft.href)) {
                toast.error("Allow pop-ups to open WhatsApp.");
              }
            }}
          >
            <MessageCircle className="mr-1.5 h-4 w-4" /> Share on WhatsApp
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="mr-1.5 h-4 w-4" /> Print / Save PDF
          </Button>
          {canWriteFees && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  void ensureShare
                    .mutateAsync("regenerate")
                    .then(() => toast.success("New receipt link ready."))
                    .catch((e) => toast.error(formatUserError(e)))
                }
              >
                <RefreshCw className="mr-1.5 h-4 w-4" /> New link
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  void ensureShare
                    .mutateAsync("revoke")
                    .then(() => toast.success("Receipt link turned off."))
                    .catch((e) => toast.error(formatUserError(e)))
                }
              >
                <Ban className="mr-1.5 h-4 w-4" /> Turn off link
              </Button>
            </>
          )}
        </div>
      </div>

      {shareRevoked && (
        <p className="no-print mb-3 text-sm text-muted-foreground">
          The public link is off. Make a new one if the parent still needs it.
        </p>
      )}

      <div className="print-root print-area mx-auto max-w-2xl rounded-2xl border border-border bg-card p-8 shadow-sm sm:p-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border pb-6">
          <div className="flex items-center gap-3">
            {i?.logo_url ? (
              <img
                src={i.logo_url}
                alt={i?.name ?? "Logo"}
                className="h-12 w-12 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <GraduationCap className="h-6 w-6" />
              </div>
            )}
            <div>
              <h1 className="font-display text-xl font-semibold leading-tight">
                {i?.name ?? "My Institute"}
              </h1>
              {i?.address && (
                <p className="text-xs text-muted-foreground">{i.address}</p>
              )}
              {(i?.contact_phone || i?.contact_email) && (
                <p className="text-xs text-muted-foreground">
                  {i?.contact_phone}
                  {i?.contact_phone && i?.contact_email && " · "}
                  {i?.contact_email}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Fee Receipt
            </div>
            <div className="mt-1 font-mono text-sm">{p.receipt_number}</div>
            <div className="text-xs text-muted-foreground">
              {formatDate(p.payment_date)}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-2 gap-4 py-6">
          <Field label="Student">{s.full_name}</Field>
          <Field label="Batch">{batchName ?? "—"}</Field>
          {s.guardian_name && <Field label="Guardian">{s.guardian_name}</Field>}
          {s.phone && <Field label="Phone">{s.phone}</Field>}
          <Field label="Payment method">{p.method.toUpperCase()}</Field>
          {p.reference && <Field label="Reference">{p.reference}</Field>}
        </div>

        {/* Amount */}
        <div className="rounded-xl bg-primary-soft p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Amount paid</div>
            <div className="font-display text-3xl font-semibold text-primary">
              {formatINR(Number(p.amount))}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total fee</span>
              <span className="font-mono">
                {formatINR(Number(s.fee_total))}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Remaining</span>
              <span className="font-mono font-semibold">
                {formatINR(remaining)}
              </span>
            </div>
          </div>
        </div>

        {p.notes && (
          <p className="mt-4 text-sm text-muted-foreground">{p.notes}</p>
        )}

        {/* Footer */}
        <div className="mt-8 flex items-end justify-between border-t border-border pt-6 text-xs text-muted-foreground">
          <div>{i?.receipt_footer ?? "Thank you for your payment."}</div>
          <div className="text-right">
            <div className="h-10" />
            <div className="border-t border-border pt-1">
              Authorised Signature
            </div>
          </div>
        </div>
      </div>
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
