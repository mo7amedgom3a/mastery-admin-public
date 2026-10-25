import { useT } from "@/lib/i18n";
import { studioHref } from "@/lib/refs";
import { AppLink } from "@/components/ui/app-link";
import { Icon } from "@/components/ui/icon";
import type { ProductView, SearchProductDetail } from "@/lib/api";

interface InstructorItem {
  id: number | null;
  name: string;
  role?: string;
  coursesCount?: number;
  image?: string | null;
}

interface InstructorsTabProps {
  productRef: string;
  data: ProductView;
  searchDetail?: SearchProductDetail | null;
}

export function InstructorsTab({ productRef, data, searchDetail }: InstructorsTabProps) {
  const t = useT();

  const instructors: InstructorItem[] = [];
  const searchObj = searchDetail as Record<string, unknown> | undefined;

  // Extract from search product details
  if (Array.isArray(searchObj?.instructors) && searchObj.instructors.length) {
    for (const item of searchObj.instructors) {
      const rec = (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>;
      const inst = (typeof rec.instructor === "object" && rec.instructor !== null ? rec.instructor : rec) as Record<string, unknown>;
      instructors.push({
        id: typeof inst.id === "number" ? inst.id : null,
        name: String(inst.name || t("مدرب", "Instructor")),
        role: String(inst.job_title || inst.bio || inst.role || t("مدرب رئيسي", "Lead instructor")),
        coursesCount: typeof inst.courses_count === "number" ? inst.courses_count : undefined,
        image: (inst.profile_image || inst.image || inst.square_image) as string | null,
      });
    }
  } else if (Array.isArray(searchObj?.trainers) && searchObj.trainers.length) {
    for (const trainer of searchObj.trainers) {
      const rec = (typeof trainer === "object" && trainer !== null ? trainer : {}) as Record<string, unknown>;
      instructors.push({
        id: typeof rec.id === "number" ? rec.id : null,
        name: String(rec.name || t("مدرب", "Instructor")),
        role: String(rec.title || rec.role || t("مدرب المادة", "Course instructor")),
        image: (rec.profile_image || rec.image) as string | null,
      });
    }
  }

  // Fallback if no instructors listed
  if (instructors.length === 0) {
    // Check if product has an instructor name in metadata
    const metaTrainer = searchObj?.trainer_name || (data.product as Record<string, unknown>)?.trainer_name;
    if (metaTrainer) {
      instructors.push({
        id: null,
        name: String(metaTrainer),
        role: t("مدرب رئيسي", "Lead instructor"),
      });
    }
  }

  const colors = ["coral", "purple", "sky", "teal", "yellow"];

  return (
    <div>
      <div className="cd-cards">
        {instructors.map((ins, idx) => {
          const color = colors[idx % colors.length];
          const initial = ins.name.trim()[0] || "I";

          return (
            <div key={idx} className="cd-card cd-pcard">
              <span
                className="cd-avatar cd-avatar--xl"
                style={{ "--c": `var(--${color})`, overflow: "hidden" } as React.CSSProperties}
              >
                {ins.image ? (
                  <img
                    src={ins.image}
                    alt={ins.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  initial
                )}
              </span>
              <h3>{ins.name}</h3>
              <span className="cd-muted">{ins.role}</span>

              {typeof ins.coursesCount === "number" && (
                <div className="cd-mini-stats">
                  <span>
                    {ins.coursesCount} {t("دورات", "courses")}
                  </span>
                </div>
              )}

              <div className="cd-actions">
                {ins.id ? (
                  <AppLink
                    className="ma-btn ma-btn--sm ma-btn--soft"
                    to={`/learning/instructors/${ins.id}`}
                  >
                    <Icon name="user" className="cd-ic--sm" />
                    {t("الملف الشخصي", "Profile")}
                  </AppLink>
                ) : (
                  <span className="cd-chip cd-chip--plain">
                    <Icon name="user" className="cd-ic--sm" />
                    {t("معتمد", "Verified")}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* Add Instructor Prompt */}
        <AppLink className="cd-addtile" to={studioHref(productRef)}>
          <Icon name="plus" />
          <strong>{t("إدارة المدربين في الاستوديو", "Manage instructors in Studio")}</strong>
        </AppLink>
      </div>
    </div>
  );
}
