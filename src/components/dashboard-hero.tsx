import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ArrowRight, CalendarCheck, Wallet, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { formatINR } from "@/lib/format";

function greetingFor(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

function firstName(full?: string | null, email?: string | null) {
  if (full) return full.trim().split(/\s+/)[0];
  if (email) return email.split("@")[0];
  return "there";
}

export function DashboardHero({
  instituteName,
  classesToday,
  studentsActive,
  duesWeekAmount,
}: {
  instituteName?: string | null;
  classesToday: number;
  studentsActive: number;
  duesWeekAmount: number;
}) {
  const { user } = useAuth();
  const displayName = firstName(
    (user?.user_metadata?.full_name as string | undefined) ?? null,
    user?.email,
  );
  const today = useMemo(() => new Date(), []);
  const greeting = greetingFor(today);

  return (
    <motion.section
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="hero-gradient relative mb-6 overflow-hidden rounded-2xl border border-subtle p-5 sm:p-7"
    >
      {/* soft orbital decoration */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br from-brand-teal/20 to-transparent blur-2xl"
      />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">
            {format(today, "EEEE, d MMMM")}
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl lg:text-[2.25rem] font-bold tracking-tight leading-tight">
            {greeting},{" "}
            <span className="gradient-text">{displayName}</span>
          </h1>
          {instituteName && (
            <p className="mt-1 text-sm text-muted-foreground">
              Here's what's happening at <span className="font-medium text-foreground">{instituteName}</span> today.
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="pill pill-brand">
              <CalendarCheck className="h-3 w-3" aria-hidden />
              {classesToday === 0
                ? "No classes scheduled"
                : `${classesToday} ${classesToday === 1 ? "class" : "classes"} today`}
            </span>
            <span className="pill pill-muted">
              <Users className="h-3 w-3" aria-hidden />
              {studentsActive} active {studentsActive === 1 ? "student" : "students"}
            </span>
            {duesWeekAmount > 0 && (
              <span className="pill pill-danger">
                <Wallet className="h-3 w-3" aria-hidden />
                {formatINR(duesWeekAmount)} due this week
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:shrink-0">
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link to="/attendance">
              Mark attendance
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button asChild size="sm" className="gap-1.5">
            <Link to="/fees">
              Record payment
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </motion.section>
  );
}
