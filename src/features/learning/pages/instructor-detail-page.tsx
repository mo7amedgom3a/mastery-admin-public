import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Monitor, Smartphone } from "lucide-react";

import { expertProfilesKeys, expertProfilesQueries, setExpertConsultations, type ExpertProfileDetail } from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { initialsOf } from "@/lib/status";
import { Alert, Avatar, Badge, Button, Card, Dl, ErrorAlert, Field, FormActions, Kpi, Loading, PageHead, PageTabs } from "@/components/ui/kit";
import { toast } from "@/components/ui/toast";
import { PageState } from "@/components/ui/primitives";
import { ExpertPreview } from "@/features/learning/expert-profile/expert-preview";
import { expertPublicUrl } from "@/features/learning/expert-profile/urls";
import { ExpertExpertiseCard } from "@/features/learning/expert-profile/expert-expertise-card";
import { ExpertProductsCard } from "@/features/learning/expert-profile/expert-products-card";
import { ExpertProfileForm } from "@/features/learning/expert-profile/expert-profile-form";
import type { PreviewDevice } from "@/features/learning/studio/preview/use-preview-channel";

/*
 * One expert (trainer and/or consultant) on B2C: profile and images, the products they teach, and a live
 * preview of their storefront page; the page content itself is edited in the Studio. `:trainerId` is the
 * expert key (legacy trainer id, `c{id}`, or uuid), so old `/learning/instructors/9` links still open.
 */

type Tab = "" | "products" | "preview";

export default function InstructorDetailPage() {
  const t = useT();
  const { trainerId: key = "", tab = "" } = useParams<{ trainerId: string; tab?: string }>();
  const query = useQuery(expertProfilesQueries.detail(key));
  const expert = query.data;
  const base = `/learning/instructors/${encodeURIComponent(key)}`;
  const active: Tab = tab === "products" || tab === "preview" ? tab : "";
  const queryClient = useQueryClient();

  return (
    <>
      <PageHead
        back={{ href: "/learning/instructors", label: t("المدربون والخبراء", "Instructors & experts") }}
        title={expert?.name ?? `#${key}`}
        status={expert ? <ExpertBadges expert={expert} /> : undefined}
        sub={expert?.headline || expert?.specialized || `#${key}`}
        actions={
          <>
            <Button kind="ghost" icon="refresh" label={t("تحديث", "Refresh")} onClick={() => { void queryClient.invalidateQueries({ queryKey: expertProfilesKeys.all }); }} />
            <Button kind="primary" icon="edit" label={t("فتح الاستوديو", "Open Studio")} href={`${base}/studio`} />
            <Button kind="ghost" icon="link" label={t("الصفحة العامة", "Public page")} href={expertPublicUrl(key)} target="_blank" rel="noopener noreferrer" />
          </>
        }
      />
      <PageTabs
        base={base}
        active={active}
        list={[
          ["", t("الملف الشخصي", "Profile")],
          ["products", t("المنتجات والموارد", "Products & resources")],
          ["preview", t("المعاينة", "Preview")],
        ]}
      />
      <PageState error={query.error}>
        {expert ? (
          <>
            {expert.merged_into_key ? (
              <Alert kind="warning" title={t("ملف مكرر تم دمجه", "Merged duplicate")}>
                {t("نُقلت منتجات هذا الملف واستشاراته وصفحته إلى الملف الأساسي، ورابطه العام يفتح الملف الأساسي.", "Its products, consultations and page moved to the main profile, and its public link opens that profile.")}{" "}
                <Button sm kind="ghost" label={t("فتح الملف الأساسي", "Open the main profile")} href={`/learning/instructors/${encodeURIComponent(expert.merged_into_key)}`} />
              </Alert>
            ) : null}
            <div className="ma-kpis">
              <Kpi label={t("المنتجات المسندة", "Assigned products")} value={formatNumber(expert.product_count)} icon="book" />
              <Kpi label={t("خدمات الاستشارة", "Consultation services")} value={formatNumber(expert.consultation_count)} icon="calendar" />
              <Kpi
                label={t("محتوى الصفحة", "Page content")}
                value={expert.has_page ? t("صفحة الاستوديو", "Studio page") : expert.has_readme ? "README" : t("نبذة قديمة", "Legacy bio")}
                icon="file"
              />
            </div>
            {active === "" ? (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
                <ExpertProfileForm key={expert.updated_at ?? expert.key} expert={expert} />
                <div className="grid content-start gap-4">
                  <ExpertExpertiseCard key={expert.updated_at ?? expert.key} expert={expert} />
                  <ConsultationsCard expert={expert} />
                  <Card title={t("السجل", "Record")}>
                    <Dl
                      rows={[
                        [t("المفتاح", "Key"), <bdi key="k">{expert.key}</bdi>],
                        [t("رقم المدرب القديم", "Legacy trainer id"), expert.legacy_trainer_id ?? "—"],
                        [t("أُنشئ", "Created"), formatDateTime(expert.created_at)],
                        [t("آخر تعديل", "Updated"), formatDateTime(expert.updated_at)],
                      ]}
                    />
                  </Card>
                </div>
              </div>
            ) : null}
            {active === "products" ? (
              <ExpertProductsCard
                expertKey={expert.key}
                consultantHref={expert.consultant_id ? `/consultations/experts/${expert.consultant_id}` : null}
              />
            ) : null}
            {active === "preview" ? <PreviewTab expert={expert} /> : null}
          </>
        ) : (
          <Loading />
        )}
      </PageState>
    </>
  );
}

function ExpertBadges({ expert }: { expert: ExpertProfileDetail }) {
  return (
    <>
      <Badge
        def={{
          label: expert.status === "active" ? { ar: "نشط", en: "Active" } : { ar: "موقوف", en: "Inactive" },
          tone: expert.status === "active" ? "success" : "warning",
        }}
      />{" "}
      {expert.product_count > 0 ? <Badge def={{ label: { ar: "مدرّب", en: "Trainer" }, tone: "info" }} /> : null}{" "}
      {expert.is_consultant ? <Badge def={{ label: { ar: "خبير استشارات", en: "Consultant" }, tone: "info" }} /> : null}{" "}
      {expert.is_featured ? <Badge def={{ label: { ar: "في الصفحة الرئيسية", en: "Featured" }, tone: "neutral" }} /> : null}
    </>
  );
}

/** Whether they give consultations: turn them on or off, and where services, availability and bookings are managed. */
function ConsultationsCard({ expert }: { expert: ExpertProfileDetail }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [enabling, setEnabling] = useState(false);
  const [email, setEmail] = useState("");
  const [minutes, setMinutes] = useState("60");
  const toggle = useMutation({
    mutationFn: (active: boolean) =>
      setExpertConsultations(expert.key, active ? { active, email: email.trim() || null, session_minutes: Number(minutes) || 60 } : { active }),
    onSuccess: (next, active) => {
      queryClient.setQueryData(expertProfilesKeys.detail(expert.key), next);
      queryClient.invalidateQueries({ queryKey: expertProfilesKeys.all });
      setEnabling(false);
      toast.success(active ? t("تم تفعيل الاستشارات", "Consultations turned on") : t("تم إيقاف الاستشارات", "Consultations turned off"));
    },
  });
  const merged = Boolean(expert.merged_into_key);

  return (
    <Card title={t("الاستشارات", "Consultations")}>
      <div className="ma-cell-flex" style={{ gap: "var(--space-3)", marginBlockEnd: "var(--space-3)" }}>
        <Avatar initials={initialsOf(expert.name)} src={expert.avatar_url} color="var(--purple)" alt={expert.name} />
        <span>
          {expert.is_consultant
            ? t(`يقدّم ${formatNumber(expert.consultation_count)} خدمة استشارية · جلسة ${expert.session_minutes ?? 60} دقيقة.`,
                `Gives ${formatNumber(expert.consultation_count)} consultation service(s) · ${expert.session_minutes ?? 60}-minute sessions.`)
            : expert.consultant_id
              ? t("الاستشارات متوقفة.", "Consultations are turned off.")
              : t("لا يقدّم استشارات.", "Doesn't give consultations.")}
        </span>
      </div>
      <div className="grid gap-2">
        {expert.consultant_id ? (
          <Button icon="calendar" label={t("الخدمات والمواعيد والحجوزات", "Services, availability & bookings")} href={`/consultations/experts/${expert.consultant_id}`} />
        ) : null}
        {merged ? null : expert.is_consultant ? (
          <Button kind="ghost" label={t("إيقاف الاستشارات", "Turn consultations off")} disabled={toggle.isPending} onClick={() => toggle.mutate(false)} />
        ) : expert.consultant_id ? (
          <Button kind="primary" label={t("تفعيل الاستشارات", "Turn consultations on")} disabled={toggle.isPending} onClick={() => toggle.mutate(true)} />
        ) : enabling ? (
          <form className="ma-form" onSubmit={(event) => { event.preventDefault(); toggle.mutate(true); }}>
            <Field id="consult-email" type="email" dir="ltr" label={t("بريد الحجوزات (اختياري)", "Bookings email (optional)")} value={email} onChange={setEmail} />
            <Field id="consult-minutes" type="number" min={5} max={240} step={5} dir="ltr" label={t("مدة الجلسة (دقيقة)", "Session length (minutes)")} value={minutes} onChange={setMinutes} />
            <FormActions>
              <Button type="submit" kind="primary" icon="check" disabled={toggle.isPending} label={t("تفعيل", "Turn on")} />
              <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={() => setEnabling(false)} />
            </FormActions>
          </form>
        ) : (
          <Button kind="primary" icon="plus" label={t("تفعيل الاستشارات لهذا المدرّب", "Turn on consultations")} onClick={() => setEnabling(true)} />
        )}
        <ErrorAlert error={toggle.error} title={t("تعذّر تحديث الاستشارات", "Couldn't update consultations")} />
      </div>
    </Card>
  );
}

function PreviewTab({ expert }: { expert: ExpertProfileDetail }) {
  const t = useT();
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  return (
    <Card
      title={t("معاينة صفحة المدرّب", "Expert page preview")}
      actions={
        <div className="ma-seg" role="group" aria-label={t("جهاز المعاينة", "Preview device")}>
          <button type="button" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")} title={t("سطح المكتب", "Desktop")}>
            <Monitor size={16} aria-hidden />
          </button>
          <button type="button" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")} title={t("الجوال", "Mobile")}>
            <Smartphone size={16} aria-hidden />
          </button>
        </div>
      }
    >
      {expert.status !== "active" ? (
        <Alert kind="warning" title={t("الملف موقوف", "This profile is inactive")}>
          {t("الصفحة مخفية عن الموقع؛ تظهر هنا في المعاينة فقط.", "The page is hidden from the site; only this preview shows it.")}
        </Alert>
      ) : null}
      <div style={{ height: "75vh" }}>
        <ExpertPreview expertKey={expert.key} device={device} />
      </div>
    </Card>
  );
}
