import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarCheck, Home, LayoutGrid, Users, Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCan } from "@/hooks/use-active-workspace";
import { listMyPendingInvites } from "@/lib/workspace.functions";
import { MOBILE_NAV_ITEMS } from "@/lib/mobile-nav";
import { cn } from "@/lib/utils";
import { MoreSheet } from "@/components/app/more-sheet";

const TAB_ICONS = {
  "/dashboard": Home,
  "/students": Users,
  "/fees": Wallet,
  "/attendance": CalendarCheck,
} as const;

/** Stitch order: Attendance stays on the bar; Plan lives in More. */
const TAB_ORDER = ["/dashboard", "/students", "/attendance", "/fees"] as const;

type Tab = {
  id: string;
  label: string;
  to?: string;
  icon: typeof Home;
  more?: boolean;
  show: boolean;
};

export function MobileTabBar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [moreOpen, setMoreOpen] = useState(false);
  const canStudents = useCan("students");
  const canFees = useCan("fees");
  const canAttendance = useCan("attendance");
  const fetchInvites = useServerFn(listMyPendingInvites);
  const invites = useQuery({
    queryKey: ["my-invites"],
    queryFn: () => fetchInvites(),
    staleTime: 60_000,
  });
  const pendingCount = invites.data?.length ?? 0;

  const canShow: Record<(typeof TAB_ORDER)[number], boolean> = {
    "/dashboard": true,
    "/students": canStudents,
    "/attendance": canAttendance,
    "/fees": canFees,
  };

  const tabs: Tab[] = [
    ...TAB_ORDER.map((to) => {
      const item = MOBILE_NAV_ITEMS.find((nav) => nav.to === to)!;
      return {
        id: item.label.toLowerCase(),
        label: item.label,
        to: item.to,
        icon: TAB_ICONS[item.to],
        show: canShow[to],
      };
    }),
    { id: "more", label: "More", icon: LayoutGrid, more: true, show: true },
  ];

  const visible = tabs.filter((t) => t.show);
  const moreActive =
    moreOpen ||
    ["/batches", "/plan", "/settings", "/analytics", "/invites", "/admin"].some(
      (p) => pathname === p || pathname.startsWith(p + "/"),
    );

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 z-40 w-full md:hidden material-chrome-dark scroll-edge-top pb-[env(safe-area-inset-bottom)]"
        aria-label="Primary"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-between gap-0.5 px-2 pt-1 pb-1">
          {visible.map((item) => {
            const Icon = item.icon;
            const active = item.more
              ? moreActive
              : pathname === item.to ||
                (item.to ? pathname.startsWith(item.to + "/") : false);
            const className = cn(
              "flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[10px] font-semibold tracking-[0.01em]",
              "transition-[transform,background-color,color] duration-100 [transition-timing-function:var(--ease-out)]",
              "active:scale-[0.97] motion-reduce:active:scale-100",
              active
                ? "bg-muted/80 text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
            );
            if (item.more) {
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-label="More"
                  aria-expanded={moreOpen}
                  onClick={() => setMoreOpen(true)}
                  className={className}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      active ? "text-brand-teal" : "text-muted-foreground",
                    )}
                    aria-hidden
                  />
                  <span className="leading-tight">{item.label}</span>
                </button>
              );
            }
            return (
              <Link
                key={item.id}
                to={item.to!}
                aria-current={active ? "page" : undefined}
                className={className}
              >
                <Icon
                  className={cn(
                    "h-5 w-5",
                    active ? "text-brand-teal" : "text-muted-foreground",
                  )}
                  aria-hidden
                />
                <span className="line-clamp-1 leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      <MoreSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        pendingInvites={pendingCount}
      />
    </>
  );
}
