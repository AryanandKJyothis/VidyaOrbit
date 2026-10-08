import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Home, Users, Wallet, CreditCard } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useInstitute } from "@/hooks/use-data";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { LoadingScreen } from "@/components/loading-screen";
import { WorkspaceProvider } from "@/hooks/use-active-workspace";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  if (loading || !session)
    return <LoadingScreen label="Preparing your workspace…" />;

  return (
    <WorkspaceProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <AppSidebar />
          <div className="flex flex-1 flex-col">
            <TopBar />
            <main className="relative flex flex-1 flex-col px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8 pb-24 sm:pb-8">
              <div className="flex-1 min-h-0 max-w-7xl mx-auto w-full">
                <PageTransition />
              </div>
              <footer className="mt-8 sm:mt-12 pt-4 sm:pt-6 border-t border-border text-center text-[10px] sm:text-[11px] text-muted-foreground shrink-0">
                <span>Vidya Orbit · Data privacy and security built-in</span>
                <span className="mx-2 opacity-40">·</span>
                <Link
                  to="/terms"
                  className="text-muted-foreground hover:text-foreground transition-colors hover:underline"
                >
                  Terms
                </Link>
                <span className="mx-2 opacity-40">·</span>
                <Link
                  to="/privacy"
                  className="text-muted-foreground hover:text-foreground transition-colors hover:underline"
                >
                  Privacy
                </Link>
              </footer>
            </main>
            <MobileNav />
          </div>
        </div>
      </SidebarProvider>
    </WorkspaceProvider>
  );
}

function TopBar() {
  const inst = useInstitute();
  const name = inst.data?.name;
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 sm:px-6 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <SidebarTrigger className="h-10 w-10 hover:bg-muted transition-colors rounded-lg md:hidden" />
      <div className="hidden md:block h-5 w-px bg-border" />
      {name && name !== "My Institute" && (
        <span className="hidden text-sm font-medium text-foreground/80 md:block truncate max-w-xs lg:max-w-md">
          {name}
        </span>
      )}
      <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="hidden h-2 w-2 rounded-full bg-brand-teal sm:inline-block animate-pulse-soft" />
          <span className="hidden sm:inline">Asia/Kolkata · INR</span>
        </div>
      </div>
    </header>
  );
}

function PageTransition() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
}

function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = [
    { label: "Dashboard", to: "/dashboard", icon: Home },
    { label: "Students", to: "/students", icon: Users },
    { label: "Fees", to: "/fees", icon: Wallet },
    {
      label: "Plan",
      to: "/plan",
      icon: CreditCard,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 z-40 w-full border-t border-border bg-background/97 px-2 py-2 backdrop-blur-md md:hidden safe-area-inset-bottom">
      <div className="mx-auto flex max-w-5xl items-stretch justify-between gap-1.5">
        {items.map((item, idx) => {
          const Icon = item.icon;
          const active =
            pathname === item.to || pathname.startsWith(item.to + "/");
          return (
            <motion.div
              key={item.to}
              className="flex-1"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.3 }}
            >
              <Link
                to={item.to}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-1 rounded-2xl px-2 text-[10px] font-semibold transition-all duration-200 active:scale-95",
                  active
                    ? "bg-muted text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 transition-all duration-200",
                    active ? "text-brand-teal" : "text-muted-foreground",
                  )}
                  aria-hidden
                />
                <span className="line-clamp-1 leading-tight">{item.label}</span>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </nav>
  );
}
