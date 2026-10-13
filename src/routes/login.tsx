import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mail } from "lucide-react";
import { SkipToContent } from "@/components/skip-to-content";
import { Logo } from "@/components/logo";
import { OnboardingForm } from "@/components/onboarding-form";
import {
  GoogleAuthDivider,
  GoogleContinueButton,
} from "@/components/google-continue-button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { credentialsSchema } from "@/lib/validation";
import { formatUserError } from "@/lib/format-error";
import { GOOGLE_AUTH_ENABLED } from "@/lib/feature-flags";
import { signInWithGoogle } from "@/lib/google-auth";
import { PUBLIC_PAGES, pageHead } from "@/lib/seo";
import { getContactConfig, getTelHref } from "@/lib/contact-config";
import { Card, CardContent } from "@/components/ui/card";

const searchSchema = z.object({
  invite: z.string().min(10).max(200).optional(),
  mode: z.enum(["login", "signup"]).optional().catch(undefined),
});

export const Route = createFileRoute("/login")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => pageHead(PUBLIC_PAGES.login),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const { invite, mode } = Route.useSearch();
  const joiningTeam = !!invite;
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginErrors, setLoginErrors] = useState<{
    email?: string;
    password?: string;
    form?: string;
  }>({});

  const postLoginPath = joiningTeam
    ? `/invites?token=${encodeURIComponent(invite!)}`
    : "/dashboard";
  const redirectOrigin =
    typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    if (!loading && session) navigate({ to: postLoginPath });
  }, [loading, session, navigate, postLoginPath]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErrors({});
    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      const next: { email?: string; password?: string } = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "email" || key === "password") next[key] = issue.message;
      }
      setLoginErrors(
        Object.keys(next).length
          ? next
          : { form: parsed.error.issues[0]?.message },
      );
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setSubmitting(false);
    if (error) {
      setLoginErrors({
        form: formatUserError(error, "Sign-in failed. Please try again."),
      });
      return;
    }
    toast.success("Welcome back");
    navigate({ to: postLoginPath });
  };

  const handleSignup = async (formData: Record<string, string>) => {
    const parsed = credentialsSchema.safeParse({
      email: formData.email,
      password: formData.password,
    });
    if (!parsed.success)
      throw new Error(parsed.error.issues[0]?.message || "Validation failed");

    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${redirectOrigin}${postLoginPath}`,
        data: joiningTeam ? { joining_team: true, invite_token: invite } : {},
      },
    });

    if (error)
      throw new Error(formatUserError(error, "Could not create account"));
    toast.success(
      joiningTeam
        ? "Account created! Check your email to verify, then accept the invite."
        : "Account created! Check your email to verify.",
    );
  };

  const handleGoogle = async () => {
    setOauthLoading(true);
    const { error } = await signInWithGoogle(
      `${redirectOrigin}${postLoginPath}`,
    );
    if (error) {
      setOauthLoading(false);
      toast.error(formatUserError(error, "Google sign-in failed"));
    }
  };

  const signupFields = [
    {
      id: "email",
      label: "Email address",
      type: "email" as const,
      placeholder: "admin@institute.in",
      helperText: joiningTeam
        ? "Use the email your invite was sent to"
        : "We'll send a verification link here",
      required: true,
      autoComplete: "email",
    },
    {
      id: "password",
      label: "Password",
      type: "password" as const,
      placeholder: "••••••••",
      helperText: "At least 8 characters",
      required: true,
      minLength: 8,
      autoComplete: "new-password",
    },
  ];

  const contact = getContactConfig();
  const telHref = getTelHref();

  return (
    <div className="grid min-h-screen bg-brand-grid lg:grid-cols-2">
      <SkipToContent href="#auth-panel" />
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div
          className="absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(circle at 18% 22%, oklch(0.72 0.15 175 / 0.5), transparent 50%), radial-gradient(circle at 82% 78%, oklch(0.65 0.18 25 / 0.4), transparent 55%), radial-gradient(circle at 60% 10%, oklch(0.75 0.15 55 / 0.3), transparent 50%)",
          }}
        />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur ring-1 ring-white/20 shadow-lg">
            <Logo size={30} />
          </div>
          <div>
            <div className="font-display text-lg font-bold tracking-tight">
              Vidya
            </div>
            <div className="text-xs uppercase tracking-[0.16em] text-primary-foreground/80 font-semibold">
              Orbit
            </div>
          </div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 space-y-6"
        >
          <h1 className="font-display text-4xl font-bold leading-[1.15] xl:text-5xl">
            Manage your
            <br />
            <span className="bg-gradient-to-r from-brand-teal via-brand-sun to-brand-coral bg-clip-text text-transparent">
              institute with
            </span>
            <br />
            <span className="bg-gradient-to-r from-brand-coral via-brand-saffron to-brand-teal bg-clip-text text-transparent">
              Vidya Orbit
            </span>
          </h1>
          <p className="max-w-md text-base leading-relaxed text-primary-foreground/75">
            An elegant admin dashboard for coaching centres — manage students,
            batches, fees, attendance, analytics and receipts in one unified
            platform.
          </p>
        </motion.div>
        <div className="relative z-10 text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} Vidya Orbit
        </div>
      </div>

      <div
        id="auth-panel"
        className="flex items-center justify-center p-5 sm:p-10"
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="mb-6 flex flex-col items-center text-center lg:hidden">
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft shadow-sm ring-1 ring-primary/15">
                <Logo size={26} />
              </div>
              <span className="font-display text-2xl font-bold tracking-tight">
                vidya<span className="text-primary">orbit</span>
              </span>
            </div>
            <h1 className="font-display text-2xl font-bold leading-tight">
              Manage your tuition centre with ease
            </h1>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Designed for tutors and coaching centres
            </p>
          </div>

          {joiningTeam && (
            <div className="mb-5 rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
              <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-semibold">
                  You&apos;ve been invited to a workspace
                </p>
                <p className="text-muted-foreground mt-0.5">
                  Sign in or create an account to accept the invite. No new
                  institute will be created.
                </p>
              </div>
            </div>
          )}

          <Card className="overflow-hidden">
            <CardContent className="p-5 sm:p-6">
              <p className="type-kicker text-muted-foreground">Centre portal</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Log in to manage attendance &amp; fees
              </p>
              <Tabs
                defaultValue={
                  mode === "signup" || joiningTeam ? "signup" : "login"
                }
                className="mt-4 w-full"
              >
                <TabsList className="grid h-11 w-full grid-cols-2 rounded-full">
                  <TabsTrigger value="login" className="rounded-full">
                    Sign in
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="rounded-full">
                    Create account
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="mt-5">
                  <h2 className="sr-only">Sign in</h2>

                  {GOOGLE_AUTH_ENABLED && (
                    <>
                      <GoogleContinueButton
                        onClick={handleGoogle}
                        loading={oauthLoading}
                      />
                      <GoogleAuthDivider />
                    </>
                  )}

                  <form
                    onSubmit={handleLogin}
                    className="mt-5 space-y-4"
                    noValidate
                  >
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setLoginErrors((prev) => ({
                            ...prev,
                            email: undefined,
                            form: undefined,
                          }));
                        }}
                        placeholder="admin@institute.in"
                        autoComplete="email"
                        aria-invalid={!!loginErrors.email}
                        aria-describedby={
                          loginErrors.email ? "login-email-error" : undefined
                        }
                        className={
                          loginErrors.email
                            ? "border-destructive/50 focus-visible:ring-destructive/30"
                            : undefined
                        }
                      />
                      {loginErrors.email && (
                        <p
                          id="login-email-error"
                          className="text-xs text-destructive"
                          role="alert"
                        >
                          {loginErrors.email}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Password</Label>
                        <Link
                          to="/forgot-password"
                          className="inline-flex min-h-11 items-center text-sm text-primary [@media(hover:hover)_and_(pointer:fine)]:hover:underline"
                        >
                          Forgot password?
                        </Link>
                      </div>
                      <PasswordInput
                        id="password"
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setLoginErrors((prev) => ({
                            ...prev,
                            password: undefined,
                            form: undefined,
                          }));
                        }}
                        autoComplete="current-password"
                        aria-invalid={!!loginErrors.password}
                        aria-describedby={
                          loginErrors.password
                            ? "login-password-error"
                            : undefined
                        }
                        className={
                          loginErrors.password
                            ? "border-destructive/50 focus-visible:ring-destructive/30"
                            : undefined
                        }
                      />
                      {loginErrors.password && (
                        <p
                          id="login-password-error"
                          className="text-xs text-destructive"
                          role="alert"
                        >
                          {loginErrors.password}
                        </p>
                      )}
                    </div>
                    {loginErrors.form && (
                      <p
                        className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                        role="alert"
                      >
                        {loginErrors.form}
                      </p>
                    )}
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="h-12 w-full"
                    >
                      {submitting && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Sign in to Vidya Orbit
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="mt-6">
                  {GOOGLE_AUTH_ENABLED && (
                    <>
                      <GoogleContinueButton
                        onClick={handleGoogle}
                        loading={oauthLoading}
                      />
                      <GoogleAuthDivider />
                    </>
                  )}

                  <OnboardingForm
                    title={
                      joiningTeam ? "Join the workspace" : "Create your account"
                    }
                    subtitle={
                      joiningTeam
                        ? "Create your account to accept the invite"
                        : "Start with email and password. We’ll ask for your centre next."
                    }
                    fields={signupFields}
                    onSubmit={handleSignup}
                    submitLabel={
                      joiningTeam
                        ? "Create account & continue"
                        : "Create account"
                    }
                    isLoading={submitting}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          {contact.phone && (
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Need assistance? Support in Malayalam &amp; English
              {telHref ? (
                <>
                  :{" "}
                  <a href={telHref} className="font-semibold text-foreground">
                    {contact.phone}
                  </a>
                </>
              ) : (
                "."
              )}
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
