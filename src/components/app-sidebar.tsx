import { Link, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard,
  Users,
  Layers,
  Wallet,
  CalendarCheck,
  BarChart3,
  Settings,
  LogOut,
  CreditCard,
  ShieldCheck,
  Users2,
  Mail,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/logo";
import { useSubscription, PLANS } from "@/hooks/use-subscription";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useActiveWorkspace, useCan } from "@/hooks/use-active-workspace";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { listMyPendingInvites } from "@/lib/workspace.functions";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  resource?:
    "students" | "batches" | "fees" | "attendance" | "settings" | "billing";
};

const baseItems: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Students", url: "/students", icon: Users, resource: "students" },
  { title: "Batches", url: "/batches", icon: Layers, resource: "batches" },
  { title: "Fees", url: "/fees", icon: Wallet, resource: "fees" },
  {
    title: "Attendance",
    url: "/attendance",
    icon: CalendarCheck,
    resource: "attendance",
  },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  {
    title: "Plan",
    url: "/plan",
    icon: CreditCard,
    resource: "billing" as const,
  },
  { title: "Settings", url: "/settings", icon: Settings, resource: "settings" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  // "Best-prefix" match: only the most specific item lights up. Avoids
  // `/settings/team` highlighting both Team and Settings simultaneously.
  const isAdmin = useIsAdmin();
  const { active } = useActiveWorkspace();
  const canStudents = useCan("students");
  const canBatches = useCan("batches");
  const canFees = useCan("fees");
  const canAttendance = useCan("attendance");
  const canSettings = useCan("settings");
  const canBilling = useCan("billing");
  const permsMap: Record<string, boolean> = {
    students: canStudents,
    batches: canBatches,
    fees: canFees,
    attendance: canAttendance,
    settings: canSettings,
    billing: canBilling,
  };

  const fetchInvites = useServerFn(listMyPendingInvites);
  const invites = useQuery({
    queryKey: ["my-invites"],
    queryFn: () => fetchInvites(),
    staleTime: 60_000,
  });
  const pendingCount = invites.data?.length ?? 0;

  const visibleBase = baseItems.filter(
    (it) => !it.resource || permsMap[it.resource],
  );
  const items: NavItem[] = [
    ...visibleBase,
    // Team is visible only to members with settings:read (to see teammates).
    // Non-owners get a read-only view; the page itself enforces permissions.
    ...(active && canSettings
      ? [{ title: "Team", url: "/settings/team", icon: Users2 } as NavItem]
      : []),
    ...(isAdmin
      ? [
          {
            title: "Admin · Subscriptions",
            url: "/admin/subscriptions",
            icon: ShieldCheck,
          } as NavItem,
        ]
      : []),
  ];

  const activeUrl = [...items]
    .sort((a, b) => b.url.length - a.url.length)
    .find(
      (it) => pathname === it.url || pathname.startsWith(it.url + "/"),
    )?.url;
  const isActive = (u: string) => u === activeUrl;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="relative border-b border-sidebar-border transition-colors duration-300">
        {/* Orbital gradient accent */}
        <div className="absolute inset-0 bg-gradient-to-b from-sidebar-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="relative flex items-center gap-3 px-3 py-3.5"
        >
          <motion.div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sidebar-primary/30 to-sidebar-primary/15 ring-1 ring-sidebar-primary/40 transition-all duration-300 hover:ring-sidebar-primary/60"
            whileHover={{ scale: 1.12, rotate: -8 }}
            whileTap={{ scale: 0.92 }}
          >
            <Logo size={28} />
          </motion.div>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.08 }}
              className="flex flex-1 flex-col leading-tight"
            >
              <span className="font-display text-base font-bold tracking-tight text-sidebar-foreground">
                Vidya
              </span>
              <span className="text-[8.5px] uppercase tracking-[0.18em] text-sidebar-foreground/60 font-semibold">
                Orbit
              </span>
            </motion.div>
          )}
        </motion.div>
      </SidebarHeader>

      <SidebarContent>
        {!collapsed && (
          <div className="px-2 pt-2">
            <WorkspaceSwitcher />
          </div>
        )}
        {pendingCount > 0 && (
          <div className="px-2 pt-2">
            <Link
              to="/invites"
              className="flex items-center gap-2 rounded-md border border-sidebar-border/60 bg-sidebar-accent/30 px-2.5 py-2 text-xs hover:bg-sidebar-accent/60"
            >
              <Mail className="h-3.5 w-3.5" />
              {!collapsed && <span className="flex-1">Pending invites</span>}
              <Badge variant="secondary">{pendingCount}</Badge>
            </Link>
          </div>
        )}
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                    >
                      <Link
                        to={item.url}
                        className="group relative flex items-center gap-2.5 transition-colors"
                      >
                        {/* Active accent bar */}
                        <span
                          className={cn(
                            "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary transition-all",
                            active
                              ? "opacity-100 scale-y-100"
                              : "opacity-0 scale-y-50",
                          )}
                        />
                        <item.icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-transform duration-200",
                            active
                              ? "text-sidebar-primary"
                              : "text-sidebar-foreground/70 group-hover:text-sidebar-foreground group-hover:scale-110",
                          )}
                        />
                        {!collapsed && (
                          <span className="truncate">{item.title}</span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && <PlanBadge />}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign out"
              onClick={async () => {
                const { error } = await supabase.auth.signOut();
                if (error) {
                  toast.error("Could not sign out. Please try again.");
                } else {
                  qc.clear();
                }
              }}
              className="group text-sidebar-foreground/80 hover:text-sidebar-foreground"
            >
              <LogOut className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              {!collapsed && <span>Sign out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function PlanBadge() {
  const sub = useSubscription();
  if (!sub.data) return null;
  const meta = PLANS.find((p) => p.code === sub.data!.plan);
  return (
    <Link
      to="/plan"
      className="mx-1 mb-1 flex items-center justify-between rounded-lg border border-sidebar-border/60 bg-sidebar-accent/30 px-2.5 py-1.5 text-[11px] text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/60"
    >
      <span className="uppercase tracking-wider opacity-70">Plan</span>
      <span className="font-semibold">{meta?.name ?? sub.data.plan}</span>
    </Link>
  );
}
