import { useRef } from "react";

import { MoonIcon, SunIcon, type AnimatedIconHandle } from "@/components/icons/animated";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n";
import { useThemeStore, resolvedTheme } from "@/lib/theme";

/**
 * Light/dark switch following the kit's `data-theme` contract. Port of mastery-front's
 * `theme/theme-toggle.tsx` onto the admin theme store; the sun/moon play a short animation on
 * hover and focus.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const sun = useRef<AnimatedIconHandle>(null);
  const moon = useRef<AnimatedIconHandle>(null);
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const isDark = resolvedTheme(theme) === "dark";
  const t = useT();
  const label = isDark ? t("الوضع الفاتح", "Light mode") : t("الوضع الداكن", "Dark mode");

  const play = () => {
    sun.current?.startAnimation();
    moon.current?.startAnimation();
  };
  const stop = () => {
    sun.current?.stopAnimation();
    moon.current?.stopAnimation();
  };

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      onMouseEnter={play}
      onMouseLeave={stop}
      onFocus={play}
      onBlur={stop}
      aria-label={label}
      title={label}
      className={cn("ma-btn ma-btn--bare ma-btn--icon", className)}
    >
      {isDark ? <SunIcon ref={sun} size={20} /> : <MoonIcon ref={moon} size={20} />}
    </button>
  );
}
