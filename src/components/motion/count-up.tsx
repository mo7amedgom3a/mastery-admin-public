import { useEffect, useRef } from "react";

import { formatNumber } from "@/lib/format";

type CountUpProps = {
  value: number;
  prefix?: string;
  /** Milliseconds for the full count. */
  duration?: number;
  className?: string;
};

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/**
 * Animates from 0 to `value` on mount and whenever `value` changes.
 * - A single text node carries the number, so copying/DOM text is never duplicated.
 * - `aria-label` always exposes the final value to assistive tech, even mid-animation.
 * - Writes straight to the text node inside rAF: no React re-render per frame.
 * - Width is reserved with `ch` + tabular digits, so counting never shifts layout.
 * - Reduced motion: shows the final number, no animation.
 *
 * It animates on mount (not on scroll-into-view): a dashboard KPI that renders below the fold must
 * still show its real number, never a misleading `0`.
 */
export function CountUp({ value, prefix = "", duration = 1200, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const final = `${prefix}${formatNumber(value)}`;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const render = (n: number) => {
      node.textContent = `${prefix}${formatNumber(n)}`;
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      render(value);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      render(Math.round(value * easeOutCubic(progress)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    render(0);
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      render(value);
    };
  }, [value, prefix, duration]);

  return (
    <span
      ref={ref}
      role="text"
      aria-label={final}
      dir="ltr"
      className={className}
      style={{ display: "inline-block", minWidth: `${final.length}ch`, fontVariantNumeric: "tabular-nums" }}
    >
      {final}
    </span>
  );
}
