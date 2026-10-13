import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { LogoWordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { getWhatsAppHref } from "@/lib/contact-config";
import { CTA_BOOK_SETUP, WHATSAPP_PREFILL } from "@/lib/landing-copy";
import { usePrefers } from "@/hooks/use-prefers";
import { easeDrawer, fadeOnly, springSnappy } from "@/lib/motion";
import { cn } from "@/lib/utils";

const LANDING_LINKS = [
  { hash: "features", label: "Features" },
  { hash: "pricing", label: "Pricing" },
  { hash: "faq", label: "FAQ" },
] as const;

function scrollToHash(hash: string, smooth: boolean) {
  const el = document.getElementById(hash);
  if (!el) return;
  el.scrollIntoView({
    behavior: smooth ? "smooth" : "auto",
    block: "start",
  });
  if (window.location.hash !== `#${hash}`) {
    history.replaceState(null, "", `#${hash}`);
  }
}

export function SiteHeader({
  nav = "landing",
}: {
  nav?: "landing" | "pricing";
}) {
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

  const onSectionNav = (hash: string) => {
    setOpen(false);
    requestAnimationFrame(() => scrollToHash(hash, !reducedMotion));
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-ink/15 bg-paper">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-4 px-8 sm:px-16">
          <Link
            to="/"
            aria-label="Vidya Orbit home"
            className="shrink-0"
            onClick={() => setOpen(false)}
          >
            <LogoWordmark size={22} />
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-slate md:flex">
            {nav === "landing" ? (
              <>
                {LANDING_LINKS.map((l) => (
                  <Link
                    key={l.hash}
                    to="/"
                    hash={l.hash}
                    hashScrollIntoView={{
                      behavior: reducedMotion ? "instant" : "smooth",
                      block: "start",
                    }}
                    className="transition-colors duration-150 [transition-timing-function:var(--ease-out)] hover:text-ink"
                    onClick={(e) => {
                      e.preventDefault();
                      onSectionNav(l.hash);
                    }}
                  >
                    {l.label}
                  </Link>
                ))}
              </>
            ) : (
              <>
                <Link
                  to="/"
                  className="transition-colors duration-150 hover:text-ink"
                >
                  Home
                </Link>
                <Link to="/pricing" className="text-ink" aria-current="page">
                  Pricing
                </Link>
              </>
            )}
            <Link
              to="/login"
              className="transition-colors duration-150 hover:text-ink"
            >
              Log in
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:inline-flex"
              >
                <Button
                  size="sm"
                  className="h-9 !rounded-[4px] bg-orbit-blue px-3 text-paper hover:bg-orbit-blue/90"
                >
                  {CTA_BOOK_SETUP}
                </Button>
              </a>
            )}

            <button
              type="button"
              className="relative flex h-10 w-10 items-center justify-center text-ink md:hidden"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              <span className="sr-only">{open ? "Close" : "Menu"}</span>
              <span className="relative block h-3.5 w-4">
                <span
                  className={cn(
                    "absolute left-0 top-0 block h-0.5 w-4 bg-current transition-transform duration-300 [transition-timing-function:var(--ease-drawer)]",
                    open && "top-1.5 rotate-45",
                  )}
                />
                <span
                  className={cn(
                    "absolute left-0 top-1.5 block h-0.5 w-4 bg-current transition-opacity duration-200 [transition-timing-function:var(--ease-out)]",
                    open && "opacity-0",
                  )}
                />
                <span
                  className={cn(
                    "absolute left-0 top-3 block h-0.5 w-4 bg-current transition-transform duration-300 [transition-timing-function:var(--ease-drawer)]",
                    open && "top-1.5 -rotate-45",
                  )}
                />
              </span>
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            key="editorial-menu"
            className="fixed inset-0 z-50 bg-paper md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={
              reducedMotion ? fadeOnly : { duration: 0.28, ease: easeDrawer }
            }
          >
            <nav className="flex h-full flex-col px-8 pb-10 pt-24">
              <ul className="space-y-1 border-t border-ink/20">
                {nav === "landing" ? (
                  LANDING_LINKS.map((l, i) => (
                    <motion.li
                      key={l.hash}
                      initial={
                        reducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }
                      }
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        ...(reducedMotion ? fadeOnly : springSnappy),
                        delay: reducedMotion ? 0 : 0.06 + i * 0.04,
                      }}
                      className="border-b border-ink/20"
                    >
                      <a
                        href={`#${l.hash}`}
                        className="block py-4 font-display text-2xl font-bold tracking-[-0.03em]"
                        onClick={(e) => {
                          e.preventDefault();
                          onSectionNav(l.hash);
                        }}
                      >
                        {l.label}
                      </a>
                    </motion.li>
                  ))
                ) : (
                  <motion.li
                    initial={
                      reducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }
                    }
                    animate={{ opacity: 1, y: 0 }}
                    transition={reducedMotion ? fadeOnly : springSnappy}
                    className="border-b border-ink/20"
                  >
                    <Link
                      to="/"
                      className="block py-4 font-display text-2xl font-bold tracking-[-0.03em]"
                      onClick={() => setOpen(false)}
                    >
                      Home
                    </Link>
                  </motion.li>
                )}
                <motion.li
                  initial={
                    reducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }
                  }
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    ...(reducedMotion ? fadeOnly : springSnappy),
                    delay: reducedMotion ? 0 : 0.2,
                  }}
                  className="border-b border-ink/20"
                >
                  <Link
                    to="/login"
                    className="block py-4 font-display text-2xl font-bold tracking-[-0.03em]"
                    onClick={() => setOpen(false)}
                  >
                    Log in
                  </Link>
                </motion.li>
              </ul>
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-auto"
                >
                  <Button
                    size="lg"
                    className="w-full !rounded-[4px] bg-orbit-blue text-paper"
                  >
                    {CTA_BOOK_SETUP}
                  </Button>
                </a>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
