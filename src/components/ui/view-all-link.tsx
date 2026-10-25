import { useRef } from "react";

import { ArrowLeftIcon, type AnimatedIconHandle } from "@/components/icons/animated";
import { buttonClass } from "@/components/ui/button";

import { AppLink } from "./app-link";

/** Ghost "view all" link whose arrow nudges forward on hover/focus (left = forward in RTL). */
export function ViewAllLink({ to, label }: { to: string; label: string }) {
  const icon = useRef<AnimatedIconHandle>(null);
  const play = () => icon.current?.startAnimation();
  const stop = () => icon.current?.stopAnimation();
  return (
    <AppLink to={to} onMouseEnter={play} onMouseLeave={stop} onFocus={play} onBlur={stop} className={buttonClass({ variant: "ghost", size: "sm" })}>
      {label}
      <ArrowLeftIcon ref={icon} size={18} className="ma-icon-fwd" />
    </AppLink>
  );
}
