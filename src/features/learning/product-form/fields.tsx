import { type ReactNode } from "react";

import { Button, Field } from "@/components/ui/kit";
import { useT } from "@/lib/i18n";

/**
 * Small shared fields for the create-product pages: a URL slug with a generate action, a status
 * toggle and a repeating single-line list editor (learning outcomes, bundle sections).
 */

export function SlugField({
  id,
  value,
  onChange,
  onRegenerate,
  required,
  hint,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onRegenerate?: () => void;
  required?: boolean;
  hint?: ReactNode;
}) {
  const t = useT();
  return (
    <div className="ma-field">
      <label className="ma-label" htmlFor={id}>
        {t("رابط المنتج (slug)", "Product link (slug)")}
        {required ? <span aria-hidden="true" className="ma-req"> *</span> : null}
      </label>
      <div className="ma-field-inline">
        <input
          id={id}
          className="ma-input"
          dir="ltr"
          value={value}
          placeholder="my-product-slug"
          onChange={(event) => onChange(event.target.value)}
        />
        {onRegenerate ? (
          <Button kind="soft" sm icon="refresh" label={t("توليد", "Generate")} onClick={onRegenerate} />
        ) : null}
      </div>
      <span className="ma-help" id={`${id}-hint`}>
        {hint ??
          t(
            "اتركه فارغًا ليُنشأ تلقائيًا، أو اكتبه بحروف لاتينية.",
            "Leave empty to generate automatically, or type a Latin slug.",
          )}
      </span>
    </div>
  );
}

/** Price input that flags malformed values before submit. */
export function PriceField({
  id,
  value,
  onChange,
  invalid,
  label,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  label?: ReactNode;
}) {
  const t = useT();
  return (
    <Field
      id={id}
      type="number"
      min={0}
      step="any"
      dir="ltr"
      label={label ?? t("السعر (USD)", "Price (USD)")}
      value={value}
      onChange={onChange}
      hint={
        invalid
          ? t("أدخل رقمًا صحيحًا أكبر من أو يساوي صفر.", "Enter a valid number ≥ 0.")
          : t("بالدولار الأمريكي.", "In US dollars.")
      }
      aria-invalid={invalid || undefined}
    />
  );
}

/** Checkbox row used for boolean flags (featured, CPD eligible, published). */
export function ToggleField({
  id,
  label,
  checked,
  onChange,
  hint,
}: {
  id: string;
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: ReactNode;
}) {
  return (
    <label className="ma-check" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>
        {label}
        {hint ? <span className="ma-member__meta"> · {hint}</span> : null}
      </span>
    </label>
  );
}

/** Repeating single-line text editor (learning outcomes, package sections). */
export function ListEditor({
  label,
  items,
  onChange,
  addLabel,
  placeholder,
  hint,
}: {
  label: ReactNode;
  items: string[];
  onChange: (items: string[]) => void;
  addLabel?: ReactNode;
  placeholder?: string;
  hint?: ReactNode;
}) {
  const t = useT();
  const update = (index: number, value: string) => onChange(items.map((item, i) => (i === index ? value : item)));
  const remove = (index: number) => onChange(items.filter((_, i) => i !== index));
  return (
    <div className="ma-field">
      <span className="ma-label">{label}</span>
      {items.length > 0 ? (
        <div className="ma-listedit">
          {items.map((item, index) => (
            <div className="ma-listedit__row" key={index}>
              <input
                className="ma-input"
                value={item}
                placeholder={placeholder}
                onChange={(event) => update(index, event.target.value)}
              />
              <Button
                kind="bare"
                icon="trash"
                label={t("حذف", "Remove")}
                onClick={() => remove(index)}
              />
            </div>
          ))}
        </div>
      ) : null}
      <div>
        <Button
          kind="soft"
          sm
          icon="plus"
          label={addLabel ?? t("إضافة سطر", "Add a line")}
          onClick={() => onChange([...items, ""])}
          className="ma-listedit__add"
        />
      </div>
      {hint ? <span className="ma-help">{hint}</span> : null}
    </div>
  );
}
