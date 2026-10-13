import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { LoadingScreen } from "@/components/loading-screen";
import { useAuth } from "@/hooks/use-auth";
import { parseAuthNext } from "@/lib/auth-callback";
import { PUBLIC_PAGES, pageHead } from "@/lib/seo";

const searchSchema = z
  .object({
    next: z.string().optional(),
    error: z.string().optional(),
    error_description: z.string().optional(),
    code: z.string().optional(),
  })
  .passthrough();

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => pageHead(PUBLIC_PAGES.authCallback),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const search = Route.useSearch();
  const [error, setError] = useState<string | null>(() =>
    oauthErrorMessage(search.error, search.error_description),
  );

  useEffect(() => {
    if (error) return;
    if (loading) return;
    if (session) {
      const next = parseAuthNext(search.next);
      if (next.kind === "join") {
        void navigate({ to: "/join/$token", params: { token: next.token } });
        return;
      }
      if (next.kind === "invites") {
        void navigate({
          to: "/invites",
          search: next.token ? { token: next.token } : {},
        });
        return;
      }
      void navigate({ to: "/dashboard" });
      return;
    }

    const timeout = window.setTimeout(() => {
      setError("Could not complete sign-in. Please try again.");
    }, 12_000);
    return () => window.clearTimeout(timeout);
  }, [error, loading, session, navigate, search.next]);

  if (error) {
    return (
      <div className="bg-brand-grid flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <Logo size={48} />
        <p
          role="alert"
          className="max-w-sm text-center text-sm text-muted-foreground"
        >
          {error}
        </p>
        <Button asChild>
          <Link to="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return <LoadingScreen label="Signing you in…" />;
}

function oauthErrorMessage(
  error?: string,
  description?: string,
): string | null {
  if (!error && !description) return null;
  if (error === "access_denied") {
    return "Google sign-in was cancelled. You can try again when you are ready.";
  }
  return description || "Google sign-in failed. Please try again.";
}
