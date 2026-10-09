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
    <header className="sticky top-0 z-30 material-chrome scroll-edge">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:h-16 sm:px-6">
        <Link to="/" aria-label="Vidya Orbit home" className="shrink-0">
          <LogoWordmark size={28} />
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          {nav === "landing" ? (
            <>
              <a
                href="#setup"
                className="rounded-md px-1 py-1 transition-[color,opacity] duration-100 hover:text-foreground"
              >
                How we set you up
              </a>
              <a
                href="#product"
                className="rounded-md px-1 py-1 transition-[color,opacity] duration-100 hover:text-foreground"
              >
                The app
              </a>
              <Link
                to="/pricing"
                className="rounded-md px-1 py-1 transition-[color,opacity] duration-100 hover:text-foreground"
              >
                Pricing
              </Link>
            </>
          ) : (
            <Link
              to="/"
              className="rounded-md px-1 py-1 transition-[color,opacity] duration-100 hover:text-foreground"
            >
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
            <Button size="sm" className="min-h-10">
              {CTA_START_FREE}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
