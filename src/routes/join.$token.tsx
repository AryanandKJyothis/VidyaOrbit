import {
  createFileRoute,
  useNavigate,
  useParams,
  Link,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Loader2, CheckCircle2, XCircle, Mail, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/logo";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";
import { useActiveWorkspace } from "@/hooks/use-active-workspace";
import { previewInvite, acceptInvite } from "@/lib/workspace.functions";
import { formatUserError } from "@/lib/format-error";

export const Route = createFileRoute("/join/$token")({
  component: JoinPage,
  head: () => ({
    meta: [
      { title: "You've been invited — Vidya Orbit" },
      {
        name: "description",
        content: "Join your team's workspace on Vidya Orbit.",
      },
      { property: "og:title", content: "You've been invited to Vidya Orbit" },
      {
        property: "og:description",
        content: "Accept your invite and start collaborating with your team.",
      },
    ],
  }),
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

function JoinPage() {
  const { token } = useParams({ from: "/join/$token" });
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const ws = useActiveWorkspace();

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
      toast.success("You're in!");
      await ws.refresh();
      ws.setActiveOwnerId(res.ownerId);
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="mb-6 flex items-center gap-3 justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft ring-1 ring-primary/20">
            <Logo size={30} />
          </div>
          <div className="text-left">
            <div className="font-display text-lg font-bold tracking-tight">
              Vidya
            </div>
            <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
              Orbit
            </div>
          </div>
        </div>

        {preview.isLoading || authLoading ? (
          <Card>
            <CardContent className="py-12 flex flex-col items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              Loading invitation…
            </CardContent>
          </Card>
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
      </motion.div>
    </div>
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
  const userEmail = session?.user?.email?.toLowerCase() ?? null;
  const inviteEmail = preview.email.toLowerCase();
  const emailMatches = userEmail === inviteEmail;

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-xl">You&apos;ve been invited</CardTitle>
        <CardDescription className="text-base">
          Join{" "}
          <span className="font-semibold text-foreground">
            {preview.workspaceName}
          </span>{" "}
          as{" "}
          <Badge variant="secondary" className="ml-1 align-middle">
            <Shield className="h-3 w-3 mr-1" />
            {preview.role}
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <div className="text-xs text-muted-foreground">Invite sent to</div>
          <div className="font-medium">{preview.email}</div>
        </div>

        {session ? (
          emailMatches ? (
            <Button
              onClick={onAccept}
              disabled={accepting}
              className="w-full"
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
                className="w-full"
                onClick={async () => {
                  const { error } = await supabase.auth.signOut();
                  if (error)
                    toast.error("Could not sign out. Please try again.");
                }}
              >
                Sign out
              </Button>
            </div>
          )
        ) : (
          <SignInToAccept inviteEmail={preview.email} />
        )}

        <p className="text-center text-xs text-muted-foreground">
          Invite expires {new Date(preview.expiresAt).toLocaleDateString()}
        </p>
      </CardContent>
    </Card>
  );
}

function SignInToAccept({ inviteEmail }: { inviteEmail: string }) {
  const [mode, setMode] = useState<"choose" | "password">("choose");
  const [email, setEmail] = useState(inviteEmail);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  async function handleGoogle() {
    setOauthLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.href, // come back to this exact /join/$token page
    });
    if (result.error) {
      setOauthLoading(false);
      toast.error(formatUserError(result.error, "Google sign-in failed"));
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
          data: { joining_team: true },
        },
      });
      setSubmitting(false);
      if (error)
        return toast.error(formatUserError(error, "Could not create account"));
      toast.success(
        "Account created — check your email to verify, then come back to this link.",
      );
    }
  }

  if (mode === "choose") {
    return (
      <div className="space-y-3">
        <Button
          onClick={handleGoogle}
          disabled={oauthLoading}
          className="w-full"
          variant="outline"
          size="lg"
        >
          {oauthLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          <span className="ml-2">Continue with Google</span>
        </Button>
        <Button
          onClick={() => setMode("password")}
          variant="ghost"
          className="w-full"
        >
          Use email &amp; password instead
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
        <label className="text-xs font-medium text-muted-foreground">
          Password (8+ characters)
        </label>
        <input
          type="password"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => handlePassword("signin")} disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign in
        </Button>
        <Button
          onClick={() => handlePassword("signup")}
          disabled={submitting}
          variant="outline"
        >
          Create account
        </Button>
      </div>
      <Button
        variant="ghost"
        className="w-full"
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
    <Card>
      <CardContent className="py-10 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <XCircle className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h2 className="font-semibold text-lg">{msg.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{msg.body}</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/login">Go to sign in</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
