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
import { LoadingScreen } from "@/components/loading-screen";
import { SkipToContent } from "@/components/skip-to-content";
import { WorkspaceProvider } from "@/hooks/use-active-workspace";
import { OwnerOnboardingHost } from "@/components/owner-onboarding-host";
import { usePrefers } from "@/hooks/use-prefers";
import { fadeOnly, springDefault } from "@/lib/motion";

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
        <div id="app-shell" className="flex min-h-screen w-full bg-background">
          <SkipToContent />
          <AppSidebar />
          <div className="flex flex-1 flex-col">
            <AppTopBar />
            <main
              id="main-content"
              className="relative flex flex-1 flex-col px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-8"
            >
              <div className="flex-1 min-h-0 max-w-7xl mx-auto w-full">
                <PageTransition />
              </div>
              <footer className="mt-8 sm:mt-12 pt-4 sm:pt-6 border-t border-border text-center text-xs text-muted-foreground shrink-0">
                <span>Vidya Orbit · Data privacy and security built-in</span>
                <span className="mx-2 opacity-40">·</span>
                <Link
                  to="/terms"
                  className="inline-flex min-h-11 items-center text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground transition-colors [@media(hover:hover)_and_(pointer:fine)]:hover:underline"
                >
                  Terms
                </Link>
                <span className="mx-2 opacity-40">·</span>
                <Link
                  to="/privacy"
                  className="inline-flex min-h-11 items-center text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground transition-colors [@media(hover:hover)_and_(pointer:fine)]:hover:underline"
                >
                  Privacy
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
