import { createFileRoute } from "@tanstack/react-router";
import { throwAuthAliasRedirect } from "@/lib/auth-aliases";

export const Route = createFileRoute("/sign-in")({
  beforeLoad: (ctx) => throwAuthAliasRedirect("login", ctx),
});
