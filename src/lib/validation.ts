import { z } from "zod";

const phoneRegex = /^[0-9+\-\s()]{6,20}$/;

const trimmedString = (max: number) =>
  z.string().trim().max(max, `Must be at most ${max} characters`);

function coalesceEmpty(v: unknown): unknown {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "string" && v.trim() === "") return undefined;
  if (typeof v === "string") return v.trim();
  return v;
}

function coalesceEmptyToNull(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" && v.trim() === "") return null;
  if (typeof v === "string") return v.trim();
  return v;
}

/** Optional text from forms: accepts null, undefined, and blank — omits field when empty. */
export function optionalText(max: number) {
  return z.preprocess(coalesceEmpty, trimmedString(max).optional());
}

/** Nullable text for DB columns: blank/null → SQL null. */
export function nullableText(max: number) {
  return z.preprocess(coalesceEmptyToNull, z.union([z.null(), trimmedString(max)]));
}

/** Optional phone — blank/null allowed; validates when provided. */
export function optionalPhone() {
  return z.preprocess(
    coalesceEmpty,
    z
      .string()
      .regex(phoneRegex, "Enter a valid phone number (6–20 digits).")
      .max(20)
      .optional(),
  );
}

export function optionalDate() {
  return z.preprocess(
    coalesceEmpty,
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date (YYYY-MM-DD).").optional(),
  );
}

export function nullableDate() {
  return z.preprocess(
    coalesceEmptyToNull,
    z.union([
      z.null(),
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date (YYYY-MM-DD)."),
    ]),
  );
}

export const studentSchema = z.object({
  full_name: z.string().trim().min(1, "Student name is required").max(120),
  phone: optionalPhone(),
  guardian_name: optionalText(120),
  guardian_phone: optionalPhone(),
  address: optionalText(500),
  joining_date: optionalDate(),
  status: z.enum(["active", "inactive", "archived"]).optional(),
  batch_id: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.union([z.null(), z.string().uuid("Pick a valid batch")]).optional(),
  ),
  fee_total: z.number().min(0, "Fee cannot be negative").max(10_000_000).optional(),
  fee_due_date: nullableDate(),
  notes: nullableText(1000),
});

// Require at least one contact phone: either student `phone` or `guardian_phone`.
export const studentSchemaWithPhone = studentSchema.superRefine((val, ctx) => {
  if (!val.phone && !val.guardian_phone) {
    ctx.addIssue({
      code: "custom",
      message: "Enter the student's phone or a guardian phone number.",
      path: ["phone"],
    });
  }
});

export const batchSchema = z.object({
  name: z.string().trim().min(1, "Batch name is required").max(120),
  subject: nullableText(120),
  teacher_name: nullableText(120),
  timing: nullableText(80),
  days_of_week: z.array(z.string().max(10)).max(7).optional(),
  capacity: z.number().int().min(1, "Capacity must be at least 1").max(1000).optional(),
  is_active: z.boolean().optional(),
  notes: nullableText(1000),
});

export const paymentSchema = z.object({
  student_id: z.string().uuid("Select a student"),
  amount: z.number().positive("Amount must be greater than zero").max(10_000_000),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid payment date"),
  method: z.enum(["cash", "upi", "card", "bank", "other"]),
  reference: nullableText(120),
  notes: nullableText(1000),
});

export const instituteSchema = z.object({
  name: z.string().trim().min(1, "Institute name is required").max(160),
  contact_phone: z.preprocess(
    coalesceEmptyToNull,
    z.union([
      z.null(),
      z
        .string()
        .regex(phoneRegex, "Enter a valid phone number (6–20 digits).")
        .max(20),
    ]),
  ),
  contact_email: z.preprocess(
    coalesceEmptyToNull,
    z.union([z.null(), z.string().trim().email("Enter a valid email address").max(255)]),
  ),
  address: nullableText(500),
  receipt_prefix: z.preprocess(
    coalesceEmpty,
    z
      .string()
      .regex(/^[A-Z0-9-]{1,10}$/i, "Receipt prefix: 1–10 letters or numbers")
      .optional(),
  ),
  receipt_footer: nullableText(500),
});

export const credentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(255),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72)
    .refine((s) => !/\s/.test(s), { message: "Password must not contain spaces" }),
});

/** Required phone for signup — validated strict. */
export function requiredPhone() {
  return z.preprocess(
    (v) => {
      if (v === null || v === undefined) return undefined;
      if (typeof v === "string") return v.trim();
      return v;
    },
    z
      .string()
      .min(1, "Phone number is required")
      .regex(phoneRegex, "Enter a valid phone number (6–20 digits)")
      .max(20),
  );
}

export const signupSchema = credentialsSchema.extend({
  institute_name: z.string().trim().min(2, "Institute name is required").max(160),
  phone: requiredPhone(),
});

export const emailSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(255),
});

export const newPasswordSchema = z.object({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72)
    .refine((s) => !/\s/.test(s), { message: "Password must not contain spaces" }),
});
