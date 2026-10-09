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
      className="mb-8 sm:mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
    >
      <div className="relative min-w-0">
        <h1 className="font-display text-3xl font-bold leading-[1.08] tracking-[-0.028em] text-balance sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        <motion.span
          aria-hidden
          initial={reducedMotion ? { opacity: 0 } : { scaleX: 0 }}
          animate={reducedMotion ? { opacity: 1 } : { scaleX: 1 }}
          transition={transition}
          className="mt-3 sm:mt-4 block h-1 w-14 origin-left rounded-full bg-gradient-to-r from-brand-teal via-brand-saffron to-brand-coral"
        />
        {description && (
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground sm:mt-4 sm:text-base">
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
