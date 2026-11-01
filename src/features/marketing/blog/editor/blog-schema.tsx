import {
  BlockNoteSchema,
  createHeadingBlockSpec,
  defaultBlockSpecs,
  insertOrUpdateBlockForSlashMenu,
} from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import type { DefaultReactSuggestionItem } from "@blocknote/react";
import { BarChart3, FileCode, ImageIcon, Info, LayoutPanelTop, ListChecks, ListTree, MessageCircleQuestion, Tags } from "lucide-react";
import { useState } from "react";

import { useT } from "@/lib/i18n";
import { isSafeUrl } from "@/features/marketing/blog/model/document";
import { useBlogEditorContext } from "@/features/marketing/blog/editor/blog-context";

/*
 * The blog's block set: BlockNote built-ins the storefront renders (no audio, code, toggle, check list or file
 * blocks; headings 1–3 only) plus the blog blocks. Keep in sync with the backend whitelist and
 * `model/document.ts`. `lead` is content-less on the backend and is rendered as a paragraph instead.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { audio: _audio, codeBlock: _code, toggleListItem: _toggle, checkListItem: _check, file: _file, heading: _heading, ...builtIns } =
  defaultBlockSpecs;

const stop = { onKeyDown: (event: React.KeyboardEvent) => event.stopPropagation() };

function parseStrings(raw: unknown): string[] {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const items = JSON.parse(raw) as unknown;
    return Array.isArray(items) ? items.filter((item): item is string => typeof item === "string" && item.trim() !== "") : [];
  } catch {
    return [];
  }
}

function parseStats(raw: unknown): { value: string; label: string }[] {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const items = JSON.parse(raw) as unknown;
    return Array.isArray(items)
      ? items.flatMap((item) => {
          const stat = item as { value?: unknown; label?: unknown };
          return typeof stat?.value === "string" && typeof stat?.label === "string"
            ? [{ value: stat.value, label: stat.label }]
            : [];
        })
      : [];
  } catch {
    return [];
  }
}

/** `value | label` per line, the compact text form the stats editor shows. */
function statsText(raw: unknown): string {
  return parseStats(raw).map((stat) => `${stat.value} | ${stat.label}`).join("\n");
}

function textStats(text: string): string {
  const items = text
    .split("\n")
    .map((line) => line.split("|"))
    .filter((parts) => parts.length >= 2)
    .map((parts) => ({ value: parts[0].trim(), label: parts.slice(1).join("|").trim() }))
    .filter((stat) => stat.value && stat.label);
  return JSON.stringify(items);
}

/** A wide banner image with an overlaid headline, picked from the post's assets. */
export const bannerBlock = createReactBlockSpec(
  {
    type: "banner",
    propSchema: { url: { default: "" }, alt: { default: "" }, headline: { default: "" }, subheadline: { default: "" } },
    content: "none",
  },
  {
    render: function Banner({ block, editor }) {
      const t = useT();
      const blog = useBlogEditorContext();
      const { url, alt, headline, subheadline } = block.props;
      const set = (props: Partial<typeof block.props>) => editor.updateBlock(block, { props });
      return (
        <div className="ma-sblock ma-sblock--banner" contentEditable={false}>
          <div className="ma-sblock__media" style={url && isSafeUrl(url) ? { backgroundImage: `url("${url}")` } : undefined}>
            {!url ? <ImageIcon aria-hidden size={28} /> : null}
            <div className="ma-sblock__overlay">
              <input className="ma-sblock__headline" placeholder={t("عنوان البانر", "Banner headline")} value={headline}
                onChange={(event) => set({ headline: event.target.value })} {...stop} />
              <input className="ma-sblock__sub" placeholder={t("سطر فرعي (اختياري)", "Subheadline (optional)")}
                value={subheadline} onChange={(event) => set({ subheadline: event.target.value })} {...stop} />
            </div>
          </div>
          <div className="ma-sblock__bar">
            <button type="button" className="ma-sblock__btn" onClick={async () => {
              const asset = await blog?.pickAsset("image");
              if (asset) set({ url: asset.url, alt: asset.alt_text ?? alt });
            }}>
              <ImageIcon size={14} aria-hidden /> {url ? t("تغيير الصورة", "Change image") : t("اختر صورة", "Choose image")}
            </button>
            <input className="ma-sblock__input" placeholder={t("رابط الصورة (أو اختر من الوسائط)", "Image URL (or pick from assets)")}
              value={url} onChange={(event) => set({ url: event.target.value })} {...stop} />
            <input className="ma-sblock__input" placeholder={t("نص بديل للصورة", "Image alt text")} value={alt}
              onChange={(event) => set({ alt: event.target.value })} {...stop} />
          </div>
        </div>
      );
    },
  },
);

const TONES = ["info", "success", "warning"] as const;

/** A highlighted note (info / success / warning) with inline answer text. */
export const calloutBlock = createReactBlockSpec(
  {
    type: "callout",
    propSchema: { tone: { default: "info", values: TONES } },
    content: "inline",
  },
  {
    render: function Callout({ block, editor, contentRef }) {
      const t = useT();
      const next = TONES[(TONES.indexOf(block.props.tone) + 1) % TONES.length];
      return (
        <div className={`ma-sblock ma-sblock--callout is-${block.props.tone}`}>
          <button type="button" contentEditable={false} className="ma-sblock__tone" title={t("تغيير اللون", "Change tone")}
            onClick={() => editor.updateBlock(block, { props: { tone: next } })}>
            <Info size={16} aria-hidden />
          </button>
          <div className="ma-sblock__inline" ref={contentRef} />
        </div>
      );
    },
  },
);

/** A question with its (inline) answer. */
export const faqBlock = createReactBlockSpec(
  {
    type: "faq",
    propSchema: { question: { default: "" } },
    content: "inline",
  },
  {
    render: function Faq({ block, editor, contentRef }) {
      const t = useT();
      return (
        <div className="ma-sblock ma-sblock--faq">
          <div className="ma-sblock__q" contentEditable={false}>
            <MessageCircleQuestion size={16} aria-hidden />
            <input className="ma-sblock__question" placeholder={t("السؤال", "Question")} value={block.props.question}
              onChange={(event) => editor.updateBlock(block, { props: { question: event.target.value } })} {...stop} />
          </div>
          <div className="ma-sblock__inline ma-sblock__answer" ref={contentRef} />
        </div>
      );
    },
  },
);

const TAG_TONES = ["soft", "yellow"] as const;

/** A row of chips (topics, fields); `items` is a JSON array of labels, `label` names the list. */
export const tagsBlock = createReactBlockSpec(
  {
    type: "tags",
    propSchema: { items: { default: "[]" }, tone: { default: "soft", values: TAG_TONES }, label: { default: "" } },
    content: "none",
  },
  {
    render: function TagsBlock({ block, editor }) {
      const t = useT();
      const [draft, setDraft] = useState("");
      const tags = parseStrings(block.props.items);
      const save = (next: string[]) => editor.updateBlock(block, { props: { items: JSON.stringify(next) } });
      const add = (value: string) => {
        const clean = value.trim();
        setDraft("");
        if (clean && !tags.some((tag) => tag.toLowerCase() === clean.toLowerCase())) save([...tags, clean]);
      };
      const next = TAG_TONES[(TAG_TONES.indexOf(block.props.tone) + 1) % TAG_TONES.length];
      return (
        <div className="ma-bblock ma-bblock--tags" contentEditable={false}>
          <div className="ma-bblock__bar">
            <button type="button" className="ma-sblock__tone" title={t("تغيير اللون", "Change tone")}
              onClick={() => editor.updateBlock(block, { props: { tone: next } })}>
              <Tags size={16} aria-hidden />
            </button>
            <input className="ma-sblock__input" placeholder={t("اسم القائمة (مثل: المواضيع)", "List name (e.g. Topics)")}
              value={block.props.label} onChange={(event) => editor.updateBlock(block, { props: { label: event.target.value } })} {...stop} />
          </div>
          <div className="ma-taginput">
            {tags.map((tag) => (
              <span key={tag} className={`ma-tag ma-tag--${block.props.tone}`}>
                {tag}
                <button type="button" aria-label={t(`إزالة ${tag}`, `Remove ${tag}`)} onClick={() => save(tags.filter((item) => item !== tag))}>
                  ×
                </button>
              </span>
            ))}
            <input className="ma-input ma-taginput__input" value={draft} placeholder={t("اكتب ثم Enter…", "Type then Enter…")}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter" || event.key === "," || event.key === "،") {
                  event.preventDefault();
                  add(draft);
                } else if (event.key === "Backspace" && !draft && tags.length) {
                  save(tags.slice(0, -1));
                }
              }}
              onBlur={() => add(draft)} />
          </div>
        </div>
      );
    },
  },
);

/** The article's key takeaways: one item per line in the editor, a JSON array in props. */
export const takeawaysBlock = createReactBlockSpec(
  {
    type: "takeaways",
    propSchema: { items: { default: "[]" } },
    content: "none",
  },
  {
    render: function Takeaways({ block, editor }) {
      const t = useT();
      const items = parseStrings(block.props.items);
      return (
        <div className="ma-bblock ma-bblock--takeaways" contentEditable={false}>
          <strong className="ma-bblock__title">
            <ListChecks size={16} aria-hidden /> {t("أهم النقاط", "Key takeaways")}
          </strong>
          <textarea className="ma-input ma-textarea ma-bblock__textarea" rows={Math.max(3, items.length + 1)}
            placeholder={t("نقطة في كل سطر…", "One takeaway per line…")}
            value={items.join("\n")}
            onChange={(event) =>
              editor.updateBlock(block, {
                props: { items: JSON.stringify(event.target.value.split("\n").map((item) => item.trim()).filter(Boolean)) },
              })
            }
            {...stop} />
        </div>
      );
    },
  },
);

/** A small stat band: `value | label` per line in the editor, `{value, label}` objects in props. */
export const statsBlock = createReactBlockSpec(
  {
    type: "stats",
    propSchema: { items: { default: "[]" } },
    content: "none",
  },
  {
    render: function Stats({ block, editor }) {
      const t = useT();
      const items = parseStats(block.props.items);
      return (
        <div className="ma-bblock ma-bblock--stats" contentEditable={false}>
          <strong className="ma-bblock__title">
            <BarChart3 size={16} aria-hidden /> {t("أرقام سريعة", "Key stats")}
          </strong>
          {items.length ? (
            <div className="ma-bblock__statgrid">
              {items.map((stat, index) => (
                <span key={`${stat.value}-${index}`} className="ma-bblock__stat">
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </span>
              ))}
            </div>
          ) : null}
          <textarea className="ma-input ma-textarea ma-bblock__textarea" rows={Math.max(2, items.length + 1)}
            placeholder={t("القيمة | الوصف، سطر لكل رقم…", "Value | label, one per line…")}
            value={statsText(block.props.items)}
            onChange={(event) => editor.updateBlock(block, { props: { items: textStats(event.target.value) } })}
            {...stop} />
        </div>
      );
    },
  },
);

function parseTocEntries(raw: unknown): { label: string; href: string }[] {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const items = JSON.parse(raw) as unknown;
    return Array.isArray(items)
      ? items.flatMap((item) => {
          const entry = item as { label?: unknown; href?: unknown };
          return typeof entry?.label === "string" && typeof entry?.href === "string"
            ? [{ label: entry.label, href: entry.href }]
            : [];
        })
      : [];
  } catch {
    return [];
  }
}

function inlineText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  let text = "";
  for (const item of content as { type?: string; text?: string; content?: unknown }[]) {
    if (item?.type === "text") text += item.text ?? "";
    else if (item?.type === "link") text += inlineText(item.content);
  }
  return text;
}

/** The level-1/2 headings of the draft as contents links (`#h-<block id>`, the storefront's anchor). */
function headingLinks(editor: { document: unknown }): { label: string; href: string }[] {
  const links: { label: string; href: string }[] = [];
  const visit = (blocks: readonly { type?: string; props?: Record<string, unknown>; content?: unknown; children?: readonly unknown[]; id?: string }[]) => {
    for (const block of blocks) {
      if (block.type === "heading" && Number(block.props?.level ?? 1) <= 2) {
        const label = inlineText(block.content).trim();
        const id = typeof block.id === "string" ? block.id.trim() : "";
        if (label && /^[A-Za-z0-9_-]{1,80}$/.test(id)) links.push({ label, href: `#h-${id}` });
      }
      if (block.children?.length) {
        visit(block.children as readonly { type?: string; props?: Record<string, unknown>; content?: unknown; children?: readonly unknown[]; id?: string }[]);
      }
    }
  };
  visit(editor.document as { type?: string; props?: Record<string, unknown>; content?: unknown; children?: readonly unknown[]; id?: string }[]);
  return links;
}

/** المحتويات: the admin's own contents links (label + anchor), imported from the draft's headings or written by hand. */
export const tocBlock = createReactBlockSpec(
  {
    type: "toc",
    propSchema: {
      title: { default: "المحتويات" },
      items: { default: "[]" },
    },
    content: "none",
  },
  {
    render: function Toc({ block, editor }) {
      const t = useT();
      const items = parseTocEntries(block.props.items);
      const save = (next: { label: string; href: string }[]) =>
        editor.updateBlock(block, { props: { items: JSON.stringify(next) } });
      return (
        <div className="ma-bblock ma-bblock--toc" contentEditable={false}>
          <strong className="ma-bblock__title">
            <ListTree size={16} aria-hidden /> {t("المحتويات", "Table of contents")}
          </strong>
          <input
            className="ma-input"
            value={block.props.title}
            placeholder={t("عنوان القسم (المحتويات)", "Section title (Contents)")}
            aria-label={t("عنوان المحتويات", "Contents title")}
            onChange={(event) => editor.updateBlock(block, { props: { title: event.target.value } })}
            {...stop}
          />
          {items.length > 0 ? (
            <ol className="ma-bblock__toc">
              {items.map((item, index) => {
                const headings = headingLinks(editor);
                const linked = headings.find((heading) => heading.href === item.href);
                return (
                  <li key={`${item.href}-${index}`}>
                    <input
                      className="ma-input"
                      value={item.label}
                      placeholder={t("اسم القسم", "Section label")}
                      aria-label={t("اسم القسم", "Section label")}
                      onChange={(event) =>
                        save(items.map((entry, position) => (position === index ? { ...entry, label: event.target.value } : entry)))
                      }
                      {...stop}
                    />
                    <select
                      className="ma-input ma-select"
                      value={linked ? item.href : "__custom__"}
                      aria-label={t("القسم المرتبط", "Linked section")}
                      title={t("اختر القسم الذي ينتقل إليه الرابط", "Pick the section this link opens")}
                      onChange={(event) => {
                        const href = event.target.value;
                        if (href === "__custom__") return;
                        const heading = headings.find((entry) => entry.href === href);
                        // Picking a section renames the row to it; the label stays editable afterwards.
                        save(items.map((entry, position) =>
                          position === index ? { label: heading?.label || entry.label, href } : entry,
                        ));
                      }}
                      {...stop}
                    >
                      <option value="__custom__">{t("رابط مخصص…", "Custom link…")}</option>
                      {headings.map((heading) => (
                        <option key={heading.href} value={heading.href}>
                          {heading.label}
                        </option>
                      ))}
                    </select>
                    {linked ? null : (
                      <input
                        className="ma-input"
                        dir="ltr"
                        value={item.href}
                        placeholder="#h-…"
                        aria-label={t("رابط القسم", "Section link")}
                        onChange={(event) =>
                          save(items.map((entry, position) => (position === index ? { ...entry, href: event.target.value } : entry)))
                        }
                        {...stop}
                      />
                    )}
                    <button
                      type="button"
                      className="ma-bblock__remove"
                      aria-label={t("حذف الرابط", "Remove link")}
                      onClick={() => save(items.filter((_, position) => position !== index))}
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="ma-bblock__hint">
              {t(
                "أضف رابطاً ثم اختر القسم من القائمة — سيُولّد رابط #h-… تلقائياً. أو استورد كل العناوين دفعة واحدة.",
                "Add a link and pick its section from the list — the #h-… anchor is filled for you. Or import every heading at once.",
              )}
            </p>
          )}
          <div className="ma-bblock__bar">
            <button type="button" className="ma-btn ma-btn--ghost ma-btn--sm" onClick={() => save(headingLinks(editor))}>
              {t("استيراد العناوين", "Import headings")}
            </button>
            <button type="button" className="ma-btn ma-btn--ghost ma-btn--sm" onClick={() => save([...items, { label: "", href: "" }])}>
              {t("إضافة رابط", "Add link")}
            </button>
          </div>
        </div>
      );
    },
  },
);

export const blogSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...builtIns,
    heading: createHeadingBlockSpec({ levels: [1, 2, 3], allowToggleHeadings: false }),
    banner: bannerBlock(),
    callout: calloutBlock(),
    faq: faqBlock(),
    tags: tagsBlock(),
    takeaways: takeawaysBlock(),
    stats: statsBlock(),
    toc: tocBlock(),
  },
});

export type BlogEditor = typeof blogSchema.BlockNoteEditor;
export type BlogEditorBlock = typeof blogSchema.Block;
export type BlogPartialBlock = typeof blogSchema.PartialBlock;

type T = (ar: string, en?: string) => string;

/** Slash-menu entries of the blog blocks, plus the README/Markdown importer. */
export function blogSlashItems(editor: BlogEditor, t: T, onOpenReadme?: () => void): DefaultReactSuggestionItem[] {
  const group = t("مقال المدونة", "Blog post");
  return [
    {
      title: t("استيراد README / Markdown", "Import README / Markdown"),
      subtext: t("بناء المقال من نص Markdown جاهز", "Build the article from Markdown text"),
      group,
      aliases: ["readme", "markdown", "md", "استيراد", "ماركداون"],
      icon: <FileCode size={18} />,
      onItemClick: () => onOpenReadme?.(),
    },
    {
      title: t("بانر", "Banner"), subtext: t("صورة عريضة مع عنوان", "Wide image with a headline"), group,
      aliases: ["banner", "hero", "cover", "بانر"], icon: <LayoutPanelTop size={18} />,
      onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: "banner" }),
    },
    {
      title: t("تنبيه", "Callout"), subtext: t("ملاحظة بارزة", "Highlighted note"), group,
      aliases: ["callout", "note", "tip", "تنبيه"], icon: <Info size={18} />,
      onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: "callout" }),
    },
    {
      title: t("سؤال شائع", "FAQ"), subtext: t("سؤال وجوابه", "A question and its answer"), group,
      aliases: ["faq", "question", "سؤال"], icon: <MessageCircleQuestion size={18} />,
      onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: "faq" }),
    },
    {
      title: t("وسوم", "Tags"), subtext: t("صف من الوسوم مثل المواضيع", "A row of chips, like topics"), group,
      aliases: ["tags", "chips", "topics", "وسوم", "مواضيع"], icon: <Tags size={18} />,
      onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: "tags" }),
    },
    {
      title: t("أهم النقاط", "Key takeaways"), subtext: t("ملخص نقاط المقال", "A summary of the article's points"), group,
      aliases: ["takeaways", "summary", "نقاط", "ملخص"], icon: <ListChecks size={18} />,
      onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: "takeaways" }),
    },
    {
      title: t("أرقام سريعة", "Key stats"), subtext: t("أرقام بارزة مع وصف", "Headline numbers with labels"), group,
      aliases: ["stats", "numbers", "أرقام", "إحصاءات"], icon: <BarChart3 size={18} />,
      onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: "stats" }),
    },
    {
      title: t("المحتويات", "Table of contents"), subtext: t("روابط أقسام المقال", "Links to the article's sections"), group,
      aliases: ["toc", "contents", "index", "محتويات", "فهرس"], icon: <ListTree size={18} />,
      onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: "toc" }),
    },
  ];
}
