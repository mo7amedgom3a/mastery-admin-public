import { apiDelete, apiGet, apiPost } from "@/lib/api/client";
import type { QueryParams, SuccessResponse } from "@/lib/api/operation-types";

/*
 * Customer management beyond the profile (`/admin/customers/{customer_ref}/…`, B2C customers only): access
 * given by admins (zero-total `admin_grant` orders), the profile photo, internal notes and the admin history.
 */

type GrantsOp = "list_grants_api_v1_admin_customers__customer_ref__grants_get";
type GrantOptionsOp = "grant_options_api_v1_admin_customers__customer_ref__grant_options_get";
type AvatarOp = "get_avatar_api_v1_admin_customers__customer_ref__avatar_get";
type NotesOp = "list_notes_api_v1_admin_customers__customer_ref__notes_get";
type HistoryOp = "customer_history_api_v1_admin_customers__customer_ref__history_get";

export type CustomerGrant = SuccessResponse<GrantsOp>[number];
export type CustomerGrantOption = SuccessResponse<GrantOptionsOp>[number];
export type CustomerGrantOptionsParams = Omit<QueryParams<GrantOptionsOp>, "customer_ref">;
export type CustomerAvatar = SuccessResponse<AvatarOp>;
export type CustomerNote = SuccessResponse<NotesOp>[number];
export type CustomerHistoryEntry = SuccessResponse<HistoryOp>[number];

const base = "admin/customers/{customer_ref}";

export const customerAdminKeys = {
  all: ["customers", "admin"] as const,
  grants: (ref: string) => [...customerAdminKeys.all, "grants", ref] as const,
  grantOptions: (ref: string, params: CustomerGrantOptionsParams) => [...customerAdminKeys.all, "grant-options", ref, params] as const,
  avatar: (ref: string) => [...customerAdminKeys.all, "avatar", ref] as const,
  notes: (ref: string) => [...customerAdminKeys.all, "notes", ref] as const,
  history: (ref: string) => [...customerAdminKeys.all, "history", ref] as const,
};

export function listCustomerGrants(ref: string): Promise<CustomerGrant[]> {
  return apiGet(`${base}/grants`, { path: { customer_ref: ref } });
}

/** Published courses, diplomas, packages and bundles, flagged when the customer already has access. */
export function listCustomerGrantOptions(ref: string, params: CustomerGrantOptionsParams): Promise<CustomerGrantOption[]> {
  return apiGet(`${base}/grant-options`, { path: { customer_ref: ref }, query: params });
}

/** Gives access without payment; returns the customer's grants. */
export function grantCustomerAccess(ref: string, product_id: string, reason: string): Promise<CustomerGrant[]> {
  return apiPost(`${base}/grants`, { path: { customer_ref: ref }, body: { product_id, reason } });
}

export function revokeCustomerGrant(ref: string, order_id: string): Promise<CustomerGrant[]> {
  return apiDelete(`${base}/grants/{order_id}`, { path: { customer_ref: ref, order_id } });
}

export function getCustomerAvatar(ref: string): Promise<CustomerAvatar> {
  return apiGet(`${base}/avatar`, { path: { customer_ref: ref } });
}

/** JPEG, PNG or WebP, ≤ 5 MB. */
export function uploadCustomerAvatar(ref: string, file: File): Promise<CustomerAvatar> {
  return apiPost(`${base}/avatar`, {
    path: { customer_ref: ref },
    query: { filename: file.name },
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream" },
  });
}

export function listCustomerNotes(ref: string): Promise<CustomerNote[]> {
  return apiGet(`${base}/notes`, { path: { customer_ref: ref } });
}

export function addCustomerNote(ref: string, body: string): Promise<CustomerNote[]> {
  return apiPost(`${base}/notes`, { path: { customer_ref: ref }, body: { body } });
}

export function deleteCustomerNote(ref: string, note_id: string): Promise<CustomerNote[]> {
  return apiDelete(`${base}/notes/{note_id}`, { path: { customer_ref: ref, note_id } });
}

export function listCustomerHistory(ref: string): Promise<CustomerHistoryEntry[]> {
  return apiGet(`${base}/history`, { path: { customer_ref: ref } });
}
