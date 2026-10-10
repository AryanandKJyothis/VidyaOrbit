import { useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { usePrefers } from "@/hooks/use-prefers";
import { easeInOutStrong, easeOutStrong } from "@/lib/motion";

/**
 * Slim top progress bar that appears whenever the router is navigating /
 * loading a route chunk. Eliminates the "stuck for 1s on click" feel.
 */
export function RouteProgress() {
  const { reducedMotion } = usePrefers();
  const isLoading = useRouterState({
    select: (s) => s.status === "pending" || s.isLoading,
  });

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          key="route-progress"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12, ease: easeOutStrong }}
          className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[2px] overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
          <motion.div
            className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-gradient-to-r from-brand-teal via-brand-saffron to-brand-coral"
            initial={{ x: "-100%" }}
            animate={reducedMotion ? { x: "120%" } : { x: ["-100%", "350%"] }}
            transition={
              reducedMotion
                ? { duration: 0.18, ease: easeOutStrong }
                : {
                    duration: 1,
                    repeat: Infinity,
                    ease: easeInOutStrong,
                  }
            }
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
