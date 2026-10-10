import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, MessageCircle, Phone } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
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
import { usePrefers } from "@/hooks/use-prefers";
import { easeDrawer, fadeOnly, springSnappy } from "@/lib/motion";
import { cn } from "@/lib/utils";

const LANDING_LINKS = [
  { href: "#product", label: "The app" },
  { href: "#setup", label: "How we set you up" },
  { href: "#benefits", label: "Benefits" },
  { href: "#faq", label: "FAQ" },
] as const;

export function SiteHeader({
  nav = "landing",
}: {
  nav?: "landing" | "pricing";
}) {
  const { phone } = getContactConfig();
  const tel = getTelHref();
  const wa = getWhatsAppHref(WHATSAPP_PREFILL);
  const [open, setOpen] = useState(false);
  const { reducedMotion } = usePrefers();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <div className="pointer-events-none sticky top-0 z-40 px-4 pt-4 sm:px-6 sm:pt-6">
        <header
          className={cn(
            "pointer-events-auto mx-auto flex w-max max-w-full items-center gap-2 rounded-full border border-border/60 bg-background/70 px-2 py-1.5 shadow-[var(--shadow-card)] backdrop-blur-xl backdrop-saturate-150 sm:gap-3 sm:px-3 sm:py-2",
            "supports-[backdrop-filter]:bg-background/55",
          )}
        >
          <Link
            to="/"
            aria-label="Vidya Orbit home"
            className="shrink-0 rounded-full px-1.5 py-1"
            onClick={() => setOpen(false)}
          >
            <LogoWordmark size={24} />
          </Link>

          <nav className="hidden items-center gap-1 text-sm text-muted-foreground md:flex">
            {nav === "landing" ? (
              <>
                {LANDING_LINKS.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    className="rounded-full px-2.5 py-1.5 transition-[color,background-color] duration-150 [transition-timing-function:var(--ease-out)] hover:bg-muted/70 hover:text-foreground"
                  >
                    {l.label}
                  </a>
                ))}
                <Link
                  to="/pricing"
                  className="rounded-full px-2.5 py-1.5 transition-[color,background-color] duration-150 [transition-timing-function:var(--ease-out)] hover:bg-muted/70 hover:text-foreground"
                >
                  Pricing
                </Link>
              </>
            ) : (
              <Link
                to="/"
                className="rounded-full px-2.5 py-1.5 transition-[color,background-color] duration-150 [transition-timing-function:var(--ease-out)] hover:bg-muted/70 hover:text-foreground"
              >
                Home
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-1">
            {tel && phone && (
              <a
                href={tel}
                aria-label={`Call ${FOUNDER_NAME} at ${phone}`}
                className="hidden sm:inline-flex"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                >
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
                className="hidden sm:inline-flex"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-full px-3"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </Button>
              </a>
            )}
            <Link
              to="/login"
              search={{ mode: "signup" }}
              className="hidden sm:inline-flex"
            >
              <Button size="sm" className="h-9 rounded-full px-3">
                {CTA_START_FREE}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>

            <button
              type="button"
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-[background-color] duration-150 [transition-timing-function:var(--ease-out)] hover:bg-muted md:hidden"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              <span className="sr-only">{open ? "Close" : "Menu"}</span>
              <span className="relative block h-3.5 w-4">
                <span
                  className={cn(
                    "absolute left-0 top-0 block h-0.5 w-4 rounded-full bg-current transition-transform duration-300 [transition-timing-function:var(--ease-drawer)]",
                    open && "top-1.5 rotate-45",
                  )}
                />
                <span
                  className={cn(
                    "absolute left-0 top-1.5 block h-0.5 w-4 rounded-full bg-current transition-opacity duration-200 [transition-timing-function:var(--ease-out)]",
                    open && "opacity-0",
                  )}
                />
                <span
                  className={cn(
                    "absolute left-0 top-3 block h-0.5 w-4 rounded-full bg-current transition-transform duration-300 [transition-timing-function:var(--ease-drawer)]",
                    open && "top-1.5 -rotate-45",
                  )}
                />
              </span>
            </button>
          </div>
        </header>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            key="island-menu"
            className="fixed inset-0 z-50 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={
              reducedMotion ? fadeOnly : { duration: 0.28, ease: easeDrawer }
            }
          >
            <button
              type="button"
              className="absolute inset-0 bg-background/80 backdrop-blur-3xl"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            />
            <nav className="relative z-10 flex h-full flex-col px-6 pb-10 pt-24">
              <ul className="space-y-1">
                {nav === "landing" ? (
                  <>
                    {LANDING_LINKS.map((l, i) => (
                      <motion.li
                        key={l.href}
                        initial={
                          reducedMotion ? { opacity: 0 } : { opacity: 0, y: 48 }
                        }
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          ...(reducedMotion ? fadeOnly : springSnappy),
                          delay: reducedMotion ? 0 : 0.08 + i * 0.05,
                        }}
                      >
                        <a
                          href={l.href}
                          className="block rounded-2xl px-3 py-3 font-display text-2xl font-semibold tracking-tight"
                          onClick={() => setOpen(false)}
                        >
                          {l.label}
                        </a>
                      </motion.li>
                    ))}
                    <motion.li
                      initial={
                        reducedMotion ? { opacity: 0 } : { opacity: 0, y: 48 }
                      }
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        ...(reducedMotion ? fadeOnly : springSnappy),
                        delay: reducedMotion
                          ? 0
                          : 0.08 + LANDING_LINKS.length * 0.05,
                      }}
                    >
                      <Link
                        to="/pricing"
                        className="block rounded-2xl px-3 py-3 font-display text-2xl font-semibold tracking-tight"
                        onClick={() => setOpen(false)}
                      >
                        Pricing
                      </Link>
                    </motion.li>
                  </>
                ) : (
                  <motion.li
                    initial={
                      reducedMotion ? { opacity: 0 } : { opacity: 0, y: 48 }
                    }
                    animate={{ opacity: 1, y: 0 }}
                    transition={reducedMotion ? fadeOnly : springSnappy}
                  >
                    <Link
                      to="/"
                      className="block rounded-2xl px-3 py-3 font-display text-2xl font-semibold tracking-tight"
                      onClick={() => setOpen(false)}
                    >
                      Home
                    </Link>
                  </motion.li>
                )}
              </ul>
              <div className="mt-auto flex flex-col gap-2">
                {wa && (
                  <a href={wa} target="_blank" rel="noreferrer">
                    <Button size="lg" className="w-full">
                      <MessageCircle className="h-4 w-4" />
                      {CTA_WHATSAPP}
                    </Button>
                  </a>
                )}
                <Link to="/login" search={{ mode: "signup" }}>
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full"
                    onClick={() => setOpen(false)}
                  >
                    {CTA_START_FREE}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
