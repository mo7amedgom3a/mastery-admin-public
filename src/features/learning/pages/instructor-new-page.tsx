import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { createExpertProfile, type ExpertProfileCreate } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { toast } from "@/components/ui/toast";
import { Button, Card, Dl, ErrorAlert, Field, FormActions, PageHead } from "@/components/ui/kit";
import { ToggleField } from "@/features/learning/product-form";

/**
 * `POST /admin/catalog/instructors` — the seed fields of an expert created by hand: name, title
 * line, specialty, status, bio, a landing-page placement and an optional consultant profile.
 * Details, socials and the images are edited on the expert's detail page afterwards.
 */

type FormState = {
  display_name: string;
  headline: string;
  specialized: string;
  bio: string;
  status: string;
  is_featured: boolean;
  featured_order: string;
  make_consultant: boolean;
};

const INITIAL: FormState = {
  display_name: "",
  headline: "",
  specialized: "",
  bio: "",
  status: "active",
  is_featured: false,
  featured_order: "",
  make_consultant: false,
};

function payloadOf(form: FormState): ExpertProfileCreate {
  const optional = (value: string) => {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  };
  return {
    display_name: form.display_name.trim(),
    headline: optional(form.headline),
    specialized: optional(form.specialized),
    bio: optional(form.bio),
    status: form.status === "inactive" ? "inactive" : "active",
    is_featured: form.is_featured,
    featured_order: form.is_featured && form.featured_order.trim() !== "" ? Number(form.featured_order) : null,
    make_consultant: form.make_consultant,
  };
}

export default function InstructorNewPage() {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(INITIAL);
  const set = <K extends keyof FormState>(field: K) => (value: FormState[K]) =>
    setForm((current) => ({ ...current, [field]: value }));

  const create = useMutation({
    mutationFn: () => createExpertProfile(payloadOf(form)),
    onSuccess: (expert) => {
      toast.success(t("تم إضافة المدرب", "Instructor added"));
      queryClient.invalidateQueries({ queryKey: ["learning", "expert-profiles"] });
      navigate(`/learning/instructors/${encodeURIComponent(expert.key)}`);
    },
  });

  const invalid = form.display_name.trim().length < 2 ||
    (form.is_featured && form.featured_order.trim() !== "" && !(Number(form.featured_order) >= 0));

  return (
    <>
      <PageHead
        title={t("إضافة مدرب", "Add instructor")}
        sub={t(
          "بيانات البداية فقط؛ التفاصيل والصور والصفحة تُكمل من صفحة المدرب بعد الإنشاء.",
          "Seed fields only; details, images and the page are completed on the expert's page after creation.",
        )}
        back={{ href: "/learning/instructors", label: t("المدربون", "Instructors") }}
      />

      <form
        className="ma-form-layout"
        onSubmit={(event) => {
          event.preventDefault();
          if (!invalid) create.mutate();
        }}
      >
        <div className="ma-form-main">
          <Card title={t("بيانات المدرب", "Instructor details")}>
            <div className="ma-form">
              <div className="ma-form-grid ma-form-grid--2">
                <Field
                  id="instructor-name"
                  label={t("الاسم", "Name")}
                  required
                  value={form.display_name}
                  onChange={set("display_name")}
                  maxLength={300}
                />
                <Field
                  id="instructor-headline"
                  label={t("اللقب / العنوان", "Title line")}
                  value={form.headline}
                  onChange={set("headline")}
                  maxLength={300}
                  hint={t("يظهر تحت الاسم، مثل «خبير التسويق الرقمي».", "Shown under the name, e.g. “Digital marketing expert”.")}
                />
                <Field
                  id="instructor-specialized"
                  label={t("التخصص", "Specialty")}
                  value={form.specialized}
                  onChange={set("specialized")}
                />
                <Field
                  id="instructor-status"
                  label={t("الحالة", "Status")}
                  options={[
                    ["active", t("نشط — يظهر في الموقع", "Active — shown on the site")],
                    ["inactive", t("موقوف — مخفي من الموقع", "Inactive — hidden from the site")],
                  ]}
                  value={form.status}
                  onChange={set("status")}
                />
              </div>

              <Field
                id="instructor-bio"
                type="textarea"
                rows={4}
                label={t("نبذة مختصرة", "Short bio")}
                value={form.bio}
                onChange={set("bio")}
                hint={t("صفحة المدرب تعرض README أو صفحة الاستوديو عند حفظها؛ النبذة احتياطي.", "The expert's page shows the README or Studio page once saved; the bio is the fallback.")}
              />

              <div className="ma-form-grid ma-form-grid--2">
                <ToggleField
                  id="instructor-featured"
                  label={t("ضمن خبراء الصفحة الرئيسية", "In the landing page’s experts line-up")}
                  checked={form.is_featured}
                  onChange={set("is_featured")}
                />
                <Field
                  id="instructor-featured-order"
                  type="number"
                  min={0}
                  dir="ltr"
                  label={t("الترتيب", "Order")}
                  value={form.featured_order}
                  onChange={set("featured_order")}
                  disabled={!form.is_featured}
                  hint={t("الأصغر أولًا. يلزم وجود صورة (تُرفع لاحقًا).", "Lowest first. Needs a photo (uploaded later).")}
                />
              </div>

              <ToggleField
                id="instructor-consultant"
                label={t("يقدّم استشارات (خبير استشارات)", "Gives consultations (consultant profile)")}
                checked={form.make_consultant}
                onChange={set("make_consultant")}
                hint={t("يُنشأ رقم خبير الاستشارات فورًا؛ البريد ومدة الجلسة والخدمات تُضبط من «إدارة الاستشارات» في صفحة المدرب.", "Their consultant profile is created at once; email, session length and services are set from “Consultations” on the expert's page.")}
              />

              <p className="ma-note">
                {t(
                  "يظهر المدرب في صفحة الخبراء العامة حتى يُسند إليه دورة أو منتج واحد — أسنِده من صفحة المدرب بعد الإنشاء، وارفع صورته الشخصية من هناك أيضًا.",
                  "The expert appears on the public experts page once a course or product is assigned to them — assign it from their page after creation, and upload their photo there too.",
                )}
              </p>
            </div>
          </Card>
        </div>

        <aside className="ma-form-aside">
          <Card title={t("ملخص المدرب", "Instructor summary")}>
            <Dl
              rows={[
                [t("الاسم", "Name"), form.display_name.trim() || t("—", "—")],
                [t("اللقب", "Title line"), form.headline.trim() || t("—", "—")],
                [t("التخصص", "Specialty"), form.specialized.trim() || t("—", "—")],
                [t("الحالة", "Status"), form.status === "active" ? t("نشط", "Active") : t("موقوف", "Inactive")],
                [t("الصفحة الرئيسية", "Landing page"), form.is_featured ? t("ضمن الخبراء", "In the line-up") : t("—", "—")],
                [t("استشارات", "Consultations"), form.make_consultant ? t("خبير استشارات", "Consultant") : t("—", "—")],
              ]}
            />
          </Card>

          <ErrorAlert error={create.error} title={t("تعذّر إضافة المدرب", "Couldn't add the instructor")} />

          <FormActions>
            <Button
              type="submit"
              kind="primary"
              icon="check"
              label={create.isPending ? t("جارٍ الإضافة…", "Adding…") : t("إضافة المدرب", "Add instructor")}
              disabled={create.isPending || invalid}
            />
            <Button kind="ghost" label={t("إلغاء", "Cancel")} href="/learning/instructors" />
          </FormActions>
        </aside>
      </form>
    </>
  );
}
