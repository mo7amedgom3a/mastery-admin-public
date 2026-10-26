import { createReactBlockSpec } from "@blocknote/react";
import { useState } from "react";
import { ImageIcon, Images, Info, LayoutGrid, MessageCircleQuestion, Plus, Tags, Trash2, UserRound } from "lucide-react";

import { useT } from "@/lib/i18n";
import { isSafeUrl, parseGallery, parseTags } from "@/features/learning/studio/model/document";
import { useStudioContext } from "@/features/learning/studio/editor/studio-context";

/*
 * Studio blocks beyond BlockNote's built-ins. Props are scalars (a BlockNote rule), so the gallery keeps its
 * images as a JSON string. Every block edits its props in place; the storefront renders the same types.
 */

const stop = { onKeyDown: (event: React.KeyboardEvent) => event.stopPropagation() };

export const bannerBlock = createReactBlockSpec(
  {
    type: "banner",
    propSchema: { url: { default: "" }, alt: { default: "" }, headline: { default: "" }, subheadline: { default: "" } },
    content: "none",
  },
  {
    render: function Banner({ block, editor }) {
      const t = useT();
      const studio = useStudioContext();
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
              const asset = await studio.pickAsset("image");
              if (asset) set({ url: asset.url, alt: asset.alt_text ?? alt });
            }}>
              <ImageIcon size={14} aria-hidden /> {url ? t("تغيير الصورة", "Change image") : t("اختر صورة", "Choose image")}
            </button>
            <input className="ma-sblock__input" placeholder={t("نص بديل للصورة", "Image alt text")} value={alt}
              onChange={(event) => set({ alt: event.target.value })} {...stop} />
          </div>
        </div>
      );
    },
  },
);

const TONES = ["info", "success", "warning"] as const;

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

export const instructorCardBlock = createReactBlockSpec(
  {
    type: "instructorCard",
    propSchema: { ref: { default: "" }, name: { default: "" }, avatarUrl: { default: "" }, bio: { default: "" } },
    content: "none",
  },
  {
    render: function InstructorCard({ block, editor }) {
      const t = useT();
      const { instructors } = useStudioContext();
      const { ref, name, avatarUrl, bio } = block.props;
      return (
        <div className="ma-sblock ma-sblock--instructor" contentEditable={false}>
          <span className="ma-sblock__avatar">
            {avatarUrl && isSafeUrl(avatarUrl) ? <img src={avatarUrl} alt="" /> : <UserRound size={20} aria-hidden />}
          </span>
          <div className="ma-sblock__stack">
            <select className="ma-sblock__input" value={ref} aria-label={t("المدرب", "Instructor")}
              onChange={(event) => {
                const picked = instructors.find((item) => item.ref === event.target.value);
                editor.updateBlock(block, {
                  props: { ref: picked?.ref ?? "", name: picked?.display_name ?? "", avatarUrl: picked?.avatar_url ?? "" },
                });
              }}>
              <option value="">{t("اختر من مدربي الصفحة…", "Pick one of the page's instructors…")}</option>
              {instructors.map((item) => (
                <option key={item.ref} value={item.ref}>{item.display_name}</option>
              ))}
            </select>
            {name ? <strong>{name}</strong> : null}
            <textarea className="ma-sblock__input" rows={2} placeholder={t("نبذة قصيرة (اختياري)", "Short bio (optional)")}
              value={bio} onChange={(event) => editor.updateBlock(block, { props: { bio: event.target.value } })} {...stop} />
          </div>
        </div>
      );
    },
  },
);

export const assetGalleryBlock = createReactBlockSpec(
  {
    type: "assetGallery",
    propSchema: { items: { default: "[]" } },
    content: "none",
  },
  {
    render: function AssetGallery({ block, editor }) {
      const t = useT();
      const studio = useStudioContext();
      const items = parseGallery(block.props.items);
      const save = (next: typeof items) => editor.updateBlock(block, { props: { items: JSON.stringify(next) } });
      return (
        <div className="ma-sblock ma-sblock--gallery" contentEditable={false}>
          <div className="ma-sblock__grid">
            {items.map((item, index) => (
              <figure key={`${item.url}-${index}`} className="ma-sblock__tile">
                <img src={item.url} alt={item.alt} />
                <button type="button" className="ma-sblock__remove" aria-label={t("إزالة", "Remove")}
                  onClick={() => save(items.filter((_, i) => i !== index))}>
                  <Trash2 size={14} aria-hidden />
                </button>
              </figure>
            ))}
            <button type="button" className="ma-sblock__tile ma-sblock__add" onClick={async () => {
              const asset = await studio.pickAsset("image");
              if (asset) save([...items, { url: asset.url, alt: asset.alt_text ?? "" }]);
            }}>
              {items.length ? <Plus size={20} aria-hidden /> : <Images size={20} aria-hidden />}
              <span>{t("أضف صورة", "Add image")}</span>
            </button>
          </div>
        </div>
      );
    },
  },
);

function parseProgramSlugs(raw: string): string[] {
  try {
    const items = JSON.parse(raw || "[]") as unknown;
    return Array.isArray(items) ? items.flatMap((item) => (typeof item?.slug === "string" ? [item.slug as string] : [])) : [];
  } catch {
    return [];
  }
}

/** Featured programs: a row of cards for products of the page (the expert's own items), picked by slug. */
export const programCardsBlock = createReactBlockSpec(
  {
    type: "programCards",
    propSchema: { items: { default: "[]" } },
    content: "none",
  },
  {
    render: function ProgramCards({ block, editor }) {
      const t = useT();
      const { programs = [] } = useStudioContext();
      const slugs = parseProgramSlugs(block.props.items);
      const save = (next: string[]) => editor.updateBlock(block, { props: { items: JSON.stringify(next.map((slug) => ({ slug }))) } });
      const remaining = programs.filter((program) => !slugs.includes(program.slug));
      return (
        <div className="ma-sblock ma-sblock--gallery" contentEditable={false}>
          <strong style={{ display: "flex", alignItems: "center", gap: "6px", marginBlockEnd: "var(--space-2)" }}>
            <LayoutGrid size={16} aria-hidden /> {t("بطاقات البرامج", "Program cards")}
          </strong>
          <div className="ma-sblock__grid">
            {slugs.map((slug) => {
              const program = programs.find((item) => item.slug === slug);
              return (
                <figure key={slug} className="ma-sblock__tile" title={program?.title ?? slug}>
                  {program?.image && isSafeUrl(program.image) ? <img src={program.image} alt="" /> : null}
                  <figcaption style={{ position: "absolute", insetInline: 0, bottom: 0, padding: "4px 6px", fontSize: "11px", background: "var(--surface)" }}>
                    {program?.title ?? t(`غير متاح: ${slug}`, `Unavailable: ${slug}`)}
                  </figcaption>
                  <button type="button" className="ma-sblock__remove" aria-label={t("إزالة", "Remove")}
                    onClick={() => save(slugs.filter((item) => item !== slug))}>
                    <Trash2 size={14} aria-hidden />
                  </button>
                </figure>
              );
            })}
          </div>
          {remaining.length ? (
            <select className="ma-sblock__input" value="" aria-label={t("أضف برنامجاً", "Add a program")}
              onChange={(event) => event.target.value && save([...slugs, event.target.value])}>
              <option value="">{t("+ أضف برنامجاً من برامج المدرّب…", "+ Add one of the expert's programs…")}</option>
              {remaining.map((program) => (
                <option key={program.slug} value={program.slug}>{program.title}</option>
              ))}
            </select>
          ) : slugs.length === 0 ? (
            <span className="ma-studio__hint" style={{ margin: 0 }}>{t("لا توجد برامج منشورة لهذا المدرّب.", "This expert has no published programs.")}</span>
          ) : null}
        </div>
      );
    },
  },
);

const TAG_TONES = ["soft", "yellow"] as const;

/** A row of chips (an expert's fields or skills); `items` is a JSON array of labels, `label` names the list. */
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
      const tags = parseTags(block.props.items);
      const save = (next: string[]) => editor.updateBlock(block, { props: { items: JSON.stringify(next) } });
      const add = (value: string) => {
        const clean = value.trim();
        setDraft("");
        if (clean && !tags.some((tag) => tag.toLowerCase() === clean.toLowerCase())) save([...tags, clean]);
      };
      const next = TAG_TONES[(TAG_TONES.indexOf(block.props.tone) + 1) % TAG_TONES.length];
      return (
        <div className="ma-sblock ma-sblock--gallery" contentEditable={false}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBlockEnd: "var(--space-2)" }}>
            <button type="button" className="ma-sblock__tone" title={t("تغيير اللون", "Change tone")}
              onClick={() => editor.updateBlock(block, { props: { tone: next } })}>
              <Tags size={16} aria-hidden />
            </button>
            <input className="ma-sblock__input" placeholder={t("اسم القائمة (مثل: المجالات)", "List name (e.g. Fields)")}
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
