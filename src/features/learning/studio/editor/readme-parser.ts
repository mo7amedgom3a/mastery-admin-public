import { BlockNoteEditor } from "@blocknote/core";

import { studioSchema, type StudioEditor, type StudioPartialBlock } from "@/features/learning/studio/editor/schema";
import { STUDIO_BLOCK_TYPES, tagsFromParagraph } from "@/features/learning/studio/model/document";

export function sanitizeParsedBlocks(blocks: unknown[]): StudioPartialBlock[] {
  if (!Array.isArray(blocks)) return [];
  const allowedTypes = new Set(STUDIO_BLOCK_TYPES);

  function sanitizeBlock(b: any): any {
    if (!b || typeof b !== "object") return null;
    let type = b.type;
    let props = { ...(b.props || {}) };
    const content = b.content;
    const children = Array.isArray(b.children) ? b.children.map(sanitizeBlock).filter(Boolean) : undefined;

    if (type === "heading") {
      const lvl = Number(props.level ?? 1);
      props.level = Math.min(3, Math.max(1, lvl));
    } else if (type === "codeBlock" || !allowedTypes.has(type)) {
      // Not in the studio's block set (code, audio…): keep the text, drop the block-specific props.
      type = "paragraph";
      props = {};
    }

    return tagsFromParagraph({
      ...b,
      type,
      props,
      content,
      children,
    });
  }

  return blocks.map(sanitizeBlock).filter(Boolean) as StudioPartialBlock[];
}

/**
 * Markdown → studio blocks. The converter only needs a schema, so one headless editor (never mounted) is
 * reused: this is how the product README is imported into the studio editor on open.
 */
let markdownParser: StudioEditor | null = null;

export function markdownToStudioBlocks(markdown: string): StudioPartialBlock[] {
  if (!markdown.trim()) return [];
  markdownParser ??= BlockNoteEditor.create({ schema: studioSchema });
  return sanitizeParsedBlocks(markdownParser.tryParseMarkdownToBlocks(markdown));
}

export function extractSyllabusFromMarkdown(markdown: string) {
  const lines = markdown.split("\n");
  const units: { unitName: string; lessons: string[] }[] = [];
  let currentUnit: { unitName: string; lessons: string[] } | null = null;
  let title = "";
  let summary = "";
  let foundTitle = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("# ")) {
      title = line.replace(/^#\s+/, "").trim();
      foundTitle = true;
    } else if (foundTitle && !summary && !line.startsWith("#") && !line.startsWith("-") && !line.startsWith("*") && !line.startsWith(">")) {
      summary = line;
    } else if (line.startsWith("## ")) {
      const unitName = line.replace(/^##\s+/, "").trim();
      currentUnit = { unitName, lessons: [] };
      units.push(currentUnit);
    } else if (line.startsWith("### ")) {
      const lessonName = line.replace(/^###\s+/, "").trim();
      if (currentUnit) {
        currentUnit.lessons.push(lessonName);
      } else {
        currentUnit = { unitName: lessonName, lessons: [] };
        units.push(currentUnit);
      }
    } else if (line.startsWith("- ") || line.startsWith("* ") || /^\d+\.\s+/.test(line)) {
      const lessonName = line.replace(/^(-\s+|\*\s+|\d+\.\s+)/, "").trim();
      if (currentUnit && lessonName) {
        currentUnit.lessons.push(lessonName);
      }
    }
  }

  return { title, summary, units };
}
