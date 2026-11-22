import { queryOptions } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPost } from "@/lib/api/client";
import type { PathParams, QueryParams, RequestBody, SuccessResponse } from "@/lib/api/operation-types";

/**
 * Labs AI layer (`/admin/labs/{lab_id}/check`, `/admin/labs/change-requests`, `/admin/labs/ai/*`).
 *
 * AI clients author drafts over MCP and can only *request* publication. A change request stores
 * the quality check that passed and a checksum of the draft; approving publishes exactly that
 * draft (or fails, marking the request stale, if the draft moved). AI access tokens authenticate
 * MCP clients as the admin who created them, never with more than that admin's scopes. Connector UIs
 * (claude.ai, ChatGPT, …) use OAuth instead: the admin approves them on `/oauth/consent`, and each
 * approval is a "connected app" (grant) they can disconnect.
 */

type LabCheckOp = "admin_labs_check";
type EngineCheckOp = "admin_labs_engine_defs_check";
type ChangeListOp = "admin_labs_change_requests_list";
type ChangeGetOp = "admin_labs_change_requests_get";
type ChangeApproveOp = "admin_labs_change_requests_approve";
type ConnectionOp = "admin_labs_ai_connection";
type TokenListOp = "admin_labs_ai_tokens_list";
type TokenCreateOp = "admin_labs_ai_tokens_create";
type TokenRevokeOp = "admin_labs_ai_tokens_revoke";
type OAuthRequestOp = "admin_labs_ai_oauth_request";
type OAuthApproveOp = "admin_labs_ai_oauth_approve";
type OAuthGrantsOp = "admin_labs_ai_oauth_grants";

export type QualityCheck = SuccessResponse<LabCheckOp>;
export type QualityIssue = QualityCheck["errors"][number];
export type ChangeRequestsParams = QueryParams<ChangeListOp>;
export type ChangeRequestsPage = SuccessResponse<ChangeListOp>;
export type ChangeRequest = SuccessResponse<ChangeGetOp>;
export type ChangeRequestStatus = ChangeRequest["status"];
export type ChangeDecision = RequestBody<ChangeApproveOp>;
export type AiConnection = SuccessResponse<ConnectionOp>;
export type AiToken = SuccessResponse<TokenListOp>[number];
export type AiTokenInput = RequestBody<TokenCreateOp>;
export type AiTokenCreated = SuccessResponse<TokenCreateOp>;
export type OAuthRequest = SuccessResponse<OAuthRequestOp>;
export type OAuthDecision = SuccessResponse<OAuthApproveOp>;
export type OAuthGrant = SuccessResponse<OAuthGrantsOp>[number];

type LabId = PathParams<LabCheckOp>["lab_id"];
type EngineId = PathParams<EngineCheckOp>["engine_id"];
type ChangeId = PathParams<ChangeGetOp>["change_request_id"];
type TokenId = PathParams<TokenRevokeOp>["token_id"];

/** Shape of one exploration summary inside `QualityCheck.explore` (computed server side). */
export type ExploreSummary = {
  applicable: boolean;
  reason?: string;
  error?: string;
  paths_scored?: number;
  truncated?: boolean;
  thresholds?: { ready: number; excellent: number };
  overall?: { min: number; max: number; mean: number };
  outcomes?: Record<string, number>;
  dimensions?: Record<string, { min: number; max: number; constant: boolean }>;
  best?: { overall: number; readiness: string; verdict: string; outcome: string | null };
  worst?: { overall: number; readiness: string; verdict: string; outcome: string | null };
};

export const labAiPaths = {
  labCheck: "admin/labs/{lab_id}/check",
  engineCheck: "admin/labs/engine-defs/{engine_id}/check",
  changes: "admin/labs/change-requests",
  change: "admin/labs/change-requests/{change_request_id}",
  approve: "admin/labs/change-requests/{change_request_id}/approve",
  reject: "admin/labs/change-requests/{change_request_id}/reject",
  cancel: "admin/labs/change-requests/{change_request_id}/cancel",
  connection: "admin/labs/ai/connection",
  tokens: "admin/labs/ai/tokens",
  token: "admin/labs/ai/tokens/{token_id}",
  oauthRequest: "admin/labs/ai/oauth/requests/{request_id}",
  oauthApprove: "admin/labs/ai/oauth/requests/{request_id}/approve",
  oauthDeny: "admin/labs/ai/oauth/requests/{request_id}/deny",
  oauthGrants: "admin/labs/ai/oauth/grants",
  oauthGrant: "admin/labs/ai/oauth/grants/{grant_id}",
} as const;

export const labAiKeys = {
  all: ["learning", "labs", "ai"] as const,
  changes: (params?: ChangeRequestsParams) => [...labAiKeys.all, "changes", params ?? {}] as const,
  change: (id: string) => [...labAiKeys.all, "change", id] as const,
  connection: () => [...labAiKeys.all, "connection"] as const,
  tokens: () => [...labAiKeys.all, "tokens"] as const,
  oauthRequest: (id: string) => [...labAiKeys.all, "oauth-request", id] as const,
  grants: () => [...labAiKeys.all, "grants"] as const,
};

export const labAiQueries = {
  changes: (params: ChangeRequestsParams = {}) =>
    queryOptions({
      queryKey: labAiKeys.changes(params),
      queryFn: () => apiGet<ChangeRequestsPage>(labAiPaths.changes, { query: params }),
    }),
  change: (id: ChangeId) =>
    queryOptions({
      queryKey: labAiKeys.change(id),
      queryFn: () => apiGet<ChangeRequest>(labAiPaths.change, { path: { change_request_id: id } }),
    }),
  connection: () =>
    queryOptions({
      queryKey: labAiKeys.connection(),
      queryFn: () => apiGet<AiConnection>(labAiPaths.connection),
      staleTime: 5 * 60_000,
    }),
  tokens: () =>
    queryOptions({
      queryKey: labAiKeys.tokens(),
      queryFn: () => apiGet<AiToken[]>(labAiPaths.tokens),
    }),
  oauthRequest: (request_id: string) =>
    queryOptions({
      queryKey: labAiKeys.oauthRequest(request_id),
      queryFn: () => apiGet<OAuthRequest>(labAiPaths.oauthRequest, { path: { request_id } }),
      retry: false,
      staleTime: Infinity,
    }),
  grants: () =>
    queryOptions({
      queryKey: labAiKeys.grants(),
      queryFn: () => apiGet<OAuthGrant[]>(labAiPaths.oauthGrants),
    }),
};

// ------------------------------------------------------------------ checks

export function checkLab(lab_id: LabId, max_paths = 300): Promise<QualityCheck> {
  return apiPost<QualityCheck>(labAiPaths.labCheck, { path: { lab_id }, query: { max_paths } });
}

export function checkEngineDef(engine_id: EngineId, max_paths = 300): Promise<QualityCheck> {
  return apiPost<QualityCheck>(labAiPaths.engineCheck, { path: { engine_id }, query: { max_paths } });
}

// ---------------------------------------------------------- change requests

export function approveChangeRequest(id: ChangeId, note?: string | null): Promise<ChangeRequest> {
  return apiPost<ChangeRequest>(labAiPaths.approve, { path: { change_request_id: id }, body: { note: note || null } });
}

export function rejectChangeRequest(id: ChangeId, note: string): Promise<ChangeRequest> {
  return apiPost<ChangeRequest>(labAiPaths.reject, { path: { change_request_id: id }, body: { note } });
}

export function cancelChangeRequest(id: ChangeId): Promise<ChangeRequest> {
  return apiPost<ChangeRequest>(labAiPaths.cancel, { path: { change_request_id: id } });
}

// ----------------------------------------------------------------- tokens

export function createAiToken(body: AiTokenInput): Promise<AiTokenCreated> {
  return apiPost<AiTokenCreated>(labAiPaths.tokens, { body });
}

export function revokeAiToken(token_id: TokenId): Promise<AiToken> {
  return apiDelete<AiToken>(labAiPaths.token, { path: { token_id } });
}

// ------------------------------------------------------------------ OAuth (connected apps)

export function approveOAuthRequest(request_id: string, scopes: string[]): Promise<OAuthDecision> {
  return apiPost<OAuthDecision>(labAiPaths.oauthApprove, { path: { request_id }, body: { scopes } });
}

export function denyOAuthRequest(request_id: string): Promise<OAuthDecision> {
  return apiPost<OAuthDecision>(labAiPaths.oauthDeny, { path: { request_id } });
}

export function revokeOAuthGrant(grant_id: string): Promise<OAuthGrant> {
  return apiDelete<OAuthGrant>(labAiPaths.oauthGrant, { path: { grant_id } });
}
