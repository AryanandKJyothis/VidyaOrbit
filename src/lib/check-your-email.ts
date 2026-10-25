/** Seconds before the user can request another auth email. */
export const RESEND_COOLDOWN_SECONDS = 60;

export const GMAIL_INBOX_URL = "https://mail.google.com/";
export const OUTLOOK_INBOX_URL = "https://outlook.live.com/mail/";

export type CheckEmailKind = "signup" | "invite_signup" | "recovery";

const COPY: Record<CheckEmailKind, { heading: string; instruction: string }> = {
  signup: {
    heading: "Check your email",
    instruction:
      "Open the confirmation link to continue. If you don't see it, check spam or promotions.",
  },
  invite_signup: {
    heading: "Check your email",
    instruction:
      "Open the confirmation link, then return to this invite. If you don't see it, check spam or promotions.",
  },
  recovery: {
    heading: "Check your email",
    instruction:
      "Open the link to choose a new password. If you don't see it, check spam or promotions.",
  },
};

export function checkEmailCopy(kind: CheckEmailKind): {
  heading: string;
  instruction: string;
} {
  return COPY[kind];
}

export function remainingCooldown(
  sentAtMs: number,
  nowMs: number,
  cooldownSeconds = RESEND_COOLDOWN_SECONDS,
): number {
  const elapsed = Math.floor((nowMs - sentAtMs) / 1000);
  return Math.max(0, cooldownSeconds - elapsed);
}

export function resendLabel(remainingSeconds: number): string {
  if (remainingSeconds > 0) return `Resend in ${remainingSeconds}s`;
  return "Resend email";
}
