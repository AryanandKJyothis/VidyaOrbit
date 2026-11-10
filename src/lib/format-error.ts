import { z } from "zod";

const FIELD_LABELS: Record<string, string> = {
  full_name: "Student name",
  name: "Name",
  phone: "Phone",
  guardian_name: "Guardian name",
  guardian_phone: "Guardian phone",
  address: "Address",
  joining_date: "Joining date",
  fee_due_date: "Fee due date",
  fee_total: "Total fee",
  batch_id: "Batch",
  notes: "Notes",
  subject: "Subject",
  teacher_name: "Teacher",
  timing: "Timing",
  capacity: "Capacity",
  student_id: "Student",
  amount: "Amount",
  payment_date: "Payment date",
  method: "Payment method",
  reference: "Reference",
  contact_phone: "Contact phone",
  contact_email: "Contact email",
  receipt_prefix: "Receipt prefix",
  receipt_footer: "Receipt footer",
  upi_vpa: "UPI ID",
  centre_type: "Centre type",
  email: "Email",
  password: "Password",
  institute_name: "Institute name",
};

function labelForPath(path: (string | number)[]): string | null {
  if (!path.length) return null;
  const key = String(path[path.length - 1]);
  return FIELD_LABELS[key] ?? key.replace(/_/g, " ");
}

function isOpaqueZodMessage(message: string): boolean {
  if (!message) return true;
  if (message === "Invalid input") return true;
  if (message.startsWith("[")) return true;
  if (message.includes("invalid_union")) return true;
  return false;
}

/** Turn a ZodError into a single readable sentence for toasts. */
export function formatZodError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Please check the form and try again.";

  const fieldLabel = labelForPath(issue.path as (string | number)[]);

  if (!isOpaqueZodMessage(issue.message)) {
    if (
      fieldLabel &&
      !issue.message.toLowerCase().includes(fieldLabel.toLowerCase())
    ) {
      return `${fieldLabel}: ${issue.message}`;
    }
    return issue.message;
  }

  if (fieldLabel) {
    return `${fieldLabel} is optional — leave it blank or enter a valid value.`;
  }

  return "Please check the required fields and try again.";
}

/**
 * Map known error patterns to user-friendly messages with context and next steps.
 * Format: what happened, why (when known), what to do next.
 */
const ERROR_MAPPINGS: Array<{
  pattern: RegExp;
  message: string;
}> = [
  // Auth errors
  {
    pattern: /^invalid login credentials$/i,
    message:
      "Couldn't sign you in. That email and password combination doesn't match our records. Check your details or reset your password.",
  },
  {
    pattern: /^email not confirmed$/i,
    message:
      "Email not verified yet. Check your inbox for the verification link we sent, or request a new one.",
  },
  {
    pattern: /^user already registered$/i,
    message:
      "That email is already registered. Try signing in instead, or use a different email.",
  },
  {
    pattern: /^signup requires a valid password/i,
    message:
      "Password doesn't meet requirements. Use at least 8 characters with a mix of letters and numbers.",
  },
  {
    pattern: /^password should be at least (\d+)/i,
    message: "Password is too short. Use at least $1 characters.",
  },
  {
    pattern: /^unable to validate email address/i,
    message:
      "That email address doesn't look right. Check for typos and try again.",
  },
  // Database/network errors
  {
    pattern: /network|fetch failed|failed to fetch/i,
    message:
      "Connection lost. Check your internet connection and try again in a moment.",
  },
  {
    pattern: /timeout|timed out/i,
    message:
      "Request took too long. Your connection might be slow — try again in a moment.",
  },
  {
    pattern: /duplicate key|unique constraint|already exists/i,
    message:
      "That record already exists. Check if you've already added it, or edit the existing one instead.",
  },
  {
    pattern: /foreign key|violates.*constraint/i,
    message:
      "Can't complete this action because it's linked to other records. Remove the connection first.",
  },
  {
    pattern: /permission denied|not authorized|rls/i,
    message:
      "You don't have permission for that. Ask your centre owner to update your role.",
  },
  // Razorpay payment errors
  {
    pattern: /payment.*failed|transaction.*failed/i,
    message:
      "Payment didn't go through. Your bank might have declined it. Check your payment details and try again.",
  },
  {
    pattern: /card.*declined/i,
    message:
      "Card was declined. Contact your bank to confirm the card is active, or try a different payment method.",
  },
  {
    pattern: /insufficient.*funds/i,
    message:
      "Insufficient funds. Your account balance is too low. Add funds or use a different payment method.",
  },
  // Plan limits
  {
    pattern: /plan limit reached/i,
    message:
      "You've reached your plan limit. Upgrade your plan to add more students or batches.",
  },
];

/** Messages that are safe to show from Supabase Auth (no schema/constraint leakage). */
const SAFE_AUTH_MESSAGES = [
  /^invalid login credentials$/i,
  /^email not confirmed$/i,
  /^user already registered$/i,
  /^signup requires a valid password/i,
  /^password should be at least/i,
  /^unable to validate email address/i,
];

function looksTechnical(msg: string): boolean {
  if (!msg) return true;
  if (msg.startsWith("[") || msg.startsWith("{")) return true;
  return /invalid_union|ZodError|violates|constraint|duplicate key|relation |column |JWT|RLS|postgres|digest|stack trace|expected string/i.test(
    msg,
  );
}

function isSafeAuthMessage(msg: string): boolean {
  const t = msg.trim();
  return SAFE_AUTH_MESSAGES.some((re) => re.test(t));
}

/**
 * Convert any thrown error into a safe, user-facing message.
 * Raw error details are logged for developers but not shown to end users.
 *
 * Trigger-raised messages prefixed with "USER:" are passed through as-is.
 */
export function formatUserError(
  e: unknown,
  fallback = "Couldn't complete that action. Please try again, and contact support if this keeps happening.",
): string {
  // Log full error for developers (server-side and dev console only)
  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    console.error("[app] error:", e);
  }

  if (e instanceof z.ZodError) {
    return formatZodError(e);
  }

  const named = e as { name?: string; message?: string; code?: string };
  if (named?.name === "ZodError" && named.message) {
    try {
      const parsed = JSON.parse(named.message) as z.ZodIssue[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return formatZodError(new z.ZodError(parsed));
      }
    } catch {
      /* fall through */
    }
  }

  const msg = named?.message ?? "";

  // Server-sent user-facing messages (prefixed with USER:)
  if (msg.startsWith("USER:")) return msg.slice(5).trim();

  // Try mapping to known friendly error messages
  for (const mapping of ERROR_MAPPINGS) {
    if (mapping.pattern.test(msg)) {
      // Handle regex capture groups (e.g., $1)
      const match = msg.match(mapping.pattern);
      let message = mapping.message;
      if (match) {
        for (let i = 1; i < match.length; i++) {
          message = message.replace(`$${i}`, match[i] ?? "");
        }
      }
      return message;
    }
  }

  // Legacy safe auth messages
  if (isSafeAuthMessage(msg)) return msg;

  // Pass through short, non-technical messages
  if (msg && !looksTechnical(msg) && msg.length <= 160) return msg;

  // Default fallback with context
  return fallback;
}
