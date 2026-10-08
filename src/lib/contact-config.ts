/**
 * Contact configuration for upgrade / support CTAs.
 * Reads from environment variables; shows nothing when unset.
 */

export interface ContactConfig {
  whatsapp: string | null;
  email: string | null;
}

export function getContactConfig(): ContactConfig {
  return {
    whatsapp: import.meta.env.VITE_CONTACT_WHATSAPP || null,
    email: import.meta.env.VITE_CONTACT_EMAIL || null,
  };
}

export function hasAnyContact(): boolean {
  const { whatsapp, email } = getContactConfig();
  return !!(whatsapp || email);
}

export function getContactMessage(isOwner: boolean): string {
  const { whatsapp, email } = getContactConfig();
  if (!whatsapp && !email) return "";

  if (isOwner) {
    if (whatsapp && email) return `Contact us on WhatsApp or email to upgrade.`;
    if (whatsapp) return `Contact us on WhatsApp to upgrade.`;
    if (email) return `Contact us via email to upgrade.`;
  } else {
    if (whatsapp && email)
      return `Ask your administrator to upgrade, or contact us on WhatsApp or email.`;
    if (whatsapp)
      return `Ask your administrator to upgrade, or contact us on WhatsApp.`;
    if (email)
      return `Ask your administrator to upgrade, or contact us via email.`;
  }
  return "";
}

export function getContactLink(): string | null {
  const { whatsapp, email } = getContactConfig();
  if (whatsapp) {
    const clean = whatsapp.replace(/\D/g, "");
    return `https://wa.me/${clean}`;
  }
  if (email) {
    return `mailto:${email}`;
  }
  return null;
}

export function getContactLabel(): string {
  const { whatsapp, email } = getContactConfig();
  if (whatsapp) return "WhatsApp us";
  if (email) return "Email us";
  return "Contact us";
}
