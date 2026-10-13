export const MARKETING_OPT_IN_LABEL =
  "Send me product updates and tips by email";

export function isGoogleAuthUser(
  user:
    | {
        app_metadata?: { provider?: string; providers?: string[] };
        identities?: { provider?: string }[] | null;
      }
    | null
    | undefined,
): boolean {
  if (!user) return false;
  if (user.app_metadata?.provider === "google") return true;
  if (user.app_metadata?.providers?.includes("google")) return true;
  return (user.identities ?? []).some((i) => i.provider === "google");
}

function asBooleanFlag(value: unknown): boolean | null {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
}

/** True once the user has answered the optional marketing checkbox. */
export function hasMarketingChoice(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  return asBooleanFlag(metadata?.marketing_opt_in) !== null;
}

export function readMarketingOptIn(
  metadata: Record<string, unknown> | null | undefined,
): { optedIn: boolean; at: string | null } | null {
  const optedIn = asBooleanFlag(metadata?.marketing_opt_in);
  if (optedIn === null) return null;
  const at =
    typeof metadata?.marketing_opt_in_at === "string"
      ? metadata.marketing_opt_in_at
      : null;
  return { optedIn, at };
}

export function marketingOptInMetadata(
  optedIn: boolean,
  at: Date = new Date(),
): { marketing_opt_in: boolean; marketing_opt_in_at: string } {
  return {
    marketing_opt_in: optedIn,
    marketing_opt_in_at: at.toISOString(),
  };
}

export function shouldAskMarketingInSetup(input: {
  isGoogleUser: boolean;
  hasChoice: boolean;
}): boolean {
  return input.isGoogleUser && !input.hasChoice;
}
