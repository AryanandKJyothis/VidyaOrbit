import { Search } from "lucide-react";
import { FilterChips } from "@/components/app/filter-chips";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { formatDateTime, formatINR } from "@/lib/format";
import { paiseToRupees, type AdminPaymentRow } from "@/lib/admin-mrr";

export const PAYMENT_FILTERS = [
  { id: "all", label: "All" },
  { id: "live", label: "Live" },
  { id: "test", label: "Test" },
  { id: "paid", label: "Paid" },
  { id: "needs_review", label: "Needs review" },
  { id: "failed", label: "Failed" },
  { id: "created", label: "Created" },
] as const;

export function AdminPaymentsPanel({
  rows,
  total,
  search,
  filter,
  loading,
  onSearch,
  onFilter,
  onOpenCentre,
}: {
  rows: AdminPaymentRow[];
  total: number;
  search: string;
  filter: string;
  loading?: boolean;
  onSearch: (v: string) => void;
  onFilter: (v: string) => void;
  onOpenCentre?: (ownerId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search centre or Razorpay id"
          className="h-12 rounded-2xl pl-9"
        />
      </div>
      <FilterChips
        ariaLabel="Payment filters"
        value={filter}
        onChange={onFilter}
        chips={PAYMENT_FILTERS.map((c) => ({
          id: c.id,
          label: c.label,
          count: c.id === "all" ? total : undefined,
          tone: c.id === "needs_review" ? "danger" : "default",
        }))}
      />
      {loading ? (
        <Skeleton className="h-24 rounded-2xl" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No payments match"
          description="Live Razorpay captures will show here. Student tuition is on each centre."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border/80">
              {rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => onOpenCentre?.(row.owner_id)}
                    className="flex w-full flex-col gap-1 px-4 py-3.5 text-left transition-colors duration-150 [transition-timing-function:var(--ease-out)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {row.centre_name ?? "Unknown centre"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.tier} {row.cycle} · {row.razorpay_order_id}
                      </p>
                      {row.review_reason && (
                        <p className="mt-1 text-xs text-warning-foreground">
                          {row.review_reason}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold tabular-nums">
                        {formatINR(paiseToRupees(row.amount_paise))}
                      </span>
                      <Badge
                        variant={row.status === "paid" ? "default" : "outline"}
                        className="capitalize"
                      >
                        {row.status}
                      </Badge>
                      <Badge variant="outline" className="uppercase">
                        {row.key_mode}
                      </Badge>
                      {row.needs_review && (
                        <Badge variant="destructive">Review</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(row.paid_at ?? row.created_at)}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
