import type { BadgeDef } from "@/components/ui/kit";
import type { ChangeRequest } from "@/lib/api";

/** Status badges for publish change requests. */
export const CHANGE_STATUS: Record<string, BadgeDef> = {
  open: { label: { ar: "بانتظار المراجعة", en: "Awaiting review" }, tone: "info" },
  approved: { label: { ar: "اعتُمد ونُشر", en: "Approved & published" }, tone: "success" },
  rejected: { label: { ar: "مرفوض", en: "Rejected" }, tone: "danger" },
  cancelled: { label: { ar: "أُلغي", en: "Cancelled" }, tone: "neutral" },
  stale: { label: { ar: "قديم: تغيّرت المسودة", en: "Stale: draft changed" }, tone: "warning" },
  superseded: { label: { ar: "استُبدل بطلب أحدث", en: "Superseded" }, tone: "neutral" },
};

export const CHANGE_STATUSES = ["open", "approved", "rejected", "stale", "cancelled", "superseded"] as const;

export const TOKEN_STATUS: Record<string, BadgeDef> = {
  active: { label: { ar: "فعّال", en: "Active" }, tone: "success" },
  expired: { label: { ar: "منتهي", en: "Expired" }, tone: "neutral" },
  revoked: { label: { ar: "مُبطل", en: "Revoked" }, tone: "danger" },
};

export const GRANT_STATUS: Record<string, BadgeDef> = {
  active: { label: { ar: "مرتبط", en: "Connected" }, tone: "success" },
  revoked: { label: { ar: "مفصول", en: "Disconnected" }, tone: "neutral" },
};

export const TOKEN_SCOPE_LABEL: Record<string, { ar: string; en: string }> = {
  "admin:labs:read": { ar: "قراءة وفحص", en: "Read & check" },
  "admin:labs:write": { ar: "تعديل المسودات وطلب النشر", en: "Edit drafts & request publishing" },
  "admin:labs:analytics": { ar: "التحليلات", en: "Analytics" },
};

/** "AI · Claude Code" or "Admin" for who opened a request. */
export function requesterBadge(request: Pick<ChangeRequest, "actor_type" | "client">): BadgeDef {
  if (request.actor_type === "ai") {
    const client = request.client ? ` · ${request.client}` : "";
    return { label: { ar: `ذكاء اصطناعي${client}`, en: `AI${client}` }, tone: "info" };
  }
  return { label: { ar: "مشرف", en: "Admin" }, tone: "neutral" };
}

export function changeTargetHref(request: Pick<ChangeRequest, "target_type" | "target_id">): string {
  return request.target_type === "lab"
    ? `/learning/labs/${request.target_id}`
    : `/learning/labs/engines/${request.target_id}`;
}

// ------------------------------------------------------------------ structural diff

export type DiffEntry = { path: string; kind: "added" | "removed" | "changed"; before?: unknown; after?: unknown };

const IGNORED_KEYS = new Set(["engine"]);

/** Empty-ish values compare equal, so defaults filled on publish (`[]`, `null`, `false`) are not noise. */
function isBlank(value: unknown): boolean {
  if (value === undefined || value === null || value === false || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).every(isBlank);
  return false;
}

function idOf(value: unknown): string | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const id = (value as Record<string, unknown>).id ?? (value as Record<string, unknown>).key;
    return typeof id === "string" ? id : null;
  }
  return null;
}

/**
 * What changed between two JSON documents, as JSON-pointer-like paths. Arrays of objects with an
 * `id` (stages, choices, pages, blocks) are matched by id, so moving one item does not mark every
 * following item as changed. Stops at `limit` entries.
 */
export function structuralDiff(before: unknown, after: unknown, limit = 300): DiffEntry[] {
  const out: DiffEntry[] = [];

  function walk(a: unknown, b: unknown, path: string): void {
    if (out.length >= limit) return;
    if (isBlank(a) && isBlank(b)) return;
    // Publishing fills defaults (`min_select: 0`, `any: []`); a field missing on one side and a zero
    // default on the other is the same document.
    if ((a === undefined && b === 0) || (b === undefined && a === 0)) return;
    if (isBlank(a)) {
      out.push({ path, kind: "added", after: b });
      return;
    }
    if (isBlank(b)) {
      out.push({ path, kind: "removed", before: a });
      return;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      const keyed = a.every((item) => idOf(item)) && b.every((item) => idOf(item));
      if (keyed) {
        const left = new Map(a.map((item) => [idOf(item)!, item]));
        const right = new Map(b.map((item) => [idOf(item)!, item]));
        for (const [id, item] of left) walk(item, right.get(id), `${path}/${id}`);
        for (const [id, item] of right) if (!left.has(id)) walk(undefined, item, `${path}/${id}`);
        const order = (list: unknown[]) => list.map(idOf).filter((id) => left.has(id!) && right.has(id!)).join("|");
        if (order(a) !== order(b) && out.length < limit) out.push({ path, kind: "changed", before: "order", after: "order" });
        return;
      }
      // Same length: compare item by item so default-filled objects (guards, conditions) do not differ.
      if (a.length === b.length) {
        a.forEach((item, index) => walk(item, b[index], `${path}/${index}`));
        return;
      }
      out.push({ path, kind: "changed", before: a, after: b });
      return;
    }
    if (a && b && typeof a === "object" && typeof b === "object") {
      const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
      for (const key of keys) {
        if (path === "" && IGNORED_KEYS.has(key)) continue;
        walk((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], `${path}/${key}`);
      }
      return;
    }
    if (a !== b) out.push({ path, kind: "changed", before: a, after: b });
  }

  walk(before, after, "");
  return out;
}

/** Short printable value for a diff row. */
export function preview(value: unknown, max = 160): string {
  if (value === undefined) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
