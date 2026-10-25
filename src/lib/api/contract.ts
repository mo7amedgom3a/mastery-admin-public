import type { components } from "@/types/openapi";

/**
 * Shared shapes of the admin API. Every admin resource is served by the admin module (`/api/v1/admin/*`)
 * over B2C and the legacy platform; the generated OpenAPI types describe them exactly, so these are
 * aliases of `@/types/openapi` schemas plus a few UI helpers.
 */

type Schema = components["schemas"];

export type Page<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type DateRange = { start: string; end: string };

/** System of record of a federated item. */
export type RecordSource = "b2c" | "legacy";

/** A generic row rendered by the auto-column tables (`AdminListPanel`). */
export type Row = Record<string, unknown>;

/** Legacy course/package kind of catalog refs (`legacy:course:<id>`, `legacy:package:<id>`). */
export type CatalogKind = "course" | "package";

/** Every catalog product type (`b2c.products.product_type`). */
export type ProductType = "course" | "diploma" | "package" | "bundle" | "consultation" | "live_diploma";

/** Kind of storefront data the studio live preview renders (postMessage `kind`). */
export type PreviewKind = ProductType;

/** Legacy course/package detail attached to a catalog product (`CatalogProductView.legacy.product`). */
export type CatalogProduct = Schema["CatalogProduct"];
export type Promotion = Schema["Promotion"];
export type ReferralPartner = Schema["ReferralPartner"];
export type ReferralPayout = Schema["PayoutRequest"];
export type ConsultationService = Schema["ConsultationService"];
export type TicketMessage = Schema["SupportMessage"];
export type SupportTicket = Schema["SupportTicket"];
