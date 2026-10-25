import { normalizePhoneKey } from "@/lib/student-import";
import type { ResolvedParentPhone } from "./types";

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

/**
 * Guardian/student numbers stored as +91XXXXXXXXXX.
 * Invalid or missing numbers are skipped (no row body, status skipped).
 */
export function normalizeIndiaE164(
  phone: string | null | undefined,
): string | null {
  const key = normalizePhoneKey(phone);
  if (!key || !INDIAN_MOBILE.test(key)) return null;
  return `+91${key}`;
}

export function e164ToWaMe(e164: string | null | undefined): string | null {
  if (!e164) return null;
  const key = normalizePhoneKey(e164);
  if (!key || !INDIAN_MOBILE.test(key)) return null;
  return `91${key}`;
}

export function resolveParentWhatsAppPhone(student: {
  guardian_phone?: string | null;
  phone?: string | null;
}): ResolvedParentPhone | null {
  const guardian = normalizeIndiaE164(student.guardian_phone);
  if (guardian) {
    return { e164: guardian, waMe: e164ToWaMe(guardian)!, source: "guardian" };
  }
  const own = normalizeIndiaE164(student.phone);
  if (own) {
    return { e164: own, waMe: e164ToWaMe(own)!, source: "student" };
  }
  return null;
}

export function hasValidParentPhone(student: {
  guardian_phone?: string | null;
  phone?: string | null;
}): boolean {
  return resolveParentWhatsAppPhone(student) !== null;
}
