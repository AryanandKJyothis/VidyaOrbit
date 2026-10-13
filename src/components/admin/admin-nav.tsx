import { useEffect, useRef } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  Building2,
  CreditCard,
  LayoutDashboard,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/centres", label: "Centres", icon: Building2 },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/payments", label: "Payments", icon: CreditCard },
  { to: "/admin/alerts", label: "Alerts", icon: Activity },
] as const;

export function AdminNav({ pathname: pathnameProp }: { pathname?: string }) {
  const livePath = useRouterState({ select: (r) => r.location.pathname });
  const pathname = pathnameProp ?? livePath;
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "instant",
    });
  }, [pathname]);

  return (
    <nav
      aria-label="Admin sections"
      className="-mx-1 mb-5 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mb-6"
    >
      {ITEMS.map((item) => {
        const exact = "exact" in item && item.exact;
        const active = exact
          ? pathname === item.to
          : pathname === item.to || pathname.startsWith(item.to + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            ref={active ? activeRef : undefined}
            to={item.to}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-11 min-h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-[transform,background-color,border-color,color] duration-150 [transition-timing-function:var(--ease-out)] active:scale-[0.97] motion-reduce:active:scale-100",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/60",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
