import { queryOptions } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api/client";

/**
 * Content indexing console (`/admin/rag`): the vector index behind smart search and the AI
 * advisor. Products are chunked, embedded (Workers AI bge-m3) and stored in Cloudflare
 * Vectorize by the RAG Temporal worker; these endpoints read the index state, start runs and
 * live-test a keyword. Types are handwritten (like retention) because the surface is small.
 */

export type IndexState = "indexed" | "stale" | "deleted" | "not_indexed";
export type IndexRunKind = "index" | "delete" | "refresh";
export type IndexRunStatus =
  | "running"
  | "completed"
  | "failed"
  | "canceled"
  | "terminated"
  | "continued_as_new"
  | "timed_out"
  | "unknown";

export type IndexOverview = {
  store: {
    vector_store: string;
    index_name: string | null;
    embedding_provider: string;
    embedding_model: string;
    dimension: number;
    vector_count: number | null;
    processed_up_to: string | null;
  };
  totals: {
    indexable_products: number;
    indexed_products: number;
    stale_products: number;
    missing_products: number;
    orphan_products: number;
    indexed_chunks: number;
    deleted_chunks: number;
    last_indexed_at: string | null;
  };
  schedule: {
    schedule_id: string;
    cron: string[];
    paused: boolean;
    next_runs: string[];
    last_run_at: string | null;
  } | null;
  auto_index_enabled: boolean;
  semantic_search_enabled: boolean;
  temporal_configured: boolean;
};

export type IndexProduct = {
  product_id: string;
  title: string | null;
  slug: string | null;
  product_type: string | null;
  status: string | null;
  state: IndexState;
  indexed_chunks: number;
  deleted_chunks: number;
  indexed_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  deleted_reason: string | null;
};

export type IndexProductPage = { items: IndexProduct[]; total: number; limit: number; offset: number };

export type IndexProductsParams = {
  q?: string;
  state?: IndexState;
  product_type?: string;
  limit?: number;
  offset?: number;
};

export type IndexRunSummary = {
  workflow_id: string;
  kind: IndexRunKind;
  status: IndexRunStatus;
  started_at: string | null;
  closed_at: string | null;
  scheduled: boolean;
};

export type IndexRunResult = {
  action: string;
  batches: number;
  products: number;
  chunks_indexed: number;
  chunks_skipped: number;
  chunks_deleted: number;
  not_indexable: string[];
  soft_deleted_products: string[];
};

export type IndexRunDetail = Omit<IndexRunSummary, "scheduled"> & {
  progress: { action: string; products: number; total_batches: number; result: IndexRunResult | null } | null;
  result: IndexRunResult | null;
  error: string | null;
};

export type IndexRunStarted = { workflow_id: string };

export type LiveTestProduct = {
  rank: number;
  product_id: string;
  title: string | null;
  product_type: string | null;
  score: number;
  sources: string[];
};

export type LiveTestResult = {
  query: string;
  top_k: number;
  embed_ms: number | null;
  vector_ms: number | null;
  search_ms: number;
  semantic_error: string | null;
  chunks: {
    rank: number;
    similarity: number;
    product_id: string | null;
    title: string | null;
    product_type: string | null;
    status: string | null;
    source: string | null;
    excerpt: string | null;
  }[];
  semantic_products: LiveTestProduct[];
  storefront: LiveTestProduct[];
  storefront_semantic_used: boolean;
  expectations: {
    product_id: string;
    title: string | null;
    semantic_rank: number | null;
    search_rank: number | null;
    matched: boolean;
  }[];
};

export const searchIndexPaths = {
  overview: "admin/rag/overview",
  products: "admin/rag/products",
  runs: "admin/rag/runs",
  run: (workflowId: string) => `admin/rag/runs/${encodeURIComponent(workflowId)}`,
  index: "admin/rag/index",
  remove: "admin/rag/delete",
  refresh: "admin/rag/refresh",
  test: "admin/rag/test",
} as const;

export const getIndexOverview = (): Promise<IndexOverview> => apiGet(searchIndexPaths.overview);

export const listIndexProducts = (params: IndexProductsParams = {}): Promise<IndexProductPage> =>
  apiGet(searchIndexPaths.products, { query: params });

export const listIndexRuns = (limit = 20): Promise<IndexRunSummary[]> =>
  apiGet(searchIndexPaths.runs, { query: { limit } });

export const getIndexRun = (workflowId: string): Promise<IndexRunDetail> => apiGet(searchIndexPaths.run(workflowId));

export const indexProducts = (productIds: string[], force: boolean): Promise<IndexRunStarted> =>
  apiPost(searchIndexPaths.index, { body: { product_ids: productIds, force } });

export const removeProductsFromIndex = (productIds: string[], reason: string): Promise<IndexRunStarted> =>
  apiPost(searchIndexPaths.remove, { body: { product_ids: productIds, reason } });

export const refreshIndex = (force: boolean): Promise<IndexRunStarted> =>
  apiPost(searchIndexPaths.refresh, { body: { force } });

export const runLiveTest = (body: {
  query: string;
  top_k: number;
  expected_product_ids: string[];
}): Promise<LiveTestResult> => apiPost(searchIndexPaths.test, { body });

export const searchIndexKeys = {
  all: ["search-index"] as const,
  overview: () => [...searchIndexKeys.all, "overview"] as const,
  products: (params: IndexProductsParams) => [...searchIndexKeys.all, "products", params] as const,
  runs: () => [...searchIndexKeys.all, "runs"] as const,
  run: (workflowId: string) => [...searchIndexKeys.all, "run", workflowId] as const,
};

export const searchIndexQueries = {
  overview: () => queryOptions({ queryKey: searchIndexKeys.overview(), queryFn: getIndexOverview }),
  products: (params: IndexProductsParams) =>
    queryOptions({ queryKey: searchIndexKeys.products(params), queryFn: () => listIndexProducts(params) }),
  runs: () => queryOptions({ queryKey: searchIndexKeys.runs(), queryFn: () => listIndexRuns(20) }),
  run: (workflowId: string) =>
    queryOptions({
      queryKey: searchIndexKeys.run(workflowId),
      queryFn: () => getIndexRun(workflowId),
      enabled: Boolean(workflowId),
    }),
};

export function isIndexRunActive(status: IndexRunStatus | undefined): boolean {
  return status === "running";
}
