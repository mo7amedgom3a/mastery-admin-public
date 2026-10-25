import { create } from "zustand";

/**
 * Language + direction. Arabic is the default (design kit golden rule 7); English is a toggle.
 * The `<html>` element's `lang`/`dir` are kept in sync by `I18nProvider` in `App`.
 */
export type Lang = "ar" | "en";

const LANG_KEY = "admin.lang";

function storedLang(): Lang {
  if (typeof localStorage === "undefined") return "ar";
  return localStorage.getItem(LANG_KEY) === "en" ? "en" : "ar";
}

type LangState = {
  lang: Lang;
  setLang: (lang: Lang) => void;
};

export const useLangStore = create<LangState>((set) => ({
  lang: storedLang(),
  setLang: (lang) => {
    if (typeof localStorage !== "undefined") localStorage.setItem(LANG_KEY, lang);
    set({ lang });
  },
}));

export function useLang(): Lang {
  return useLangStore((state) => state.lang);
}

/** Pick the current-language string: `t("عربي", "English")`. */
export function translate(lang: Lang, ar: string, en?: string): string {
  return lang === "ar" ? ar : (en ?? ar);
}

export function useT(): (ar: string, en?: string) => string {
  const lang = useLang();
  return (ar, en) => translate(lang, ar, en);
}

export function dirOf(lang: Lang): "rtl" | "ltr" {
  return lang === "ar" ? "rtl" : "ltr";
}

/** Latin digits with the Gregorian calendar in both languages, matching how the team reads data. */
export function localeOf(lang: Lang): string {
  return lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-US";
}
