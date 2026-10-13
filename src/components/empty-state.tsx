import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { usePrefers } from "@/hooks/use-prefers";
import { fadeOnly, springDefault } from "@/lib/motion";

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
  const { reducedMotion } = usePrefers();
  const transition = reducedMotion ? fadeOnly : springDefault;

  return (
    <motion.div
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition}
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/10 px-6 py-14 text-center",
        className,
      )}
    >
      {Icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Icon className="h-7 w-7" strokeWidth={1.5} />
        </div>
      )}
      <h3 className="font-display text-lg font-semibold leading-tight tracking-tight text-foreground text-balance">
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty">
        {description}
      </p>
      {children && (
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {children}
        </div>
      )}
    </motion.div>
  );
}
