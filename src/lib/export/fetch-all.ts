import type { PageResult } from "@/components/ui/paged-list";
import { ApiError } from "@/lib/api/client";

export const EXCEL_ROW_LIMIT = 5_000;
export const PDF_ROW_LIMIT = 500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Retries a rate-limited (429) / transient (502-504) page with backoff so a long walk survives the API throttle. */
async function withRetry<R>(run: () => Promise<R>): Promise<R> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      const retryable = error instanceof ApiError && (error.status === 429 || (error.status >= 502 && error.status <= 504));
      if (!retryable || attempt >= 5) throw error;
      await sleep(Math.min(1000 * 2 ** attempt, 15_000));
    }
  }
}

/**
 * Walks a paged endpoint with the caller's active filters until `total` or `max` rows are collected.
 * `truncated` is true when more rows exist than were fetched.
 */
export async function fetchAllPages<T>(
  fetchPage: (offset: number, limit: number) => Promise<PageResult<T>>,
  { pageSize = 50, max = EXCEL_ROW_LIMIT, onProgress }: { pageSize?: number; max?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<{ items: T[]; total: number; truncated: boolean }> {
  const items: T[] = [];
  let total = Infinity;
  // Advance by the requested window, not by `items.length`: some lists filter a page client-side, so a page can hold fewer rows than were requested.
  let offset = 0;
  while (offset < total && items.length < max) {
    const limit = Math.min(pageSize, max - items.length);
    const page = await withRetry(() => fetchPage(offset, limit));
    total = page.total;
    items.push(...page.items);
    offset += limit;
    onProgress?.(Math.min(offset, total), total);
  }
  return { items, total: Number.isFinite(total) ? total : items.length, truncated: offset < total };
}
