import { LegacyProductContent } from "@/features/learning/components/legacy-product-content";
import { type CatalogKind } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Icon } from "@/components/ui/icon";

interface LegacyTabProps {
  productRef: string;
  legacyKind: CatalogKind;
}

export function LegacyTab({ productRef, legacyKind }: LegacyTabProps) {
  const t = useT();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        className="ma-alert ma-alert--info"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          background: "var(--card-subtle)",
          border: "1px solid var(--border)",
          borderRadius: 8,
        }}
      >
        <Icon name="refresh" />
        <div style={{ fontSize: 13 }}>
          <strong>{t("بيانات النظام القديم الموروثة (Legacy LMS)", "Legacy LMS Data")}</strong>
          <span style={{ marginInlineStart: 6, color: "var(--text-muted)" }}>
            {t(
              "تتضمن صفوف الأسعار القديمة، قواعد الإكمال، الشهادات، وسجلات المتعلمين المباشرة في النظام القديم.",
              "Includes legacy price rows, completion criteria, certificates, and direct learner records."
            )}
          </span>
        </div>
      </div>

      <LegacyProductContent productRef={productRef} kind={legacyKind} />
    </div>
  );
}
