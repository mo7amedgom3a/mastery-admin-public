import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { Button, Field, FormActions } from "@/components/ui/kit";
import { useT } from "@/lib/i18n";
import { ELEMENT_SPECS, type ElementRow, type FoundElement } from "./live-elements";

/**
 * Form editor of one README card element (levels, training, outcomes…): the section heading, the element's
 * own title where it has one, and its rows, which can be added, removed and reordered. Saving writes the
 * element back into the README text (the caller replaces its line range).
 */
export function LiveElementDialog({
  element,
  onSave,
  onDelete,
  onClose,
}: {
  element: FoundElement;
  onSave: (sectionTitle: string, title: string, rows: ElementRow[]) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const spec = ELEMENT_SPECS[element.kind];
  const [sectionTitle, setSectionTitle] = useState(element.sectionTitle);
  const [title, setTitle] = useState(element.title);
  const [rows, setRows] = useState<ElementRow[]>(() =>
    element.rows.length > 0 ? element.rows : spec.single ? [{}] : [],
  );

  const setField = (index: number, key: string, value: string) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  const move = (index: number, by: -1 | 1) =>
    setRows((current) => {
      const next = [...current];
      const [row] = next.splice(index, 1);
      next.splice(index + by, 0, row);
      return next;
    });
  const emptyRow = () => Object.fromEntries(spec.fields.map((field) => [field.key, ""]));

  return (
    <div className="ma-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        className="ma-studio-dialog"
        style={{ inlineSize: "min(760px, calc(100vw - 32px))", maxBlockSize: "calc(100vh - 48px)", overflow: "auto" }}
        role="dialog"
        aria-modal="true"
        aria-label={t(`تعديل: ${spec.ar}`, `Edit: ${spec.en}`)}
        onKeyDown={(event) => event.key === "Escape" && onClose()}
      >
        <div className="ma-studio-dialog__head">
          <div>
            <strong style={{ fontSize: "16px", display: "block" }}>{t(spec.ar, spec.en)}</strong>
            <p className="ma-studio-dialog__text" style={{ fontSize: "12px", margin: 0 }}>
              {t(spec.hintAr, spec.hintEn)}
            </p>
          </div>
          <button type="button" className="ma-sblock__btn" onClick={onClose} aria-label={t("إغلاق", "Close")} style={{ fontSize: "18px", lineHeight: 1 }}>
            ×
          </button>
        </div>

        <form
          className="ma-form"
          style={{ padding: "var(--space-3)" }}
          onSubmit={(event) => {
            event.preventDefault();
            onSave(sectionTitle, title, rows);
          }}
        >
          <div className="ma-form-grid ma-form-grid--2">
            {element.headingLine >= 0 ? (
              <Field id="live-el-section" label={t("عنوان القسم", "Section heading")} value={sectionTitle} onChange={setSectionTitle} />
            ) : null}
            {element.kind === "features" ? (
              <Field id="live-el-title" label={t("عنوان المميزات", "Features heading")} value={title} onChange={setTitle} />
            ) : null}
          </div>

          {rows.map((row, index) => (
            <fieldset
              key={index}
              style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-soft)", padding: "var(--space-3)", display: "grid", gap: "var(--space-2)" }}
            >
              {spec.single ? null : (
                <legend style={{ display: "flex", alignItems: "center", gap: "6px", padding: "0 6px", fontWeight: 600 }}>
                  {String(index + 1).padStart(2, "0")}
                  <button type="button" className="ma-sblock__btn" aria-label={t("تحريك لأعلى", "Move up")} disabled={index === 0} onClick={() => move(index, -1)}>
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    className="ma-sblock__btn"
                    aria-label={t("تحريك لأسفل", "Move down")}
                    disabled={index === rows.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    className="ma-sblock__btn"
                    aria-label={t("حذف", "Remove")}
                    onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                  >
                    <Trash2 size={14} />
                  </button>
                </legend>
              )}
              <div className={spec.fields.length > 1 && !spec.fields.every((f) => f.multiline) ? "ma-form-grid ma-form-grid--2" : undefined}>
                {spec.fields.map((field) => (
                  <Field
                    key={field.key}
                    id={`live-el-${index}-${field.key}`}
                    label={t(field.ar, field.en)}
                    type={field.multiline ? "textarea" : "text"}
                    rows={field.multiline ? 3 : undefined}
                    dir={field.ltr ? "ltr" : "auto"}
                    value={row[field.key] ?? ""}
                    onChange={(value) => setField(index, field.key, value)}
                  />
                ))}
              </div>
            </fieldset>
          ))}

          {spec.single ? null : (
            <div>
              <Button sm iconNode={<Plus size={14} />} label={t("إضافة عنصر", "Add item")} onClick={() => setRows((current) => [...current, emptyRow()])} />
            </div>
          )}

          <FormActions>
            <Button type="submit" kind="primary" icon="check" label={t("تطبيق", "Apply")} />
            <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={onClose} />
            <Button
              kind="ghost"
              iconNode={<Trash2 size={14} />}
              label={t("حذف العنصر", "Delete element")}
              onClick={() => {
                if (window.confirm(t("حذف هذا العنصر من README؟", "Delete this element from the README?"))) onDelete();
              }}
            />
          </FormActions>
        </form>
      </div>
    </div>
  );
}
