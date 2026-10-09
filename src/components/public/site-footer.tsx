import { Link } from "@tanstack/react-router";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { LogoWordmark } from "@/components/logo";
import {
  FOUNDER_NAME,
  FOUNDER_TOWN,
  getContactConfig,
  getTelHref,
  getWhatsAppHref,
} from "@/lib/contact-config";
import { WHATSAPP_PREFILL } from "@/lib/landing-copy";

export function SiteFooter() {
  const { email, phone } = getContactConfig();
  const tel = getTelHref();
  const wa = getWhatsAppHref(WHATSAPP_PREFILL);

  return (
    <footer className="border-t border-border/50 bg-card/50">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:px-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <LogoWordmark size={26} />
          <p>
            Built in {FOUNDER_TOWN} by {FOUNDER_NAME}.
          </p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link
            to="/login"
            className="transition-colors duration-100 hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            to="/pricing"
            className="transition-colors duration-100 hover:text-foreground"
          >
            Pricing
          </Link>
          <Link
            to="/terms"
            className="transition-colors duration-100 hover:text-foreground"
          >
            Terms
          </Link>
          <Link
            to="/privacy"
            className="transition-colors duration-100 hover:text-foreground"
          >
            Privacy
          </Link>
          {tel && phone && (
            <a
              href={tel}
              className="inline-flex items-center gap-1.5 transition-colors duration-100 hover:text-foreground"
            >
              <Phone className="h-3.5 w-3.5" />
              {phone}
            </a>
          )}
          {email && (
            <a
              href={`mailto:${email}`}
              className="inline-flex items-center gap-1.5 transition-colors duration-100 hover:text-foreground"
            >
              <Mail className="h-3.5 w-3.5" />
              {email}
            </a>
          )}
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 transition-colors duration-100 hover:text-foreground"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp {FOUNDER_NAME}
            </a>
          )}
        </nav>
        <p>© {new Date().getFullYear()} Vidya Orbit</p>
      </div>
    </footer>
  );
}
