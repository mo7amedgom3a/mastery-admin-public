import type { BlogBlock, BlogDocument, BlogDocumentMeta, BlogPostDetail } from "@/lib/api";

import type { BlogPartialBlock } from "@/features/marketing/blog/editor/blog-schema";

/*
 * The blog post document (schema version 1): `meta` plus BlockNote `blocks`. The backend validates the same
 * whitelist (`app/modules/blog/domain/document.py`); this mirror catches mistakes before a save. Block types
 * BlockNote owns (audio, code, toggle, check list, file) and the backend's content-less `lead` are not part of the
 * blog editor, so they are normalised away instead of blanking the page.
 */

export const SCHEMA_VERSION = 1;

/** BlockNote built-ins the storefront renders plus the blog blocks (exactly the backend whitelist minus `lead`). */
export const BLOG_BLOCK_TYPES = [
  "heading",
  "paragraph",
  "bulletListItem",
  "numberedListItem",
  "quote",
  "image",
  "video",
  "divider",
  "table",
  "banner",
  "callout",
  "faq",
  "tags",
  "takeaways",
  "stats",
  "toc",
] as const;

export type BlogBlockType = (typeof BLOG_BLOCK_TYPES)[number];

/** Blocks whose data lives in props and which must not carry `content` (BlockNote throws otherwise). */
const CONTENTLESS = new Set<string>(["banner", "tags", "takeaways", "stats", "toc", "divider", "image", "video", "lead"]);

/** Props holding a URL: `https:`/`http:` or a site-relative path only. */
const URL_PROPS = new Set(["url", "avatarUrl", "href", "previewUrl"]);
const TEXT_STYLES = new Set(["bold", "italic", "underline", "strike", "code", "textColor", "backgroundColor"]);
const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 100;
const MAX_LIST_ITEMS = 60;
const MAX_TOC_ITEMS = 100;
const MAX_DEPTH = 4;

export function isSafeUrl(value: string): boolean {
  const url = value.trim();
  return (
    url === "" ||
    url.startsWith("https://") ||
    url.startsWith("http://") ||
    (url.startsWith("/") && !url.startsWith("//"))
  );
}

/** Plain text of BlockNote inline content. */
export function plainText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return (content as { type?: string; text?: string; content?: unknown }[])
    .map((item) => (item.type === "link" ? plainText(item.content) : (item.text ?? "")))
    .join("");
}

export function emptyMeta(title = "", summary = ""): BlogDocumentMeta {
  return { title, summary, cover: null, tags: [] };
}

export function toDocument(meta: BlogDocumentMeta, blocks: unknown[]): BlogDocument {
  return { schema_version: SCHEMA_VERSION, meta, blocks: blocks as BlogBlock[] };
}

/**
 * The editor document of a post loaded from the API. A never-saved post has `{}`: its title/summary/cover come
 * from the post columns so the editor does not open blank.
 */
export function documentOfPost(post: BlogPostDetail): BlogDocument {
  const stored = post.document ?? {};
  const meta = stored.meta;
  return {
    schema_version: SCHEMA_VERSION,
    meta: {
      title: meta?.title ?? post.title ?? "",
      summary: meta?.summary ?? post.summary ?? "",
      cover:
        meta?.cover ??
        (post.cover_image_url
          ? { url: post.cover_image_url, alt: post.cover_image_alt ?? "" }
          : null),
      tags: Array.isArray(meta?.tags) ? meta.tags : (post.tags ?? []),
    },
    blocks: Array.isArray(stored.blocks) ? (toEditorBlocks(stored.blocks) as BlogBlock[]) : [],
  };
}

/**
 * Makes API-stored blocks loadable: drops `content` from content-less blocks and empty `children`, and turns a
 * stored `lead` (content-less in the backend, not a blog editor block) into a plain paragraph.
 */
export function toEditorBlocks(blocks: unknown[]): BlogPartialBlock[] {
  const clean = (raw: unknown): BlogPartialBlock | null => {
    if (!raw || typeof raw !== "object") return null;
    const block = { ...(raw as Record<string, unknown>) };
    if (block.type === "lead") {
      block.type = "paragraph";
      block.props = {};
    }
    if (CONTENTLESS.has(String(block.type))) delete block.content;
    if (Array.isArray(block.children)) {
      const children = block.children
        .map(clean)
        .filter((child): child is BlogPartialBlock => child !== null);
      if (children.length > 0) block.children = children;
      else delete block.children;
    }
    return block as BlogPartialBlock;
  };
  return blocks.map(clean).filter((block): block is BlogPartialBlock => block !== null);
}

/**
 * Blocks parsed from Markdown, kept inside the blog's vocabulary: unknown types become paragraphs, headings are
 * clamped to 1–3 and content-less blocks lose their `content` (BlockNote's own rule).
 */
export function sanitizeParsedBlocks(blocks: unknown[]): BlogPartialBlock[] {
  if (!Array.isArray(blocks)) return [];
  const allowed = new Set<string>(BLOG_BLOCK_TYPES);
  const sanitize = (raw: unknown): BlogPartialBlock | null => {
    if (!raw || typeof raw !== "object") return null;
    const block = { ...(raw as Record<string, unknown>) };
    let type = String(block.type ?? "paragraph");
    if (!allowed.has(type)) {
      // Code, audio, check list, file…: keep the text, drop the block-specific props.
      type = type === "checkListItem" ? "bulletListItem" : "paragraph";
      block.props = {};
    }
    if (type === "heading") {
      const level = Number((block.props as { level?: unknown } | undefined)?.level ?? 1);
      block.props = { ...(block.props as Record<string, unknown>), level: Math.min(3, Math.max(1, level)) };
    }
    if (CONTENTLESS.has(type)) delete block.content;
    if (Array.isArray(block.children)) {
      const children = block.children.map(sanitize).filter((child): child is BlogPartialBlock => child !== null);
      if (children.length) block.children = children;
      else delete block.children;
    } else {
      delete block.children;
    }
    block.type = type;
    return block as BlogPartialBlock;
  };
  return blocks.map(sanitize).filter((block): block is BlogPartialBlock => block !== null);
}

function jsonList(raw: unknown): unknown[] | null {
  if (raw === undefined || raw === null || raw === "") return [];
  if (typeof raw !== "string") return null;
  try {
    const items = JSON.parse(raw) as unknown;
    return Array.isArray(items) ? items : null;
  } catch {
    return null;
  }
}

function inlineProblem(content: unknown): string | null {
  if (!Array.isArray(content)) return "Inline content must be a list";
  for (const item of content as { type?: string; text?: unknown; styles?: unknown; href?: unknown }[]) {
    if (!item || typeof item !== "object") return "Inline content must be objects";
    if (item.type === "text") {
      if (typeof item.text !== "string") return "Text content must be a string";
      const styles = (item.styles ?? {}) as Record<string, unknown>;
      for (const key of Object.keys(styles)) {
        if (!TEXT_STYLES.has(key)) return `Unsupported text style: ${key}`;
      }
    } else if (item.type === "link") {
      if (typeof item.href !== "string" || !item.href.trim() || !isSafeUrl(item.href)) {
        return "Links must be https or site-relative URLs";
      }
      const nested = inlineProblem((item as { content?: unknown }).content ?? []);
      if (nested) return nested;
    } else {
      return "Unsupported inline content";
    }
  }
  return null;
}

function blockProblem(raw: unknown, depth: number): string | null {
  if (!raw || typeof raw !== "object") return "A block must be an object";
  if (depth > MAX_DEPTH) return "Blocks nest at most 4 levels deep";
  const block = raw as BlogBlock;
  const type = block.type;
  if (!BLOG_BLOCK_TYPES.includes(type as BlogBlockType)) return `Unsupported block type: ${type}`;
  const props = (block.props ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined) continue;
    if (!["string", "number", "boolean"].includes(typeof value)) {
      return `Block prop ${key} must be a string, number or boolean`;
    }
    if (typeof value === "string" && URL_PROPS.has(key) && !isSafeUrl(value)) {
      return `Block prop ${key} must be an https or site-relative URL`;
    }
  }
  if (type === "heading" && ![1, 2, 3].includes(Number(props.level ?? 1))) {
    return "Headings are level 1, 2 or 3";
  }
  if (type === "callout" && !["info", "success", "warning"].includes(String(props.tone ?? "info"))) {
    return "Callout tones are info, success or warning";
  }
  if (type === "faq" && (typeof props.question !== "string" || !props.question.trim())) {
    return "A FAQ block needs a question";
  }
  if (type === "tags") {
    const items = jsonList(props.items);
    if (!items) return "Tags must be a JSON array";
    if (items.length > MAX_TAGS) return `Tags are at most ${MAX_TAGS} items`;
    for (const item of items) {
      if (typeof item !== "string" || !item.trim() || item.length > MAX_TAG_LENGTH) return "Each tag is a short string";
    }
    if (!["soft", "yellow"].includes(String(props.tone ?? "soft"))) return "Tag tones are soft or yellow";
  }
  if (type === "takeaways") {
    const items = jsonList(props.items);
    if (!items || !items.every((item) => typeof item === "string" && item.trim())) {
      return "Takeaways must be a JSON array of strings";
    }
  }
  if (type === "stats") {
    const items = jsonList(props.items);
    if (!items || items.length > MAX_LIST_ITEMS) return "Stats must be a JSON array";
    for (const item of items) {
      const stat = item as { value?: unknown; label?: unknown };
      if (typeof stat?.value !== "string" || !stat.value.trim() || typeof stat?.label !== "string") {
        return "Each stat needs a string value and label";
      }
    }
  }
  if (type === "toc") {
    if (props.title != null && (typeof props.title !== "string" || props.title.length > 200)) {
      return "The contents title is a string of at most 200 characters";
    }
    const items = jsonList(props.items);
    if (!items || items.length > MAX_TOC_ITEMS) return `Contents are at most ${MAX_TOC_ITEMS} links`;
    for (const item of items) {
      const entry = item as { label?: unknown; href?: unknown };
      if (typeof entry?.label !== "string" || !entry.label.trim() || typeof entry?.href !== "string") {
        return "Each contents link needs a label and a target";
      }
      const href = entry.href.trim();
      if (!href.startsWith("#") && !isSafeUrl(href)) {
        return "Contents links are #anchors or safe URLs";
      }
    }
  }
  if (CONTENTLESS.has(type)) {
    if (block.content != null && !(Array.isArray(block.content) && block.content.length === 0)) {
      return `A ${type} block holds no content; put its data in props`;
    }
  } else if (Array.isArray(block.content)) {
    const problem = inlineProblem(block.content);
    if (problem) return problem;
  } else if (block.content && typeof block.content === "object") {
    const table = block.content as { type?: string; rows?: unknown };
    if (table.type !== "tableContent" || !Array.isArray(table.rows)) return "Table content must have rows";
    for (const row of table.rows as { cells?: unknown[] }[]) {
      for (const cell of row?.cells ?? []) {
        const problem = inlineProblem(Array.isArray(cell) ? cell : (cell as { content?: unknown })?.content ?? []);
        if (problem) return problem;
      }
    }
  } else if (block.content != null) {
    return "Block content must be a list of inline content or a table";
  }
  if (block.children && Array.isArray(block.children)) {
    for (const child of block.children) {
      const problem = blockProblem(child, depth + 1);
      if (problem) return problem;
    }
  }
  return null;
}

/** First validation problem of a document, or null. */
export function documentProblem(document: BlogDocument): string | null {
  if (document.schema_version !== SCHEMA_VERSION) return `schema_version: expected ${SCHEMA_VERSION}`;
  const meta = document.meta;
  if (!meta || typeof meta.title !== "string" || meta.title.length > 500) return "meta.title is too long";
  if (typeof meta.summary !== "string" || meta.summary.length > 2000) return "meta.summary is too long";
  if (meta.cover) {
    if (!meta.cover.url.trim() || !isSafeUrl(meta.cover.url)) return "meta.cover.url must be https or site-relative";
  }
  if (!Array.isArray(meta.tags) || meta.tags.length > MAX_TAGS) return `meta.tags holds at most ${MAX_TAGS} items`;
  for (const tag of meta.tags) {
    if (typeof tag !== "string" || !tag.trim() || tag.length > MAX_TAG_LENGTH) return "meta.tags holds short strings";
  }
  if (!Array.isArray(document.blocks)) return "blocks must be a list";
  for (const block of document.blocks) {
    const problem = blockProblem(block, 1);
    if (problem) return problem;
  }
  return null;
}
