import { createFileRoute } from "@tanstack/react-router";
import { throwAuthAliasRedirect } from "@/lib/auth-aliases";

export const Route = createFileRoute("/signup")({
  beforeLoad: (ctx) => throwAuthAliasRedirect("signup", ctx),
});
