/**
 * Contact configuration for upgrade / support CTAs.
 * Centralizes all contact info for the site (landing, pricing, terms, privacy, billing).
 * Reads from environment variables with built-in defaults. To hide contact info,
 * explicitly set the env var to an empty string.
 */

export interface ContactConfig {
  phone: string | null;
  whatsapp: string | null;
  whatsappUrl: string | null;
  email: string | null;
}

export const DEFAULT_PHONE = "+91 7025063047";
export const DEFAULT_WHATSAPP_NUMBER = "917025063047";
export const DEFAULT_WHATSAPP_URL = "https://wa.me/917025063047";
export const DEFAULT_EMAIL = "aryanandkjyothis4@gmail.com";

export function getContactConfig(): ContactConfig {
  const envPhone = import.meta.env.VITE_CONTACT_PHONE;
  const envWhatsapp = import.meta.env.VITE_CONTACT_WHATSAPP;
  const envEmail = import.meta.env.VITE_CONTACT_EMAIL;

  const phone =
    envPhone !== undefined && envPhone !== ""
      ? envPhone
      : envPhone === ""
        ? null
        : DEFAULT_PHONE;
  const whatsappRaw =
    envWhatsapp !== undefined && envWhatsapp !== ""
      ? envWhatsapp
      : envWhatsapp === ""
        ? null
        : DEFAULT_WHATSAPP_NUMBER;
  const email =
    envEmail !== undefined && envEmail !== ""
      ? envEmail
      : envEmail === ""
        ? null
        : DEFAULT_EMAIL;

  let whatsappUrl: string | null = null;
  if (whatsappRaw) {
    const clean = whatsappRaw.replace(/\D/g, "");
    whatsappUrl = `https://wa.me/${clean}`;
  } else if (envWhatsapp === undefined) {
    whatsappUrl = DEFAULT_WHATSAPP_URL;
  }

  return {
    phone,
    whatsapp: whatsappRaw,
    whatsappUrl,
    email,
  };
}

export function hasAnyContact(): boolean {
  const { whatsappUrl, email } = getContactConfig();
  return !!(whatsappUrl || email);
}

export function getContactMessage(isOwner: boolean): string {
  const { whatsappUrl, email } = getContactConfig();
  if (!whatsappUrl && !email) return "";

  if (isOwner) {
    if (whatsappUrl && email)
      return `Contact us on WhatsApp or email to upgrade.`;
    if (whatsappUrl) return `Contact us on WhatsApp to upgrade.`;
    if (email) return `Contact us via email to upgrade.`;
  } else {
    if (whatsappUrl && email)
      return `Ask your administrator to upgrade, or contact us on WhatsApp or email.`;
    if (whatsappUrl)
      return `Ask your administrator to upgrade, or contact us on WhatsApp.`;
    if (email)
      return `Ask your administrator to upgrade, or contact us via email.`;
  }
  return "";
}

export function getContactLink(): string | null {
  const { whatsappUrl, email } = getContactConfig();
  if (whatsappUrl) {
    return whatsappUrl;
  }
  if (email) {
    return `mailto:${email}`;
  }
  return null;
}

export function getContactLabel(): string {
  const { whatsappUrl, email } = getContactConfig();
  if (whatsappUrl) return "WhatsApp us";
  if (email) return "Email us";
  return "Contact us";
}
