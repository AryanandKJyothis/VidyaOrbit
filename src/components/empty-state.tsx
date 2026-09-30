import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

type Props = {
  icon?: LucideIcon;
  title: string;
  description: string;
  children?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-gradient-to-b from-muted/15 to-muted/5 px-6 py-12 text-center",
        className,
      )}
    >
      {Icon && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-teal/15 to-brand-saffron/10 text-muted-foreground hover:text-primary transition-colors duration-300"
        >
          <Icon className="h-7 w-7" strokeWidth={1.3} />
        </motion.div>
      )}
      <motion.h3
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="text-base font-semibold text-foreground"
      >
        {title}
      </motion.h3>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed"
      >
        {description}
      </motion.p>
      {children && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="mt-6 flex flex-wrap justify-center gap-3"
        >
          {children}
        </motion.div>
      )}
    </motion.div>
  );
}
