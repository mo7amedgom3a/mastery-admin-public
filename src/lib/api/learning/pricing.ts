import { apiGet, apiPost, apiPut } from "@/lib/api/client";
import type { PathParams, QueryParams, RequestBody, SuccessResponse } from "@/lib/api/operation-types";

type GetPriceOp = "get_product_price_api_v1_admin_pricing_products__product_id__get";
type SetPriceOp = "set_product_price_api_v1_admin_pricing_products__product_id__put";
type HistoryOp = "product_price_history_api_v1_admin_pricing_products__product_id__history_get";
type PreviewOp = "preview_bulk_price_change_api_v1_admin_pricing_bulk_preview_post";
type ApplyOp = "apply_bulk_price_change_api_v1_admin_pricing_bulk_apply_post";
type BatchesOp = "list_price_batches_api_v1_admin_pricing_batches_get";
type BatchOp = "get_price_batch_api_v1_admin_pricing_batches__batch_id__get";
type RevertOp = "revert_price_batch_api_v1_admin_pricing_batches__batch_id__revert_post";

export type ProductPriceBody = RequestBody<SetPriceOp>;
export type ProductActivePrice = SuccessResponse<GetPriceOp>;
export type ProductPriceHistoryRow = SuccessResponse<HistoryOp>[number];
export type BulkPriceRequest = RequestBody<PreviewOp>;
export type BulkPriceSelector = BulkPriceRequest["selector"];
export type BulkPriceFilter = NonNullable<BulkPriceSelector["filter"]>;
export type BulkPriceOperation = BulkPriceRequest["operation"];
export type BulkPricePreview = SuccessResponse<PreviewOp>;
export type BulkPriceRow = BulkPricePreview["rows"][number];
export type BulkPriceApplyResult = SuccessResponse<ApplyOp>;
export type PriceBatchPage = SuccessResponse<BatchesOp>;
export type PriceBatch = PriceBatchPage["items"][number];
export type PriceBatchDetail = SuccessResponse<BatchOp>;
export type PriceBatchRevert = SuccessResponse<RevertOp>;
export type PriceBatchListParams = QueryParams<BatchesOp>;

export const pricingPaths = {
  product: "admin/pricing/products/{product_id}",
  history: "admin/pricing/products/{product_id}/history",
  preview: "admin/pricing/bulk/preview",
  apply: "admin/pricing/bulk/apply",
  batches: "admin/pricing/batches",
  batch: "admin/pricing/batches/{batch_id}",
  revert: "admin/pricing/batches/{batch_id}/revert",
} as const;

export const pricingKeys = {
  all: ["pricing"] as const,
  history: (productId: string) => [...pricingKeys.all, "history", productId] as const,
  batches: (params: PriceBatchListParams) => [...pricingKeys.all, "batches", params] as const,
  batch: (batchId: string) => [...pricingKeys.all, "batch", batchId] as const,
};

/** `GET /admin/pricing/products/{id}` — the active global price (USD by default). */
export function getProductPrice(product_id: PathParams<GetPriceOp>["product_id"]): Promise<ProductActivePrice> {
  return apiGet(pricingPaths.product, { path: { product_id } });
}

/** `PUT /admin/pricing/products/{id}` — closes the current price and starts a new one. Audited. */
export function setProductPrice(
  product_id: PathParams<SetPriceOp>["product_id"],
  body: ProductPriceBody,
): Promise<ProductActivePrice> {
  return apiPut(pricingPaths.product, { path: { product_id }, body });
}

/** Every price the product has had, newest first. */
export function getProductPriceHistory(product_id: PathParams<HistoryOp>["product_id"]): Promise<ProductPriceHistoryRow[]> {
  return apiGet(pricingPaths.history, { path: { product_id } });
}

/** New price of every selected product; nothing is written. */
export function previewBulkPriceChange(body: BulkPriceRequest): Promise<BulkPricePreview> {
  return apiPost(pricingPaths.preview, { body });
}

/** Stores the preview as one batch; 409 when `expected_count` no longer matches. */
export function applyBulkPriceChange(body: RequestBody<ApplyOp>): Promise<BulkPriceApplyResult> {
  return apiPost(pricingPaths.apply, { body });
}

export function listPriceBatches(params: PriceBatchListParams = {}): Promise<PriceBatchPage> {
  return apiGet(pricingPaths.batches, { query: params });
}

export function getPriceBatch(batch_id: PathParams<BatchOp>["batch_id"]): Promise<PriceBatchDetail> {
  return apiGet(pricingPaths.batch, { path: { batch_id } });
}

/** Restores the earlier prices; products priced again since the batch are skipped. */
export function revertPriceBatch(batch_id: PathParams<RevertOp>["batch_id"]): Promise<PriceBatchRevert> {
  return apiPost(pricingPaths.revert, { path: { batch_id } });
}
