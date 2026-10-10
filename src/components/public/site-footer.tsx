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
    <footer className="border-t border-border/50 bg-card/60">
      <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted-foreground sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3 sm:col-span-2 lg:col-span-1">
            <Link to="/" aria-label="Vidya Orbit home">
              <LogoWordmark size={26} />
            </Link>
            <p className="max-w-xs leading-relaxed">
              Coaching-centre software for Kerala. Built in {FOUNDER_TOWN} by{" "}
              {FOUNDER_NAME}.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
              Product
            </p>
            <nav className="mt-3 flex flex-col gap-2">
              <Link
                to="/pricing"
                className="transition-colors duration-100 hover:text-foreground"
              >
                Pricing
              </Link>
              <Link
                to="/login"
                search={{ mode: "signup" }}
                className="transition-colors duration-100 hover:text-foreground"
              >
                Start free
              </Link>
              <Link
                to="/login"
                className="transition-colors duration-100 hover:text-foreground"
              >
                Sign in
              </Link>
            </nav>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
              Contact
            </p>
            <nav className="mt-3 flex flex-col gap-2">
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
            </nav>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
              Legal
            </p>
            <nav className="mt-3 flex flex-col gap-2">
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
              <Link
                to="/terms"
                hash="refund"
                className="transition-colors duration-100 hover:text-foreground"
              >
                Refunds &amp; cancellations
              </Link>
            </nav>
          </div>
        </div>

        <p className="mt-8 border-t border-border/60 pt-6 text-xs">
          © {new Date().getFullYear()} Vidya Orbit
        </p>
      </div>
    </footer>
  );
}
