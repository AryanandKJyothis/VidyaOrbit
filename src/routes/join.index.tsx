import { createFileRoute } from "@tanstack/react-router";
import { throwAuthAliasRedirect } from "@/lib/auth-aliases";

/** Index only — `join.tsx` would wrap `/join/$token` and steal invite links. */
export const Route = createFileRoute("/join/")({
  beforeLoad: (ctx) => throwAuthAliasRedirect("signup", ctx),
});
