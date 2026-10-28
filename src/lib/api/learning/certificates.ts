import { queryOptions } from "@tanstack/react-query";

import { apiGet, apiPatch, apiPost, apiPut, apiRaw } from "@/lib/api/client";
import type { QueryParams, RequestBody, SuccessResponse } from "@/lib/api/operation-types";

/*
 * B2C certificates (`/admin/catalog/products/{ref}/certificate-*`, `/admin/certificates`). Settings are per
 * course / diploma / live diploma; the preview endpoints render an unsaved draft with the same template the
 * issued PDF is printed from. Legacy certificate templates stay in `catalog.ts` (`certificateTemplates`).
 */

type GetSettingsOp = "get_certificate_settings_api_v1_admin_catalog_products__product_ref__certificate_settings_get";
type PutSettingsOp = "put_certificate_settings_api_v1_admin_catalog_products__product_ref__certificate_settings_put";
type PreviewOp = "preview_certificate_html_api_v1_admin_catalog_products__product_ref__certificate_preview_post";
type RecipientsOp =
  "list_certificate_recipients_api_v1_admin_catalog_products__product_ref__certificate_recipients_get";
type IssueOp = "issue_certificates_api_v1_admin_certificates_issue_post";
type ListOp = "list_certificates_api_v1_admin_certificates_get";
type GetOp = "get_certificate_api_v1_admin_certificates__certificate_id__get";
type RevokeOp = "revoke_certificate_api_v1_admin_certificates__certificate_id__revoke_post";
type ReissueOp = "reissue_certificate_api_v1_admin_certificates__certificate_id__reissue_post";
type RenameOp = "set_certificate_recipient_name_api_v1_admin_certificates__certificate_id__recipient_name_patch";

export type CertificateSettings = SuccessResponse<GetSettingsOp>;
export type CertificateSettingsInput = RequestBody<PutSettingsOp>;
export type CertificateSignatory = CertificateSettingsInput["signatories"][number];
export type CertificatePreviewInput = RequestBody<PreviewOp>;
export type CertificateRecipientsParams = QueryParams<RecipientsOp>;
export type CertificateRecipientPage = SuccessResponse<RecipientsOp>;
export type CertificateRecipient = CertificateRecipientPage["items"][number];
export type IssueCertificatesInput = RequestBody<IssueOp>;
export type IssueCertificatesResult = SuccessResponse<IssueOp>;
export type CertificatesParams = QueryParams<ListOp>;
export type CertificatePage = SuccessResponse<ListOp>;
export type IssuedCertificate = SuccessResponse<GetOp>;
export type CertificateStatus = NonNullable<CertificatesParams["status"]>;

export const certificatePaths = {
  settings: "admin/catalog/products/{product_ref}/certificate-settings",
  preview: "admin/catalog/products/{product_ref}/certificate-preview",
  previewPdf: "admin/catalog/products/{product_ref}/certificate-preview.pdf",
  recipients: "admin/catalog/products/{product_ref}/certificate-recipients",
  issue: "admin/certificates/issue",
  list: "admin/certificates",
  detail: "admin/certificates/{certificate_id}",
  pdf: "admin/certificates/{certificate_id}/pdf",
  revoke: "admin/certificates/{certificate_id}/revoke",
  reissue: "admin/certificates/{certificate_id}/reissue",
  rename: "admin/certificates/{certificate_id}/recipient-name",
} as const;

export const certificateKeys = {
  all: ["learning", "certificates"] as const,
  settings: (productRef: string) => [...certificateKeys.all, "settings", productRef] as const,
  recipients: (productRef: string, params?: CertificateRecipientsParams) =>
    [...certificateKeys.all, "recipients", productRef, params ?? {}] as const,
  list: (params?: CertificatesParams) => [...certificateKeys.all, "list", params ?? {}] as const,
  detail: (certificateId: string) => [...certificateKeys.all, "detail", certificateId] as const,
};

export function getCertificateSettings(product_ref: string): Promise<CertificateSettings> {
  return apiGet(certificatePaths.settings, { path: { product_ref } });
}

/** `PUT .../certificate-settings`. Audited. */
export function saveCertificateSettings(
  product_ref: string,
  body: CertificateSettingsInput,
): Promise<CertificateSettings> {
  return apiPut(certificatePaths.settings, { path: { product_ref }, body });
}

/** Self-contained certificate HTML (fonts and images inlined) for an `srcdoc` iframe. */
export async function renderCertificatePreview(
  product_ref: string,
  body: CertificatePreviewInput,
  signal?: AbortSignal,
): Promise<string> {
  const response = await apiRaw("POST", certificatePaths.preview, { path: { product_ref }, body, signal });
  return response.text();
}

export async function renderCertificatePreviewPdf(product_ref: string, body: CertificatePreviewInput): Promise<Blob> {
  const response = await apiRaw("POST", certificatePaths.previewPdf, { path: { product_ref }, body });
  return response.blob();
}

export function listCertificateRecipients(
  product_ref: string,
  params: CertificateRecipientsParams = {},
): Promise<CertificateRecipientPage> {
  return apiGet(certificatePaths.recipients, { path: { product_ref }, query: params });
}

/** `POST /admin/certificates/issue` — by customer ids, or every eligible customer (`all_eligible`). Audited. */
export function issueCertificates(body: IssueCertificatesInput): Promise<IssueCertificatesResult> {
  return apiPost(certificatePaths.issue, { body });
}

export function listCertificates(params: CertificatesParams = {}): Promise<CertificatePage> {
  return apiGet(certificatePaths.list, { query: params });
}

export function getCertificate(certificate_id: string): Promise<IssuedCertificate> {
  return apiGet(certificatePaths.detail, { path: { certificate_id } });
}

export async function downloadCertificatePdf(certificate_id: string): Promise<Blob> {
  const response = await apiRaw("GET", certificatePaths.pdf, { path: { certificate_id } });
  return response.blob();
}

export function revokeCertificate(certificate_id: string, reason?: string): Promise<SuccessResponse<RevokeOp>> {
  return apiPost(certificatePaths.revoke, { path: { certificate_id }, body: { reason: reason?.trim() || null } });
}

/** Re-render with the product's current settings; the public code is kept. */
export function reissueCertificate(certificate_id: string): Promise<SuccessResponse<ReissueOp>> {
  return apiPost(certificatePaths.reissue, { path: { certificate_id } });
}

export function renameCertificateRecipient(certificate_id: string, name: string): Promise<SuccessResponse<RenameOp>> {
  return apiPatch(certificatePaths.rename, { path: { certificate_id }, body: { name } });
}

export const certificateQueries = {
  settings: (productRef: string) =>
    queryOptions({
      queryKey: certificateKeys.settings(productRef),
      queryFn: () => getCertificateSettings(productRef),
    }),
  recipients: (productRef: string, params: CertificateRecipientsParams = {}) =>
    queryOptions({
      queryKey: certificateKeys.recipients(productRef, params),
      queryFn: () => listCertificateRecipients(productRef, params),
    }),
  list: (params: CertificatesParams = {}) =>
    queryOptions({ queryKey: certificateKeys.list(params), queryFn: () => listCertificates(params) }),
  detail: (certificateId: string) =>
    queryOptions({ queryKey: certificateKeys.detail(certificateId), queryFn: () => getCertificate(certificateId) }),
};

/** Opens a PDF blob in a new tab (falls back to a download when pop-ups are blocked). */
export function openPdfBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank", "noopener");
  if (!opened) {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
