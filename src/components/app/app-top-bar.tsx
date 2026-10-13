import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/logo";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { InitialsAvatar } from "@/components/app/initials-avatar";
import { useAuth } from "@/hooks/use-auth";
import { useInstitute } from "@/hooks/use-data";
import { useCan } from "@/hooks/use-active-workspace";

export function AppTopBar() {
  const { user } = useAuth();
  const inst = useInstitute();
  const canSettings = useCan("settings");
  const display =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email ||
    inst.data?.name ||
    "Account";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 px-4 material-chrome scroll-edge sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2.5 md:gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl md:hidden"
          style={{ backgroundColor: "#F8F7F2" }}
        >
          <Logo size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
            Vidya Orbit
          </p>
          <div className="-ml-2 max-w-[220px] sm:max-w-xs">
            <WorkspaceSwitcher variant="header" />
          </div>
        </div>
      </div>
      <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
        <span className="h-2 w-2 rounded-full bg-brand-teal" aria-hidden />
        <span>Asia/Kolkata · INR</span>
      </div>
      {canSettings ? (
        <Link
          to="/settings"
          aria-label="Open settings"
          className="shrink-0 rounded-full transition-transform duration-100 [transition-timing-function:var(--ease-out)] active:scale-[0.97] motion-reduce:active:scale-100"
        >
          <InitialsAvatar name={display} size="sm" />
        </Link>
      ) : (
        <InitialsAvatar name={display} size="sm" />
      )}
    </header>
  );
}
