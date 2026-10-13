/** Public OAuth return path. Keep this on the Supabase redirect allow-list. */
export const AUTH_CALLBACK_PATH = "/auth/callback";

const DEFAULT_NEXT = "/dashboard";
const TOKEN = /^[A-Za-z0-9._~-]{10,200}$/;

/**
 * Same-origin path Google (or email confirm) should resume after `/auth/callback`.
 * Rejects protocol-relative URLs, traversal, and anything outside the app.
 */
export function safeAuthNextPath(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_NEXT;
  const trimmed = raw.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("://") ||
    trimmed.includes("\\") ||
    trimmed.includes("..")
  ) {
    return DEFAULT_NEXT;
  }

  const withoutHash = trimmed.split("#")[0] ?? trimmed;
  const qIndex = withoutHash.indexOf("?");
  const pathOnly =
    (qIndex === -1 ? withoutHash : withoutHash.slice(0, qIndex)).replace(
      /\/+$/,
      "",
    ) || "/";
  const query = qIndex === -1 ? "" : withoutHash.slice(qIndex + 1);

  if (pathOnly === "/dashboard") return "/dashboard";

  if (pathOnly === "/invites") {
    const token = new URLSearchParams(query).get("token");
    if (token && TOKEN.test(token)) {
      return `/invites?token=${encodeURIComponent(token)}`;
    }
    return "/invites";
  }

  if (pathOnly.startsWith("/join/")) {
    const token = pathOnly.slice("/join/".length);
    if (token && !token.includes("/") && TOKEN.test(token)) {
      return `/join/${encodeURIComponent(token)}`;
    }
  }

  return DEFAULT_NEXT;
}

export function authCallbackUrl(origin: string, nextPath: string): string {
  const base = origin.endsWith("/") ? origin : `${origin}/`;
  const url = new URL(AUTH_CALLBACK_PATH.replace(/^\//, ""), base);
  url.searchParams.set("next", safeAuthNextPath(nextPath));
  return url.toString();
}

export type AuthNextTarget =
  | { kind: "dashboard" }
  | { kind: "invites"; token?: string }
  | { kind: "join"; token: string };

export function parseAuthNext(raw: unknown): AuthNextTarget {
  const path = safeAuthNextPath(raw);
  if (path.startsWith("/join/")) {
    return { kind: "join", token: path.slice("/join/".length) };
  }
  if (path.startsWith("/invites")) {
    const token = new URLSearchParams(path.split("?")[1] ?? "").get("token");
    return token ? { kind: "invites", token } : { kind: "invites" };
  }
  return { kind: "dashboard" };
}
