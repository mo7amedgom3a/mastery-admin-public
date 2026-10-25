import { STOREFRONT_ORIGIN } from "@/features/learning/studio/preview/use-preview-channel";

/** The expert's public page on the storefront. */
export function expertPublicUrl(key: string): string {
  return `${STOREFRONT_ORIGIN.replace(/\/$/, "")}/experts/${encodeURIComponent(key)}`;
}
