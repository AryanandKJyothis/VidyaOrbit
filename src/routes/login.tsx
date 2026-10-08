import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mail } from "lucide-react";
import { Logo } from "@/components/logo";
import { OnboardingForm } from "@/components/onboarding-form";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { credentialsSchema, signupSchema } from "@/lib/validation";
import { formatUserError } from "@/lib/format-error";
import { GOOGLE_AUTH_ENABLED } from "@/lib/feature-flags";

const searchSchema = z.object({
  invite: z.string().min(10).max(200).optional(),
  mode: z.enum(["login", "signup"]).optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: (s) => searchSchema.parse(s),
  component: LoginPage,
});

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.7 2.9l5.7-5.7C33.9 6.5 29.2 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5c10.8 0 19.5-8.7 19.5-19.5 0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.5 16 18.9 12.5 24 12.5c2.9 0 5.6 1.1 7.7 2.9l5.7-5.7C33.9 6.5 29.2 4.5 24 4.5 16.3 4.5 9.7 8.7 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 43.5c5.1 0 9.7-1.9 13.2-5.1l-6.1-5c-2 1.4-4.4 2.1-7.1 2.1-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.5 39.2 16.2 43.5 24 43.5z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.2 5.4l6.1 5c-.4.4 6.8-4.9 6.8-14.4 0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const { invite, mode } = Route.useSearch();
  const joiningTeam = !!invite;
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setSubmitting(false);
    if (error)
      return toast.error(
        formatUserError(error, "Sign-in failed. Please try again."),
      );
    toast.success("Welcome back");
    navigate({ to: postLoginPath });
  };

  const handleSignup = async (formData: Record<string, string>) => {
    let validated: {
      email: string;
      password: string;
      phone: string;
      institute_name?: string;
    };
    if (joiningTeam) {
      const schema = credentialsSchema.extend({
        phone: z
          .string()
          .trim()
          .min(6)
          .max(20)
          .regex(/^[0-9+\-\s()]{6,20}$/, "Enter a valid phone"),
      });
      const parsed = schema.safeParse({
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
      });
      if (!parsed.success)
        throw new Error(parsed.error.issues[0]?.message || "Validation failed");
      validated = parsed.data;
    } else {
      const parsed = signupSchema.safeParse({
        email: formData.email,
        password: formData.password,
        institute_name: formData.institute_name,
        phone: formData.phone,
      });
      if (!parsed.success)
        throw new Error(parsed.error.issues[0]?.message || "Validation failed");
      validated = parsed.data;
    }

    const { error } = await supabase.auth.signUp({
      email: validated.email,
      password: validated.password,
      options: {
        emailRedirectTo: `${redirectOrigin}${postLoginPath}`,
        data: {
          phone: validated.phone,
          ...(joiningTeam
            ? { joining_team: true, invite_token: invite }
            : { institute_name: validated.institute_name }),
        },
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
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: redirectOrigin + postLoginPath,
    });
    if (result.error) {
      setOauthLoading(false);
      toast.error(formatUserError(result.error, "Google sign-in failed"));
      return;
    }
    if (result.redirected) return;
    navigate({ to: postLoginPath });
  };

  const signupFields = [
    ...(joiningTeam
      ? []
      : [
          {
            id: "institute_name",
            label: "Institute name",
            type: "text" as const,
            placeholder: "Bright Future Academy",
            helperText: "This will appear on receipts and dashboards",
            required: true,
          },
        ]),
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
      id: "phone",
      label: "Phone number",
      type: "tel" as const,
      placeholder: "+91 98765 43210",
      helperText: "We'll use this to contact you about your account",
      required: true,
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

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
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
            <div className="text-[10px] uppercase tracking-[0.16em] text-primary-foreground/70 font-semibold">
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

      <div className="flex items-center justify-center p-6 sm:p-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft shadow-md ring-1 ring-primary/20">
              <Logo size={30} />
            </div>
            <div>
              <div className="font-display text-lg font-bold tracking-tight">
                Vidya
              </div>
              <div className="text-[8.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">
                Orbit
              </div>
            </div>
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

          <Tabs
            defaultValue={mode === "signup" || joiningTeam ? "signup" : "login"}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-6">
              <h2 className="font-display text-2xl font-semibold">
                Welcome back
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {joiningTeam
                  ? "Sign in to accept your invite."
                  : "Sign in to manage your institute."}
              </p>

              {GOOGLE_AUTH_ENABLED && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-6 w-full"
                    onClick={handleGoogle}
                    disabled={oauthLoading}
                  >
                    {oauthLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <GoogleIcon />
                    )}
                    <span className="ml-2">Continue with Google</span>
                  </Button>
                  <div className="relative my-5">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        Or with email
                      </span>
                    </div>
                  </div>
                </>
              )}

              <form onSubmit={handleLogin} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@institute.in"
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link
                      to="/forgot-password"
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Sign in
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              {GOOGLE_AUTH_ENABLED && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="mb-6 w-full"
                    onClick={handleGoogle}
                    disabled={oauthLoading}
                  >
                    {oauthLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <GoogleIcon />
                    )}
                    <span className="ml-2">Sign up with Google</span>
                  </Button>
                  <div className="relative my-5">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        Or with email
                      </span>
                    </div>
                  </div>
                </>
              )}

              <OnboardingForm
                title={
                  joiningTeam ? "Join the workspace" : "Create your institute"
                }
                subtitle={
                  joiningTeam
                    ? "Create your account to accept the invite"
                    : "Start managing your students in minutes"
                }
                fields={signupFields}
                onSubmit={handleSignup}
                submitLabel={
                  joiningTeam ? "Create account & continue" : "Create account"
                }
                isLoading={submitting}
              />
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}
