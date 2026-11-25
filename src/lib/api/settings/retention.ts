import { queryOptions } from "@tanstack/react-query";

import { apiGet, apiPost, apiPut } from "@/lib/api/client";

/**
 * Data retention (`/admin/retention`): per-category expiration policies for high-volume
 * tables, eligible-row previews and the run history. Types are handwritten (like the
 * mirror status below) because the surface is small and stable.
 */

export type LocalizedText = { ar: string; en: string };

export type RetentionPolicy = {
  category_key: string;
  label: LocalizedText;
  description: LocalizedText;
  table: string;
  timestamp_column: string;
  retention_days: number;
  is_enabled: boolean;
  batch_size: number;
  max_rows_per_run: number;
  min_days: number;
  max_days: number;
  default_days: number;
  protected: boolean;
  last_run_at: string | null;
  last_deleted_count: number | null;
  last_status: string | null;
};

export type RetentionEngineInfo = {
  enabled: boolean;
  worker_interval_seconds: number;
  queue_poll_seconds: number;
  running_run_id: string | null;
  running_since: string | null;
};

export type RetentionPoliciesResponse = {
  items: RetentionPolicy[];
  engine: RetentionEngineInfo;
  generated_at: string;
};

export type RetentionPolicyUpdate = {
  retention_days: number;
  is_enabled: boolean;
  acknowledge_protected?: boolean;
};

export type RetentionPreviewItem = {
  category_key: string;
  label: LocalizedText;
  retention_days: number;
  is_enabled: boolean;
  cutoff_at: string;
  eligible_rows: number;
  capped: boolean;
};

export type RetentionPreviewResponse = {
  items: RetentionPreviewItem[];
  generated_at: string;
};

export type RetentionRunStatus = "queued" | "running" | "succeeded" | "partial" | "failed" | "skipped";

export type RetentionRun = {
  run_id: string;
  trigger_source: "schedule" | "admin" | "cli";
  requested_by: string | null;
  dry_run: boolean;
  status: RetentionRunStatus;
  started_at: string | null;
  finished_at: string | null;
  total_deleted: number;
  error: string | null;
  created_at: string | null;
};

export type RetentionRunPage = {
  items: RetentionRun[];
  total: number;
  limit: number;
  offset: number;
};

export type RetentionRunItem = {
  category_key: string;
  label: LocalizedText;
  cutoff_at: string;
  deleted_count: number;
  duration_ms: number | null;
  status: "succeeded" | "skipped" | "failed";
  truncated: boolean;
  error: string | null;
};

export type RetentionRunDetail = RetentionRun & { items: RetentionRunItem[] };

export type RetentionRunQueued = { run_id: string; status: RetentionRunStatus };

export type RetentionRunsParams = { limit?: number; offset?: number };

export const retentionPaths = {
  policies: "admin/retention",
  policy: (categoryKey: string) => `admin/retention/policies/${categoryKey}`,
  preview: "admin/retention/preview",
  runs: "admin/retention/runs",
  run: (runId: string) => `admin/retention/runs/${runId}`,
} as const;

export const listRetentionPolicies = (): Promise<RetentionPoliciesResponse> =>
  apiGet(retentionPaths.policies);

export const updateRetentionPolicy = (
  categoryKey: string,
  body: RetentionPolicyUpdate,
): Promise<RetentionPolicy> => apiPut(retentionPaths.policy(categoryKey), { body });

export const previewRetention = (categoryKeys?: string[]): Promise<RetentionPreviewResponse> =>
  apiPost(retentionPaths.preview, { body: { category_keys: categoryKeys ?? null } });

export const queueRetentionRun = (body: {
  category_keys?: string[] | null;
  dry_run: boolean;
}): Promise<RetentionRunQueued> => apiPost(retentionPaths.runs, { body });

export const listRetentionRuns = (params: RetentionRunsParams = {}): Promise<RetentionRunPage> =>
  apiGet(retentionPaths.runs, { query: params });

export const getRetentionRun = (runId: string): Promise<RetentionRunDetail> =>
  apiGet(retentionPaths.run(runId));

export const retentionKeys = {
  all: ["retention"] as const,
  policies: () => [...retentionKeys.all, "policies"] as const,
  runs: (params?: RetentionRunsParams) => [...retentionKeys.all, "runs", params ?? {}] as const,
  run: (runId: string) => [...retentionKeys.all, "run", runId] as const,
};

export const retentionQueries = {
  policies: () =>
    queryOptions({ queryKey: retentionKeys.policies(), queryFn: listRetentionPolicies }),
  runs: (params?: RetentionRunsParams) =>
    queryOptions({ queryKey: retentionKeys.runs(params), queryFn: () => listRetentionRuns(params) }),
  run: (runId: string) =>
    queryOptions({
      queryKey: retentionKeys.run(runId),
      queryFn: () => getRetentionRun(runId),
      enabled: Boolean(runId),
    }),
};

export const RETENTION_TERMINAL_STATUSES: RetentionRunStatus[] = [
  "succeeded",
  "partial",
  "failed",
  "skipped",
];

export function isRetentionRunFinished(status: RetentionRunStatus | undefined): boolean {
  return status !== undefined && RETENTION_TERMINAL_STATUSES.includes(status);
}
