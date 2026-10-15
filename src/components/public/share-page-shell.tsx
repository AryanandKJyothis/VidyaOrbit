import type { ReactNode } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoWordmark } from "@/components/logo";

export function SharePageShell({
  title,
  children,
  canPrint = false,
}: {
  title: string;
  children: ReactNode;
  canPrint?: boolean;
}) {
  return (
    <div className="min-h-svh bg-paper text-ink">
      <div className="no-print mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-4">
        <LogoWordmark className="text-primary" />
        {canPrint && (
          <Button onClick={() => window.print()}>
            <Printer className="mr-1.5 h-4 w-4" /> Print / Save PDF
          </Button>
        )}
      </div>
      <main className="print-root mx-auto max-w-2xl px-4 pb-16">
        <h1 className="no-print sr-only">{title}</h1>
        {children}
      </main>
    </div>
  );
}

export function ShareUnavailable({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <h1 className="font-display text-xl font-semibold">{title}</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        {body}
      </p>
    </div>
  );
}
