import { useT } from "@/lib/i18n";
import { productHref, studioHref } from "@/lib/refs";
import { AppLink } from "@/components/ui/app-link";
import { Icon } from "@/components/ui/icon";
import type { SearchProductDetail } from "@/lib/api";

interface RelatedItem {
  legacy_id: number;
  title?: string | null;
  image?: string | null;
  square_image?: string | null;
  product_id?: string | null;
  resource_type?: string;
}

interface RelatedTabProps {
  productRef: string;
  detail?: SearchProductDetail | null;
}

export function RelatedTab({ productRef, detail }: RelatedTabProps) {
  const t = useT();
  const related = detail?.related;

  const groups: Array<{ label: string; kind: string; items: RelatedItem[] }> = [
    {
      label: t("الدورات ذات الصلة", "Related Courses"),
      kind: "course",
      items: ((related?.courses ?? []) as unknown as RelatedItem[]) || [],
    },
    {
      label: t("الدبلومات", "Diplomas"),
      kind: "diploma",
      items: ((related?.diplomas ?? []) as unknown as RelatedItem[]) || [],
    },
    {
      label: t("الحزم والباقات", "Packages"),
      kind: "package",
      items: ((related?.packages ?? []) as unknown as RelatedItem[]) || [],
    },
    {
      label: t("الاستشارات ذات الصلة", "Consultations"),
      kind: "consultation",
      items: ((related?.consultations ?? []) as unknown as RelatedItem[]) || [],
    },
  ];

  const totalItems = groups.reduce((acc, g) => acc + g.items.length, 0);

  if (totalItems === 0) {
    return (
      <div className="cd-empty" style={{ padding: 48 }}>
        <Icon name="layers" />
        <strong>{t("لا توجد عناصر ذات صلة مضافة", "No related items linked yet")}</strong>
        <span>
          {t(
            "يمكنك ربط دورات وحزم أخرى ذات صلة لتعزيز المبيعات المتقاطعة",
            "You can link related courses and packages in the studio for cross-selling"
          )}
        </span>
        <div style={{ marginBlockStart: 16 }}>
          <AppLink className="ma-btn ma-btn--sm ma-btn--primary" to={studioHref(productRef)}>
            <Icon name="plus" className="cd-ic--sm" />
            {t("إدارة العناصر في الاستوديو", "Manage in Studio")}
          </AppLink>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {groups.map(
        ({ label, kind, items }) =>
          items.length > 0 && (
            <section key={label} className="cd-card">
              <div className="cd-card__h">
                <h2>
                  <Icon name="layers" />
                  {label}
                </h2>
                <span className="cd-chip cd-chip--plain cd-num">{items.length}</span>
              </div>
              <div className="cd-card__b">
                <div className="cd-cards">
                  {items.map((item, idx) => {
                    const href = item.product_id
                      ? productHref(`b2c:${item.product_id}`)
                      : productHref(`legacy:${item.resource_type || kind}:${item.legacy_id}`);
                    const img = item.square_image || item.image;

                    return (
                      <div key={idx} className="ma-card" style={{ maxWidth: 320 }}>
                        <div
                          className="ma-card__media"
                          style={{
                            background: "var(--card-subtle)",
                            position: "relative",
                            height: 140,
                            overflow: "hidden",
                          }}
                        >
                          {img ? (
                            <img
                              src={img}
                              alt={item.title || ""}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            <div
                              style={{
                                width: "100%",
                                height: "100%",
                                display: "grid",
                                placeItems: "center",
                                opacity: 0.4,
                              }}
                            >
                              <Icon name="layers" />
                            </div>
                          )}
                          <span
                            className="ma-tag ma-tag--ink"
                            style={{ position: "absolute", top: 8, right: 8 }}
                          >
                            {kind}
                          </span>
                        </div>
                        <div className="ma-card__body">
                          <h3 className="ma-card__title" style={{ fontSize: 15, margin: 0 }}>
                            {item.title || t("عنصر غير مسمى", "Untitled")}
                          </h3>
                        </div>
                        <div className="ma-card__foot">
                          <AppLink className="ma-btn ma-btn--sm ma-btn--soft" to={href}>
                            {t("معاينة", "Review")}
                          </AppLink>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )
      )}
    </div>
  );
}
