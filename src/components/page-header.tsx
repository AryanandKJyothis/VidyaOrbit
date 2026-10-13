import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { usePrefers } from "@/hooks/use-prefers";
import { fadeOnly, springDefault } from "@/lib/motion";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  const { reducedMotion } = usePrefers();
  const transition = reducedMotion ? fadeOnly : springDefault;

  return (
    <motion.div
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition}
      className="mb-5 sm:mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
    >
      <div className="relative min-w-0">
        <h1 className="font-display text-2xl font-bold leading-[1.15] tracking-[-0.022em] text-balance sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted-foreground text-pretty">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
          {actions}
        </div>
      )}
    </motion.div>
  );
}
