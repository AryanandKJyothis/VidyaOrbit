import { Search } from "lucide-react";
import { FilterChips } from "@/components/app/filter-chips";
import { InitialsAvatar } from "@/components/app/initials-avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { relTime } from "@/components/admin/edit-subscription-dialog";
import { formatDate } from "@/lib/format";
import type { AdminUserRow } from "@/lib/admin-mrr";

export const USER_FILTERS = [
  { id: "all", label: "All" },
  { id: "owners", label: "Owners" },
  { id: "staff", label: "Staff" },
  { id: "orphan", label: "No centre" },
  { id: "unconfirmed", label: "Unconfirmed" },
] as const;

export function AdminUsersPanel({
  rows,
  total,
  search,
  filter,
  loading,
  onSearch,
  onFilter,
  onOpen,
}: {
  rows: AdminUserRow[];
  total: number;
  search: string;
  filter: string;
  loading?: boolean;
  onSearch: (v: string) => void;
  onFilter: (v: string) => void;
  onOpen: (userId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search email, name, phone, or centre"
          className="h-12 rounded-2xl pl-9"
        />
      </div>
      <FilterChips
        ariaLabel="User filters"
        value={filter}
        onChange={onFilter}
        chips={USER_FILTERS.map((c) => ({
          id: c.id,
          label: c.label,
          count: c.id === "all" ? total : undefined,
        }))}
      />
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No users match"
          description="Try a different search or filter."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border/80">
              {rows.map((row) => (
                <li key={row.user_id}>
                  <button
                    type="button"
                    onClick={() => onOpen(row.user_id)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150 [transition-timing-function:var(--ease-out)] active:scale-[0.99] motion-reduce:active:scale-100 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/40"
                  >
                    <InitialsAvatar
                      name={row.full_name || row.email || "User"}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-semibold">
                          {row.full_name || row.email || "No email"}
                        </p>
                        {row.platform_admin && (
                          <Badge variant="default">Admin</Badge>
                        )}
                        {row.orphan && <Badge variant="outline">Orphan</Badge>}
                        {!row.email_confirmed_at && (
                          <Badge variant="destructive">Unconfirmed</Badge>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.email}
                        {row.phone ? ` · ${row.phone}` : ""}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {row.centres.length === 0
                          ? "No centre"
                          : row.centres
                              .map((c) => `${c.name} (${c.role})`)
                              .join(" · ")}
                      </p>
                    </div>
                    <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                      <p className="text-xs text-muted-foreground">
                        Joined {formatDate(row.created_at)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {relTime(row.last_sign_in_at)}
                      </p>
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
