import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { AUTH_BTN, AuthShell } from "@/components/auth/auth-shell";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { newPasswordSchema } from "@/lib/validation";
import { formatUserError } from "@/lib/format-error";
import { toast } from "sonner";
import { PUBLIC_PAGES, pageHead } from "@/lib/seo";

export const Route = createFileRoute("/reset-password")({
  head: () => pageHead(PUBLIC_PAGES.resetPassword),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery hash and emits PASSWORD_RECOVERY on load
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")
        setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return toast.error("Passwords don't match");
    const parsed = newPasswordSchema.safeParse({ password });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });
    setLoading(false);
    if (error)
      return toast.error(
        formatUserError(error, "Could not update password. Please try again."),
      );
    toast.success("Password updated");
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      toast.error(
        "Password updated, but the session could not be closed. Please sign out manually.",
      );
    }
    navigate({ to: "/login" });
  };

  return (
    <AuthShell>
      <p className="text-sm text-slate">Set a new password</p>
      <h2 className="mt-2 font-display text-3xl font-bold tracking-[-0.03em] text-balance">
        Create a new password
      </h2>
      <form onSubmit={submit} className="mt-8 space-y-4">
        {!ready && (
          <p className="text-sm leading-relaxed text-slate">
            Open this page from the reset link in your email. The link is valid
            for 1 hour.
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="np">New password</Label>
          <PasswordInput
            id="np"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className="!rounded-[4px]"
          />
          <p className="text-xs text-slate">
            At least 8 characters. Checked against known data breaches.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cp">Confirm password</Label>
          <PasswordInput
            id="cp"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            className="!rounded-[4px]"
          />
        </div>
        <Button
          type="submit"
          disabled={loading || !ready}
          className={cn(
            AUTH_BTN,
            "w-full bg-orbit-blue text-paper hover:bg-orbit-blue/90",
          )}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Update password
        </Button>
      </form>
    </AuthShell>
  );
}
