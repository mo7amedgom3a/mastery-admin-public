import type { SettingEntry } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Badge, Button, Field } from "@/components/ui/kit";

const SOURCE_BADGES = {
  admin: { label: { ar: "الإدارة", en: "Dashboard" }, tone: "info" as const },
  env: { label: { ar: "البيئة", en: "Env" }, tone: "neutral" as const },
  default: { label: { ar: "افتراضي", en: "Default" }, tone: "neutral" as const },
};

/** One non-secret setting: the env key, its provenance, the control and inline errors. */
export function SettingRow({
  entry,
  value,
  error,
  readOnly,
  onChange,
  onRevert,
  reverting,
}: {
  entry: SettingEntry;
  value: string | boolean;
  error?: string;
  readOnly: boolean;
  onChange: (value: string | boolean) => void;
  onRevert: () => void;
  reverting: boolean;
}) {
  const t = useT();
  const id = `setting-${entry.key.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const danger = entry.danger
    ? entry.danger === "signs_out_all"
      ? t("تغييره يُخرج جميع المستخدمين", "Changing this signs everyone out")
      : t("يلزم إعادة فهرسة البحث", "Search must be reindexed")
    : null;

  return (
    <div
      className="flex flex-col gap-2"
      data-setting-key={entry.key}
      style={{ paddingBlock: "var(--space-3)", borderBlockEnd: "1px solid var(--line)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <code className="ma-help" style={{ direction: "ltr", textAlign: "start", fontWeight: 700 }}>
          {entry.key}
        </code>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge def={SOURCE_BADGES[entry.source]} />
          {entry.pending_restart ? (
            <Badge def={{ label: { ar: "بعد إعادة التشغيل", en: "After restart" }, tone: "warning" }} />
          ) : null}
          {entry.worker_restart ? (
            <Badge def={{ label: { ar: "إعادة تشغيل العمّال", en: "Worker restart" }, tone: "neutral" }} />
          ) : null}
          {entry.deprecated ? (
            <Badge def={{ label: { ar: "قديم", en: "Deprecated" }, tone: "warning" }} />
          ) : null}
          {entry.source === "admin" && !readOnly ? (
            <Button
              kind="ghost"
              sm
              icon="refresh"
              label={t("رجوع للافتراضي", "Revert")}
              disabled={reverting}
              onClick={onRevert}
            />
          ) : null}
        </div>
      </div>

      {entry.kind === "bool" ? (
        <label className="ma-check" htmlFor={id}>
          <input
            id={id}
            type="checkbox"
            checked={Boolean(value)}
            disabled={readOnly}
            aria-describedby={entry.hint ? `${id}-hint` : undefined}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span>
            {entry.label} — {value ? t("مفعّل", "enabled") : t("معطّل", "disabled")}
          </span>
        </label>
      ) : entry.kind === "enum" ? (
        <Field
          id={id}
          label={entry.label}
          options={[
            ...(entry.value == null ? [["", t("— غير محدد —", "— not set —")] as [string, string]] : []),
            ...entry.choices.map((choice) => [choice, choice] as [string, string]),
          ]}
          value={String(value)}
          disabled={readOnly}
          onChange={(next) => onChange(next)}
        />
      ) : (
        <Field
          id={id}
          label={entry.label}
          type={["int", "float", "decimal"].includes(entry.kind) ? "number" : "text"}
          dir={
            ["url", "email", "datetime", "int", "float", "decimal", "list"].includes(entry.kind)
              ? "ltr"
              : undefined
          }
          value={String(value)}
          placeholder={
            entry.default == null || entry.default === "" ? t("غير محدد", "not set") : String(entry.default)
          }
          disabled={readOnly}
          hint={
            entry.kind === "list" ? t("قائمة مفصولة بفواصل.", "Comma-separated list.") : entry.hint || undefined
          }
          onChange={(next) => onChange(next)}
        />
      )}

      {danger ? (
        <span className="ma-help" style={{ color: "var(--danger)" }}>
          {danger}
        </span>
      ) : null}
      {entry.invalid_reason ? (
        <span className="ma-help" style={{ color: "var(--danger)" }}>
          {t("القيمة المحفوظة غير صالحة: ", "Stored value is invalid: ")}
          {entry.invalid_reason}
        </span>
      ) : null}
      {error ? (
        <span className="ma-help" style={{ color: "var(--danger)" }} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
