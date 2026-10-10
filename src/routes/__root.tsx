import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  Link,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { AuthProvider } from "@/hooks/use-auth";
import { Toaster } from "@/components/ui/sonner";
import { RouteProgress } from "@/components/route-progress";
import { LogoWordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { SkipToContent } from "@/components/skip-to-content";
import {
  FOUNDER_NAME,
  getContactConfig,
  getTelHref,
  getWhatsAppHref,
} from "@/lib/contact-config";
import { WHATSAPP_PREFILL } from "@/lib/landing-copy";
import {
  OG_IMAGE_ALT,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_URL,
  OG_IMAGE_WIDTH,
  PUBLIC_PAGES,
  SITE_NAME,
  verificationMeta,
} from "@/lib/seo";
import { MessageCircle, Phone } from "lucide-react";
import appCss from "../styles.css?url";

function NotFoundComponent() {
  const { phone } = getContactConfig();
  const tel = getTelHref();
  const wa = getWhatsAppHref(
    "Hi Aryanand, I followed a link that led to a missing page on Vidya Orbit.",
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SkipToContent href="#not-found" />
      <header className="border-b border-border/60 px-4 py-4 sm:px-6">
        <Link to="/" aria-label="Vidya Orbit home">
          <LogoWordmark size={28} />
        </Link>
      </header>
      <main
        id="not-found"
        className="flex flex-1 items-center justify-center px-4 py-16"
      >
        <div className="max-w-md text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            404
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            This page isn&apos;t here
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            The link may be old, mistyped, or shared from WhatsApp. Head home,
            check pricing, or message {FOUNDER_NAME}.
          </p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-2.5 sm:flex-row sm:items-center">
            <Button asChild>
              <Link to="/">Go home</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/pricing">Pricing</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/login" search={{ mode: "signup" }}>
                Start free
              </Link>
            </Button>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-foreground"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp {FOUNDER_NAME}
              </a>
            )}
            {tel && phone && (
              <a
                href={tel}
                className="inline-flex items-center gap-1.5 hover:text-foreground"
              >
                <Phone className="h-3.5 w-3.5" />
                {phone}
              </a>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const isDev = import.meta.env.DEV;
  const errorMessage = error instanceof Error ? error.message : String(error);
  if (!isDev) {
    // Surface details to engineers, not to end users.
    console.error("[Vidya] Unhandled route error:", error);
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isDev
            ? errorMessage
            : "An unexpected error occurred. Please try again."}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    head: () => ({
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: PUBLIC_PAGES.home.title },
        { name: "description", content: PUBLIC_PAGES.home.description },
        { name: "author", content: "Aryanand, Vidya Orbit" },
        { property: "og:site_name", content: SITE_NAME },
        { property: "og:locale", content: "en_IN" },
        { property: "og:type", content: "website" },
        { property: "og:image", content: OG_IMAGE_URL },
        { property: "og:image:width", content: OG_IMAGE_WIDTH },
        { property: "og:image:height", content: OG_IMAGE_HEIGHT },
        { property: "og:image:alt", content: OG_IMAGE_ALT },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: OG_IMAGE_URL },
        { name: "twitter:image:alt", content: OG_IMAGE_ALT },
        ...verificationMeta(),
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        {
          rel: "preload",
          href: "/fonts/sora-700-latin.woff2",
          as: "font",
          type: "font/woff2",
          crossOrigin: "anonymous",
        },
      ],
    }),
    shellComponent: RootShell,
    component: RootComponent,
    notFoundComponent: NotFoundComponent,
    errorComponent: ErrorComponent,
  },
);

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <HeadContent />
      </head>
      <body className="bg-orbital">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouteProgress />
        <Outlet />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </QueryClientProvider>
  );
}
