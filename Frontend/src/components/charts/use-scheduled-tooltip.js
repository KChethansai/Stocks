'use client';
// LOCAL GLUE (not Bklit source): minimal re-implementation of Bklit's
// unpublished ./use-scheduled-tooltip, derived from its call sites in
// use-chart-interaction.ts. Deduplicates rapid hover updates via rAF and
// an optional caller-supplied key.
import { useCallback, useEffect, useRef, useState } from "react";

export function useScheduledTooltip() {
  const [tooltipData, setTooltipData] = useState(null);
  const rafRef = useRef(0);
  const lastKeyRef = useRef(null);

  const clearRaf = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  };

  useEffect(() => clearRaf, []);

  const clearTooltip = useCallback(() => {
    clearRaf();
    lastKeyRef.current = null;
    setTooltipData(null);
  }, []);

  const resetTooltipDedupe = useCallback(() => {
    lastKeyRef.current = null;
  }, []);

  const scheduleTooltip = useCallback((next, key) => {
    const dedupeKey = key ?? (next ? next.index : null);
    if (dedupeKey !== null && dedupeKey === lastKeyRef.current) return;
    lastKeyRef.current = dedupeKey;
    clearRaf();
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      setTooltipData(next);
    });
  }, []);

  return { tooltipData, setTooltipData, scheduleTooltip, clearTooltip, resetTooltipDedupe };
}
