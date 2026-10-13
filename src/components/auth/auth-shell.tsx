import type { ReactNode } from "react";
import { LogoWordmark } from "@/components/logo";
import { OrbitMotif } from "@/components/landing/orbit-motif";
import { SkipToContent } from "@/components/skip-to-content";
import { HERO_EYEBROW, HERO_SUB, HERO_TITLE } from "@/lib/landing-copy";
import { cn } from "@/lib/utils";

/** 4px editorial buttons on public auth screens. */
export const AUTH_BTN =
  "h-12 !rounded-[4px] px-6 text-base font-semibold transition-transform duration-150 [transition-timing-function:var(--ease-out)] active:scale-[0.97]";

export function AuthShell({
  children,
  title = HERO_TITLE,
  sub = HERO_SUB,
}: {
  children: ReactNode;
  title?: string;
  sub?: string;
}) {
  const lines = title
    .replace(/\.$/, "")
    .split(". ")
    .map((line) => `${line}.`);

  return (
    <div className="grid min-h-screen bg-paper text-ink lg:grid-cols-2">
      <SkipToContent href="#auth-panel" />
      <aside className="relative hidden overflow-hidden bg-orbit-blue text-paper lg:flex lg:flex-col lg:justify-between lg:px-16 lg:py-12">
        <OrbitMotif
          inverted
          spin
          className="absolute -right-12 top-20 h-80 w-80 opacity-70"
        />
        <div className="relative z-10">
          <LogoWordmark size={28} inverted />
        </div>
        <div className="relative z-10 max-w-lg">
          <p className="text-sm text-paper/70">{HERO_EYEBROW}</p>
          <h1 className="mt-6 font-display text-5xl font-bold leading-[0.95] tracking-[-0.04em] text-balance xl:text-6xl">
            {lines.map((line, i) => (
              <span key={line} className={cn("block", i === 1 && "text-paper")}>
                {line}
              </span>
            ))}
          </h1>
          <p className="mt-6 max-w-md text-pretty text-base leading-relaxed text-paper/80">
            {sub}
          </p>
        </div>
        <p className="relative z-10 text-sm text-paper/55">
          © {new Date().getFullYear()} Vidya Orbit
        </p>
      </aside>
      <div
        id="auth-panel"
        className="flex items-center justify-center px-8 py-12 sm:px-16"
      >
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <LogoWordmark size={24} />
            <p className="mt-4 text-sm text-slate">{HERO_EYEBROW}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
