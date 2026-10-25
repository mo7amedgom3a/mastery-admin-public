import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  expertProfilesKeys,
  updateExpertProfile,
  uploadExpertImage,
  type ExpertProfileDetail,
  type ExpertProfileUpdate,
} from "@/lib/api";
import { useT } from "@/lib/i18n";
import { initialsOf } from "@/lib/status";
import { toast } from "@/components/ui/toast";
import { Avatar, Button, Card, ErrorAlert, Field, FormActions } from "@/components/ui/kit";

/*
 * The expert's public profile (`b2c.instructors`): identity, title line, status, the landing line-up,
 * details and socials, plus avatar and cover uploads. Saving refreshes the storefront profile, the
 * `/experts` directory and the landing page.
 */

type FormState = Record<
  | "display_name" | "headline" | "status" | "featured_order" | "specialized" | "scoped_experience" | "languages"
  | "city" | "educational_level" | "years_of_experience" | "facebook_url" | "instagram_url" | "youtube_url",
  string
> & { is_featured: boolean };

function formOf(expert: ExpertProfileDetail): FormState {
  return {
    display_name: expert.name ?? "",
    headline: expert.headline ?? "",
    status: expert.status,
    is_featured: Boolean(expert.is_featured),
    featured_order: expert.featured_order != null ? String(expert.featured_order) : "",
    specialized: expert.specialized ?? "",
    scoped_experience: expert.scoped_experience ?? "",
    languages: expert.languages ?? "",
    city: expert.city ?? "",
    educational_level: expert.educational_level ?? "",
    years_of_experience: expert.years_of_experience ?? "",
    facebook_url: expert.facebook_url ?? "",
    instagram_url: expert.instagram_url ?? "",
    youtube_url: expert.youtube_url ?? "",
  };
}

/** Only what changed, with empty text sent as `null` (cleared). */
function changesOf(before: FormState, after: FormState): ExpertProfileUpdate {
  const body: Record<string, unknown> = {};
  for (const field of Object.keys(after) as (keyof FormState)[]) {
    if (after[field] === before[field]) continue;
    if (field === "is_featured") body[field] = after[field];
    else if (field === "featured_order") body[field] = after[field] === "" ? null : Number(after[field]);
    else body[field] = (after[field] as string).trim() === "" ? null : (after[field] as string).trim();
  }
  return body as ExpertProfileUpdate;
}

const URL_FIELDS = ["facebook_url", "instagram_url", "youtube_url"] as const;

export function ExpertProfileForm({ expert, onSaved }: { expert: ExpertProfileDetail; onSaved?: () => void }) {
  const t = useT();
  const queryClient = useQueryClient();
  const initial = formOf(expert);
  const [form, setForm] = useState<FormState>(initial);
  const set = (field: keyof FormState) => (value: string) => setForm((current) => ({ ...current, [field]: value }));
  const changes = changesOf(initial, form);
  const dirty = Object.keys(changes).length > 0;
  const badUrl = URL_FIELDS.find((field) => form[field].trim() !== "" && !/^https:\/\//i.test(form[field].trim()));
  const invalid = form.display_name.trim().length < 2 || Boolean(badUrl);

  const refresh = (next: ExpertProfileDetail) => {
    queryClient.setQueryData(expertProfilesKeys.detail(expert.key), next);
    queryClient.invalidateQueries({ queryKey: expertProfilesKeys.all });
    onSaved?.();
  };

  const save = useMutation({
    mutationFn: () => updateExpertProfile(expert.key, changes),
    onSuccess: (next) => {
      toast.success(t("تم حفظ الملف الشخصي", "Profile saved"));
      setForm(formOf(next));
      refresh(next);
    },
  });

  return (
    <div className="grid content-start gap-4">
      <ExpertImages expert={expert} onUploaded={refresh} />
      <Card title={t("الملف الشخصي العام", "Public profile")}>
        <form
          className="ma-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!invalid && dirty) save.mutate();
          }}
        >
          <div className="ma-form-grid ma-form-grid--2">
            <Field id="expert-name" label={t("الاسم", "Name")} required value={form.display_name} onChange={set("display_name")} />
            <Field
              id="expert-headline"
              label={t("اللقب / العنوان", "Title line")}
              value={form.headline}
              onChange={set("headline")}
              maxLength={300}
              hint={t("يظهر تحت الاسم، مثل «خبير التسويق الرقمي».", "Shown under the name, e.g. “Digital marketing expert”.")}
            />
            <Field
              id="expert-status"
              label={t("الحالة", "Status")}
              options={[
                ["active", t("نشط — يظهر في الموقع", "Active — shown on the site")],
                ["inactive", t("موقوف — مخفي من الموقع", "Inactive — hidden from the site")],
              ]}
              value={form.status}
              onChange={set("status")}
            />
            <Field id="expert-specialized" label={t("التخصص", "Specialty")} value={form.specialized} onChange={set("specialized")} />
          </div>

          <fieldset className="ma-form-grid ma-form-grid--2" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="ma-label">{t("الصفحة الرئيسية", "Landing page")}</legend>
            <label className="ma-cell-flex" style={{ gap: "8px" }}>
              <input
                type="checkbox"
                checked={form.is_featured}
                onChange={(event) => setForm((current) => ({ ...current, is_featured: event.target.checked }))}
              />
              <span>{t("ضمن خبراء الصفحة الرئيسية", "In the landing page’s experts line-up")}</span>
            </label>
            <Field
              id="expert-featured-order"
              type="number"
              min={0}
              dir="ltr"
              label={t("الترتيب", "Order")}
              value={form.featured_order}
              onChange={set("featured_order")}
              disabled={!form.is_featured}
              hint={t("الأصغر أولًا. يلزم وجود صورة.", "Lowest first. Needs a photo.")}
            />
          </fieldset>

          <div className="ma-form-grid ma-form-grid--2">
            <Field id="expert-scope" label={t("قطاع الخبرة", "Experience sector")} value={form.scoped_experience} onChange={set("scoped_experience")} />
            <Field id="expert-years" label={t("سنوات الخبرة", "Years of experience")} value={form.years_of_experience} onChange={set("years_of_experience")} />
            <Field id="expert-education" label={t("المؤهل العلمي", "Education")} value={form.educational_level} onChange={set("educational_level")} />
            <Field id="expert-languages" label={t("لغات التدريب", "Training languages")} value={form.languages} onChange={set("languages")} />
            <Field id="expert-city" label={t("المدينة", "City")} value={form.city} onChange={set("city")} />
          </div>

          <div className="ma-form-grid ma-form-grid--2">
            <Field id="expert-facebook" dir="ltr" label="Facebook" value={form.facebook_url} onChange={set("facebook_url")} placeholder="https://" />
            <Field id="expert-instagram" dir="ltr" label="Instagram" value={form.instagram_url} onChange={set("instagram_url")} placeholder="https://" />
            <Field id="expert-youtube" dir="ltr" label="YouTube" value={form.youtube_url} onChange={set("youtube_url")} placeholder="https://" />
          </div>
          {badUrl ? (
            <p className="ma-help" role="alert">{t("روابط التواصل يجب أن تبدأ بـ https://", "Social links must start with https://")}</p>
          ) : null}

          <ErrorAlert error={save.error} title={t("تعذّر حفظ الملف الشخصي", "Couldn't save the profile")} />
          <FormActions>
            <Button
              type="submit"
              kind="primary"
              icon="check"
              disabled={save.isPending || invalid || !dirty}
              label={save.isPending ? t("جارٍ الحفظ…", "Saving…") : t("حفظ", "Save")}
            />
            {dirty ? <Button kind="ghost" label={t("تجاهل التغييرات", "Discard changes")} onClick={() => setForm(initial)} /> : null}
          </FormActions>
        </form>
      </Card>
    </div>
  );
}

/** Avatar and cover: pick a file, it uploads to S3 and is set on the profile at once. */
function ExpertImages({ expert, onUploaded }: { expert: ExpertProfileDetail; onUploaded: (next: ExpertProfileDetail) => void }) {
  const t = useT();
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: ({ file, kind }: { file: File; kind: "avatar" | "cover" }) => uploadExpertImage(expert.key, file, kind),
    onSuccess: (result) => {
      toast.success(result.kind === "avatar" ? t("تم تحديث الصورة", "Photo updated") : t("تم تحديث الغلاف", "Cover updated"));
      onUploaded(result.instructor);
    },
  });
  const pick = (kind: "avatar" | "cover") => (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("الحد الأقصى 5 ميجابايت", "5 MB at most"));
      return;
    }
    upload.mutate({ file, kind });
  };
  const busy = upload.isPending ? upload.variables?.kind : null;

  return (
    <Card title={t("الصور", "Images")}>
      <div className="ma-cols ma-cols--2">
        <div className="ma-cell-flex" style={{ gap: "var(--space-4)" }}>
          <Avatar initials={initialsOf(expert.name)} src={expert.avatar_url} color="var(--sky)" alt={expert.name} lg />
          <div className="grid gap-2">
            <strong>{t("الصورة الشخصية", "Profile photo")}</strong>
            <span className="ma-help">{t("JPEG أو PNG أو WebP، حتى 5 ميجابايت.", "JPEG, PNG or WebP, up to 5 MB.")}</span>
            <input ref={avatarInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pick("avatar")} />
            <Button
              sm
              icon="upload"
              disabled={Boolean(busy)}
              label={busy === "avatar" ? t("جارٍ الرفع…", "Uploading…") : t("رفع صورة", "Upload photo")}
              onClick={() => avatarInput.current?.click()}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <strong>{t("صورة الغلاف", "Cover image")}</strong>
          {expert.cover_url ? (
            <img src={expert.cover_url} alt="" style={{ width: "100%", maxHeight: 120, objectFit: "cover", borderRadius: "var(--radius-soft)" }} />
          ) : (
            <span className="ma-help">{t("لا يوجد غلاف.", "No cover yet.")}</span>
          )}
          <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pick("cover")} />
          <Button
            sm
            icon="upload"
            disabled={Boolean(busy)}
            label={busy === "cover" ? t("جارٍ الرفع…", "Uploading…") : t("رفع غلاف", "Upload cover")}
            onClick={() => coverInput.current?.click()}
          />
        </div>
      </div>
      <ErrorAlert error={upload.error} title={t("تعذّر رفع الصورة", "Couldn't upload the image")} />
    </Card>
  );
}
