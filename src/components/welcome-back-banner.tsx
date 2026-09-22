import { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

// Simple "we missed you" banner shown when the user returns after a stretch
// of inactivity. Purely client-side: we keep the last-seen timestamp in
// localStorage per user, and pop the banner once if they've been away for
// 7+ days. Dismissing it (or acting on it) marks it as seen for this gap.
const AWAY_DAYS = 7;

export function WelcomeBackBanner() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [daysAway, setDaysAway] = useState(0);

  useEffect(() => {
    if (!user) return;
    const key = `vo:lastSeen:${user.id}`;
    const dismissedKey = `vo:welcomeBackShown:${user.id}`;
    const now = Date.now();
    const raw = localStorage.getItem(key);
    const last = raw ? Number(raw) : NaN;

    if (Number.isFinite(last)) {
      const days = Math.floor((now - last) / 86_400_000);
      const lastShownFor = Number(localStorage.getItem(dismissedKey) ?? "0");
      if (days >= AWAY_DAYS && days !== lastShownFor) {
        setDaysAway(days);
        setShow(true);
        localStorage.setItem(dismissedKey, String(days));
      }
    }
    // Always refresh the last-seen stamp so future gaps are measured from now.
    localStorage.setItem(key, String(now));
  }, [user]);

  if (!show) return null;

  return (
    <Card className="mb-4 border-primary/40 bg-primary/5">
      <div className="flex items-start gap-3 p-4">
        <div className="mt-0.5 rounded-full bg-primary/15 p-2 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <p className="font-semibold">Welcome back — it's been {daysAway} days 👋</p>
          <p className="text-sm text-muted-foreground">
            Pick up where you left off. Add a student or mark today's attendance in a tap.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link to="/students">Add a student</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/attendance">Mark attendance</Link>
            </Button>
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => setShow(false)}
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
