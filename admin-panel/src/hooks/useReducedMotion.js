import { useEffect, useState } from "react";

/**
 * Tracks `prefers-reduced-motion: reduce`.
 *
 * A single shared media-query listener per component instead of ad-hoc checks
 * sprinkled through pages — and it degrades safely in jsdom/older browsers
 * where `matchMedia` or `addEventListener` on the query list is missing.
 */
const useReducedMotion = () => {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  return reduced;
};

export default useReducedMotion;
