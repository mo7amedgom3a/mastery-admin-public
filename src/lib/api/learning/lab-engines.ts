import { queryOptions } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/lib/api/client";
import type { PathParams, QueryParams, RequestBody, SuccessResponse } from "@/lib/api/operation-types";

/**
 * Lab engines and personas (`/admin/labs/runtimes|engine-defs|personas`).
 *
 * A runtime is code (dialogue, blocks, schema, bespoke runners). An engine is an admin template on
 * a runtime ("HR mediation", "Sales discovery"): context, runtime config, persona slots,
 * constraints and the scoring rubric. Labs are built on an engine; publishing a lab pins the
 * engine's published version. Personas are a reusable library referenced by key.
 */

type RuntimesOp = "admin_labs_runtimes";
type EngineListOp = "admin_labs_engine_defs_list";
type EngineCreateOp = "admin_labs_engine_defs_create";
type EngineGetOp = "admin_labs_engine_defs_get";
type EngineUpdateOp = "admin_labs_engine_defs_update";
type EngineValidateOp = "admin_labs_engine_defs_validate";
type EngineVersionsOp = "admin_labs_engine_defs_versions";
type EngineVersionOp = "admin_labs_engine_defs_version";
type EngineUsageOp = "admin_labs_engine_defs_usage";
type EngineTestOp = "admin_labs_engine_defs_test";
type EngineGraphOp = "admin_labs_engine_defs_graph";
type PersonaListOp = "admin_labs_personas_list";
type PersonaCreateOp = "admin_labs_personas_create";
type PersonaUpdateOp = "admin_labs_personas_update";
type PersonaUsageOp = "admin_labs_personas_usage";

export type RuntimeCatalog = SuccessResponse<RuntimesOp>;
export type LabRuntimeDef = RuntimeCatalog["items"][number];
export type EngineDefsParams = QueryParams<EngineListOp>;
export type EngineDefSummary = SuccessResponse<EngineListOp>["items"][number];
export type EngineDefDetail = SuccessResponse<EngineGetOp>;
export type EngineDefCreateInput = RequestBody<EngineCreateOp>;
export type EngineDefUpdateInput = RequestBody<EngineUpdateOp>;
export type EngineDefValidation = SuccessResponse<EngineValidateOp>;
export type EngineDefVersion = SuccessResponse<EngineVersionOp>;
export type EngineDefVersions = SuccessResponse<EngineVersionsOp>["items"];
export type EngineDefUsage = SuccessResponse<EngineUsageOp>;
export type EngineTestInput = RequestBody<EngineTestOp>;
export type EngineTestResult = SuccessResponse<EngineTestOp>;
export type EngineGraph = SuccessResponse<EngineGraphOp>;
export type EngineGraphInput = RequestBody<EngineGraphOp>;
export type PersonaList = SuccessResponse<PersonaListOp>;
export type LabPersona = PersonaList["items"][number];
export type PersonaCreateInput = RequestBody<PersonaCreateOp>;
export type PersonaUpdateInput = RequestBody<PersonaUpdateOp>;
export type PersonaUsage = SuccessResponse<PersonaUsageOp>;

type EngineId = PathParams<EngineGetOp>["engine_id"];
type PersonaId = PathParams<PersonaUpdateOp>["persona_id"];

/** The engine draft (`EngineDefinition` on the backend); `config`/`rubric` are runtime-owned. */
export type EngineDefinitionDoc = {
  schema_version?: 1;
  context: {
    domain?: string;
    setting?: string;
    learner_role?: string;
    tone?: string;
    glossary?: string[];
    system_prompt?: string;
    observer_prompt?: string;
  };
  config: Record<string, unknown>;
  persona_slots: { slot: string; label: { ar: string; en?: string | null }; required?: boolean; default_persona_key?: string | null }[];
  constraints: EngineConstraint[];
  rubric?: Record<string, unknown> | null;
  starter_scenario?: Record<string, unknown> | null;
  notes?: string | null;
};

export type EngineConstraint = {
  key: string;
  label: { ar: string; en?: string | null };
  type: "number" | "money" | "minutes" | "percent" | "text" | "bool";
  value?: unknown;
  unit?: string | null;
  min?: number | null;
  max?: number | null;
  lab_overridable?: boolean;
  learner_visible?: boolean;
  description?: string | null;
};

export type PersonaProfile = {
  name_en?: string | null;
  role_en?: string | null;
  initials?: string;
  tone?: "coral" | "sky" | "purple" | "teal" | "yellow" | "pink" | "green" | "blue";
  avatar_url?: string | null;
  age?: number | null;
  organization?: string | null;
  personality?: string;
  traits?: string[];
  goals?: string[];
  speaking_style?: string;
  sample_lines?: string[];
  hidden_facts?: string[];
  system_prompt?: string;
};

export const labEnginePaths = {
  runtimes: "admin/labs/runtimes",
  engines: "admin/labs/engine-defs",
  engine: "admin/labs/engine-defs/{engine_id}",
  draft: "admin/labs/engine-defs/{engine_id}/draft",
  validate: "admin/labs/engine-defs/{engine_id}/validate",
  publish: "admin/labs/engine-defs/{engine_id}/publish",
  status: "admin/labs/engine-defs/{engine_id}/status",
  versions: "admin/labs/engine-defs/{engine_id}/versions",
  version: "admin/labs/engine-defs/{engine_id}/versions/{version_no}",
  restore: "admin/labs/engine-defs/{engine_id}/versions/{version_no}/restore",
  usage: "admin/labs/engine-defs/{engine_id}/usage",
  test: "admin/labs/engine-defs/{engine_id}/test",
  graph: "admin/labs/engine-defs/{engine_id}/graph",
  personas: "admin/labs/personas",
  persona: "admin/labs/personas/{persona_id}",
  personaUsage: "admin/labs/personas/{persona_id}/usage",
} as const;

export const labEngineKeys = {
  all: ["learning", "labs", "engines-admin"] as const,
  runtimes: () => [...labEngineKeys.all, "runtimes"] as const,
  list: (params?: EngineDefsParams) => [...labEngineKeys.all, "list", params ?? {}] as const,
  detail: (engineId: string) => [...labEngineKeys.all, "detail", engineId] as const,
  versions: (engineId: string) => [...labEngineKeys.all, "versions", engineId] as const,
  usage: (engineId: string) => [...labEngineKeys.all, "usage", engineId] as const,
  personas: (params?: Record<string, unknown>) => [...labEngineKeys.all, "personas", params ?? {}] as const,
  persona: (personaId: string) => [...labEngineKeys.all, "persona", personaId] as const,
  personaUsage: (personaId: string) => [...labEngineKeys.all, "persona-usage", personaId] as const,
};

export const labEngineQueries = {
  runtimes: () =>
    queryOptions({
      queryKey: labEngineKeys.runtimes(),
      queryFn: () => apiGet<RuntimeCatalog>(labEnginePaths.runtimes),
      staleTime: 10 * 60_000,
    }),
  list: (params: EngineDefsParams = {}) =>
    queryOptions({
      queryKey: labEngineKeys.list(params),
      queryFn: () => apiGet<SuccessResponse<EngineListOp>>(labEnginePaths.engines, { query: params }),
    }),
  detail: (engineId: EngineId) =>
    queryOptions({
      queryKey: labEngineKeys.detail(engineId),
      queryFn: () => apiGet<EngineDefDetail>(labEnginePaths.engine, { path: { engine_id: engineId } }),
    }),
  versions: (engineId: EngineId) =>
    queryOptions({
      queryKey: labEngineKeys.versions(engineId),
      queryFn: () =>
        apiGet<SuccessResponse<EngineVersionsOp>>(labEnginePaths.versions, { path: { engine_id: engineId } }).then((page) => page.items),
    }),
  usage: (engineId: EngineId) =>
    queryOptions({
      queryKey: labEngineKeys.usage(engineId),
      queryFn: () => apiGet<EngineDefUsage>(labEnginePaths.usage, { path: { engine_id: engineId } }),
    }),
  personas: (params: QueryParams<PersonaListOp> = {}) =>
    queryOptions({
      queryKey: labEngineKeys.personas(params),
      queryFn: () => apiGet<PersonaList>(labEnginePaths.personas, { query: params }),
    }),
  persona: (personaId: PersonaId) =>
    queryOptions({
      queryKey: labEngineKeys.persona(personaId),
      queryFn: () => apiGet<LabPersona>(labEnginePaths.persona, { path: { persona_id: personaId } }),
    }),
  personaUsage: (personaId: PersonaId) =>
    queryOptions({
      queryKey: labEngineKeys.personaUsage(personaId),
      queryFn: () => apiGet<PersonaUsage>(labEnginePaths.personaUsage, { path: { persona_id: personaId } }),
    }),
};

// ------------------------------------------------------------------ engine writes

export function createEngineDef(body: EngineDefCreateInput): Promise<EngineDefDetail> {
  return apiPost<EngineDefDetail>(labEnginePaths.engines, { body });
}

export function updateEngineDef(engine_id: EngineId, body: EngineDefUpdateInput): Promise<EngineDefDetail> {
  return apiPatch<EngineDefDetail>(labEnginePaths.engine, { path: { engine_id }, body });
}

export function deleteEngineDef(engine_id: EngineId): Promise<void> {
  return apiDelete<void>(labEnginePaths.engine, { path: { engine_id } });
}

export function saveEngineDraft(engine_id: EngineId, definition: EngineDefinitionDoc, base_revision: number): Promise<EngineDefDetail> {
  return apiPut<EngineDefDetail>(labEnginePaths.draft, { path: { engine_id }, body: { definition, base_revision } });
}

export function validateEngineDef(engine_id: EngineId, definition?: EngineDefinitionDoc): Promise<EngineDefValidation> {
  return apiPost<EngineDefValidation>(labEnginePaths.validate, { path: { engine_id }, body: { definition: definition ?? null } });
}

export function publishEngineDef(engine_id: EngineId, changelog?: string | null): Promise<EngineDefVersion> {
  return apiPost<EngineDefVersion>(labEnginePaths.publish, { path: { engine_id }, body: { changelog: changelog ?? null } });
}

export function setEngineDefStatus(engine_id: EngineId, status: "draft" | "archived"): Promise<EngineDefDetail> {
  return apiPost<EngineDefDetail>(labEnginePaths.status, { path: { engine_id }, body: { status } });
}

export function getEngineDefVersion(engine_id: EngineId, version_no: number): Promise<EngineDefVersion> {
  return apiGet<EngineDefVersion>(labEnginePaths.version, { path: { engine_id, version_no } });
}

export function restoreEngineDef(engine_id: EngineId, version_no: number): Promise<EngineDefDetail> {
  return apiPost<EngineDefDetail>(labEnginePaths.restore, { path: { engine_id, version_no } });
}

export function testEngineDef(engine_id: EngineId, body: EngineTestInput): Promise<EngineTestResult> {
  return apiPost<EngineTestResult>(labEnginePaths.test, { path: { engine_id }, body });
}

/** Read-only lifecycle graph for the Studio canvas (saved draft, or the unsaved `definition`). */
export function buildEngineGraph(engine_id: EngineId, body: EngineGraphInput, signal?: AbortSignal): Promise<EngineGraph> {
  return apiPost<EngineGraph>(labEnginePaths.graph, { path: { engine_id }, body, signal });
}

// ------------------------------------------------------------------ persona writes

export function createPersona(body: PersonaCreateInput): Promise<LabPersona> {
  return apiPost<LabPersona>(labEnginePaths.personas, { body });
}

export function updatePersona(persona_id: PersonaId, body: PersonaUpdateInput): Promise<LabPersona> {
  return apiPatch<LabPersona>(labEnginePaths.persona, { path: { persona_id }, body });
}

export function deletePersona(persona_id: PersonaId): Promise<void> {
  return apiDelete<void>(labEnginePaths.persona, { path: { persona_id } });
}
