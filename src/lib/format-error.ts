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
  fallback = "Something went wrong. Please try again.",
): string {
  console.error("[app] error:", e);

  if (e instanceof z.ZodError) {
    return formatZodError(e);
  }

  const named = e as { name?: string; message?: string };
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
  if (msg.startsWith("USER:")) return msg.slice(5).trim();

  if (/^Plan limit reached/i.test(msg)) return msg;

  if (isSafeAuthMessage(msg)) return msg;

  if (msg && !looksTechnical(msg) && msg.length <= 160) return msg;

  return fallback;
}
