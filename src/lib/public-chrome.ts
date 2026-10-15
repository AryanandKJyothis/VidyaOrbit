/** Authenticated app paths: no marketing chrome such as the WhatsApp FAB. */
export const APP_SHELL_PREFIXES = [
  "/dashboard",
  "/students",
  "/fees",
  "/attendance",
  "/batches",
  "/analytics",
  "/billing",
  "/plan",
  "/settings",
  "/invites",
  "/admin",
  "/receipts",
  "/absentees",
  "/reports",
  "/r",
  "/report",
] as const;

export function isAppShellPath(pathname: string): boolean {
  return APP_SHELL_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
