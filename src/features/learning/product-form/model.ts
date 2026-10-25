import { useState } from "react";

import type { CreateProductRequest, ProductCreateType, ProductLevel } from "@/lib/api";

/**
 * Shared state and helpers for the "create product" pages. One form state shape feeds the catalog
 * endpoints (`POST /admin/catalog/products`) and the type-specific pages (bundle, live diploma),
 * so validation, slug generation and price parsing behave identically everywhere.
 */

/** Types the unified create page submits to `POST /admin/catalog/products`. */
export type CatalogCreateType = Extract<ProductCreateType, "course" | "diploma" | "package" | "consultation">;

export const CATALOG_CREATE_TYPES: { value: CatalogCreateType; ar: string; en: string }[] = [
  { value: "course", ar: "دورة", en: "Course" },
  { value: "diploma", ar: "دبلوم", en: "Diploma" },
  { value: "package", ar: "حزمة", en: "Package" },
  { value: "consultation", ar: "استشارة", en: "Consultation" },
];

/** Every price on the platform is entered in US dollars. */
export const PRICE_CURRENCY = "USD";

export const LEVEL_OPTIONS: { value: ProductLevel; ar: string; en: string }[] = [
  { value: "beginner", ar: "مبتدئ", en: "Beginner" },
  { value: "intermediate", ar: "متوسط", en: "Intermediate" },
  { value: "advanced", ar: "متقدم", en: "Advanced" },
];

export const LANGUAGE_OPTIONS: { value: string; ar: string; en: string }[] = [
  { value: "ar", ar: "العربية", en: "Arabic" },
  { value: "en", ar: "الإنجليزية", en: "English" },
];

/** The "general info" block: how long the product is, who it is for, and how long buyers keep access. */
export type GeneralInfo = {
  durationHours: string;
  level: ProductLevel | "";
  language: string;
  /** Lifetime access, or `accessDurationDays` days after purchase. */
  lifetimeAccess: boolean;
  accessDurationDays: string;
  cpdEligible: boolean;
};

export const EMPTY_GENERAL_INFO: GeneralInfo = {
  durationHours: "",
  level: "",
  language: "ar",
  lifetimeAccess: true,
  accessDurationDays: "365",
  cpdEligible: false,
};

export type CatalogFormState = GeneralInfo & {
  title: string;
  titleEn: string;
  shortDescription: string;
  description: string;
  slug: string;
  /** Once the admin edits the slug by hand, stop regenerating it from the title. */
  slugEdited: boolean;
  price: string;
  marketingTag: string;
  appleStoreId: string;
  googleStoreId: string;
  featured: boolean;
  manualAccounting: boolean;
  published: boolean;
  categoryIds: string[];
  skillIds: string[];
  keywords: string[];
  instructorIds: number[];
  expertIds: number[];
  courseRefs: string[];
  /** Consultation session length in minutes. */
  durationMinutes: string;
};

const EMPTY_FORM: CatalogFormState = {
  ...EMPTY_GENERAL_INFO,
  title: "",
  titleEn: "",
  shortDescription: "",
  durationMinutes: "60",
  description: "",
  slug: "",
  slugEdited: false,
  price: "",
  marketingTag: "",
  appleStoreId: "",
  googleStoreId: "",
  featured: false,
  manualAccounting: false,
  published: true,
  categoryIds: [],
  skillIds: [],
  keywords: [],
  instructorIds: [],
  expertIds: [],
  courseRefs: [],
};

/** Keys whose value is a list of toggleable ids/strings. */
export type CatalogListKey = "categoryIds" | "skillIds" | "keywords" | "instructorIds" | "expertIds" | "courseRefs";

export function useCatalogForm(initial: Partial<CatalogFormState> = {}) {
  const [form, setForm] = useState<CatalogFormState>({ ...EMPTY_FORM, ...initial });

  const setField = <K extends keyof CatalogFormState>(key: K, value: CatalogFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  /** Set a text field; when the title changes and the slug is still auto, keep the slug in sync. */
  const setTitle = (value: string) =>
    setForm((prev) => ({ ...prev, title: value, slug: prev.slugEdited ? prev.slug : toSlug(prev.titleEn || value) }));

  const setTitleEn = (value: string) =>
    setForm((prev) => ({ ...prev, titleEn: value, slug: prev.slugEdited ? prev.slug : toSlug(value || prev.title) }));

  const setSlug = (value: string) => setForm((prev) => ({ ...prev, slug: value, slugEdited: true }));

  const toggle = (key: CatalogListKey, value: string | number) =>
    setForm((prev) => {
      const list = prev[key] as (string | number)[];
      const next = list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
      return { ...prev, [key]: next };
    });

  const setList = (key: CatalogListKey, value: (string | number)[]) => setForm((prev) => ({ ...prev, [key]: value }));

  return { form, setForm, setField, setTitle, setTitleEn, setSlug, toggle, setList };
}

/**
 * Latin, URL-safe slug. Arabic titles transliterate to nothing, so the field stays editable and
 * the admin types a Latin slug when the auto value comes back empty (required for live diplomas).
 */
export function toSlug(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Kebab-case validation for live diplomas (`^[a-z0-9]+(?:-[a-z0-9]+)*$`). */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

/** `null` for an empty price; a finite non-negative number otherwise (`null` when malformed). */
export function parsePrice(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/** A price the create endpoints accept: present and a finite number ≥ 0 (`minimum` raises the floor). */
export function isPriceRequiredValid(value: string, minimum = 0): boolean {
  const parsed = parsePrice(value);
  return parsed !== null && parsed >= minimum && (minimum === 0 || parsed > 0);
}

/** `null` for an empty number field, the number when valid and ≥ 0, `NaN` when malformed. */
export function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN;
}

/** Whether the general-info block holds values the API accepts. */
export function isGeneralInfoValid(info: GeneralInfo): boolean {
  const hours = parseOptionalNumber(info.durationHours);
  if (hours !== null && Number.isNaN(hours)) return false;
  if (info.lifetimeAccess) return true;
  const days = Number(info.accessDurationDays);
  return Number.isInteger(days) && days >= 1;
}

/** The general-info fields of a create request; lifetime access is sent as `null`. */
export function generalInfoPayload(
  info: GeneralInfo,
): Pick<CreateProductRequest, "duration_hours" | "level" | "language" | "access_duration_days" | "cpd_eligible"> {
  return {
    duration_hours: parseOptionalNumber(info.durationHours),
    level: info.level || null,
    language: info.language || null,
    access_duration_days: info.lifetimeAccess ? null : Number(info.accessDurationDays),
    cpd_eligible: info.cpdEligible,
  };
}

export function isPriceValid(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return true;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0;
}

/** `null` for empty optional text so the API clears the field. */
export function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function trimmed(value: string): string {
  return value.trim();
}
