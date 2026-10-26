import { queryOptions } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/lib/api/client";
import type { QueryParams, RequestBody, SuccessResponse } from "@/lib/api/operation-types";

/*
 * Expert (trainer) profiles on B2C (`/admin/catalog/instructors`): the profile the storefront shows on
 * `/experts/{key}` and the landing page, its page README, avatar/cover, and the products the expert is
 * assigned to. `key` is the public expert key: the legacy trainer id, `c{id}`, or the instructor uuid.
 */

type ListOp = "list_instructors_api_v1_admin_catalog_instructors_get";
type GetOp = "get_instructor_api_v1_admin_catalog_instructors__key__get";
type UpdateOp = "update_instructor_api_v1_admin_catalog_instructors__key__patch";
type CreateOp = "create_instructor_api_v1_admin_catalog_instructors_post";
type ImageOp = "upload_instructor_image_api_v1_admin_catalog_instructors__key__images_post";
type ReadmeOp = "get_instructor_readme_api_v1_admin_catalog_instructors__key__readme_get";
type PutReadmeOp = "put_instructor_readme_api_v1_admin_catalog_instructors__key__readme_put";
type ExpertiseOp = "put_instructor_expertise_api_v1_admin_catalog_instructors__key__expertise_put";
type ProductsOp = "list_instructor_products_api_v1_admin_catalog_instructors__key__products_get";
type OptionsOp = "instructor_product_options_api_v1_admin_catalog_instructors__key__product_options_get";

export type ExpertProfileListParams = QueryParams<ListOp>;
export type ExpertProfilePage = SuccessResponse<ListOp>;
export type ExpertProfileRow = ExpertProfilePage["items"][number];
export type ExpertProfileDetail = SuccessResponse<GetOp>;
export type ExpertProfileUpdate = RequestBody<UpdateOp>;
export type ExpertProfileCreate = RequestBody<CreateOp>;
export type ExpertImageResult = SuccessResponse<ImageOp>;
export type ExpertReadme = SuccessResponse<ReadmeOp>;
export type ExpertExpertiseUpdate = RequestBody<ExpertiseOp>;
export type ExpertProduct = SuccessResponse<ProductsOp>[number];
export type ExpertProductOptionsParams = Omit<QueryParams<OptionsOp>, "key">;

export const expertProfilesPaths = {
  list: "admin/catalog/instructors",
  detail: "admin/catalog/instructors/{key}",
  images: "admin/catalog/instructors/{key}/images",
  readme: "admin/catalog/instructors/{key}/readme",
  expertise: "admin/catalog/instructors/{key}/expertise",
  products: "admin/catalog/instructors/{key}/products",
  product: "admin/catalog/instructors/{key}/products/{product_id}",
  options: "admin/catalog/instructors/{key}/product-options",
} as const;

export const expertProfilesKeys = {
  all: ["learning", "expert-profiles"] as const,
  list: (params?: ExpertProfileListParams) => [...expertProfilesKeys.all, "list", params ?? {}] as const,
  detail: (key: string) => [...expertProfilesKeys.all, "detail", key] as const,
  readme: (key: string) => [...expertProfilesKeys.all, "readme", key] as const,
  products: (key: string) => [...expertProfilesKeys.all, "products", key] as const,
  options: (key: string, params: ExpertProductOptionsParams) => [...expertProfilesKeys.all, "options", key, params] as const,
};

/** `GET /admin/catalog/instructors` — experts with their roles and counts. */
export function listExpertProfiles(params: ExpertProfileListParams = {}): Promise<ExpertProfilePage> {
  return apiGet(expertProfilesPaths.list, { query: params });
}

export function getExpertProfile(key: string): Promise<ExpertProfileDetail> {
  return apiGet(expertProfilesPaths.detail, { path: { key } });
}

/** Adds an expert profile by hand (seed fields only; the rest is edited on the detail page). */
export function createExpertProfile(body: ExpertProfileCreate): Promise<ExpertProfileDetail> {
  return apiPost(expertProfilesPaths.list, { body });
}

/** Only the fields sent change; `null` clears one. */
export function updateExpertProfile(key: string, body: ExpertProfileUpdate): Promise<ExpertProfileDetail> {
  return apiPatch(expertProfilesPaths.detail, { path: { key }, body });
}

/** Uploads the avatar or cover (JPEG, PNG or WebP, ≤ 5 MB) and sets it on the profile. */
export function uploadExpertImage(key: string, file: File, kind: "avatar" | "cover"): Promise<ExpertImageResult> {
  return apiPost(expertProfilesPaths.images, {
    path: { key },
    query: { kind, filename: file.name },
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream" },
  });
}

export function getExpertReadme(key: string): Promise<ExpertReadme> {
  return apiGet(expertProfilesPaths.readme, { path: { key } });
}

export function putExpertReadme(key: string, markdown: string): Promise<SuccessResponse<PutReadmeOp>> {
  return apiPut(expertProfilesPaths.readme, { path: { key }, body: { markdown } });
}

/** Replaces the fields and skills the expert page shows (in order); both empty → their items' categories and skills. */
export function putExpertExpertise(key: string, body: ExpertExpertiseUpdate): Promise<ExpertProfileDetail> {
  return apiPut(expertProfilesPaths.expertise, { path: { key }, body });
}

export function listExpertProducts(key: string): Promise<ExpertProduct[]> {
  return apiGet(expertProfilesPaths.products, { path: { key } });
}

/** Products that can still be assigned to the expert (courses, diplomas, live diplomas, packages, bundles). */
export function listExpertProductOptions(key: string, params: ExpertProductOptionsParams): Promise<ExpertProduct[]> {
  return apiGet(expertProfilesPaths.options, { path: { key }, query: params });
}

export function assignExpertProduct(key: string, product_id: string): Promise<ExpertProduct[]> {
  return apiPost(expertProfilesPaths.products, { path: { key }, body: { product_id } });
}

export function unassignExpertProduct(key: string, product_id: string): Promise<ExpertProduct[]> {
  return apiDelete(expertProfilesPaths.product, { path: { key, product_id } });
}

export const expertProfilesQueries = {
  detail: (key: string) => queryOptions({
    queryKey: expertProfilesKeys.detail(key),
    queryFn: () => getExpertProfile(key),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  }),
  readme: (key: string) => queryOptions({ queryKey: expertProfilesKeys.readme(key), queryFn: () => getExpertReadme(key) }),
  products: (key: string) =>
    queryOptions({
      queryKey: expertProfilesKeys.products(key),
      queryFn: () => listExpertProducts(key),
      staleTime: 0,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    }),
};

type DuplicatesOp = "list_duplicate_instructors_api_v1_admin_catalog_instructors_duplicates_get";
type PageDocumentOp = "get_instructor_page_document_api_v1_admin_catalog_instructors__key__page_document_get";
type PageAssetOp = "upload_instructor_page_asset_api_v1_admin_catalog_instructors__key__assets_post";
type ConsultantOp = "set_instructor_consultant_api_v1_admin_catalog_instructors__key__consultant_post";

export type ExpertDuplicateGroup = SuccessResponse<DuplicatesOp>[number];
export type ExpertPageDocument = SuccessResponse<PageDocumentOp>;
export type ExpertConsultantRequest = RequestBody<ConsultantOp>;

export const expertStudioKeys = {
  duplicates: () => [...expertProfilesKeys.all, "duplicates"] as const,
  pageDocument: (key: string) => [...expertProfilesKeys.all, "page-document", key] as const,
};

/** Profiles that share a name, each with the suggested survivor first. */
export function listExpertDuplicates(): Promise<ExpertDuplicateGroup[]> {
  return apiGet("admin/catalog/instructors/duplicates");
}

/** Merges `sourceKey` into `key`: its products, consultant and page move; it is hidden and its key resolves to `key`. */
export function mergeExpert(key: string, sourceKey: string): Promise<ExpertProfileDetail> {
  return apiPost("admin/catalog/instructors/{key}/merge", { path: { key }, body: { source_key: sourceKey } });
}

/** Turns the expert's consultations on (creating their consultant profile) or off. */
export function setExpertConsultations(key: string, body: ExpertConsultantRequest): Promise<ExpertProfileDetail> {
  return apiPost("admin/catalog/instructors/{key}/consultant", { path: { key }, body });
}

export function getExpertPageDocument(key: string): Promise<ExpertPageDocument> {
  return apiGet("admin/catalog/instructors/{key}/page-document", { path: { key } });
}

/** Saves the Studio page draft (validated like the course Studio). */
export function saveExpertPageDraft(key: string, blocks: unknown[]): Promise<ExpertPageDocument> {
  return apiPut("admin/catalog/instructors/{key}/page-document", { path: { key }, body: { blocks } });
}

export function publishExpertPage(key: string): Promise<ExpertPageDocument> {
  return apiPost("admin/catalog/instructors/{key}/page-document/publish", { path: { key } });
}

/** The storefront goes back to the README; the draft is kept. */
export function unpublishExpertPage(key: string): Promise<ExpertPageDocument> {
  return apiDelete("admin/catalog/instructors/{key}/page-document", { path: { key } });
}

/** An image for the Studio page (JPEG, PNG or WebP, ≤ 5 MB); returns its public URL. */
export function uploadExpertPageAsset(key: string, file: File): Promise<SuccessResponse<PageAssetOp>> {
  return apiPost("admin/catalog/instructors/{key}/assets", {
    path: { key },
    query: { filename: file.name },
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream" },
  });
}

type CurrentPageOp = "get_instructor_current_page_api_v1_admin_catalog_instructors__key__current_page_get";
export type ExpertCurrentPage = SuccessResponse<CurrentPageOp>;

/** The expert as the storefront shows them now (hidden experts included): the Studio pre-fills a new page from it. */
export function getExpertCurrentPage(key: string): Promise<ExpertCurrentPage> {
  return apiGet("admin/catalog/instructors/{key}/current-page", { path: { key } });
}
