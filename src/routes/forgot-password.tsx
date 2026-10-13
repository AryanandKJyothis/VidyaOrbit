import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { AUTH_BTN, AuthShell } from "@/components/auth/auth-shell";
import { supabase } from "@/integrations/supabase/client";
import { emailSchema } from "@/lib/validation";
import { toast } from "sonner";
import { PUBLIC_PAGES, pageHead } from "@/lib/seo";
import { CheckYourEmail } from "@/components/check-your-email";
import { cn } from "@/lib/utils";

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
    <AuthShell>
      {sent ? (
        <CheckYourEmail
          email={email}
          kind="recovery"
          onResend={async () => {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: `${window.location.origin}/reset-password`,
            });
            if (error && error.status && error.status >= 500) throw error;
          }}
          onUseDifferentEmail={() => setSent(false)}
        >
          <Link
            to="/login"
            className="mt-2 inline-flex min-h-11 items-center text-sm text-slate underline-offset-4 hover:text-ink hover:underline"
          >
            Back to sign in
          </Link>
        </CheckYourEmail>
      ) : (
        <>
          <p className="text-sm text-slate">Reset password</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-[-0.03em] text-balance">
            Forgot your password?
          </h2>
          <p className="mt-3 text-pretty text-base leading-relaxed text-slate">
            Enter the email on your account and we&apos;ll send a reset link.
          </p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="!rounded-[4px]"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className={cn(
                AUTH_BTN,
                "w-full bg-orbit-blue text-paper hover:bg-orbit-blue/90",
              )}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send reset link
            </Button>
            <Link
              to="/login"
              className="inline-flex min-h-11 items-center text-sm text-slate underline-offset-4 hover:text-ink hover:underline"
            >
              Back to sign in
            </Link>
          </form>
        </>
      )}
    </AuthShell>
  );
}
