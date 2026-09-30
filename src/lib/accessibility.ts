import { cn } from "@/lib/utils";

/**
 * Utility for creating accessible status badges that include both color and text.
 * Prevents color-only status indicators that fail accessibility standards.
 */
export function createStatusLabel(status: string): {
  label: string;
  variant: string;
} {
  const statuses: Record<string, { label: string; variant: string }> = {
    active: { label: "Active", variant: "default" },
    archived: { label: "Archived", variant: "secondary" },
    present: { label: "Present", variant: "default" },
    absent: { label: "Absent", variant: "destructive" },
    late: { label: "Late", variant: "outline" },
    leave: { label: "Leave", variant: "secondary" },
    pending: { label: "Pending", variant: "outline" },
    completed: { label: "Completed", variant: "default" },
    paid: { label: "Paid", variant: "default" },
    unpaid: { label: "Unpaid", variant: "destructive" },
    partial: { label: "Partial", variant: "outline" },
  };
  return statuses[status] || { label: status, variant: "secondary" };
}

/**
 * Accessible touch target utility for mobile interactions.
 * Ensures minimum 48x48px tap targets per WCAG standards.
 */
export const TOUCH_TARGET_SIZE = "min-h-12 min-w-12";

/**
 * Generates aria-label for common UI elements.
 */
export function createAriaLabel(
  action: string,
  subject: string,
  extra?: string,
): string {
  const parts = [action, subject, extra].filter(Boolean);
  return parts.join(": ");
}

/**
 * Accessible loading indicator text.
 */
export const LOADING_ARIA_LIVE = {
  role: "status",
  "aria-live": "polite",
  "aria-busy": true,
} as const;

/**
 * Accessible error state text.
 */
export const ERROR_ARIA_LIVE = {
  role: "alert",
  "aria-live": "assertive",
} as const;
