import { queryOptions } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/lib/api/client";
import type { PathParams, QueryParams, RequestBody, SuccessResponse } from "@/lib/api/operation-types";

/**
 * Practice labs (`/admin/labs`): authoring, scenarios, publishing, release, attempts and analytics.
 *
 * Engines are code; each lab owns N scenario documents whose shape is the engine's JSON Schema
 * (`GET /admin/labs/engines`). Every write is audited by the API.
 */

type EnginesOp = "admin_labs_engines";
type OverviewOp = "admin_labs_overview";
type ListOp = "admin_labs_list";
type CreateOp = "admin_labs_create";
type GetOp = "admin_labs_get";
type UpdateOp = "admin_labs_update";
type SaveDraftOp = "admin_labs_save_draft";
type ValidateOp = "admin_labs_validate";
type StatusOp = "admin_labs_set_status";
type DuplicateOp = "admin_labs_duplicate";
type ConvertToBlocksOp = "admin_labs_convert_to_blocks";
type ReleaseOp = "admin_labs_release";
type VersionsOp = "admin_labs_versions";
type VersionOp = "admin_labs_version";
type CreateScenarioOp = "admin_labs_create_scenario";
type UpdateScenarioOp = "admin_labs_update_scenario";
type DuplicateScenarioOp = "admin_labs_duplicate_scenario";
type ValidateScenarioOp = "admin_labs_validate_scenario";
type PreviewOp = "admin_labs_preview";
type AnalyticsOp = "admin_labs_analytics";
type AttemptsOp = "admin_labs_attempts";
type AttemptOp = "admin_labs_attempt";
type AssignmentsOp = "admin_labs_assignments";
type CreateAssignmentOp = "admin_labs_create_assignment";
type AssetsOp = "admin_labs_assets";
type AssetUploadUrlOp = "admin_labs_asset_upload_url";
type AssetCompleteOp = "admin_labs_asset_complete";
type ImportOp = "admin_labs_import";
type BlockTypesOp = "admin_labs_block_types";
type DocumentOp = "admin_labs_document";
type SaveDocumentOp = "admin_labs_save_document";
type ValidateDocumentOp = "admin_labs_validate_document";
type AddPageOp = "admin_labs_add_page";
type AddBlockOp = "admin_labs_add_block";
type MoveBlockOp = "admin_labs_move_block";
type HistoryOp = "admin_labs_scenario_history";
type SnapshotOp = "admin_labs_scenario_snapshot";
type RestoreSnapshotOp = "admin_labs_restore_snapshot";
type GraphOp = "admin_labs_graph";

export type LabsParams = QueryParams<ListOp>;
export type LabsPage = SuccessResponse<ListOp>;
export type LabsOverview = SuccessResponse<OverviewOp>;
export type EngineCatalog = SuccessResponse<EnginesOp>;
export type LabEngine = EngineCatalog["items"][number];
export type LabListItem = LabsPage["items"][number];
export type LabDetail = SuccessResponse<GetOp>;
export type LabCardFields = LabListItem;
export type LabScenario = LabDetail["scenarios"][number];
export type LabIssue = NonNullable<LabDetail["issues"]>[number];
export type LabValidation = SuccessResponse<ValidateOp>;
export type LabVersion = SuccessResponse<VersionOp>;
export type LabVersions = SuccessResponse<VersionsOp>["items"];
export type LabPreview = SuccessResponse<PreviewOp>;
export type LabsAnalytics = SuccessResponse<AnalyticsOp>;
export type LabAttempt = SuccessResponse<AttemptOp>;
export type LabAttemptsPage = SuccessResponse<AttemptsOp>;
export type LabsListAttempt = LabAttemptsPage["items"][number];
export type LabAssignment = SuccessResponse<AssignmentsOp>[number];
export type LabAsset = SuccessResponse<AssetsOp>[number];
export type LabDefinition = LabDetail["definition"];
export type LabGraph = SuccessResponse<GraphOp>;
export type LabGraphInput = RequestBody<GraphOp>;
export type GraphNode = NonNullable<LabGraph["nodes"]>[number];
export type GraphEdge = NonNullable<LabGraph["edges"]>[number];
export type GraphGroup = NonNullable<LabGraph["groups"]>[number];
export type GraphLink = NonNullable<GraphNode["link"]>;
export type BlockCatalog = SuccessResponse<BlockTypesOp>;
export type BlockTypeDef = BlockCatalog["items"][number];
export type BlockDocument = SuccessResponse<DocumentOp>;
export type BlockDocumentInput = RequestBody<SaveDocumentOp>;
export type BlockPageInput = RequestBody<AddPageOp>;
export type BlockInput = RequestBody<AddBlockOp>;
export type BlockMoveInput = RequestBody<MoveBlockOp>;
export type BlockNode = { id: string; type: string; props: Record<string, unknown>; children?: BlockNode[]; visible_when?: unknown[]; admin_only?: boolean; version?: number };
export type BlockPage = { id: string; title?: { ar: string; en?: string | null } | null; blocks: BlockNode[]; next_page?: string | null; show_in_trail?: boolean };
export type BlockDocumentContent = { schema_version?: number; title?: { ar: string; en?: string | null } | null; intro?: string | null; pages: BlockPage[]; fields?: unknown[]; personas?: unknown[] };
export type ScenarioHistory = SuccessResponse<HistoryOp>;
export type ScenarioSnapshot = SuccessResponse<SnapshotOp>;
export type ScenarioSnapshotSummary = ScenarioHistory["items"][number];
export type LabStatus = LabListItem["status"];
export type LabRelease = LabListItem["release"] & Record<string, unknown>;

export type LabCreateInput = RequestBody<CreateOp>;
export type LabCardInput = RequestBody<UpdateOp>;
export type LabDraftInput = RequestBody<SaveDraftOp>;
export type LabReleaseInput = RequestBody<ReleaseOp>;
export type ConvertToBlocksInput = RequestBody<ConvertToBlocksOp>;
export type ScenarioInput = RequestBody<CreateScenarioOp>;
export type ScenarioUpdate = RequestBody<UpdateScenarioOp>;
export type ScenarioDuplicateInput = RequestBody<DuplicateScenarioOp>;
export type AssignmentInput = RequestBody<CreateAssignmentOp>;
export type AssetUploadInput = RequestBody<AssetUploadUrlOp>;
export type AssetCompleteInput = RequestBody<AssetCompleteOp>;
export type LabImportInput = RequestBody<ImportOp>;

export const labsPaths = {
  engines: "admin/labs/engines",
  overview: "admin/labs/overview",
  list: "admin/labs",
  lab: "admin/labs/{lab_id}",
  draft: "admin/labs/{lab_id}/draft",
  validate: "admin/labs/{lab_id}/validate",
  status: "admin/labs/{lab_id}/status",
  publish: "admin/labs/{lab_id}/publish",
  unpublish: "admin/labs/{lab_id}/unpublish",
  archive: "admin/labs/{lab_id}/archive",
  duplicate: "admin/labs/{lab_id}/duplicate",
  release: "admin/labs/{lab_id}/release",
  versions: "admin/labs/{lab_id}/versions",
  version: "admin/labs/{lab_id}/versions/{version_no}",
  restore: "admin/labs/{lab_id}/versions/{version_no}/restore",
  scenarios: "admin/labs/{lab_id}/scenarios",
  scenario: "admin/labs/{lab_id}/scenarios/{scenario_id}",
  scenarioDuplicate: "admin/labs/{lab_id}/scenarios/{scenario_id}/duplicate",
  scenariosOrder: "admin/labs/{lab_id}/scenarios-order",
  scenarioValidate: "admin/labs/{lab_id}/scenarios/validate",
  preview: "admin/labs/{lab_id}/preview",
  graph: "admin/labs/{lab_id}/graph",
  analytics: "admin/labs/{lab_id}/analytics",
  attempts: "admin/labs/{lab_id}/attempts",
  attempt: "admin/labs/attempts/{attempt_id}",
  flagAttempt: "admin/labs/attempts/{attempt_id}/flag",
  voidAttempt: "admin/labs/attempts/{attempt_id}/reset",
  overrideAttempt: "admin/labs/attempts/{attempt_id}/override-score",
  assignments: "admin/labs/{lab_id}/assignments",
  assignment: "admin/labs/{lab_id}/assignments/{assignment_id}",
  assets: "admin/labs/{lab_id}/assets",
  assetUploadUrl: "admin/labs/{lab_id}/assets/upload-url",
  asset: "admin/labs/{lab_id}/assets/{asset_id}",
  export: "admin/labs/{lab_id}/export",
  blockTypes: "admin/labs/block-types",
  document: "admin/labs/{lab_id}/document",
  documentValidate: "admin/labs/{lab_id}/document/validate",
  documentPages: "admin/labs/{lab_id}/document/pages",
  documentPage: "admin/labs/{lab_id}/document/pages/{page_id}",
  documentBlocks: "admin/labs/{lab_id}/document/pages/{page_id}/blocks",
  documentBlock: "admin/labs/{lab_id}/document/blocks/{block_id}",
  documentBlockDuplicate: "admin/labs/{lab_id}/document/blocks/{block_id}/duplicate",
  documentBlockMove: "admin/labs/{lab_id}/document/blocks/{block_id}/move",
  import: "admin/labs/import",
  history: "admin/labs/{lab_id}/scenarios/{scenario_id}/history",
  snapshot: "admin/labs/{lab_id}/scenarios/{scenario_id}/history/{snapshot_id}",
  restoreSnapshot: "admin/labs/{lab_id}/scenarios/{scenario_id}/history/{snapshot_id}/restore",
} as const;

export const labsKeys = {
  all: ["learning", "labs"] as const,
  engines: () => [...labsKeys.all, "engines"] as const,
  overview: () => [...labsKeys.all, "overview"] as const,
  list: (params?: LabsParams) => [...labsKeys.all, "list", params ?? {}] as const,
  detail: (labId: string) => [...labsKeys.all, "detail", labId] as const,
  versions: (labId: string) => [...labsKeys.all, "versions", labId] as const,
  version: (labId: string, versionNo: number) => [...labsKeys.all, "version", labId, versionNo] as const,
  analytics: (labId: string) => [...labsKeys.all, "analytics", labId] as const,
  attempts: (labId: string, params?: Record<string, unknown>) =>
    [...labsKeys.all, "attempts", labId, params ?? {}] as const,
  attempt: (attemptId: string) => [...labsKeys.all, "attempt", attemptId] as const,
  assignments: (labId: string) => [...labsKeys.all, "assignments", labId] as const,
  assets: (labId: string) => [...labsKeys.all, "assets", labId] as const,
  blockTypes: () => [...labsKeys.all, "block-types"] as const,
  document: (labId: string, scenarioKey?: string | null) =>
    [...labsKeys.all, "document", labId, scenarioKey ?? ""] as const,
  history: (labId: string, scenarioId: string) => [...labsKeys.all, "history", labId, scenarioId] as const,
  snapshot: (labId: string, scenarioId: string, snapshotId: string) =>
    [...labsKeys.all, "snapshot", labId, scenarioId, snapshotId] as const,
};

type LabId = PathParams<"admin_labs_get">["lab_id"];
type ScenarioId = PathParams<"admin_labs_update_scenario">["scenario_id"];
type AttemptId = PathParams<"admin_labs_attempt">["attempt_id"];
type AssignmentId = PathParams<"admin_labs_delete_assignment">["assignment_id"];
type AssetId = PathParams<"admin_labs_asset_delete">["asset_id"];

// ------------------------------------------------------------------ reads

export const labsQueries = {
  engines: () =>
    queryOptions({
      queryKey: labsKeys.engines(),
      queryFn: () => apiGet<EngineCatalog>(labsPaths.engines),
      staleTime: 5 * 60_000,
    }),
  overview: () =>
    queryOptions({
      queryKey: labsKeys.overview(),
      queryFn: () => apiGet<LabsOverview>(labsPaths.overview),
    }),
  list: (params: LabsParams = {}) =>
    queryOptions({
      queryKey: labsKeys.list(params),
      queryFn: () => apiGet<LabsPage>(labsPaths.list, { query: params }),
    }),
  detail: (labId: LabId) =>
    queryOptions({
      queryKey: labsKeys.detail(labId),
      queryFn: () => apiGet<LabDetail>(labsPaths.lab, { path: { lab_id: labId } }),
    }),
  versions: (labId: LabId) =>
    queryOptions({
      queryKey: labsKeys.versions(labId),
      queryFn: () => apiGet<{ items: LabVersions }>(labsPaths.versions, { path: { lab_id: labId } }),
    }),
  version: (labId: LabId, versionNo: number) =>
    queryOptions({
      queryKey: labsKeys.version(labId, versionNo),
      queryFn: () =>
        apiGet<LabVersion>(labsPaths.version, { path: { lab_id: labId, version_no: versionNo } }),
    }),
  analytics: (labId: LabId) =>
    queryOptions({
      queryKey: labsKeys.analytics(labId),
      queryFn: () => apiGet<LabsAnalytics>(labsPaths.analytics, { path: { lab_id: labId } }),
    }),
  attempts: (labId: LabId, params: QueryParams<AttemptsOp> = {}) =>
    queryOptions({
      queryKey: labsKeys.attempts(labId, params),
      queryFn: () => apiGet<LabAttemptsPage>(labsPaths.attempts, { path: { lab_id: labId }, query: params }),
    }),
  attempt: (attemptId: AttemptId) =>
    queryOptions({
      queryKey: labsKeys.attempt(attemptId),
      queryFn: () => apiGet<LabAttempt>(labsPaths.attempt, { path: { attempt_id: attemptId } }),
    }),
  assignments: (labId: LabId) =>
    queryOptions({
      queryKey: labsKeys.assignments(labId),
      queryFn: () => apiGet<LabAssignment[]>(labsPaths.assignments, { path: { lab_id: labId } }),
    }),
  assets: (labId: LabId) =>
    queryOptions({
      queryKey: labsKeys.assets(labId),
      queryFn: () => apiGet<LabAsset[]>(labsPaths.assets, { path: { lab_id: labId } }),
    }),
  blockTypes: () =>
    queryOptions({
      queryKey: labsKeys.blockTypes(),
      queryFn: () => apiGet<BlockCatalog>(labsPaths.blockTypes),
      staleTime: 10 * 60_000,
    }),
  document: (labId: LabId, scenarioKey?: string | null) =>
    queryOptions({
      queryKey: labsKeys.document(labId, scenarioKey),
      queryFn: () =>
        apiGet<BlockDocument>(labsPaths.document, {
          path: { lab_id: labId },
          query: { scenario: scenarioKey ?? undefined },
        }),
    }),
  history: (labId: LabId, scenarioId: ScenarioId) =>
    queryOptions({
      queryKey: labsKeys.history(labId, scenarioId),
      queryFn: () =>
        apiGet<ScenarioHistory>(labsPaths.history, {
          path: { lab_id: labId, scenario_id: scenarioId },
          query: { limit: 100 },
        }),
      staleTime: 5_000,
    }),
  snapshot: (labId: LabId, scenarioId: ScenarioId, snapshotId: string) =>
    queryOptions({
      queryKey: labsKeys.snapshot(labId, scenarioId, snapshotId),
      queryFn: () =>
        apiGet<ScenarioSnapshot>(labsPaths.snapshot, {
          path: { lab_id: labId, scenario_id: scenarioId, snapshot_id: snapshotId },
        }),
      staleTime: Infinity,
    }),
};

export function listLabs(params: LabsParams = {}): Promise<LabsPage> {
  return apiGet<LabsPage>(labsPaths.list, { query: params });
}

export function getLab(lab_id: LabId): Promise<LabDetail> {
  return apiGet<LabDetail>(labsPaths.lab, { path: { lab_id } });
}

export function listLabVersions(lab_id: LabId): Promise<LabVersions> {
  return apiGet<{ items: LabVersions }>(labsPaths.versions, { path: { lab_id } }).then((page) => page.items);
}

export function getLabAttempts(
  lab_id: LabId,
  params: QueryParams<AttemptsOp> = {},
): Promise<LabAttemptsPage> {
  return apiGet<LabAttemptsPage>(labsPaths.attempts, { path: { lab_id }, query: params });
}

export function listLabAssignments(lab_id: LabId): Promise<LabAssignment[]> {
  return apiGet<LabAssignment[]>(labsPaths.assignments, { path: { lab_id } });
}

// ------------------------------------------------------------------ lab writes

export function createLab(body: LabCreateInput): Promise<LabDetail> {
  return apiPost<LabDetail>(labsPaths.list, { body });
}

export function updateLab(lab_id: LabId, body: LabCardInput): Promise<LabDetail> {
  return apiPatch<LabDetail>(labsPaths.lab, { path: { lab_id }, body });
}

export function deleteLab(lab_id: LabId): Promise<void> {
  return apiDelete<void>(labsPaths.lab, { path: { lab_id } });
}

/** Saves the lab definition; a stale `base_revision` returns 409 (the UI shows a conflict). */
export function saveLabDraft(lab_id: LabId, body: LabDraftInput): Promise<LabDetail> {
  return apiPut<LabDetail>(labsPaths.draft, { path: { lab_id }, body });
}

export function validateLab(lab_id: LabId): Promise<LabValidation> {
  return apiPost<LabValidation>(labsPaths.validate, { path: { lab_id } });
}

export function setLabStatus(
  lab_id: LabId,
  status: RequestBody<StatusOp>["status"],
): Promise<LabDetail> {
  return apiPost<LabDetail>(labsPaths.status, { path: { lab_id }, body: { status } });
}

export function publishLab(lab_id: LabId, changelog?: string | null): Promise<LabVersion> {
  return apiPost<LabVersion>(labsPaths.publish, { path: { lab_id }, body: { changelog: changelog ?? null } });
}

export function unpublishLab(lab_id: LabId): Promise<LabDetail> {
  return apiPost<LabDetail>(labsPaths.unpublish, { path: { lab_id } });
}

export function archiveLab(lab_id: LabId): Promise<LabDetail> {
  return apiPost<LabDetail>(labsPaths.archive, { path: { lab_id } });
}

export function duplicateLab(lab_id: LabId, body: RequestBody<DuplicateOp>): Promise<LabDetail> {
  return apiPost<LabDetail>(labsPaths.duplicate, { path: { lab_id }, body });
}

/** Create a composable `blocks` copy of a schema-engine lab (page/block conversion). */
export function convertLabToBlocks(lab_id: LabId, body: ConvertToBlocksInput): Promise<LabDetail> {
  return apiPost<LabDetail>(`admin/labs/{lab_id}/convert-to-blocks`, { path: { lab_id }, body });
}

export function updateLabRelease(lab_id: LabId, body: LabReleaseInput): Promise<LabDetail> {
  return apiPut<LabDetail>(labsPaths.release, { path: { lab_id }, body });
}

export function restoreLabVersion(lab_id: LabId, version_no: number): Promise<LabDetail> {
  return apiPost<LabDetail>(labsPaths.restore, { path: { lab_id, version_no } });
}

export function previewLab(lab_id: LabId, scenario_key?: string | null): Promise<LabPreview> {
  return apiPost<LabPreview>(labsPaths.preview, { path: { lab_id }, body: { scenario_key: scenario_key ?? null } });
}

/** Read-only workflow graph for the Studio canvas (saved draft, or the unsaved `definition`/`content`). */
export function buildLabGraph(lab_id: LabId, body: LabGraphInput, signal?: AbortSignal): Promise<LabGraph> {
  return apiPost<LabGraph>(labsPaths.graph, { path: { lab_id }, body, signal });
}

export function exportLab(lab_id: LabId): Promise<Record<string, unknown>> {
  return apiGet<Record<string, unknown>>(labsPaths.export, { path: { lab_id } });
}

export function importLab(body: LabImportInput): Promise<LabDetail> {
  return apiPost<LabDetail>(labsPaths.import, { body });
}

// ------------------------------------------------------------------ scenarios

export function createScenario(lab_id: LabId, body: ScenarioInput): Promise<LabScenario> {
  return apiPost<LabScenario>(labsPaths.scenarios, { path: { lab_id }, body });
}

export function updateScenario(
  lab_id: LabId,
  scenario_id: ScenarioId,
  body: ScenarioUpdate,
): Promise<LabScenario> {
  return apiPut<LabScenario>(labsPaths.scenario, { path: { lab_id, scenario_id }, body });
}

export function deleteScenario(lab_id: LabId, scenario_id: ScenarioId): Promise<void> {
  return apiDelete<void>(labsPaths.scenario, { path: { lab_id, scenario_id } });
}

export function duplicateScenario(
  lab_id: LabId,
  scenario_id: ScenarioId,
  body: ScenarioDuplicateInput,
): Promise<LabScenario> {
  return apiPost<LabScenario>(labsPaths.scenarioDuplicate, { path: { lab_id, scenario_id }, body });
}

export function orderScenarios(lab_id: LabId, scenario_ids: string[]): Promise<LabScenario[]> {
  return apiPut<LabScenario[]>(labsPaths.scenariosOrder, { path: { lab_id }, body: { scenario_ids } });
}

export function validateScenario(
  lab_id: LabId,
  body: RequestBody<ValidateScenarioOp>,
): Promise<LabValidation> {
  return apiPost<LabValidation>(labsPaths.scenarioValidate, { path: { lab_id }, body });
}

// ------------------------------------------------------------------ attempts

export function flagAttempt(attempt_id: AttemptId, reason: string): Promise<LabAttempt> {
  return apiPost<LabAttempt>(labsPaths.flagAttempt, { path: { attempt_id }, body: { reason } });
}

export function voidAttempt(attempt_id: AttemptId, reason: string): Promise<LabAttempt> {
  return apiPost<LabAttempt>(labsPaths.voidAttempt, { path: { attempt_id }, body: { reason } });
}

export function overrideAttemptScore(attempt_id: AttemptId, overall: number, reason: string): Promise<LabAttempt> {
  return apiPost<LabAttempt>(labsPaths.overrideAttempt, { path: { attempt_id }, body: { overall, reason } });
}

// ------------------------------------------------------------------ composable documents

export function getBlockDocument(lab_id: LabId, scenario_key?: string | null): Promise<BlockDocument> {
  return apiGet<BlockDocument>(labsPaths.document, { path: { lab_id }, query: { scenario: scenario_key ?? undefined } });
}

export function saveBlockDocument(lab_id: LabId, body: BlockDocumentInput): Promise<BlockDocument> {
  return apiPut<BlockDocument>(labsPaths.document, { path: { lab_id }, body });
}

export function validateBlockDocument(
  lab_id: LabId,
  body: RequestBody<ValidateDocumentOp>,
): Promise<LabValidation> {
  return apiPost<LabValidation>(labsPaths.documentValidate, { path: { lab_id }, body });
}

export function addBlockPage(lab_id: LabId, body: BlockPageInput): Promise<BlockDocument> {
  return apiPost<BlockDocument>(labsPaths.documentPages, { path: { lab_id }, body });
}

export function updateBlockPage(lab_id: LabId, page_id: string, body: BlockPageInput): Promise<BlockDocument> {
  return apiPatch<BlockDocument>(labsPaths.documentPage, { path: { lab_id, page_id }, body });
}

export function deleteBlockPage(
  lab_id: LabId,
  page_id: string,
  base_revision: number,
  scenario_key?: string | null,
): Promise<BlockDocument> {
  return apiDelete<BlockDocument>(labsPaths.documentPage, {
    path: { lab_id, page_id },
    query: { base_revision, scenario: scenario_key ?? undefined },
  });
}

export function addBlock(lab_id: LabId, page_id: string, body: BlockInput): Promise<BlockDocument> {
  return apiPost<BlockDocument>(labsPaths.documentBlocks, { path: { lab_id, page_id }, body });
}

export function updateBlock(lab_id: LabId, block_id: string, body: BlockInput): Promise<BlockDocument> {
  return apiPatch<BlockDocument>(labsPaths.documentBlock, { path: { lab_id, block_id }, body });
}

export function deleteBlock(
  lab_id: LabId,
  block_id: string,
  base_revision: number,
  scenario_key?: string | null,
): Promise<BlockDocument> {
  return apiDelete<BlockDocument>(labsPaths.documentBlock, {
    path: { lab_id, block_id },
    query: { base_revision, scenario: scenario_key ?? undefined },
  });
}

export function duplicateBlock(lab_id: LabId, block_id: string, body: BlockInput): Promise<BlockDocument> {
  return apiPost<BlockDocument>(labsPaths.documentBlockDuplicate, { path: { lab_id, block_id }, body });
}

export function moveBlock(lab_id: LabId, block_id: string, body: BlockMoveInput): Promise<BlockDocument> {
  return apiPost<BlockDocument>(labsPaths.documentBlockMove, { path: { lab_id, block_id }, body });
}

/** Copy a draft snapshot back into the scenario (new revision; 409 when `base_revision` is stale). */
export function restoreScenarioSnapshot(
  lab_id: LabId,
  scenario_id: ScenarioId,
  snapshot_id: string,
  base_revision: number,
): Promise<LabScenario> {
  return apiPost<LabScenario>(labsPaths.restoreSnapshot, {
    path: { lab_id, scenario_id, snapshot_id },
    body: { base_revision } satisfies RequestBody<RestoreSnapshotOp>,
  });
}

// ------------------------------------------------------------------ assignments & assets

export function createAssignment(lab_id: LabId, body: AssignmentInput): Promise<LabAssignment> {
  return apiPost<LabAssignment>(labsPaths.assignments, { path: { lab_id }, body });
}

export function deleteAssignment(lab_id: LabId, assignment_id: AssignmentId): Promise<void> {
  return apiDelete<void>(labsPaths.assignment, { path: { lab_id, assignment_id } });
}

export function labAssetUploadUrl(lab_id: LabId, body: AssetUploadInput): Promise<SuccessResponse<AssetUploadUrlOp>> {
  return apiPost<SuccessResponse<AssetUploadUrlOp>>(labsPaths.assetUploadUrl, { path: { lab_id }, body });
}

export function completeLabAsset(lab_id: LabId, body: AssetCompleteInput): Promise<LabAsset> {
  return apiPost<LabAsset>(labsPaths.assets, { path: { lab_id }, body });
}

export function deleteLabAsset(lab_id: LabId, asset_id: AssetId): Promise<void> {
  return apiDelete<void>(labsPaths.asset, { path: { lab_id, asset_id } });
}
