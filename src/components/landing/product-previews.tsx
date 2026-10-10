import { motion } from "framer-motion";
import { SAMPLE_CENTRE, SAMPLE_LABEL } from "@/lib/landing-sample";
import { fadeOnly, springDefault, staggerMs } from "@/lib/motion";
import { usePrefers } from "@/hooks/use-prefers";
import { cn } from "@/lib/utils";

/**
 * Capture assets are 780px-wide lossy WebPs of phone UI.
 * Display well under half that width so retina (2×) stays sharp — never
 * stretch toward the capture width (that is what made desktop look soft).
 */
const FRAME_CSS_PX = 300;

const PREVIEWS = [
  {
    id: "dashboard",
    label: "Dashboard",
    src: "/landing/preview-dashboard.webp",
    width: 780,
    height: 1058,
    alt: "Sample dashboard with students, dues and an overdue list",
  },
  {
    id: "fees",
    label: "Fees & dues",
    src: "/landing/preview-fees.webp",
    width: 780,
    height: 1150,
    alt: "Sample fees screen with overdue and pending balances in rupees",
  },
  {
    id: "attendance",
    label: "Attendance",
    src: "/landing/preview-attendance.webp",
    width: 780,
    height: 1158,
    alt: "Sample attendance roster with present, late and absent marks",
  },
] as const;

/** Screenshots of the real UI, captured from Kerala sample fixtures. No live DB. */
export function ProductPreviews() {
  const { reducedMotion } = usePrefers();

  return (
    <div className="mx-auto w-full max-w-4xl">
      <p className="mb-4 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {SAMPLE_CENTRE} · {SAMPLE_LABEL}
      </p>
      <ul className="mx-auto grid list-none gap-5 p-0 sm:grid-cols-3 sm:gap-4 lg:gap-5">
        {PREVIEWS.map((p, i) => (
          <motion.li
            key={p.id}
            className="mx-auto w-full"
            style={{ maxWidth: FRAME_CSS_PX }}
            initial={
              reducedMotion
                ? { opacity: 0 }
                : { opacity: 0, transform: "translateY(20px)" }
            }
            whileInView={
              reducedMotion
                ? { opacity: 1 }
                : { opacity: 1, transform: "translateY(0px)" }
            }
            viewport={{ once: true, amount: 0.2 }}
            transition={{
              ...(reducedMotion ? fadeOnly : springDefault),
              delay: reducedMotion ? 0 : (i * staggerMs) / 1000,
            }}
          >
            <figure
              className={cn(
                "overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[var(--shadow-card)]",
                "hover-lift",
              )}
            >
              <figcaption className="border-b border-border/50 px-3 py-2 text-xs font-semibold text-muted-foreground">
                {p.label} · {SAMPLE_LABEL}
              </figcaption>
              <div className="bg-muted/20">
                <img
                  src={p.src}
                  alt={p.alt}
                  width={p.width}
                  height={p.height}
                  className="screenshot block h-auto w-full"
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                  sizes={`${FRAME_CSS_PX}px`}
                />
              </div>
            </figure>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
