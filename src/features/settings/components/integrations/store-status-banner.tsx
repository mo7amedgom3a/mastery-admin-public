import type { RuntimeStoreStatus, VaultState } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Alert, Badge } from "@/components/ui/kit";

/**
 * Store health. The page still renders when a store is down, but writes are refused by
 * the API — this banner explains why instead of letting the admin hit 503s.
 */
export function StoreStatusBanner({ store, vault }: { store: RuntimeStoreStatus; vault: VaultState }) {
  const t = useT();

  if (!store.enabled) {
    return (
      <Alert kind="info" title={t("الإعدادات الديناميكية معطّلة", "Runtime settings are disabled")}>
        {t(
          "SETTINGS_RUNTIME_ENABLED=false: القيم تُقرأ من البيئة فقط.",
          "SETTINGS_RUNTIME_ENABLED=false: values come from the environment only.",
        )}
      </Alert>
    );
  }

  if (store.db === "migration_missing") {
    return (
      <Alert kind="danger" title={t("جدول الإعدادات غير موجود", "The settings table is missing")}>
        {t(
          "طبّق migrations/20261210_runtime_settings.sql ثم أعد تحميل الصفحة.",
          "Apply migrations/20261210_runtime_settings.sql, then reload this page.",
        )}
      </Alert>
    );
  }

  if (store.db === "error" || store.secrets === "error") {
    return (
      <Alert kind="danger" title={t("مخزن الإعدادات غير متاح", "The settings store is unavailable")}>
        {store.error ??
          t(
            "تعذّر قراءة القيم المحفوظة؛ الصفحة تعرض قيم البيئة والحفظ معطّل مؤقتًا.",
            "Stored values could not be read; this page shows the environment values and saving is disabled.",
          )}
      </Alert>
    );
  }

  if (!vault.configured) {
    return (
      <Alert kind="warning" title={t("خزنة الأسرار غير مُهيّأة", "The secrets vault is not configured")}>
        {t(
          "SETTINGS_VAULT_KEY_HASH غير مضبوط: لا يمكن عرض الأسرار أو تغييرها أو اختبارها.",
          "SETTINGS_VAULT_KEY_HASH is not set: secrets cannot be revealed, changed or tested.",
        )}
      </Alert>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2" style={{ marginBlockEnd: "var(--space-4)" }}>
      <Badge def={{ label: { ar: "المخزن: قاعدة البيانات", en: "Store: database" }, tone: "success" }} />
      <Badge
        def={{
          label: {
            ar: `الأسرار: ${store.secrets_backend === "aws" ? "AWS Secrets Manager" : "ملف محلي"}`,
            en: `Secrets: ${store.secrets_backend === "aws" ? "AWS Secrets Manager" : "local file"}`,
          },
          tone: store.secrets_backend === "aws" ? "info" : "neutral",
        }}
      />
      <Badge
        def={{
          label: {
            ar: vault.reveal_enabled ? "العرض مفعّل" : "العرض معطّل",
            en: vault.reveal_enabled ? "Reveal enabled" : "Reveal disabled",
          },
          tone: vault.reveal_enabled ? "neutral" : "warning",
        }}
      />
      {store.loaded_at ? (
        <span className="ma-help">
          {t("آخر تحميل: ", "Loaded: ")}
          {new Date(store.loaded_at).toLocaleString()}
        </span>
      ) : null}
    </div>
  );
}
