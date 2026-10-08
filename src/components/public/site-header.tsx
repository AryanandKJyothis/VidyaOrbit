import { Link } from "@tanstack/react-router";
import { ArrowRight, MessageCircle, Phone } from "lucide-react";
import { LogoWordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
  FOUNDER_NAME,
  getContactConfig,
  getTelHref,
  getWhatsAppHref,
} from "@/lib/contact-config";
import {
  CTA_START_FREE,
  CTA_WHATSAPP,
  WHATSAPP_PREFILL,
} from "@/lib/landing-copy";

export function SiteHeader({
  nav = "landing",
}: {
  nav?: "landing" | "pricing";
}) {
  const { phone } = getContactConfig();
  const tel = getTelHref();
  const wa = getWhatsAppHref(WHATSAPP_PREFILL);

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:h-16 sm:px-6">
        <Link to="/" aria-label="Vidya Orbit home" className="shrink-0">
          <LogoWordmark size={28} />
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          {nav === "landing" ? (
            <>
              <a href="#setup" className="hover:text-foreground transition">
                How we set you up
              </a>
              <a href="#product" className="hover:text-foreground transition">
                The app
              </a>
              <Link to="/pricing" className="hover:text-foreground transition">
                Pricing
              </Link>
            </>
          ) : (
            <Link to="/" className="hover:text-foreground transition">
              Home
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          {tel && phone && (
            <a href={tel} aria-label={`Call ${FOUNDER_NAME} at ${phone}`}>
              <Button variant="ghost" size="icon" className="h-11 w-11">
                <Phone className="h-4 w-4" />
              </Button>
            </a>
          )}
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              aria-label={CTA_WHATSAPP}
              className="sm:hidden"
            >
              <Button variant="ghost" size="icon" className="h-11 w-11">
                <MessageCircle className="h-4 w-4" />
              </Button>
            </a>
          )}
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:block"
            >
              <Button variant="outline" size="sm" className="min-h-10">
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </Button>
            </a>
          )}
          <Link to="/login" search={{ mode: "signup" }}>
            <Button size="sm" className="min-h-10 shadow-sm">
              {CTA_START_FREE}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
