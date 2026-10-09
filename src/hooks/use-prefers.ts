import { useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/**
 * Three independent accessibility signals from the Apple design notes.
 * Reduced motion ≠ no feedback — callers should swap slides/springs
 * for a short fade, not freeze the UI.
 */
export function usePrefers() {
  const reducedMotion = useReducedMotion() ?? false;
  const reducedTransparency = useMediaQuery(
    "(prefers-reduced-transparency: reduce)",
  );
  const moreContrast = useMediaQuery("(prefers-contrast: more)");

  return { reducedMotion, reducedTransparency, moreContrast };
}
