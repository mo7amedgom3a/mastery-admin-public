import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";

import { dirOf, useLangStore } from "@/lib/i18n";
import { resolvedTheme, useThemeStore } from "@/lib/theme";
import { ROUTER } from "@/routes/router";
import { ToastProvider } from "@/components/ui/toast";

export default function App() {
  usePrefsSync();
  return (
    <ToastProvider>
      <RouterProvider router={ROUTER} />
    </ToastProvider>
  );
}

/** Keeps `<html lang dir data-theme>` in step with the language and theme stores. */
function usePrefsSync() {
  const lang = useLangStore((state) => state.lang);
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = dirOf(lang);
  }, [lang]);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      root.setAttribute("data-theme", resolvedTheme(theme));
    };
    apply();
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
}
