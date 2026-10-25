import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { AUTH_BTN } from "@/components/auth/auth-shell";
import { usePrefers } from "@/hooks/use-prefers";
import { formatUserError } from "@/lib/format-error";
import {
  checkEmailCopy,
  GMAIL_INBOX_URL,
  OUTLOOK_INBOX_URL,
  remainingCooldown,
  resendLabel,
  type CheckEmailKind,
} from "@/lib/check-your-email";
import { fadeOnly, springDefault } from "@/lib/motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  email: string;
  kind: CheckEmailKind;
  onResend: () => Promise<void>;
  onUseDifferentEmail: () => void;
  children?: ReactNode;
};

export function CheckYourEmail({
  email,
  kind,
  onResend,
  onUseDifferentEmail,
  children,
}: Props) {
  const { reducedMotion } = usePrefers();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [sentAt, setSentAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [resending, setResending] = useState(false);
  const [status, setStatus] = useState("Email sent.");
  const remaining = remainingCooldown(sentAt, now);
  const copy = checkEmailCopy(kind);
  const canResend = remaining === 0 && !resending;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    if (remainingCooldown(sentAt, Date.now()) <= 0) return;
    const id = window.setInterval(() => {
      const next = Date.now();
      setNow(next);
      if (remainingCooldown(sentAt, next) <= 0) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [sentAt]);

  async function handleResend() {
    if (!canResend) return;
    setResending(true);
    try {
      await onResend();
      setSentAt(Date.now());
      setNow(Date.now());
      setStatus("Email sent again. Check your inbox.");
    } catch (error) {
      toast.error(formatUserError(error, "Could not resend the email."));
    } finally {
      setResending(false);
    }
  }

  return (
    <motion.section
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? fadeOnly : springDefault}
      className="flex flex-col"
      aria-labelledby="check-email-heading"
    >
      <Logo size={48} />
      <h2
        id="check-email-heading"
        ref={headingRef}
        tabIndex={-1}
        className="mt-8 font-display text-3xl font-bold tracking-[-0.03em] outline-none"
      >
        {copy.heading}
      </h2>
      <p className="mt-4 text-sm text-slate">We sent a link to</p>
      <p className="mt-1 max-w-full break-all font-display text-lg font-bold tracking-[-0.02em] text-ink">
        {email}
      </p>
      <p className="mt-3 max-w-sm text-pretty text-base leading-relaxed text-slate">
        {copy.instruction}
      </p>
      <p className="sr-only" aria-live="polite">
        {status}
      </p>
      <div className="mt-8 flex w-full flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Button
            asChild
            size="lg"
            className={cn(
              AUTH_BTN,
              "w-full bg-orbit-blue text-paper hover:bg-orbit-blue/90",
            )}
          >
            <a href={GMAIL_INBOX_URL} target="_blank" rel="noopener noreferrer">
              Open Gmail
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className={cn(
              AUTH_BTN,
              "w-full border-ink text-ink hover:bg-ink/5",
            )}
          >
            <a
              href={OUTLOOK_INBOX_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Outlook
            </a>
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className={cn(AUTH_BTN, "w-full border-ink text-ink hover:bg-ink/5")}
          onClick={handleResend}
          disabled={!canResend}
        >
          {resending && <Loader2 className="h-4 w-4 animate-spin" />}
          {resendLabel(remaining)}
        </Button>
      </div>
      <Button
        type="button"
        variant="link"
        className="mt-4 h-11 min-h-11 justify-start px-0 text-slate hover:text-ink"
        onClick={onUseDifferentEmail}
      >
        Use a different email
      </Button>
      {children}
    </motion.section>
  );
}
