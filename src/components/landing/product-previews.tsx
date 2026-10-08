import { SAMPLE_CENTRE, SAMPLE_LABEL } from "@/lib/landing-sample";

const PREVIEWS = [
  {
    id: "fees",
    label: "Fees & dues",
    src: "/landing/preview-fees.webp",
    width: 780,
    height: 1150,
    alt: "Sample fees screen with overdue and pending balances in rupees",
  },
  {
    id: "dashboard",
    label: "Dashboard",
    src: "/landing/preview-dashboard.webp",
    width: 780,
    height: 1058,
    alt: "Sample dashboard with students, dues and an overdue list",
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
  const [hero, ...rest] = PREVIEWS;
  return (
    <div>
      <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {SAMPLE_CENTRE} · {SAMPLE_LABEL}
      </p>
      <figure className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-lift)]">
        <figcaption className="sr-only">{hero.label}</figcaption>
        <img
          src={hero.src}
          alt={hero.alt}
          width={hero.width}
          height={hero.height}
          className="h-auto w-full"
          loading="lazy"
          decoding="async"
        />
      </figure>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {rest.map((p) => (
          <figure
            key={p.id}
            className="overflow-hidden rounded-2xl border border-border bg-card"
          >
            <figcaption className="px-3 py-2 text-xs font-semibold text-muted-foreground">
              {p.label} · {SAMPLE_LABEL}
            </figcaption>
            <img
              src={p.src}
              alt={p.alt}
              width={p.width}
              height={p.height}
              className="h-auto w-full"
              loading="lazy"
              decoding="async"
            />
          </figure>
        ))}
      </div>
    </div>
  );
}
