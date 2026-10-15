import { Link, useRouterState } from "@tanstack/react-router";
import { LogoWordmark } from "@/components/logo";
import {
  FOUNDER_NAME,
  FOUNDER_TOWN,
  getContactConfig,
  getTelHref,
  getWhatsAppHref,
} from "@/lib/contact-config";
import { useAuth } from "@/hooks/use-auth";
import {
  WHATSAPP_PREFILL,
  landingLoginCta,
  landingSignupCta,
  marketingHomePath,
} from "@/lib/landing-copy";

export function SiteFooter() {
  const { email, phone } = getContactConfig();
  const tel = getTelHref();
  const wa = getWhatsAppHref(WHATSAPP_PREFILL);
  const { session } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const homeTo = marketingHomePath(pathname);
  const loggedIn = Boolean(session);

  return (
    <footer className="border-t border-ink/20 bg-paper">
      <div className="mx-auto max-w-[1280px] px-8 py-16 sm:px-16">
        <Link to={homeTo} aria-label="Vidya Orbit home" className="block">
          <LogoWordmark size={72} className="h-auto w-full max-w-full" />
        </Link>

        <div className="mt-12 grid gap-10 text-sm text-slate sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-medium text-ink">Product</p>
            <nav className="mt-3 flex flex-col gap-2">
              <Link to={homeTo} hash="features" className="hover:text-ink">
                Features
              </Link>
              <Link to="/pricing" className="hover:text-ink">
                Pricing
              </Link>
              {loggedIn ? (
                <Link to="/dashboard" className="hover:text-ink">
                  {landingSignupCta(true).label}
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    search={landingSignupCta(false).search}
                    className="hover:text-ink"
                  >
                    {landingSignupCta(false).label}
                  </Link>
                  <Link to="/login" className="hover:text-ink">
                    {landingLoginCta(false).label}
                  </Link>
                </>
              )}
            </nav>
          </div>

          <div>
            <p className="font-medium text-ink">Contact</p>
            <nav className="mt-3 flex flex-col gap-2">
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-ink"
                >
                  WhatsApp {FOUNDER_NAME}
                </a>
              )}
              {tel && phone && (
                <a href={tel} className="hover:text-ink">
                  {phone}
                </a>
              )}
              {email && (
                <a href={`mailto:${email}`} className="hover:text-ink">
                  {email}
                </a>
              )}
            </nav>
          </div>

          <div>
            <p className="font-medium text-ink">Legal</p>
            <nav className="mt-3 flex flex-col gap-2">
              <Link to="/privacy" className="hover:text-ink">
                Privacy
              </Link>
              <Link to="/terms" className="hover:text-ink">
                Terms
              </Link>
              <Link to="/refund-policy" className="hover:text-ink">
                Refunds &amp; cancellations
              </Link>
              <Link to="/contact" className="hover:text-ink">
                Contact
              </Link>
            </nav>
          </div>

          <p className="max-w-xs leading-relaxed">
            Coaching centre software for Kerala. Built in {FOUNDER_TOWN} by{" "}
            {FOUNDER_NAME}.
          </p>
        </div>

        <p className="mt-12 border-t border-ink/20 pt-6 text-xs text-slate">
          © {new Date().getFullYear()} Vidya Orbit
        </p>
      </div>
    </footer>
  );
}
