import { queryOptions } from "@tanstack/react-query";

import { apiGet, apiPost, apiPut } from "@/lib/api/client";
import type { QueryParams, RequestBody, SuccessResponse } from "@/lib/api/operation-types";

type ListVouchersOp = "list_vouchers_api_v1_admin_vouchers_get";
type IssueVoucherOp = "issue_voucher_api_v1_admin_vouchers_post";
type PreviewBulkOp = "preview_bulk_api_v1_admin_vouchers_bulk_preview_post";
type IssueBulkOp = "issue_bulk_api_v1_admin_vouchers_bulk_post";
type GetVoucherOp = "get_voucher_api_v1_admin_vouchers__voucher_id__get";
type RevokeVoucherOp = "revoke_voucher_api_v1_admin_vouchers__voucher_id__revoke_post";
type VoucherExpiryOp = "set_voucher_expiry_api_v1_admin_vouchers__voucher_id__expiry_put";

export type VouchersParams = QueryParams<ListVouchersOp>;
export type VoucherPage = SuccessResponse<ListVouchersOp>;
export type Voucher = SuccessResponse<GetVoucherOp>;
export type VoucherTransaction = NonNullable<Voucher["transactions"]>[number];
export type IssueVoucherRequest = RequestBody<IssueVoucherOp>;
export type VoucherSegment = RequestBody<PreviewBulkOp>;
export type VoucherSegmentPreview = SuccessResponse<PreviewBulkOp>;
export type BulkIssueRequest = RequestBody<IssueBulkOp>;
export type BulkIssueResult = SuccessResponse<IssueBulkOp>;

export const vouchersPaths = {
  vouchers: "admin/vouchers",
  bulkPreview: "admin/vouchers/bulk/preview",
  bulk: "admin/vouchers/bulk",
  voucher: "admin/vouchers/{voucher_id}",
  revoke: "admin/vouchers/{voucher_id}/revoke",
  expiry: "admin/vouchers/{voucher_id}/expiry",
} as const;

export const vouchersKeys = {
  all: ["marketing", "vouchers"] as const,
  list: (params?: VouchersParams) => [...vouchersKeys.all, "list", params ?? {}] as const,
  detail: (voucherId: string) => [...vouchersKeys.all, "detail", voucherId] as const,
};

/** `GET /admin/vouchers` — vouchers (store credit) with balance, usage and status. */
export function listVouchers(params: VouchersParams = {}): Promise<VoucherPage> {
  return apiGet(vouchersPaths.vouchers, { query: params });
}

/** `POST /admin/vouchers` — issues a voucher to one customer (id or email). Audited. */
export function issueVoucher(body: IssueVoucherRequest): Promise<Voucher> {
  return apiPost(vouchersPaths.vouchers, { body });
}

/** `POST /admin/vouchers/bulk/preview` — who a spend segment matches, before issuing. */
export function previewVoucherSegment(body: VoucherSegment): Promise<VoucherSegmentPreview> {
  return apiPost(vouchersPaths.bulkPreview, { body });
}

/** `POST /admin/vouchers/bulk` — one voucher per customer of the segment. Audited. */
export function issueBulkVouchers(body: BulkIssueRequest): Promise<BulkIssueResult> {
  return apiPost(vouchersPaths.bulk, { body });
}

export function getVoucher(voucher_id: string): Promise<Voucher> {
  return apiGet(vouchersPaths.voucher, { path: { voucher_id } });
}

export function revokeVoucher(voucher_id: string, note?: string | null): Promise<SuccessResponse<RevokeVoucherOp>> {
  return apiPost(vouchersPaths.revoke, { path: { voucher_id }, body: { note: note ?? null } });
}

/** A past date expires the voucher now; a later one extends (and reopens an expired voucher). */
export function setVoucherExpiry(voucher_id: string, expires_at: string | null): Promise<SuccessResponse<VoucherExpiryOp>> {
  return apiPut(vouchersPaths.expiry, { path: { voucher_id }, body: { expires_at } });
}

export const vouchersQueries = {
  list: (params?: VouchersParams) => queryOptions({ queryKey: vouchersKeys.list(params), queryFn: () => listVouchers(params) }),
  detail: (voucherId: string) => queryOptions({ queryKey: vouchersKeys.detail(voucherId), queryFn: () => getVoucher(voucherId) }),
};
