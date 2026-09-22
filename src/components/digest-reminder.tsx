import { useEffect } from "react";
import { getISOWeek, getISOWeekYear } from "date-fns";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { getReminderPrefs } from "@/hooks/use-reminders";
import { formatINR } from "@/lib/format";

const DIGEST_LAST_KEY = "vidya:digest-last-week";

function currentWeekKey(d: Date) {
  return `${getISOWeekYear(d)}-W${String(getISOWeek(d)).padStart(2, "0")}`;
}

type DigestPayload = {
  overdueCount: number;
  overdueAmount: number;
  duesWeekAmount: number;
  attendancePct: number;
};

export function DigestReminderBootstrap({
  overdueCount,
  overdueAmount,
  duesWeekAmount,
  attendancePct,
}: DigestPayload) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const prefs = getReminderPrefs();
    if (!prefs.enabled) return;

    const now = new Date();
    if (now.getDay() !== prefs.digestWeekday) return;

    const wk = currentWeekKey(now);
    try {
      const last = localStorage.getItem(DIGEST_LAST_KEY);
      if (last === wk) return;
    } catch {
      /* ignore */
    }

    toast.custom(
      () => (
        <div className="w-[min(100vw-2rem,380px)] rounded-xl border border-border bg-popover p-4 shadow-lg">
          <div className="text-sm font-semibold">Weekly institute digest</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Quick snapshot — share this in staff meetings or follow up with parents.
          </p>
          <ul className="mt-3 space-y-1.5 text-xs">
            <li className="flex justify-between gap-2">
              <span className="text-muted-foreground">Overdue students</span>
              <span className="font-medium">{overdueCount}</span>
            </li>
            <li className="flex justify-between gap-2">
              <span className="text-muted-foreground">Overdue balance</span>
              <span className="font-mono font-medium">{formatINR(overdueAmount)}</span>
            </li>
            <li className="flex justify-between gap-2">
              <span className="text-muted-foreground">Fees due in 7 days</span>
              <span className="font-mono font-medium">{formatINR(duesWeekAmount)}</span>
            </li>
            <li className="flex justify-between gap-2">
              <span className="text-muted-foreground">Attendance (30d)</span>
              <span className="font-medium">{attendancePct}% present/late</span>
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="default">
              <Link to="/fees">Review fees</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/settings">Reminder settings</Link>
            </Button>
          </div>
        </div>
      ),
      { duration: 12_000 },
    );

    try {
      localStorage.setItem(DIGEST_LAST_KEY, wk);
    } catch {
      /* ignore */
    }
  }, [overdueCount, overdueAmount, duesWeekAmount, attendancePct]);

  return null;
}
