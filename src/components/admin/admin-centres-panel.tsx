import { Search } from "lucide-react";
import { FilterChips } from "@/components/app/filter-chips";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import {
  activityTone,
  adminToneText,
  expiryTone,
  relTime,
} from "@/components/admin/edit-subscription-dialog";
import { formatLimit, isUnlimited } from "@/lib/plan-limits";
import { formatINR, formatDateTime } from "@/lib/format";
import { paiseToRupees, type AdminCentreRow } from "@/lib/admin-mrr";
import { cn } from "@/lib/utils";

export const CENTRE_FILTERS = [
  { id: "all", label: "All" },
  { id: "expiring", label: "Expiring ≤30d" },
  { id: "over_limit", label: "Over limit" },
  { id: "at_risk", label: "At risk" },
  { id: "inactive", label: "Dropped 30d+" },
  { id: "trials", label: "Trials" },
  { id: "free", label: "Free" },
] as const;

export function AdminCentresPanel({
  rows,
  total,
  search,
  filter,
  loading,
  onSearch,
  onFilter,
  onOpen,
}: {
  rows: AdminCentreRow[];
  total: number;
  search: string;
  filter: string;
  loading?: boolean;
  onSearch: (v: string) => void;
  onFilter: (v: string) => void;
  onOpen: (ownerId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search centre, email, or phone"
          className="h-12 rounded-2xl pl-9"
        />
      </div>
      <FilterChips
        ariaLabel="Centre filters"
        value={filter}
        onChange={onFilter}
        chips={CENTRE_FILTERS.map((c) => ({
          id: c.id,
          label: c.label,
          count: c.id === "all" ? total : undefined,
        }))}
      />
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No centres match"
          description="Try a different search or filter."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border/80">
              {rows.map((row) => (
                <CentreRow
                  key={row.owner_id}
                  row={row}
                  onOpen={() => onOpen(row.owner_id)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CentreRow({
  row,
  onOpen,
}: {
  row: AdminCentreRow;
  onOpen: () => void;
}) {
  const unlimited = isUnlimited(row.plan_limit);
  const usagePct = unlimited
    ? 0
    : Math.min(
        100,
        Math.round((row.student_count / Math.max(1, row.plan_limit)) * 100),
      );
  const usageTone =
    !unlimited && row.student_count >= row.plan_limit
      ? "bg-destructive"
      : usagePct >= 80
        ? "bg-warning"
        : "bg-success";
  const expTone = expiryTone(row.days_until_expiry);
  const actTone = activityTone(row.last_active_at);
  const expiryText =
    row.days_until_expiry == null
      ? "no expiry"
      : row.days_until_expiry < 0
        ? `expired ${Math.abs(row.days_until_expiry)}d ago`
        : `in ${row.days_until_expiry}d`;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="grid w-full grid-cols-12 items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150 [transition-timing-function:var(--ease-out)] active:scale-[0.99] motion-reduce:active:scale-100 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/40"
    >
      <div className="col-span-12 min-w-0 md:col-span-3">
        <p className="truncate text-sm font-semibold">{row.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {row.contact_email ?? row.owner_email ?? "—"}
          {row.contact_phone ? ` · ${row.contact_phone}` : ""}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {row.staff_count} staff · {row.member_count} members
          {row.needs_review_count > 0
            ? ` · ${row.needs_review_count} review`
            : ""}
        </p>
      </div>
      <div className="col-span-6 flex flex-wrap items-center gap-1.5 md:col-span-2">
        <Badge variant="outline" className="capitalize">
          {row.plan ?? "free"}
        </Badge>
        <Badge
          variant={
            row.status === "active" || row.status === "trialing"
              ? "default"
              : "destructive"
          }
          className="capitalize"
        >
          {row.status ?? "active"}
        </Badge>
      </div>
      <div className="col-span-6 md:col-span-2">
        <div className="flex items-center justify-between text-xs">
          <span className="tabular-nums">
            {row.student_count} / {formatLimit(row.plan_limit)}
          </span>
        </div>
        {!unlimited && (
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full", usageTone)}
              style={{ width: `${usagePct}%` }}
            />
          </div>
        )}
      </div>
      <div
        className={cn(
          "col-span-4 text-xs tabular-nums md:col-span-2",
          adminToneText[expTone],
        )}
      >
        {expiryText}
      </div>
      <div
        className={cn(
          "col-span-4 text-xs md:col-span-2",
          adminToneText[actTone],
        )}
      >
        <div>{relTime(row.last_active_at)}</div>
        <div className="text-muted-foreground">
          login {relTime(row.owner_last_sign_in_at)}
        </div>
      </div>
      <div className="col-span-4 text-xs text-muted-foreground md:col-span-1">
        {row.last_payment_amount_paise != null
          ? formatINR(paiseToRupees(row.last_payment_amount_paise))
          : "—"}
        {row.last_payment_at && (
          <div className="truncate">{formatDateTime(row.last_payment_at)}</div>
        )}
      </div>
    </button>
  );
}
