import { motion, useInView } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { usePrefers } from "@/hooks/use-prefers";
import { fadeOnly, springDefault } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * In-view reveal that starts from the current (hidden) value and springs
 * to rest. Reduced motion: opacity only — no travel.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.15 });
  const { reducedMotion } = usePrefers();

  return (
    <motion.div
      ref={ref}
      className={cn(className)}
      initial={
        reducedMotion
          ? { opacity: 0 }
          : { opacity: 0, transform: "translateY(40px)" }
      }
      animate={
        inView
          ? reducedMotion
            ? { opacity: 1 }
            : { opacity: 1, transform: "translateY(0px)" }
          : undefined
      }
      transition={{
        ...(reducedMotion ? fadeOnly : springDefault),
        delay: reducedMotion ? 0 : delay,
      }}
    >
      {children}
    </motion.div>
  );
}
