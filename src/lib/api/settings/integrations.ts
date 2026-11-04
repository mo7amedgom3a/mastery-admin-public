import { ApiError, apiDelete, apiGet, apiPost, apiPut } from "@/lib/api/client";

/**
 * Runtime integration settings (`/admin/settings/integrations`).
 *
 * Non-secret values are returned by the listing. Secret values are **never** returned:
 * the API exposes `is_set`/`fingerprint` only. Revealing, replacing, clearing or testing a
 * secret additionally requires the vault unlock token (header `X-Settings-Vault-Token`),
 * which the page holds in memory after `unlockVault`.
 */

export const VAULT_HEADER = "X-Settings-Vault-Token";

export type SettingKind = "string" | "int" | "float" | "decimal" | "bool" | "list" | "datetime" | "url" | "email" | "enum";
export type SettingApplies = "live" | "restart";
export type SettingSource = "admin" | "env" | "default";

export type SettingEntry = {
  key: string;
  field: string;
  group: string;
  label: string;
  kind: SettingKind;
  secret: boolean;
  applies: SettingApplies;
  worker_restart: boolean;
  danger: "signs_out_all" | "requires_reindex" | null;
  deprecated: boolean;
  choices: string[];
  hint: string;
  /** Effective non-secret value; always null for secret entries. */
  value: unknown;
  is_set: boolean;
  source: SettingSource;
  default: unknown;
  fingerprint: string | null;
  updated_at: string | null;
  updated_by_email: string | null;
  pending_restart: boolean;
  invalid_reason: string | null;
};

export type SettingGroup = {
  id: string;
  label: { ar: string; en: string };
  description: { ar: string; en: string };
  probe: string | null;
  entries: SettingEntry[];
};

export type RuntimeStoreStatus = {
  enabled: boolean;
  db: "ok" | "error" | "migration_missing" | "disabled";
  secrets: "ok" | "error" | "disabled";
  secrets_backend: "aws" | "file" | "none";
  secrets_id: string | null;
  error: string | null;
  loaded_at: string | null;
  applied: number;
  invalid: Record<string, string>;
};

export type VaultState = {
  configured: boolean;
  reveal_enabled: boolean;
  ttl_seconds: number;
  max_attempts: number;
};

export type IntegrationsOverview = {
  groups: SettingGroup[];
  store: RuntimeStoreStatus;
  vault: VaultState;
};

export type UpdateResult = {
  updated: string[];
  restart_required: string[];
  fingerprints?: Record<string, string> | null;
};

export type UnlockResult = {
  token: string;
  expires_at: string;
  expires_in: number;
};

export type ProbeCheck = { target: string; ok: boolean; detail: string };
export type GroupTestResult = { group: string; checks: ProbeCheck[] };

export const integrationsPaths = {
  base: "admin/settings/integrations",
  update: "admin/settings/integrations",
  secrets: "admin/settings/integrations/secrets",
  secret: "admin/settings/integrations/secrets/{key}",
  reveal: "admin/settings/integrations/secrets/{key}/reveal",
  unlock: "admin/settings/integrations/vault/unlock",
  test: "admin/settings/integrations/{group}/test",
  revert: "admin/settings/integrations/{key}",
} as const;

export const integrationsKeys = {
  all: ["settings", "integrations"] as const,
  overview: () => [...integrationsKeys.all, "overview"] as const,
};

const vaultHeaders = (token: string) => ({ [VAULT_HEADER]: token });

/** `GET /admin/settings/integrations` — groups, effective values and store status. */
export function getIntegrationsOverview(): Promise<IntegrationsOverview> {
  return apiGet(integrationsPaths.base);
}

/** `PUT /admin/settings/integrations` — validate + store non-secret values (all-or-nothing). */
export function updateSettingValues(values: Record<string, unknown>): Promise<UpdateResult> {
  return apiPut(integrationsPaths.update, { body: { values } });
}

/** `DELETE /admin/settings/integrations/{key}` — drop an override, back to env/default. */
export function revertSetting(key: string): Promise<void> {
  return apiDelete(integrationsPaths.revert, { path: { key } });
}

/** `PUT /admin/settings/integrations/secrets` — requires the vault unlock token. */
export function updateSecretValues(
  values: Record<string, string>,
  token: string,
): Promise<UpdateResult> {
  return apiPut(integrationsPaths.secrets, {
    body: { values },
    headers: vaultHeaders(token),
  });
}

/** `DELETE /admin/settings/integrations/secrets/{key}` — requires the vault unlock token. */
export function clearSecret(key: string, token: string): Promise<void> {
  return apiDelete(integrationsPaths.secret, {
    path: { key },
    headers: vaultHeaders(token),
  });
}

/** `GET /admin/settings/integrations/secrets/{key}/reveal` — requires the vault unlock token. */
export function revealSecret(key: string, token: string): Promise<{ key: string; value: string }> {
  return apiGet(integrationsPaths.reveal, {
    path: { key },
    headers: vaultHeaders(token),
  });
}

/** `POST /admin/settings/integrations/vault/unlock` — exchange the vault key for a token. */
export function unlockVault(key: string): Promise<UnlockResult> {
  return apiPost(integrationsPaths.unlock, { body: { key } });
}

/** `POST /admin/settings/integrations/{group}/test` — requires the vault unlock token. */
export function testIntegration(group: string, token: string): Promise<GroupTestResult> {
  return apiPost(integrationsPaths.test, {
    path: { group },
    headers: vaultHeaders(token),
  });
}

/** Per-key validation messages from a `422 {detail: {errors}}` response. */
export function integrationErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  const body = error.details.body;
  if (!body || typeof body !== "object") return {};
  const detail = (body as { detail?: unknown }).detail;
  if (!detail || typeof detail !== "object") return {};
  const errors = (detail as { errors?: unknown }).errors;
  if (!errors || typeof errors !== "object") return {};
  return Object.fromEntries(
    Object.entries(errors as Record<string, unknown>).map(([key, value]) => [key, String(value)]),
  );
}

/** The server's human message (string details), for non-field failures. */
export function integrationErrorMessage(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  const detail = (error.details.body as { detail?: unknown } | undefined)?.detail;
  return typeof detail === "string" ? detail : null;
}
