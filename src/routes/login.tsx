import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { AUTH_BTN, AuthShell } from "@/components/auth/auth-shell";
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
import { marketingOptInMetadata } from "@/lib/marketing-opt-in";
import { MarketingOptInCheckbox } from "@/components/marketing-opt-in-checkbox";
import { PUBLIC_PAGES, pageHead } from "@/lib/seo";
import { getContactConfig, getTelHref } from "@/lib/contact-config";
import { CheckYourEmail } from "@/components/check-your-email";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  invite: z.string().min(10).max(200).optional(),
  mode: z.enum(["login", "signup"]).optional().catch(undefined),
  plan: z.string().min(1).max(64).optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => pageHead(PUBLIC_PAGES.login),
  component: LoginPage,
});

const TAB =
  "h-11 !rounded-none font-display text-sm font-bold data-[state=active]:bg-ink data-[state=active]:text-paper data-[state=active]:shadow-none";

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const { invite, mode } = Route.useSearch();
  const joiningTeam = !!invite;
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginErrors, setLoginErrors] = useState<{
    email?: string;
    password?: string;
    form?: string;
  }>({});
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [authTab, setAuthTab] = useState<"login" | "signup">(
    mode === "signup" || joiningTeam ? "signup" : "login",
  );

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
        data: {
          ...(joiningTeam ? { joining_team: true, invite_token: invite } : {}),
          ...marketingOptInMetadata(marketingOptIn),
        },
      },
    });

    if (error)
      throw new Error(formatUserError(error, "Could not create account"));
    setPendingEmail(parsed.data.email);
  };

  const resendSignupEmail = async () => {
    if (!pendingEmail) return;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pendingEmail,
      options: { emailRedirectTo: `${redirectOrigin}${postLoginPath}` },
    });
    if (error) throw error;
  };

  const handleGoogle = async () => {
    setOauthLoading(true);
    const { error } = await signInWithGoogle(postLoginPath);
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
    <AuthShell>
      {joiningTeam && !pendingEmail && (
        <div className="mb-8 border border-ink/20 px-4 py-4">
          <p className="font-display text-base font-bold tracking-[-0.02em]">
            You&apos;ve been invited to a workspace
          </p>
          <p className="mt-1 text-sm leading-relaxed text-slate">
            Sign in or create an account to accept the invite. No new institute
            will be created.
          </p>
        </div>
      )}

      {pendingEmail ? (
        <CheckYourEmail
          email={pendingEmail}
          kind={joiningTeam ? "invite_signup" : "signup"}
          onResend={resendSignupEmail}
          onUseDifferentEmail={() => {
            setAuthTab("signup");
            setPendingEmail(null);
          }}
        />
      ) : (
        <>
          <p className="text-sm text-slate">Centre portal</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-[-0.03em] text-balance">
            {authTab === "signup" ? "Create your account" : "Sign in"}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate">
            For owners and managers. Mark attendance and track fees.
          </p>

          <Tabs
            value={authTab}
            onValueChange={(value) => setAuthTab(value as "login" | "signup")}
            className="mt-8 w-full"
          >
            <TabsList className="grid h-11 w-full grid-cols-2 !rounded-[4px] border border-ink/20 bg-transparent p-0">
              <TabsTrigger
                value="login"
                className={cn(TAB, "border-r border-ink/20")}
              >
                Sign in
              </TabsTrigger>
              <TabsTrigger value="signup" className={TAB}>
                Create account
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-8">
              <h3 className="sr-only">Sign in</h3>

              {GOOGLE_AUTH_ENABLED && (
                <>
                  <GoogleContinueButton
                    onClick={handleGoogle}
                    loading={oauthLoading}
                  />
                  <GoogleAuthDivider />
                </>
              )}

              <form onSubmit={handleLogin} className="space-y-4" noValidate>
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
                    className={cn(
                      "!rounded-[4px]",
                      loginErrors.email &&
                        "border-destructive/50 focus-visible:ring-destructive/30",
                    )}
                    aria-invalid={!!loginErrors.email}
                    aria-describedby={
                      loginErrors.email ? "login-email-error" : undefined
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
                      className="text-sm text-orbit-blue underline-offset-4 hover:underline"
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
                    className={cn(
                      "!rounded-[4px]",
                      loginErrors.password &&
                        "border-destructive/50 focus-visible:ring-destructive/30",
                    )}
                    aria-invalid={!!loginErrors.password}
                    aria-describedby={
                      loginErrors.password ? "login-password-error" : undefined
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
                    className="border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                    role="alert"
                  >
                    {loginErrors.form}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={submitting}
                  className={cn(
                    AUTH_BTN,
                    "w-full bg-orbit-blue text-paper hover:bg-orbit-blue/90",
                  )}
                >
                  {submitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Sign in to Vidya Orbit
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-8">
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
                title={joiningTeam ? "Join the workspace" : undefined}
                subtitle={
                  joiningTeam
                    ? "Create your account to accept the invite"
                    : "Start with email and password. We’ll ask for your centre next."
                }
                fields={signupFields}
                onSubmit={handleSignup}
                submitLabel={
                  joiningTeam ? "Create account & continue" : "Create account"
                }
                isLoading={submitting}
                belowFields={
                  <MarketingOptInCheckbox
                    checked={marketingOptIn}
                    onCheckedChange={setMarketingOptIn}
                  />
                }
              />
            </TabsContent>
          </Tabs>
        </>
      )}

      {contact.phone && (
        <p className="mt-8 text-sm text-slate">
          Help in Malayalam and English
          {telHref ? (
            <>
              :{" "}
              <a
                href={telHref}
                className="font-medium text-ink underline-offset-4 hover:underline"
              >
                {contact.phone}
              </a>
            </>
          ) : (
            "."
          )}
        </p>
      )}
    </AuthShell>
  );
}
