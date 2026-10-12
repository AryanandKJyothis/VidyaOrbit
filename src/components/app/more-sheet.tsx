import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  CreditCard,
  Layers,
  LogOut,
  Mail,
  Settings,
  Users2,
  ShieldCheck,
} from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { useCan, useActiveWorkspace } from "@/hooks/use-active-workspace";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type MoreItem = {
  label: string;
  to: string;
  icon: typeof Layers;
  show: boolean;
};

export function MoreSheet({
  open,
  onOpenChange,
  pendingInvites = 0,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingInvites?: number;
}) {
  const qc = useQueryClient();
  const { active } = useActiveWorkspace();
  const isAdmin = useIsAdmin();
  const canBatches = useCan("batches");
  const canSettings = useCan("settings");
  const canBilling = useCan("billing");

  const items: MoreItem[] = [
    { label: "Batches", to: "/batches", icon: Layers, show: canBatches },
    {
      label: "Team",
      to: "/settings/team",
      icon: Users2,
      show: !!active && canSettings,
    },
    { label: "Analytics", to: "/analytics", icon: BarChart3, show: true },
    { label: "Plan", to: "/plan", icon: CreditCard, show: canBilling },
    { label: "Settings", to: "/settings", icon: Settings, show: canSettings },
    {
      label: pendingInvites > 0 ? `Invites (${pendingInvites})` : "Invites",
      to: "/invites",
      icon: Mail,
      show: pendingInvites > 0,
    },
    {
      label: "Admin · Subscriptions",
      to: "/admin/subscriptions",
      icon: ShieldCheck,
      show: isAdmin,
    },
  ];

  const visible = items.filter((it) => it.show);

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      shouldScaleBackground={false}
    >
      <DrawerContent className="md:hidden">
        <DrawerHeader className="text-left">
          <DrawerTitle>More</DrawerTitle>
          <DrawerDescription>
            Batches, team, plan and settings.
          </DrawerDescription>
        </DrawerHeader>
        <nav className="grid gap-1 px-3 pb-6" aria-label="More">
          {visible.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => onOpenChange(false)}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-foreground",
                  "transition-[transform,background-color] duration-150 [transition-timing-function:var(--ease-out)]",
                  "hover:bg-muted/70 active:scale-[0.98] motion-reduce:active:scale-100",
                )}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            className="mt-2 flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-destructive transition-[transform,background-color] duration-150 [transition-timing-function:var(--ease-out)] hover:bg-destructive/8 active:scale-[0.98] motion-reduce:active:scale-100"
            onClick={async () => {
              const { error } = await supabase.auth.signOut();
              if (error) {
                toast.error("Could not sign out. Please try again.");
                return;
              }
              qc.clear();
              onOpenChange(false);
            }}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <LogOut className="h-5 w-5" aria-hidden />
            </span>
            Sign out
          </button>
        </nav>
      </DrawerContent>
    </Drawer>
  );
}
