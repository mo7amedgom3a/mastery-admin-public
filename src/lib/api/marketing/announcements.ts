import { queryOptions } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/lib/api/client";
import type { QueryParams, RequestBody, SuccessResponse } from "@/lib/api/operation-types";

/** The storefront announcement bar above the header (`/admin/announcements`, marketing scopes). */

type ListBarsOp = "list_bars_api_v1_admin_announcements_get";
type CreateBarOp = "create_bar_api_v1_admin_announcements_post";
type GetBarOp = "get_bar_api_v1_admin_announcements__bar_id__get";
type UpdateBarOp = "update_bar_api_v1_admin_announcements__bar_id__patch";
type SetBarStatusOp = "set_bar_status_api_v1_admin_announcements__bar_id__status_put";
type DuplicateBarOp = "duplicate_bar_api_v1_admin_announcements__bar_id__duplicate_post";
type CreateItemOp = "create_item_api_v1_admin_announcements__bar_id__items_post";
type UpdateItemOp = "update_item_api_v1_admin_announcements__bar_id__items__item_id__patch";
type ReorderItemsOp = "reorder_items_api_v1_admin_announcements__bar_id__items_order_put";

export type AnnouncementBarsParams = QueryParams<ListBarsOp>;
export type AnnouncementBarPage = SuccessResponse<ListBarsOp>;
export type AnnouncementBarAdmin = SuccessResponse<GetBarOp>;
export type AnnouncementItemAdmin = AnnouncementBarAdmin["items"][number];
export type AnnouncementBarInput = RequestBody<CreateBarOp>;
export type AnnouncementBarUpdate = RequestBody<UpdateBarOp>;
export type AnnouncementBarStatus = RequestBody<SetBarStatusOp>["status"];
export type AnnouncementStyle = AnnouncementBarAdmin["style"];
export type AnnouncementItemInput = RequestBody<CreateItemOp>;

export const announcementsPaths = {
  bars: "admin/announcements",
  bar: "admin/announcements/{bar_id}",
  status: "admin/announcements/{bar_id}/status",
  duplicate: "admin/announcements/{bar_id}/duplicate",
  items: "admin/announcements/{bar_id}/items",
  item: "admin/announcements/{bar_id}/items/{item_id}",
  order: "admin/announcements/{bar_id}/items/order",
} as const;

export const announcementsKeys = {
  all: ["marketing", "announcements"] as const,
  list: (params?: AnnouncementBarsParams) => [...announcementsKeys.all, "list", params ?? {}] as const,
  detail: (barId: string) => [...announcementsKeys.all, "detail", barId] as const,
};

/** `GET /admin/announcements` — bars with items; archived ones only when filtered by status. */
export function listAnnouncementBars(params: AnnouncementBarsParams = {}): Promise<AnnouncementBarPage> {
  return apiGet(announcementsPaths.bars, { query: params });
}

export function getAnnouncementBar(bar_id: string): Promise<AnnouncementBarAdmin> {
  return apiGet(announcementsPaths.bar, { path: { bar_id } });
}

/** `POST /admin/announcements` — always created as a draft. Audited. */
export function createAnnouncementBar(body: AnnouncementBarInput): Promise<AnnouncementBarAdmin> {
  return apiPost(announcementsPaths.bars, { body });
}

/** `PATCH /admin/announcements/{id}` — content changes re-show the bar to visitors who dismissed it. */
export function updateAnnouncementBar(bar_id: string, body: AnnouncementBarUpdate): Promise<SuccessResponse<UpdateBarOp>> {
  return apiPatch(announcementsPaths.bar, { path: { bar_id }, body });
}

export function setAnnouncementBarStatus(
  bar_id: string,
  status: AnnouncementBarStatus,
): Promise<SuccessResponse<SetBarStatusOp>> {
  return apiPut(announcementsPaths.status, { path: { bar_id }, body: { status } });
}

export function duplicateAnnouncementBar(bar_id: string): Promise<SuccessResponse<DuplicateBarOp>> {
  return apiPost(announcementsPaths.duplicate, { path: { bar_id } });
}

export function createAnnouncementItem(bar_id: string, body: AnnouncementItemInput): Promise<AnnouncementItemAdmin> {
  return apiPost(announcementsPaths.items, { path: { bar_id }, body });
}

export function updateAnnouncementItem(
  bar_id: string,
  item_id: string,
  body: RequestBody<UpdateItemOp>,
): Promise<AnnouncementItemAdmin> {
  return apiPatch(announcementsPaths.item, { path: { bar_id, item_id }, body });
}

export function deleteAnnouncementItem(bar_id: string, item_id: string): Promise<void> {
  return apiDelete(announcementsPaths.item, { path: { bar_id, item_id } });
}

export function reorderAnnouncementItems(bar_id: string, item_ids: string[]): Promise<SuccessResponse<ReorderItemsOp>> {
  return apiPut(announcementsPaths.order, { path: { bar_id }, body: { item_ids } });
}

export const announcementsQueries = {
  list: (params?: AnnouncementBarsParams) =>
    queryOptions({ queryKey: announcementsKeys.list(params), queryFn: () => listAnnouncementBars(params) }),
  detail: (barId: string) =>
    queryOptions({ queryKey: announcementsKeys.detail(barId), queryFn: () => getAnnouncementBar(barId) }),
};
