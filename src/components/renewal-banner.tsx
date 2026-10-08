/**
 * Renewal banner - shows 7 days before expiry for owners
 */
import { AlertCircle, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { differenceInCalendarDays } from "date-fns";

type RenewalBannerProps = {
  expiryDate: Date;
  isOwner: boolean;
  isExpired: boolean;
};

export function RenewalBanner({
  expiryDate,
  isOwner,
  isExpired,
}: RenewalBannerProps) {
  if (!isOwner) return null;

  const daysLeft = differenceInCalendarDays(expiryDate, new Date());

  if (isExpired) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="ml-2">
          <strong>Your plan has expired.</strong> Renew now to restore access to
          premium features.
          <Button asChild size="sm" className="ml-3">
            <Link to="/plan">Renew Plan</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (daysLeft <= 7 && daysLeft >= 0) {
    return (
      <Alert className="mb-6 border-amber-500/50 bg-amber-500/10">
        <Clock className="h-4 w-4 text-amber-600" />
        <AlertDescription className="ml-2 text-amber-900 dark:text-amber-100">
          <strong>Plan expiring soon!</strong> Your plan expires in {daysLeft}{" "}
          day{daysLeft === 1 ? "" : "s"}.
          <Button asChild size="sm" variant="outline" className="ml-3">
            <Link to="/plan">Renew Now</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
