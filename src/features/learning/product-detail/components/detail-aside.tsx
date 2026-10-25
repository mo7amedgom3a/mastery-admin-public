import { Avatar } from "@/components/ui/kit";
import { Icon } from "@/components/ui/icon";
import { initialsOf } from "@/lib/status";
import { useT } from "@/lib/i18n";
import type { CurriculumUnit, ProductView, SearchProductDetail } from "@/lib/api";
import { computeCompleteness } from "../model";
import type { DetailTab } from "./detail-tabbar";

interface DetailAsideProps {
  data: ProductView;
  units: CurriculumUnit[];
  searchDetail?: SearchProductDetail | null;
  onNavigateTab?: (tab: DetailTab) => void;
}

export function DetailAside({
  data,
  units,
  searchDetail,
  onNavigateTab,
}: DetailAsideProps) {
  const t = useT();
  const item = data.product;
  const published = item.status === "published";
  const b2c = data.b2c;

  // Extract trainer from searchDetail or item
  const searchObj = searchDetail as Record<string, unknown> | undefined;
  let leadName: string | null = null;
  let leadImage: string | null = null;

  if (Array.isArray(searchObj?.instructors) && searchObj.instructors.length) {
    const inst = searchObj.instructors[0] as Record<string, unknown>;
    const detail = (inst.instructor || inst) as Record<string, unknown>;
    leadName = String(detail.name || "");
    leadImage = (detail.profile_image || detail.image || detail.square_image) as string | null;
  } else if (Array.isArray(searchObj?.trainers) && searchObj.trainers.length) {
    const tr = searchObj.trainers[0] as Record<string, unknown>;
    leadName = String(tr.name || "");
    leadImage = (tr.profile_image || tr.image) as string | null;
  }

  const instructorsCount = leadName ? 1 : 0;
  const { items, pct } = computeCompleteness(data, units, instructorsCount, t);

  const coverImage = item.image || item.square_image;
  const initials = initialsOf(item.title || "CB");

  return (
    <aside className="cd-aside" aria-label={t("معلومات سريعة", "Quick facts")}>
      {/* Cover & Quick facts card */}
      <div className="cd-card">
        {coverImage ? (
          <div className="cd-cover" style={{ background: "var(--fill-soft)" }}>
            <img
              src={coverImage}
              alt={item.title ?? undefined}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
            <span className="ma-tag ma-tag--ink" style={{ zIndex: 1, position: "relative" }}>
              {item.product_type === "package" ? t("حزمة", "Package") : t("دورة", "Course")}
            </span>
            <span className="ma-tag ma-tag--soft" style={{ zIndex: 1, position: "relative", background: "var(--ink)", color: "#fff" }}>
              B2C
            </span>
          </div>
        ) : (
          <div className="cd-cover">
            <span className="cd-cover__big">{initials}</span>
            <span className="ma-tag ma-tag--ink">
              {item.product_type === "package" ? t("حزمة", "Package") : t("دورة", "Course")}
            </span>
            <span className="ma-tag ma-tag--soft" style={{ background: "var(--ink)", color: "#fff" }}>
              B2C
            </span>
          </div>
        )}

        <div className="cd-card__b">
          <dl className="cd-dl">
            <div>
              <dt>{t("الحالة", "Status")}</dt>
              <dd>
                <span className={`cd-chip ${published ? "cd-chip--ok" : "cd-chip--off"}`}>
                  {published ? t("منشور", "Published") : t("مسودة", "Draft")}
                </span>
              </dd>
            </div>
            <div>
              <dt>{t("المُعرّف", "ID")}</dt>
              <dd className="cd-ltr">{item.slug || item.product_id || String(item.legacy_id || "")}</dd>
            </div>
            <div>
              <dt>{t("الجمهور", "Audience")}</dt>
              <dd>B2C</dd>
            </div>
            <div>
              <dt>{t("التصنيف", "Category")}</dt>
              <dd>{item.category || b2c?.categories?.[0] || "—"}</dd>
            </div>
          </dl>

          {leadName && (
            <div className="cd-person" style={{ marginBlockStart: 4, borderTop: "1px solid var(--border)", paddingBlockStart: 12 }}>
              <Avatar
                initials={initialsOf(leadName || "")}
                src={leadImage ?? undefined}
                alt={leadName}
                color="var(--coral)"
              />
              <div>
                <b>{leadName}</b>
                <small>{t("مدرب رئيسي", "Lead instructor")}</small>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Completeness Checklist Card */}
      <div className="cd-card">
        <div className="cd-card__h">
          <h3>{t("اكتمال الدورة", "Course completeness")}</h3>
          <div className="cd-ring" style={{ ["--p" as string]: pct }}>
            <span>{pct}%</span>
          </div>
        </div>

        <div className="cd-card__b">
          <ul className="cd-check">
            {items.map((it) => (
              <li key={it.label} className={it.complete ? "" : "is-todo"}>
                <span className="cd-check__box">
                  <Icon name="check" className="cd-ic--sm" />
                </span>
                <span>{it.label}</span>
                {!it.complete && it.actionTab && onNavigateTab && (
                  <button
                    type="button"
                    className="cd-link"
                    onClick={() => onNavigateTab(it.actionTab as DetailTab)}
                  >
                    {t("تحديد", "Set")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}
