import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft } from "lucide-react";
import { LogoWordmark } from "@/components/logo";
import { supabase } from "@/integrations/supabase/client";
import { emailSchema } from "@/lib/validation";
import { toast } from "sonner";
import { PUBLIC_PAGES, pageHead } from "@/lib/seo";
import { SkipToContent } from "@/components/skip-to-content";
import { CheckYourEmail } from "@/components/check-your-email";

export const Route = createFileRoute("/forgot-password")({
  head: () => pageHead(PUBLIC_PAGES.forgotPassword),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse({ email });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(
      parsed.data.email,
      {
        redirectTo: `${window.location.origin}/reset-password`,
      },
    );
    setLoading(false);
    // Always show success — never reveal whether email exists
    setSent(true);
    if (error && error.status && error.status >= 500)
      toast.error("Something went wrong");
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <SkipToContent href="#reset-panel" />
      <div id="reset-panel" className="w-full max-w-md">
        <div className="mb-8">
          <LogoWordmark size={28} />
          <p className="mt-2 text-xs text-muted-foreground">Reset password</p>
        </div>

        {sent ? (
          <div className="rounded-xl border bg-card p-6">
            <CheckYourEmail
              email={email}
              kind="recovery"
              onResend={async () => {
                const { error } = await supabase.auth.resetPasswordForEmail(
                  email,
                  {
                    redirectTo: `${window.location.origin}/reset-password`,
                  },
                );
                if (error && error.status && error.status >= 500) throw error;
              }}
              onUseDifferentEmail={() => setSent(false)}
            >
              <Link
                to="/login"
                className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3" /> Back to sign in
              </Link>
            </CheckYourEmail>
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="space-y-4 rounded-xl border bg-card p-6"
          >
            <h2 className="font-display text-xl font-semibold">
              Forgot your password?
            </h2>
            <p className="text-sm text-muted-foreground">
              Enter the email on your account and we'll send a reset link.
            </p>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <Button type="submit" disabled={loading} className="h-12 w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send reset link
            </Button>
            <Link
              to="/login"
              className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" /> Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
