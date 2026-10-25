import { motion, useReducedMotion } from "motion/react";
import type { ComponentProps, HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type WavingHandProps = HTMLAttributes<HTMLSpanElement> & {
  className?: string;
  variant?: "emoji" | "icon";
};

export function WavingHand({ className, variant = "emoji", style, ...props }: WavingHandProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.span
      role="img"
      aria-hidden="true"
      className={cn(
        "inline-block origin-[70%_70%] select-none cursor-default leading-none",
        variant === "icon" && "align-middle",
        className,
      )}
      style={{
        transformOrigin: "70% 70%",
        display: "inline-block",
        ...style,
      }}
      animate={
        shouldReduceMotion
          ? undefined
          : {
              rotate: [0, 14, -8, 14, -4, 10, 0],
            }
      }
      transition={{
        duration: 1.8,
        repeat: Infinity,
        repeatDelay: 1.2,
        ease: "easeInOut",
      }}
      whileHover={
        shouldReduceMotion
          ? undefined
          : {
              rotate: [0, 18, -10, 18, -6, 12, 0],
              transition: { duration: 0.8, ease: "easeInOut" },
            }
      }
      {...(props as ComponentProps<typeof motion.span>)}
    >
      {variant === "icon" ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="1.1em"
          height="1.1em"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="inline-block"
        >
          <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
          <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" />
          <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" />
          <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
        </svg>
      ) : (
        "👋"
      )}
    </motion.span>
  );
}
