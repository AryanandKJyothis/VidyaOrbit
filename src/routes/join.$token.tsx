import {
  createFileRoute,
  useNavigate,
  useParams,
  Link,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Badge } from "@/components/ui/badge";
import { AUTH_BTN, AuthShell } from "@/components/auth/auth-shell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getStorageKey } from "@/hooks/use-active-workspace";
import { previewInvite, acceptInvite } from "@/lib/workspace.functions";
import { formatUserError } from "@/lib/format-error";
import { GOOGLE_AUTH_ENABLED } from "@/lib/feature-flags";
import { signInWithGoogle } from "@/lib/google-auth";
import { GoogleContinueButton } from "@/components/google-continue-button";
import { CheckYourEmail } from "@/components/check-your-email";
import { useSignOut } from "@/hooks/use-sign-out";
import { MarketingOptInCheckbox } from "@/components/marketing-opt-in-checkbox";
import { marketingOptInMetadata } from "@/lib/marketing-opt-in";
import { PUBLIC_PAGES, pageHead } from "@/lib/seo";

export const Route = createFileRoute("/join/$token")({
  component: JoinPage,
  head: () => pageHead(PUBLIC_PAGES.join),
});

function JoinPage() {
  const { token } = useParams({ from: "/join/$token" });
  const navigate = useNavigate();
  const { session, user, loading: authLoading } = useAuth();
  const qc = useQueryClient();

  const fetchPreview = useServerFn(previewInvite);
  const acceptFn = useServerFn(acceptInvite);

  const preview = useQuery({
    queryKey: ["join-preview", token],
    queryFn: () => fetchPreview({ data: { token } }),
    staleTime: 60_000,
  });

  const accept = useMutation({
    mutationFn: () => acceptFn({ data: { token } }),
    onSuccess: async (res) => {
      // Set active workspace in localStorage (outside WorkspaceProvider)
      if (user?.id) {
        try {
          localStorage.setItem(getStorageKey(user.id), res.ownerId);
        } catch {
          // ignore quota errors
        }
      }
      // Invalidate workspaces to trigger refetch
      await qc.removeQueries({ queryKey: ["workspaces"] });
      toast.success("Welcome! You've joined the workspace.");
      navigate({ to: "/dashboard" });
    },
    onError: (e) => toast.error(formatUserError(e)),
  });

  // Auto-accept once a signed-in user lands here with a matching email.
  const inviteEmail = preview.data?.ok
    ? preview.data.email.toLowerCase()
    : null;
  const userEmail = session?.user?.email?.toLowerCase() ?? null;
  useEffect(() => {
    if (!session || !inviteEmail || !userEmail) return;
    if (inviteEmail !== userEmail) return;
    if (accept.isPending || accept.isSuccess) return;
    accept.mutate();
  }, [session, inviteEmail, userEmail]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthShell>
      {preview.isLoading || authLoading ? (
        <div className="flex flex-col items-center gap-3 py-12 text-sm text-slate">
          <Loader2 className="h-6 w-6 animate-spin text-orbit-blue" />
          Loading invitation…
        </div>
      ) : !preview.data?.ok ? (
        <InvalidInvite reason={preview.data?.reason ?? "not_found"} />
      ) : (
        <ValidInvite
          preview={preview.data}
          session={session}
          accepting={accept.isPending}
          onAccept={() => accept.mutate()}
        />
      )}
    </AuthShell>
  );
}

function ValidInvite({
  preview,
  session,
  accepting,
  onAccept,
}: {
  preview: Extract<Awaited<ReturnType<typeof previewInvite>>, { ok: true }>;
  session: ReturnType<typeof useAuth>["session"];
  accepting: boolean;
  onAccept: () => void;
}) {
  const signOut = useSignOut({ redirectTo: null });
  const userEmail = session?.user?.email?.toLowerCase() ?? null;
  const inviteEmail = preview.email.toLowerCase();
  const emailMatches = userEmail === inviteEmail;

  return (
    <div>
      <p className="text-sm text-slate">Workspace invite</p>
      <h2 className="mt-2 font-display text-3xl font-bold tracking-[-0.03em] text-balance">
        You&apos;ve been invited
      </h2>
      <p className="mt-3 text-base leading-relaxed text-slate">
        Join{" "}
        <span className="font-medium text-ink">{preview.workspaceName}</span> as{" "}
        <Badge variant="secondary" className="ml-1 align-middle !rounded-[4px]">
          <Shield className="h-3 w-3 mr-1" />
          {preview.role}
        </Badge>
      </p>
      <div className="mt-8 space-y-4">
        <div className="border border-ink/20 px-4 py-3 text-sm">
          <div className="text-xs text-slate">Invite sent to</div>
          <div className="mt-1 font-medium text-ink">{preview.email}</div>
        </div>

        {session ? (
          emailMatches ? (
            <Button
              onClick={onAccept}
              disabled={accepting}
              className={`${AUTH_BTN} w-full bg-orbit-blue text-paper hover:bg-orbit-blue/90`}
              size="lg"
            >
              {accepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CheckCircle2 className="mr-2 h-4 w-4" /> Accept &amp; enter
              workspace
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                You&apos;re signed in as{" "}
                <span className="font-semibold">{userEmail}</span>, but this
                invite was sent to{" "}
                <span className="font-semibold">{preview.email}</span>. Sign out
                and sign back in with the correct email to accept.
              </div>
              <Button
                variant="outline"
                className={`${AUTH_BTN} w-full border-ink text-ink hover:bg-ink/5`}
                data-sign-out=""
                onClick={() => void signOut()}
              >
                Sign out
              </Button>
            </div>
          )
        ) : (
          <SignInToAccept inviteEmail={preview.email} />
        )}

        <p className="text-sm text-slate">
          Invite expires {new Date(preview.expiresAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

function SignInToAccept({ inviteEmail }: { inviteEmail: string }) {
  const { token } = useParams({ from: "/join/$token" });
  const [mode, setMode] = useState<"choose" | "password" | "check-email">(
    "choose",
  );
  const [email, setEmail] = useState(inviteEmail);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  async function handleGoogle() {
    setOauthLoading(true);
    const { error } = await signInWithGoogle(`/join/${token}`);
    if (error) {
      setOauthLoading(false);
      toast.error(formatUserError(error, "Google sign-in failed"));
    }
  }

  async function handlePassword(kind: "signin" | "signup") {
    if (!email || !password || password.length < 8) {
      toast.error("Enter your email and a password of 8+ characters");
      return;
    }
    setSubmitting(true);
    if (kind === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      setSubmitting(false);
      if (error) return toast.error(formatUserError(error, "Sign-in failed"));
    } else {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: window.location.href,
          data: {
            joining_team: true,
            ...marketingOptInMetadata(marketingOptIn),
          },
        },
      });
      setSubmitting(false);
      if (error)
        return toast.error(formatUserError(error, "Could not create account"));
      setMode("check-email");
    }
  }

  async function resendSignupEmail() {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: window.location.href },
    });
    if (error) throw error;
  }

  if (mode === "check-email") {
    return (
      <CheckYourEmail
        email={email.trim()}
        kind="invite_signup"
        onResend={resendSignupEmail}
        onUseDifferentEmail={() => setMode("password")}
      />
    );
  }

  if (mode === "choose") {
    return (
      <div className="space-y-3">
        {GOOGLE_AUTH_ENABLED && (
          <GoogleContinueButton onClick={handleGoogle} loading={oauthLoading} />
        )}
        <Button
          onClick={() => setMode("password")}
          variant={GOOGLE_AUTH_ENABLED ? "ghost" : "outline"}
          className={`${AUTH_BTN} w-full ${GOOGLE_AUTH_ENABLED ? "" : "border-ink text-ink hover:bg-ink/5"}`}
        >
          {GOOGLE_AUTH_ENABLED
            ? "Use email & password instead"
            : "Continue with email & password"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Email
        </label>
        <input
          type="email"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <label
          htmlFor="join-password"
          className="text-xs font-medium text-muted-foreground"
        >
          Password (8+ characters)
        </label>
        <PasswordInput
          id="join-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          autoComplete="current-password"
        />
      </div>
      <MarketingOptInCheckbox
        id="join-marketing-opt-in"
        checked={marketingOptIn}
        onCheckedChange={setMarketingOptIn}
      />
      <div className="grid grid-cols-2 gap-2">
        <Button
          onClick={() => handlePassword("signin")}
          disabled={submitting}
          className={`${AUTH_BTN} bg-orbit-blue text-paper hover:bg-orbit-blue/90`}
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign in
        </Button>
        <Button
          onClick={() => handlePassword("signup")}
          disabled={submitting}
          variant="outline"
          className={`${AUTH_BTN} border-ink text-ink hover:bg-ink/5`}
        >
          Create account
        </Button>
      </div>
      <Button
        variant="ghost"
        className="w-full !rounded-[4px] text-slate hover:text-ink"
        onClick={() => setMode("choose")}
      >
        Back
      </Button>
    </div>
  );
}

function InvalidInvite({
  reason,
}: {
  reason: "not_found" | "expired" | "revoked" | "accepted";
}) {
  const messages: Record<typeof reason, { title: string; body: string }> = {
    not_found: {
      title: "Invite not found",
      body: "This link is invalid or has been revoked. Ask your workspace owner for a new one.",
    },
    expired: {
      title: "Invite expired",
      body: "This invite link is past its expiry date. Ask your workspace owner to send a fresh one.",
    },
    revoked: {
      title: "Invite revoked",
      body: "This invite was revoked by the workspace owner.",
    },
    accepted: {
      title: "Invite already used",
      body: "This invite has already been accepted. Sign in to access the workspace.",
    },
  };
  const msg = messages[reason];
  return (
    <div className="space-y-6">
      <XCircle className="h-8 w-8 text-destructive" />
      <div>
        <h2 className="font-display text-3xl font-bold tracking-[-0.03em]">
          {msg.title}
        </h2>
        <p className="mt-3 text-base leading-relaxed text-slate">{msg.body}</p>
      </div>
      <Button
        asChild
        variant="outline"
        className={`${AUTH_BTN} border-ink text-ink hover:bg-ink/5`}
      >
        <Link to="/login">Go to sign in</Link>
      </Button>
    </div>
  );
}
