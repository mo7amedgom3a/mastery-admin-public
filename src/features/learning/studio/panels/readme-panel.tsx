import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { Alert } from "@/components/ui/kit";
import { putProductReadme, studioKeys, studioQueries } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { LiveElementDialog } from "@/features/learning/studio/readme/live-element-dialog";
import {
  ELEMENT_SPECS,
  LIVE_ELEMENT_KINDS,
  elementTemplate,
  findElements,
  removeElement,
  replaceElement,
  type FoundElement,
} from "@/features/learning/studio/readme/live-elements";

const TEMPLATE = `## المقدمة

نص تعريفي عن المنتج.

## المحاور الرئيسية

- المحور الأول
- المحور الثاني

## الأهداف

- الهدف الأول
- الهدف الثاني

## الفئة المستهدفة

- الفئة الأولى
`;

/**
 * Markdown README of the product (replaces the HTML "about" sections). Text edits stream to the live
 * preview through `onChange`; "Save" writes `b2c.product_readme`, which the storefront reads.
 *
 * A live diploma's README is its whole `/live/{slug}` page: it also gets the card elements (levels, training,
 * outcomes…): an insert bar adds one at the cursor, and each element in the text opens in a form editor.
 */
export function ReadmePanel({
  productRef,
  editable,
  onChange,
  kind,
}: {
  productRef: string;
  editable: boolean;
  onChange: (markdown: string) => void;
  /** Product type; `live_diploma` turns on the card elements. */
  kind?: string | null;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const query = useQuery(studioQueries.readme(productRef));
  const [text, setText] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const saved = query.data?.markdown ?? "";
  const value = text ?? saved;
  const live = kind === "live_diploma";
  const textarea = useRef<HTMLTextAreaElement>(null);
  const elements = useMemo(() => (live ? findElements(value) : []), [live, value]);
  const [editing, setEditing] = useState<FoundElement | null>(null);

  const update = (next: string) => {
    setText(next);
    setState("idle");
  };

  /** Inserts a new section with the element after the line the cursor is on (at the end when unfocused). */
  const insert = (template: string) => {
    const at = textarea.current && document.activeElement === textarea.current ? textarea.current.selectionEnd : value.length;
    const lineEnd = value.indexOf("\n", at);
    const cut = lineEnd < 0 ? value.length : lineEnd;
    const before = value.slice(0, cut).replace(/\s+$/, "");
    const after = value.slice(cut).replace(/^\s+/, "");
    update([before, template, after].filter(Boolean).join("\n\n") + "\n");
  };

  useEffect(() => {
    if (query.data) onChange(text ?? query.data.markdown);
  }, [query.data, text, onChange]);

  const save = async () => {
    setState("saving");
    setError(null);
    try {
      const result = await putProductReadme(productRef, value);
      queryClient.setQueryData(studioKeys.readme(productRef), result);
      setText(null);
      setState("saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  };

  if (query.isLoading) return <p role="status">{t("جارٍ التحميل…", "Loading…")}</p>;
  if (query.isError) return <Alert kind="warning" title={t("تعذّر تحميل README", "Couldn't load the README")}>{String(query.error)}</Alert>;

  const dirty = value !== saved;
  return (
    <div style={{ display: "grid", gap: "var(--space-3)" }}>
      {query.data?.source === "sections" ? (
        <Alert kind="info" title={t("مُولَّد من الأقسام القديمة", "Generated from the legacy sections")}>
          {t("لم يُحفظ README بعد؛ احفظه ليصبح مصدر محتوى الصفحة.", "No README is saved yet; save it to make it the page's content source.")}
        </Alert>
      ) : null}
      {query.data?.source === "consultation" ? (
        <Alert kind="info" title={t("مُولَّد من تفاصيل الاستشارة", "Generated from the consultation's details")}>
          {t(
            "لم يُحفظ README بعد: جمعنا الوصف وأقسام النظام القديم وبيانات الجلسة. عدّله ثم احفظه ليصبح محتوى الصفحة.",
            "No README is saved yet: we combined the description, the legacy sections and the session facts. Edit it, then save to make it the page's content.",
          )}
        </Alert>
      ) : null}
      {query.data?.source === "description" ? (
        <Alert kind="info" title={t("مُولَّد من وصف المنتج", "Generated from the product's description")}>
          {t(
            "لم يُحفظ README بعد: جمعنا وصف المنتج ومخرجات التعلم. عدّله ثم احفظه ليصبح محتوى الصفحة.",
            "No README is saved yet: we combined the product's description and learning outcomes. Edit it, then save to make it the page's content.",
          )}
        </Alert>
      ) : null}
      {query.data?.source === "live_marketing" ? (
        <Alert kind="info" title={t("محوَّل من صفحة الدبلوم الحالية", "Converted from the current diploma page")}>
          {t(
            "لم يُحفظ README بعد: حوّلنا أقسام الصفحة الحالية إلى Markdown بعناصر بطاقات. عدّله ثم احفظه ليصبح محتوى صفحة /live.",
            "No README is saved yet: we converted the current page sections to Markdown with card elements. Edit it, then save to make it the /live page's content.",
          )}
        </Alert>
      ) : null}
      {live && editable ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }} role="toolbar" aria-label={t("إدراج عنصر", "Insert element")}>
          <span className="ma-studio__hint" style={{ margin: 0 }}>{t("إدراج:", "Insert:")}</span>
          {LIVE_ELEMENT_KINDS.map((elementKind) => (
            <button
              key={elementKind}
              type="button"
              className="ma-btn ma-btn--sm"
              title={t(ELEMENT_SPECS[elementKind].hintAr, ELEMENT_SPECS[elementKind].hintEn)}
              onClick={() => insert(elementTemplate(elementKind))}
            >
              + {t(ELEMENT_SPECS[elementKind].ar, ELEMENT_SPECS[elementKind].en)}
            </button>
          ))}
        </div>
      ) : null}
      {state === "error" ? <Alert kind="warning" title={t("تعذّر الحفظ", "Couldn't save")}>{error}</Alert> : null}
      <textarea
        id="product-readme-editor"
        ref={textarea}
        value={value}
        readOnly={!editable}
        dir="auto"
        rows={26}
        spellCheck={false}
        aria-label="README (Markdown)"
        placeholder={TEMPLATE}
        onChange={(e) => update(e.target.value)}
        style={{ width: "100%", fontFamily: "var(--font-mono, monospace)", fontSize: "13px", lineHeight: 1.7, padding: "var(--space-3)" }}
      />
      {live && elements.length > 0 ? (
        <div style={{ display: "grid", gap: "6px" }}>
          <strong style={{ fontSize: "13px" }}>{t("عناصر الصفحة", "Page elements")}</strong>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "6px" }}>
            {elements.map((element) => (
              <li
                key={`${element.start}-${element.kind}`}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", border: "1px solid var(--line)", borderRadius: "var(--radius-soft)", padding: "6px 10px" }}
              >
                <span style={{ minWidth: 0 }}>
                  <strong>{t(ELEMENT_SPECS[element.kind].ar, ELEMENT_SPECS[element.kind].en)}</strong>
                  <span className="ma-studio__hint" style={{ margin: 0 }}>
                    {" · "}
                    {element.sectionTitle || "—"} · {element.rows.length} {t("عنصر", "items")}
                  </span>
                </span>
                {editable ? (
                  <button type="button" className="ma-btn ma-btn--sm" onClick={() => setEditing(element)}>
                    {t("تعديل", "Edit")}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {editing ? (
        <LiveElementDialog
          key={`${editing.start}-${editing.kind}`}
          element={editing}
          onClose={() => setEditing(null)}
          onSave={(sectionTitle, title, rows) => {
            update(replaceElement(value, editing, sectionTitle, title, rows));
            setEditing(null);
          }}
          onDelete={() => {
            update(removeElement(value, editing));
            setEditing(null);
          }}
        />
      ) : null}
      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
        {editable ? (
          <>
            <button type="button" className="ma-btn ma-btn--primary" disabled={!dirty || state === "saving"} onClick={save}>
              {state === "saving" ? t("جارٍ الحفظ…", "Saving…") : t("حفظ README", "Save README")}
            </button>
            {!value ? (
              <button type="button" className="ma-btn" onClick={() => setText(TEMPLATE)}>
                {t("ابدأ بقالب", "Start from a template")}
              </button>
            ) : null}
          </>
        ) : null}
        {state === "saved" ? <span role="status">{t("تم الحفظ", "Saved")}</span> : null}
        <span className="ma-studio__hint" style={{ margin: 0 }}>
          {t("Markdown فقط: # عناوين، - قوائم، **غامق**، [رابط](https://…). يُزال أي HTML.", "Markdown only: # headings, - lists, **bold**, [link](https://…). Any HTML is stripped.")}
        </span>
      </div>
    </div>
  );
}
