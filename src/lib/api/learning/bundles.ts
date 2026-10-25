import { queryOptions } from "@tanstack/react-query";

import { apiGet, apiPost, apiPut } from "@/lib/api/client";
import type { PathParams, RequestBody, SuccessResponse } from "@/lib/api/operation-types";

type CreateBundleOp = "create_bundle_api_v1_admin_bundles_post";
type GetBundleOp = "get_bundle_api_v1_admin_bundles__product_id__get";
type UpdateBundleOp = "update_bundle_api_v1_admin_bundles__product_id__put";

export type BundleUpsertRequest = RequestBody<CreateBundleOp>;
export type BundleDetail = SuccessResponse<CreateBundleOp> & {
  category_ids: string[];
  cpd_eligible: boolean;
};
export type BundleMember = BundleDetail["members"][number];

export const bundlesPaths = {
  bundles: "admin/bundles",
  bundle: "admin/bundles/{product_id}",
} as const;

export const bundlesKeys = {
  all: ["learning", "bundles"] as const,
  detail: (productId: string) => [...bundlesKeys.all, "detail", productId] as const,
};

export function createBundle(body: BundleUpsertRequest): Promise<BundleDetail> {
  return apiPost(bundlesPaths.bundles, { body });
}

export function getBundle(product_id: PathParams<GetBundleOp>["product_id"]): Promise<BundleDetail> {
  return apiGet(bundlesPaths.bundle, { path: { product_id } });
}

export function updateBundle(
  product_id: PathParams<UpdateBundleOp>["product_id"],
  body: BundleUpsertRequest,
): Promise<BundleDetail> {
  return apiPut(bundlesPaths.bundle, { path: { product_id }, body });
}

export const bundlesQueries = {
  detail: (productId: string) =>
    queryOptions({ queryKey: bundlesKeys.detail(productId), queryFn: () => getBundle(productId) }),
};
