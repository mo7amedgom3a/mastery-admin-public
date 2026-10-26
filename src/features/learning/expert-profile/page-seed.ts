import type { ExpertCurrentPage } from "@/lib/api";
import { markdownToStudioBlocks } from "@/features/learning/studio/editor/readme-parser";
import type { StudioPartialBlock } from "@/features/learning/studio/editor/schema";

/*
 * A new expert Studio page, pre-filled with what the expert's page shows today, section by section and in the
 * storefront's order: about (the README, else the legacy bio converted), fields and skills, how they help, then a
 * program-cards row per kind of item they offer. Once published, the Studio page is the page body, so every
 * section the storefront showed is kept here for the admin to edit, reorder or remove.
 */

const GROUPS: [keyof ExpertCurrentPage, string][] = [
  ["consultations", "الاستشارات"],
  ["courses", "الدورات"],
  ["diplomas", "الدبلومات"],
  ["live_diplomas", "البرامج المباشرة"],
  ["packages", "الباقات"],
  ["bundles", "الحزم"],
];

const heading = (text: string, level: 2 | 3 = 2): StudioPartialBlock => ({ type: "heading", props: { level }, content: text });
/** The storefront's fields (yellow) and skills (soft) chips. */
const tags = (label: string, items: string[], tone: "yellow" | "soft"): StudioPartialBlock => ({
  type: "tags",
  props: { label, tone, items: JSON.stringify(items) },
});

/** The README's own headings sit one level under the section heading (`#`/`##` → `###`). */
function demoteHeadings(markdown: string): string {
  return markdown.replace(/^#{1,2}(?=\s)/gm, "###");
}

type SeedBlock = { id?: string; type?: string; props?: Record<string, unknown>; content?: unknown; children?: SeedBlock[] };

/**
 * The shape BlockNote documents have: every block with an id, text as inline content and a children list. The
 * preview renders the pre-filled page before the editor has produced its own document, so it must match.
 */
function normalize(block: SeedBlock): StudioPartialBlock {
  const content = typeof block.content === "string" ? [{ type: "text", text: block.content, styles: {} }] : block.content;
  return {
    ...block,
    id: block.id || crypto.randomUUID(),
    props: block.props ?? {},
    ...(content === undefined ? {} : { content }),
    children: (block.children ?? []).map(normalize),
  } as StudioPartialBlock;
}

export function pageSeed(page: ExpertCurrentPage): StudioPartialBlock[] {
  return buildSeed(page).map((block) => normalize(block as SeedBlock));
}

function buildSeed(page: ExpertCurrentPage): StudioPartialBlock[] {
  const name = page.expert.name.trim();
  const blocks: StudioPartialBlock[] = [];

  const about = page.expert.readme?.trim();
  if (about) blocks.push(heading(`نبذة عن ${name}`), ...markdownToStudioBlocks(demoteHeadings(about)));

  const fields = (page.categories ?? []).map((field) => field.trim()).filter(Boolean);
  const topics = [...new Set([...(page.skills ?? []), ...(page.tags ?? [])].map((topic) => topic.name.trim()).filter(Boolean))].slice(0, 16);
  if (fields.length || topics.length) {
    blocks.push(heading("المجالات والمهارات"));
    if (fields.length) blocks.push(tags("المجالات", fields, "yellow"));
    if (topics.length) blocks.push(tags("المهارات", topics, "soft"));
  }

  const whatTheyDo = page.highlights?.what_i_do ?? [];
  const whoTheyHelp = page.highlights?.who_i_help ?? [];
  if (whatTheyDo.length || whoTheyHelp.length) {
    blocks.push(heading(`كيف يساعدك ${name}`));
    if (whatTheyDo.length) {
      blocks.push(heading("ما الذي يقدّمه", 3), ...whatTheyDo.map((item): StudioPartialBlock => ({ type: "checkListItem", props: { checked: true }, content: item })));
    }
    if (whoTheyHelp.length) {
      blocks.push(heading("لمن يقدّم خبرته", 3), ...whoTheyHelp.map((item): StudioPartialBlock => ({ type: "bulletListItem", content: item })));
    }
  }

  for (const [kind, title] of GROUPS) {
    const cards = (page[kind] as { slug: string }[] | undefined) ?? [];
    if (!cards.length) continue;
    blocks.push(heading(title), {
      type: "programCards",
      props: { items: JSON.stringify(cards.slice(0, 24).map((card) => ({ slug: card.slug }))) },
    } as StudioPartialBlock);
  }
  return blocks;
}
