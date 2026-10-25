import { clsx } from "clsx";
import { useEffect, useRef } from "react";

import { CheckIcon, type AnimatedIconHandle } from "@/components/icons/animated";

/**
 * lucide-animated Check on a coral tile. The stroke draws whenever it becomes visible, including
 * each time a hidden tab panel is shown again. Pass the list position as `index` for a stagger.
 */
export function AnimatedCheck({ index = 0, className }: { index?: number; className?: string }) {
  const tile = useRef<HTMLSpanElement>(null);
  const icon = useRef<AnimatedIconHandle>(null);

  useEffect(() => {
    const node = tile.current;
    if (!node) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        clearTimeout(timer);
        if (entry.isIntersecting) timer = setTimeout(() => icon.current?.startAnimation(), 150 + index * 140);
      },
      { threshold: 0.9 },
    );
    observer.observe(node);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [index]);

  return (
    <span
      ref={tile}
      aria-hidden="true"
      className={clsx("grid size-7 shrink-0 place-items-center bg-accent text-on-accent", className)}
    >
      <CheckIcon ref={icon} size={18} />
    </span>
  );
}
