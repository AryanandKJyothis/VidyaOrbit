import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { GraduationCap, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display text-lg font-semibold">Vidya</div>
            <div className="text-xs text-muted-foreground">
              Set a new password
            </div>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-xl border bg-card p-6"
        >
          <h2 className="font-display text-xl font-semibold">
            Create a new password
          </h2>
          {!ready && (
            <p className="text-sm text-muted-foreground">
              Open this page from the reset link in your email. The link is
              valid for 1 hour.
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
            />
            <p className="text-xs text-muted-foreground">
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
            />
          </div>
          <Button type="submit" disabled={loading || !ready} className="w-full">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update password
          </Button>
        </form>
      </div>
    </div>
  );
}
