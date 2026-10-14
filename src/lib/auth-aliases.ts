import { redirect } from "@tanstack/react-router";

/** Canonical auth screen. Sign-up is the same route with `?mode=signup`. */
export const AUTH_LOGIN_PATH = "/login" as const;

export const AUTH_SIGNUP_SEARCH = { mode: "signup" } as const;

/** Permanent HTTP redirect — correct for these public aliases on Vercel. */
export const AUTH_ALIAS_REDIRECT_STATUS = 301 as const;

export type AuthAliasKind = "signup" | "login";

export type AuthAliasRoute = {
  path: string;
  kind: AuthAliasKind;
  file: string;
};

export const AUTH_ALIAS_ROUTES = [
  { path: "/signup", kind: "signup", file: "src/routes/signup.tsx" },
  { path: "/sign-up", kind: "signup", file: "src/routes/sign-up.tsx" },
  { path: "/register", kind: "signup", file: "src/routes/register.tsx" },
  { path: "/join", kind: "signup", file: "src/routes/join.index.tsx" },
  { path: "/signin", kind: "login", file: "src/routes/signin.tsx" },
  { path: "/sign-in", kind: "login", file: "src/routes/sign-in.tsx" },
] as const satisfies readonly AuthAliasRoute[];

export type LoginAliasSearch = {
  mode?: "login" | "signup";
  plan?: string;
  invite?: string;
};

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Incoming query object from a TanStack location or a URL search string. */
export function incomingAliasSearch(
  search?: Record<string, unknown> | null,
  searchStr?: string,
): Record<string, unknown> {
  const fromStr: Record<string, unknown> = {};
  if (searchStr) {
    const q = searchStr.startsWith("?") ? searchStr.slice(1) : searchStr;
    if (q) {
      for (const [key, value] of new URLSearchParams(q).entries()) {
        fromStr[key] = value;
      }
    }
  }
  return { ...fromStr, ...(search ?? {}) };
}

/**
 * Search object for `/login`. Signup aliases force `mode=signup`.
 * `plan` (and other known fields) are kept so `/signup?plan=growth` survives.
 */
export function loginSearchFromAlias(
  incoming: Record<string, unknown>,
  kind: AuthAliasKind,
): LoginAliasSearch {
  const invite = asNonEmptyString(incoming.invite);
  const plan = asNonEmptyString(incoming.plan);
  const existingMode =
    incoming.mode === "signup" || incoming.mode === "login"
      ? incoming.mode
      : undefined;

  return {
    ...(invite ? { invite } : {}),
    ...(plan ? { plan } : {}),
    ...(kind === "signup"
      ? { mode: "signup" as const }
      : existingMode
        ? { mode: existingMode }
        : {}),
  };
}

export function loginHrefFromAlias(
  incoming: Record<string, unknown>,
  kind: AuthAliasKind,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(incoming)) {
    const asString = asNonEmptyString(value);
    if (asString && key !== "mode") params.set(key, asString);
  }
  const search = loginSearchFromAlias(incoming, kind);
  if (search.mode) params.set("mode", search.mode);
  const qs = params.toString();
  return qs ? `${AUTH_LOGIN_PATH}?${qs}` : AUTH_LOGIN_PATH;
}

export function throwAuthAliasRedirect(
  kind: AuthAliasKind,
  ctx: {
    search?: Record<string, unknown>;
    location?: { searchStr?: string };
  },
): never {
  const incoming = incomingAliasSearch(ctx.search, ctx.location?.searchStr);
  throw redirect({
    to: AUTH_LOGIN_PATH,
    search: loginSearchFromAlias(incoming, kind),
    replace: true,
    statusCode: AUTH_ALIAS_REDIRECT_STATUS,
  });
}
