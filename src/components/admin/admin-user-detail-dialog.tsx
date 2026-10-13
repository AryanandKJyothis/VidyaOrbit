import type { ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { getAdminUserDetail } from "@/lib/admin-platform.functions";
import { paiseToRupees, type AdminPaymentRow } from "@/lib/admin-mrr";
import { formatDate, formatDateTime, formatINR } from "@/lib/format";
import { relTime } from "@/components/admin/edit-subscription-dialog";

export function AdminUserDetailDialog({
  userId,
  onClose,
  onOpenCentre,
}: {
  userId: string;
  onClose: () => void;
  onOpenCentre?: (ownerId: string) => void;
}) {
  const detailFn = useServerFn(getAdminUserDetail);
  const q = useQuery({
    queryKey: ["admin-user", userId],
    queryFn: () => detailFn({ data: { user_id: userId } }),
  });
  const user = q.data?.user;
  const payments = (q.data?.payments ?? []) as AdminPaymentRow[];
  const centres = Array.isArray(q.data?.centres) ? q.data.centres : [];
  const sub = q.data?.subscription as {
    plan?: string;
    status?: string;
    expiry_date?: string | null;
  } | null;
  const inst = q.data?.institute as {
    name?: string;
    contact_phone?: string | null;
    contact_email?: string | null;
    created_at?: string;
  } | null;
  const invites = Array.isArray(q.data?.invites) ? q.data.invites : [];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{user?.full_name || user?.email || "User"}</DialogTitle>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </DialogHeader>
        {q.isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Loading…
          </p>
        ) : !user ? (
          <p className="text-sm text-muted-foreground">User not found.</p>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-1.5">
              {user.platform_admin && <Badge>Platform admin</Badge>}
              {user.owns_centre && <Badge variant="outline">Owner</Badge>}
              {user.orphan && <Badge variant="outline">No centre</Badge>}
              {!user.email_confirmed_at && (
                <Badge variant="destructive">Unconfirmed</Badge>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-3">
              <Field label="Phone">{user.phone ?? "—"}</Field>
              <Field label="Signed up">{formatDate(user.created_at)}</Field>
              <Field label="Last sign-in">
                {relTime(user.last_sign_in_at)}
              </Field>
              <Field label="Confirmed">
                {user.email_confirmed_at
                  ? formatDate(user.email_confirmed_at)
                  : "No"}
              </Field>
            </dl>
            {inst && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Centre
                </h3>
                <p className="mt-1 font-medium">{inst.name}</p>
                <p className="text-xs text-muted-foreground">
                  {inst.contact_email} · {inst.contact_phone ?? "no phone"}
                </p>
                {sub && (
                  <p className="mt-1 capitalize text-muted-foreground">
                    {sub.plan} · {sub.status}
                    {sub.expiry_date
                      ? ` · expires ${formatDate(sub.expiry_date)}`
                      : ""}
                  </p>
                )}
              </section>
            )}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Centres and roles
              </h3>
              {centres.length === 0 ? (
                <p className="mt-1 text-muted-foreground">None</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {centres.map((c) => {
                    const row = c as {
                      owner_id: string;
                      name: string;
                      role: string;
                    };
                    return (
                      <li key={row.owner_id}>
                        <button
                          type="button"
                          className="min-h-11 text-left font-medium underline-offset-2 [@media(hover:hover)_and_(pointer:fine)]:hover:underline"
                          onClick={() => onOpenCentre?.(row.owner_id)}
                        >
                          {row.name}{" "}
                          <span className="font-normal capitalize text-muted-foreground">
                            · {row.role}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Platform payments
              </h3>
              {payments.length === 0 ? (
                <p className="mt-1 text-muted-foreground">None</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {payments.map((p) => (
                    <li key={p.id} className="text-xs">
                      {formatINR(paiseToRupees(p.amount_paise))} · {p.tier}{" "}
                      {p.cycle} · {p.status} · {p.key_mode}
                      {p.paid_at ? ` · ${formatDateTime(p.paid_at)}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {invites.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Invites
                </h3>
                <ul className="mt-1 space-y-1">
                  {invites.map((raw) => {
                    const inv = raw as {
                      id: string;
                      email: string;
                      role: string;
                      status: string;
                    };
                    return (
                      <li key={inv.id} className="text-xs">
                        {inv.email} · {inv.role} · {inv.status}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
