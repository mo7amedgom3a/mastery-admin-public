import type { Row } from "@/lib/api";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Normalises a legacy payload that may be a bare array, a page (`items`), or a single object. */
export function normalizeRows(payload: unknown): Row[] {
  if (Array.isArray(payload)) return payload as Row[];
  if (isRecord(payload)) {
    if (Array.isArray(payload.items)) return payload.items as Row[];
    return [payload as Row];
  }
  return [];
}
