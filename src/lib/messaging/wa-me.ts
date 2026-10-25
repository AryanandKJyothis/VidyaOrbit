import { e164ToWaMe } from "./phone";

/** Tier 1: open the centre's own WhatsApp with number + prefilled text. */
export function buildAssistedWhatsAppHref(
  phone: string | null | undefined,
  body: string | null | undefined,
): string | null {
  const digits = e164ToWaMe(phone) ?? null;
  if (!digits || !body?.trim()) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
}

export function openAssistedWhatsApp(href: string): boolean {
  if (typeof window === "undefined") return false;
  return window.open(href, "_blank", "noopener,noreferrer") !== null;
}
