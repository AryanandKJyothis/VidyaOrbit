import type { ReactNode } from "react";
import { motion } from "framer-motion";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="mb-8 sm:mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
    >
      <div className="relative group min-w-0">
        <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-balance leading-tight transition-colors duration-300">
          {title}
        </h1>
        {/* Accent underline — animated draw with orbital gradient */}
        <motion.span
          aria-hidden
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.7, delay: 0.12, ease: [0.2, 0.8, 0.2, 1] }}
          className="mt-3 sm:mt-4 block h-1.5 sm:h-2 w-16 sm:w-20 rounded-full bg-gradient-to-r from-brand-teal via-brand-saffron to-brand-coral origin-left shadow-lg"
        />
        {description && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mt-3 sm:mt-4 text-sm sm:text-base text-muted-foreground max-w-lg leading-relaxed"
          >
            {description}
          </motion.p>
        )}
      </div>
      {actions && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto"
        >
          {actions}
        </motion.div>
      )}
    </motion.div>
  );
}
