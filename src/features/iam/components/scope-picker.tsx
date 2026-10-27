import { useAdminAuth } from "@/lib/auth/store";
import { useT } from "@/lib/i18n";
import { InfoHint } from "@/components/ui/info-hint";
import type { AdminScopeArea } from "@/lib/api";

/**
 * Scope checkboxes grouped by area. A team lead only sees scopes they already
 * hold (plus the policy's current scopes when editing), matching the API boundary.
 */
export function ScopePicker({
  areas,
  value,
  onChange,
}: {
  areas?: AdminScopeArea[];
  value: string[];
  onChange: (scopes: string[]) => void;
}) {
  const t = useT();
  const admin = useAdminAuth((state) => state.admin);

  if (!areas) return <p className="ma-muted">{t("جارٍ تحميل الصلاحيات…", "Loading scopes…")}</p>;

  const allowed = admin?.scopes.includes("*")
    ? null
    : new Set([...(admin?.scopes ?? []), ...value]);
  const visible = allowed
    ? areas
        .map((area) => ({
          ...area,
          scopes: area.scopes.filter((option) => allowed.has(option.scope)),
        }))
        .filter((area) => area.scopes.length)
    : areas;

  const toggle = (scope: string) =>
    onChange(value.includes(scope) ? value.filter((item) => item !== scope) : [...value, scope]);

  return (
    <div className="ma-stack">
      <div className="ma-hintline">
        <InfoHint label={t("الصلاحيات", "Scopes")} title={t("الصلاحيات", "Scopes")}>
          {t(
            "كل صلاحية تسمح بعملية محددة داخل مجال. اجمع فقط ما يحتاجه الدور، ويمكن دائمًا إضافة سياسة أخرى لاحقًا.",
            "Each scope allows a specific action inside a domain. Grant only what the role needs; more policies can be added later.",
          )}
        </InfoHint>
        <span className="ma-muted">{t("كيف أختار الصلاحيات؟", "How do I choose scopes?")}</span>
      </div>
      {visible.map((area) => (
        <fieldset key={area.area}>
          <legend className="ma-label">{area.label.en}</legend>
          <div className="ma-cols ma-cols--2">
            {area.scopes.map((option) => (
              <label key={option.scope} className="ma-check">
                <input
                  type="checkbox"
                  checked={value.includes(option.scope)}
                  onChange={() => toggle(option.scope)}
                />
                <span>
                  {option.label.en}
                  <span className="ma-cell-sub" dir="ltr">{option.scope}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {value.length === 0 ? (
        <p className="ma-muted">{t("لم تُحدد صلاحيات بعد.", "No scopes selected yet.")}</p>
      ) : (
        <p className="ma-muted">
          {t(`المحدّد: ${value.length}`, `Selected: ${value.length}`)}
        </p>
      )}
    </div>
  );
}
