import { z } from "zod";

import type { StudioDocument, StudioMeta } from "@/lib/api";

import type { StudioPartialBlock } from "@/features/learning/studio/editor/schema";

/*
 * The studio page document (schema version 1): `meta` plus BlockNote `blocks`. The backend validates the same
 * whitelist (`app/modules/catalog/domain/content_document.py`); this mirror catches mistakes before a save.
 */

export const SCHEMA_VERSION = 1;
export const STUDIO_BLOCK_TYPES = [
  "heading", "paragraph", "bulletListItem", "numberedListItem", "checkListItem", "quote",
  "image", "video", "file", "divider", "table",
  "banner", "instructorCard", "callout", "faq", "assetGallery", "programCards", "tags",
] as const;

export type StudioBlock = StudioDocument["blocks"] extends (infer B)[] | undefined ? B : never;

/** `https:` or a site-relative path (no `javascript:`, `data:` or protocol-relative URLs). */
export function isSafeUrl(value: string): boolean {
  const url = value.trim();
  return url === "" || url.startsWith("https://") || url.startsWith("http://") || (url.startsWith("/") && !url.startsWith("//"));
}

const safeUrl = z.string().max(2000).refine((value) => value.trim() !== "" && isSafeUrl(value), "https URL");
const image = z.object({ asset_id: z.string().nullish(), url: safeUrl, alt: z.string().max(500).default("") });

export const metaSchema = z.object({
  title: z.string().max(500).default(""),
  summary: z.string().max(5000).default(""),
  cover: image.nullish(),
  banner: image.extend({ headline: z.string().max(300).default("") }).nullish(),
  intro_video_id: z.string().max(100).nullish(),
  instructors: z
    .array(z.object({ ref: z.string().max(100), display_name: z.string().max(300), avatar_url: z.string().nullish() }))
    .max(50)
    .default([]),
});

const blockSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    id: z.string().optional(),
    type: z.enum(STUDIO_BLOCK_TYPES),
    props: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
    content: z.unknown().optional(),
    children: z.array(blockSchema).optional(),
  }),
);

export const documentSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  meta: metaSchema,
  blocks: z.array(blockSchema),
});

export function emptyMeta(): StudioMeta {
  return { title: "", summary: "", cover: null, banner: null, intro_video_id: null, instructors: [] };
}

export function toDocument(meta: StudioMeta, blocks: unknown[]): StudioDocument {
  return { schema_version: SCHEMA_VERSION, meta, blocks: blocks as StudioDocument["blocks"] };
}

/** First validation problem of a document, or null. */
export function documentProblem(document: StudioDocument): string | null {
  const result = documentSchema.safeParse(document);
  if (result.success) return null;
  const issue = result.error.issues[0];
  return `${issue.path.join(".") || "document"}: ${issue.message}`;
}

type InlineItem = { type?: string; text?: string; content?: unknown };

/** Plain text of BlockNote inline content. */
export function plainText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return (content as InlineItem[])
    .map((item) => (item.type === "link" ? plainText(item.content) : (item.text ?? "")))
    .join("");
}

export type OutlineItem = { id: string; title: string; level: number };

/** Headings of the page, in order: level 2 headings start the page sections. */
export function outlineOf(blocks: unknown[]): OutlineItem[] {
  const out: OutlineItem[] = [];
  for (const raw of blocks as { id?: string; type?: string; props?: { level?: number }; content?: unknown }[]) {
    if (raw.type !== "heading" || !raw.id) continue;
    out.push({ id: raw.id, title: plainText(raw.content).trim(), level: Number(raw.props?.level ?? 1) });
  }
  return out;
}

export type GalleryItem = { url: string; alt: string };

/**
 * Blocks whose data lives in props. BlockNote throws while building a document that gives them `content`,
 * which would blank the whole studio page, so anything loaded from the API is normalised first.
 */
const CONTENTLESS = new Set(["banner", "instructorCard", "assetGallery", "programCards", "tags", "divider", "image", "video", "file"]);

/** "المجالات: …" (fields, yellow) or "المهارات: …" (skills, soft): a list line pages wrote before the tags block. */
const TAG_LINE = /^\s*(المجالات|المهارات|الوسوم|fields|skills|tags)\s*[:：]\s*(.+)$/i;
const FIELD_LABELS = new Set(["المجالات", "fields"]);

/** A paragraph that is a "label: a، b، c" list becomes a `tags` block (same id); anything else is returned as is. */
export function tagsFromParagraph<B extends { id?: unknown; type?: unknown; content?: unknown; children?: unknown }>(block: B): B {
  if (block.type !== "paragraph" || (Array.isArray(block.children) && block.children.length > 0)) return block;
  const text = typeof block.content === "string" ? block.content : plainText(block.content);
  const match = TAG_LINE.exec(text);
  if (!match) return block;
  const items = [...new Set(match[2].split(/[،,؛;]/).map((item) => item.trim()).filter(Boolean))];
  if (!items.length) return block;
  const label = match[1];
  return {
    ...(block.id ? { id: block.id } : {}),
    type: "tags",
    props: { label, tone: FIELD_LABELS.has(label.toLowerCase()) ? "yellow" : "soft", items: JSON.stringify(items) },
  } as unknown as B;
}

/**
 * Makes API-stored blocks loadable: drops `content` from content-less blocks and empty `children`, and turns
 * "المجالات: …"/"المهارات: …" lines into `tags` blocks.
 */
export function toEditorBlocks(blocks: unknown[]): StudioPartialBlock[] {
  const clean = (raw: unknown): StudioPartialBlock | null => {
    if (!raw || typeof raw !== "object") return null;
    const block = tagsFromParagraph({ ...(raw as Record<string, unknown>) });
    if (CONTENTLESS.has(String(block.type))) delete block.content;
    if (Array.isArray(block.children)) {
      const children = block.children.map(clean).filter((child): child is StudioPartialBlock => child !== null);
      if (children.length > 0) block.children = children;
      else delete block.children;
    }
    return block as StudioPartialBlock;
  };
  return blocks.map(clean).filter((block): block is StudioPartialBlock => block !== null);
}

export function parseGallery(value: unknown): GalleryItem[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const items = JSON.parse(value) as unknown;
    return Array.isArray(items)
      ? items.filter((item): item is GalleryItem => typeof item?.url === "string" && isSafeUrl(item.url) && item.url !== "")
      : [];
  } catch {
    return [];
  }
}

/** `tags.items`: a JSON array of chip labels (blank ones dropped). */
export function parseTags(value: unknown): string[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const items = JSON.parse(value) as unknown;
    return Array.isArray(items) ? items.filter((item): item is string => typeof item === "string" && item.trim() !== "") : [];
  } catch {
    return [];
  }
}
