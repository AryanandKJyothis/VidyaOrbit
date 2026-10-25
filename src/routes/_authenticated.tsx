import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopBar } from "@/components/app/app-top-bar";
import { MobileTabBar } from "@/components/app/mobile-tab-bar";
import { InlinePending } from "@/components/loading-screen";
import { SkipToContent } from "@/components/skip-to-content";
import {
  WorkspaceProvider,
  useActiveWorkspace,
} from "@/hooks/use-active-workspace";
import { OwnerOnboardingHost } from "@/components/owner-onboarding-host";
import { usePrefers } from "@/hooks/use-prefers";
import { fadeOnly, springDefault } from "@/lib/motion";
import { APP_WEBSITE_LABEL } from "@/lib/landing-copy";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen w-full flex-col bg-background">
        <header className="flex h-16 items-center border-b border-border px-4 sm:px-6">
          <p className="font-display text-sm font-bold tracking-[-0.04em] text-primary">
            Vidya Orbit
          </p>
        </header>
        <InlinePending
          label={
            session
              ? "Preparing your workspace…"
              : loading
                ? "Opening Vidya Orbit…"
                : "Taking you to sign in…"
          }
        />
      </div>
    );
  }

  return (
    <WorkspaceProvider>
      <SidebarProvider>
        <div id="app-shell" className="flex min-h-screen w-full bg-background">
          <SkipToContent />
          <AppSidebar />
          <div className="flex flex-1 flex-col">
            <AppTopBar />
            <main
              id="main-content"
              className="relative flex flex-1 flex-col px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-8"
            >
              <div className="mx-auto min-h-0 w-full max-w-7xl flex-1">
                <WorkspaceContentGate>
                  <PageTransition />
                </WorkspaceContentGate>
              </div>
              <footer className="mt-8 shrink-0 border-t border-border pt-4 text-center text-xs text-muted-foreground sm:mt-12 sm:pt-6">
                <span>Vidya Orbit · Data privacy and security built-in</span>
                <span className="mx-2 opacity-40">·</span>
                <Link
                  to="/privacy"
                  className="inline-flex min-h-11 items-center text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:underline"
                >
                  Privacy
                </Link>
                <span className="mx-2 opacity-40">·</span>
                <Link
                  to="/terms"
                  className="inline-flex min-h-11 items-center text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:underline"
                >
                  Terms
                </Link>
                <span className="mx-2 opacity-40">·</span>
                <Link
                  to="/refund-policy"
                  className="inline-flex min-h-11 items-center text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:underline"
                >
                  Refunds &amp; cancellations
                </Link>
                <span className="mx-2 opacity-40">·</span>
                <Link
                  to="/contact"
                  className="inline-flex min-h-11 items-center text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:underline"
                >
                  Contact
                </Link>
                <span className="mx-2 opacity-40">·</span>
                <Link
                  to="/home"
                  className="inline-flex min-h-11 items-center text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:underline"
                >
                  {APP_WEBSITE_LABEL}
                </Link>
              </footer>
            </main>
            <MobileTabBar />
          </div>
        </div>
        <OwnerOnboardingHost />
      </SidebarProvider>
    </WorkspaceProvider>
  );
}

function WorkspaceContentGate({ children }: { children: React.ReactNode }) {
  const { loading } = useActiveWorkspace();
  if (loading) {
    return <InlinePending label="Preparing your workspace…" />;
  }
  return <>{children}</>;
}

function PageTransition() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { reducedMotion } = usePrefers();
  const transition = reducedMotion ? fadeOnly : springDefault;
  return (
    <AnimatePresence>
      <motion.div
        key={pathname}
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
        transition={transition}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
}
