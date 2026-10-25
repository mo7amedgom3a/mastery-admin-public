/**
 * Refs of federated admin resources: `b2c:<uuid>` or `legacy:<kind>:<id>`. Routes take the ref
 * (URL-encoded), so B2C and legacy items open on the same pages.
 */

export const orderHref = (ref: string): string => `/sales/orders/${encodeURIComponent(ref)}`;
export const paymentHref = (ref: string): string => `/sales/payments/${encodeURIComponent(ref)}`;
/** A refund case (plain B2C case id; refund cases have no legacy counterpart). */
export const refundCaseHref = (caseId: string): string => `/sales/refunds/${encodeURIComponent(caseId)}`;
export const customerHref = (ref: string): string => `/customers/${encodeURIComponent(ref)}`;
export const productHref = (ref: string): string => `/learning/catalog/${encodeURIComponent(ref)}`;
/** A product's detail page opened on one tab (`?tab=`), e.g. right after it is created. */
export const productTabHref = (ref: string, tab: string): string => `${productHref(ref)}?tab=${encodeURIComponent(tab)}`;
/** Course Studio of a product (page editor with live preview). */
export const studioHref = (ref: string): string => `${productHref(ref)}/studio`;

/** Short display id of a ref: `#120345` for legacy rows, `#1a2b3c4d` for B2C UUIDs. */
export function shortRef(ref: string | null | undefined): string {
  if (!ref) return "—";
  const parts = ref.split(":");
  const id = parts[parts.length - 1];
  return `#${parts[0] === "legacy" ? id : id.slice(0, 8)}`;
}

/** The route param of a ref page, decoded. */
export const refParam = (value: string | undefined): string => decodeURIComponent(value ?? "");

/** Whether a federated item comes from the legacy platform (read-only in the admin). */
export const isLegacy = (item: { source?: string | null } | null | undefined): boolean => item?.source === "legacy";
