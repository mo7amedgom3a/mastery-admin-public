import { queryOptions } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api/client";
import type { PreviewKind } from "@/lib/api/contract";
import type { RequestBody, SuccessResponse } from "@/lib/api/operation-types";
import type { components } from "@/types/openapi";
import type { components as legacyCourseComponents } from "@/lib/api/learning/legacy-course-preview";

/*
 * Course Studio (`/admin/catalog/products/{ref}/studio`): a product's page as a document (`meta` + BlockNote
 * `blocks`), saved as a draft with an optimistic lock (`base_revision`, 409 when stale) and published as
 * numbered versions. Publishing a product backed by a legacy course/package also rewrites its legacy page rows
 * (`legacy_sync`). Assets upload straight to storage with a presigned URL, then are recorded with their key.
 */

type GetStudioOp = "get_studio_api_v1_admin_catalog_products__product_ref__studio_get";
type SaveDraftOp = "save_draft_api_v1_admin_catalog_products__product_ref__studio_draft_put";
type PublishOp = "publish_api_v1_admin_catalog_products__product_ref__studio_publish_post";
type VersionsOp = "list_versions_api_v1_admin_catalog_products__product_ref__studio_versions_get";
type VersionOp = "get_version_api_v1_admin_catalog_products__product_ref__studio_versions__version_id__get";
type RestoreOp =
  "restore_version_api_v1_admin_catalog_products__product_ref__studio_versions__version_id__restore_post";
type AssetsOp = "list_assets_api_v1_admin_catalog_products__product_ref__studio_assets_get";
type UploadUrlOp = "asset_upload_url_api_v1_admin_catalog_products__product_ref__studio_assets_upload_url_post";
type CompleteUploadOp = "complete_asset_upload_api_v1_admin_catalog_products__product_ref__studio_assets_post";

/** The page in the studio: draft (`draft_revision` 0 = never saved, seeded from the current page) and published state. */
export type StudioContent = SuccessResponse<GetStudioOp>;
export type StudioDocument = StudioContent["draft"];
export type StudioMeta = NonNullable<StudioDocument["meta"]>;
export type SaveDraftRequest = RequestBody<SaveDraftOp>;
export type PublishRequest = NonNullable<RequestBody<PublishOp>>;
export type StudioPublishResult = SuccessResponse<PublishOp>;
export type StudioVersion = SuccessResponse<VersionsOp>[number];
export type StudioVersionDetail = SuccessResponse<VersionOp>;
/** Storefront data of the product's legacy course (frozen shape of the removed `GET /legacy/courses/{id}`). */
export type StudioPreviewCourseBase = legacyCourseComponents["schemas"]["CourseDetailResponse"];
/**
 * The storefront data the live preview renders under the draft, tagged with its `kind`. `base` is the
 * kind-specific payload (`StudioPreviewCourseBase` for course/diploma, a package/bundle/live-diploma payload
 * otherwise) or `null` when the product has no storefront page of its own.
 */
export type StudioPreviewPayload = { kind: PreviewKind; base: unknown };
export type StudioAssetPage = SuccessResponse<AssetsOp>;
export type StudioAsset = StudioAssetPage["items"][number];
export type StudioUploadIntent = SuccessResponse<UploadUrlOp>;
export type CompleteUploadRequest = RequestBody<CompleteUploadOp>;

export const studioPaths = {
  page: "admin/catalog/products/{product_ref}/studio",
  draft: "admin/catalog/products/{product_ref}/studio/draft",
  publish: "admin/catalog/products/{product_ref}/studio/publish",
  versions: "admin/catalog/products/{product_ref}/studio/versions",
  version: "admin/catalog/products/{product_ref}/studio/versions/{version_id}",
  restore: "admin/catalog/products/{product_ref}/studio/versions/{version_id}/restore",
  previewBase: "admin/catalog/products/{product_ref}/studio/preview-base",
  assets: "admin/catalog/products/{product_ref}/studio/assets",
  uploadUrl: "admin/catalog/products/{product_ref}/studio/assets/upload-url",
  directUpload: "admin/catalog/products/{product_ref}/studio/assets/upload",
  asset: "admin/catalog/products/{product_ref}/studio/assets/{asset_id}",
  downloadUrl: "admin/catalog/products/{product_ref}/studio/assets/{asset_id}/download-url",
} as const;

export const studioKeys = {
  all: ["learning", "studio"] as const,
  readme: (productRef: string) => [...studioKeys.all, "readme", productRef] as const,
  page: (productRef: string) => [...studioKeys.all, "page", productRef] as const,
  versions: (productRef: string) => [...studioKeys.all, "versions", productRef] as const,
  version: (productRef: string, versionId: string) => [...studioKeys.all, "version", productRef, versionId] as const,
  previewBase: (productRef: string) => [...studioKeys.all, "preview-base", productRef] as const,
  assets: (productRef: string) => [...studioKeys.all, "assets", productRef] as const,
};

/** Product README (markdown) — replaces the HTML "about" sections; `source` says where the text came from. */
export type ProductReadme = components["schemas"]["ReadmeResponse"];

/** `GET .../readme` — the saved README, or one generated from the legacy HTML sections until it is first saved. */
export function getProductReadme(product_ref: string): Promise<ProductReadme> {
  return apiGet("admin/catalog/products/{product_ref}/readme", { path: { product_ref } });
}

/** `PUT .../readme` — saves the README; raw HTML and unsafe URLs are stripped server-side. */
export function putProductReadme(product_ref: string, markdown: string): Promise<ProductReadme> {
  return apiPut("admin/catalog/products/{product_ref}/readme", { path: { product_ref }, body: { markdown } });
}

/** `GET .../studio` — the draft (seeded from the current page when never saved) and the published state. */
export function getStudio(product_ref: string): Promise<StudioContent> {
  return apiGet(studioPaths.page, { path: { product_ref } });
}

/** `PUT .../studio/draft` — replaces the draft; 409 when it changed since `base_revision`. */
export function saveStudioDraft(product_ref: string, body: SaveDraftRequest): Promise<StudioContent> {
  return apiPut(studioPaths.draft, { path: { product_ref }, body });
}

/** `POST .../studio/publish` — publishes the saved draft as a new version (and syncs legacy rows). Audited. */
export function publishStudio(product_ref: string, body: PublishRequest = {}): Promise<StudioPublishResult> {
  return apiPost(studioPaths.publish, { path: { product_ref }, body });
}

/** `GET .../studio/versions` — published versions, newest first. */
export function listStudioVersions(product_ref: string): Promise<StudioVersion[]> {
  return apiGet(studioPaths.versions, { path: { product_ref } });
}

export function getStudioVersion(product_ref: string, version_id: string): Promise<StudioVersionDetail> {
  return apiGet(studioPaths.version, { path: { product_ref, version_id } });
}

/** `POST .../studio/versions/{id}/restore` — copies a version into the draft. Audited. */
export function restoreStudioVersion(product_ref: string, version_id: string): Promise<SuccessResponse<RestoreOp>> {
  return apiPost(studioPaths.restore, { path: { product_ref, version_id } });
}

/** `GET .../studio/preview-base` — storefront data the live preview renders under the draft, tagged with its kind. */
export function getStudioPreviewBase(product_ref: string): Promise<StudioPreviewPayload> {
  return apiGet(studioPaths.previewBase, { path: { product_ref } });
}

export function listStudioAssets(product_ref: string, query: { limit?: number; offset?: number } = {}): Promise<StudioAssetPage> {
  return apiGet(studioPaths.assets, { path: { product_ref }, query });
}

export function requestStudioUpload(
  product_ref: string,
  body: { filename?: string | null; content_type?: string | null; size_bytes?: number | null },
): Promise<StudioUploadIntent> {
  return apiPost(studioPaths.uploadUrl, { path: { product_ref }, body });
}

export function completeStudioUpload(product_ref: string, body: CompleteUploadRequest): Promise<StudioAsset> {
  return apiPost(studioPaths.assets, { path: { product_ref }, body });
}

export function deleteStudioAsset(product_ref: string, asset_id: string): Promise<void> {
  return apiDelete(studioPaths.asset, { path: { product_ref, asset_id } });
}

export type StudioAssetDownloadLink = {
  asset_id: string;
  url: string;
  expires_in: number;
};

/** Generates an on-demand presigned download/view URL for an asset (e.g. PDF). */
export function getStudioAssetDownloadUrl(product_ref: string, asset_id: string): Promise<StudioAssetDownloadLink> {
  return apiGet(studioPaths.downloadUrl, { path: { product_ref, asset_id } });
}

/** Directly uploads a file through the backend to S3 (used as fallback when browser preflight/direct PUT fails). */
export async function uploadStudioAssetDirect(product_ref: string, file: File, alt_text?: string): Promise<StudioAsset> {
  const query: Record<string, string> = { filename: file.name };
  if (file.type) query.content_type = file.type;
  if (alt_text) query.alt_text = alt_text;
  return apiPost(studioPaths.directUpload, {
    path: { product_ref },
    query,
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
}


/** Uploads a file to the product's assets: presigned PUT straight to storage, with automatic backend fallback. */
export async function uploadStudioAsset(product_ref: string, file: File, alt_text?: string): Promise<StudioAsset> {
  try {
    const intent = await requestStudioUpload(product_ref, {
      filename: file.name,
      content_type: file.type || null,
      size_bytes: file.size,
    });
    const headers = new Headers(intent.headers || {});
    if (intent.content_type && !headers.has("Content-Type")) {
      headers.set("Content-Type", intent.content_type);
    }
    const response = await fetch(intent.upload_url, {
      method: intent.method || "PUT",
      headers,
      body: file,
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`S3 direct upload failed (${response.status}): ${errorText || response.statusText}`);
    }
    return await completeStudioUpload(product_ref, { key: intent.key, filename: file.name, alt_text: alt_text ?? null });
  } catch (err) {
    // If S3 direct upload fails (e.g. CORS block, network failure, or bucket resolution), fallback to backend proxy upload
    return uploadStudioAssetDirect(product_ref, file, alt_text);
  }
}



export const studioQueries = {
  readme: (productRef: string) =>
    queryOptions({ queryKey: studioKeys.readme(productRef), queryFn: () => getProductReadme(productRef), staleTime: Infinity }),
  page: (productRef: string) =>
    queryOptions({ queryKey: studioKeys.page(productRef), queryFn: () => getStudio(productRef), staleTime: Infinity }),
  versions: (productRef: string) =>
    queryOptions({ queryKey: studioKeys.versions(productRef), queryFn: () => listStudioVersions(productRef) }),
  version: (productRef: string, versionId: string) =>
    queryOptions({ queryKey: studioKeys.version(productRef, versionId), queryFn: () => getStudioVersion(productRef, versionId) }),
  previewBase: (productRef: string) =>
    queryOptions({
      queryKey: studioKeys.previewBase(productRef), queryFn: () => getStudioPreviewBase(productRef), retry: false,
      staleTime: 5 * 60_000,
    }),
  assets: (productRef: string) =>
    queryOptions({ queryKey: studioKeys.assets(productRef), queryFn: () => listStudioAssets(productRef, { limit: 200 }) }),
};
