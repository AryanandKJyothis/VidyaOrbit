import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatUserError } from "@/lib/format-error";

export function CheckEmailPanel({
  email,
  onBack,
}: {
  email: string;
  onBack: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const resend = async () => {
    setSending(true);
    setNote(null);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });
    setSending(false);
    if (error) {
      setNote(formatUserError(error, "Could not resend the link"));
      return;
    }
    setNote("We sent another link.");
  };

  return (
    <div className="flex w-full max-w-md flex-col items-center text-center">
      <span
        className="flex items-center justify-center rounded-[4px]"
        style={{ backgroundColor: "#F8F7F2", width: 72, height: 72 }}
      >
        <Logo size={56} />
      </span>
      <h1 className="mt-8 font-display text-3xl font-bold tracking-[-0.03em]">
        Check your email
      </h1>
      <p className="mt-3 text-base leading-relaxed text-slate">
        We sent a link to {email}
      </p>
      {note && (
        <p className="mt-3 text-sm text-slate" role="status">
          {note}
        </p>
      )}
      <button
        type="button"
        onClick={resend}
        disabled={sending}
        className="mt-8 text-sm font-semibold text-orbit-blue underline-offset-4 hover:underline disabled:opacity-50"
      >
        {sending ? "Sending…" : "Resend link"}
      </button>
      <div className="mt-10 flex flex-col gap-2">
        <Button variant="outline" className="rounded-[4px]" onClick={onBack}>
          Back
        </Button>
        <Link
          to="/"
          className="text-sm text-slate underline-offset-4 hover:text-ink hover:underline"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
