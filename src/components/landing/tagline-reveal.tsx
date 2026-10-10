import { useEffect, useRef, useState } from "react";
import { usePrefers } from "@/hooks/use-prefers";
import { cn } from "@/lib/utils";

/**
 * B11 tagline reveal — words activate one at a time as they cross a
 * trigger line while scrolling. Reduced motion: show full colour at once.
 */
export function TaglineReveal({
  lines,
  className,
}: {
  lines: string[];
  className?: string;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const { reducedMotion } = usePrefers();
  const words = lines.flatMap((line, lineIndex) => {
    const parts = line.trim().split(/\s+/).filter(Boolean);
    return parts.map((word, i) => ({
      word,
      key: `${lineIndex}-${i}-${word}`,
      breakAfter: i === parts.length - 1 && lineIndex < lines.length - 1,
    }));
  });
  const [active, setActive] = useState(() =>
    reducedMotion ? words.length : 0,
  );

  useEffect(() => {
    if (reducedMotion) {
      setActive(words.length);
      return;
    }
    const root = rootRef.current;
    if (!root) return;

    const nodes = Array.from(
      root.querySelectorAll<HTMLElement>("[data-tagline-word]"),
    );
    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const idx = Number((entry.target as HTMLElement).dataset.taglineWord);
          if (!Number.isFinite(idx)) continue;
          setActive((prev) => Math.max(prev, idx + 1));
        }
      },
      {
        root: null,
        // Activate when the word crosses the mid-viewport band
        rootMargin: "-40% 0px -40% 0px",
        threshold: 0,
      },
    );

    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [reducedMotion, words.length]);

  return (
    <section
      ref={rootRef}
      className={cn("mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24", className)}
      aria-label="Setup promise"
    >
      <p className="mx-auto max-w-[680px] text-center font-display text-4xl font-bold leading-[1.1] tracking-[-0.03em] sm:text-5xl md:text-6xl">
        {words.map((w, i) => (
          <span key={w.key}>
            <span
              data-tagline-word={i}
              className={cn(
                "inline-block transition-colors duration-700 [transition-timing-function:var(--ease-drawer)]",
                i < active ? "text-foreground" : "text-foreground/30",
              )}
            >
              {w.word}
            </span>
            {w.breakAfter ? <br /> : " "}
          </span>
        ))}
      </p>
    </section>
  );
}
