import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePrefers } from "@/hooks/use-prefers";
import { formatUserError } from "@/lib/format-error";
import {
  checkEmailCopy,
  GMAIL_INBOX_URL,
  remainingCooldown,
  resendLabel,
  type CheckEmailKind,
} from "@/lib/check-your-email";
import { fadeOnly, springDefault } from "@/lib/motion";
import { toast } from "sonner";

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
      className="flex flex-col items-center text-center"
      aria-labelledby="check-email-heading"
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-soft text-primary shadow-sm ring-1 ring-primary/15">
        <Mail className="h-10 w-10" strokeWidth={1.5} aria-hidden="true" />
      </div>
      <h2
        id="check-email-heading"
        ref={headingRef}
        tabIndex={-1}
        className="mt-6 font-display text-2xl font-semibold tracking-tight outline-none"
      >
        {copy.heading}
      </h2>
      <p className="mt-3 text-sm text-muted-foreground">We sent a link to</p>
      <p className="mt-1 max-w-full break-all text-base font-semibold text-foreground">
        {email}
      </p>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {copy.instruction}
      </p>
      <p className="sr-only" aria-live="polite">
        {status}
      </p>
      <div className="mt-8 flex w-full flex-col gap-3">
        <Button asChild size="lg" className="w-full">
          <a href={GMAIL_INBOX_URL} target="_blank" rel="noopener noreferrer">
            Open Gmail
          </a>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
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
        className="mt-4 h-11 min-h-11"
        onClick={onUseDifferentEmail}
      >
        Use a different email
      </Button>
      {children}
    </motion.section>
  );
}
