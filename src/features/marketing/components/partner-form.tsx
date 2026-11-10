import { useState } from "react";

import { type Partner, type PartnerInput } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Button, ErrorAlert, Field, FormActions } from "@/components/ui/kit";

/** Marketer details. Email and referral code are fixed after creation (identity, live links). */
export function PartnerForm({
  partner,
  pending,
  error,
  submitLabel,
  cancelHref,
  onSubmit,
}: {
  partner?: Partner;
  pending: boolean;
  error: unknown;
  submitLabel: string;
  cancelHref: string;
  onSubmit: (body: PartnerInput) => void;
}) {
  const t = useT();
  const [form, setForm] = useState({
    email: partner?.email ?? "",
    full_name: partner?.full_name ?? "",
    phone: partner?.phone ?? "",
    country_code: partner?.country_code ?? "",
    referral_code: partner?.referral_code ?? "",
    notes: partner?.notes ?? "",
  });
  const set = (key: keyof typeof form) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const disabled = pending || !form.email.includes("@");

  return (
    <form
      className="ma-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled) return;
        onSubmit({
          email: form.email.trim(),
          full_name: form.full_name.trim() || null,
          phone: form.phone.trim() || null,
          country_code: form.country_code.trim().toUpperCase() || null,
          referral_code: form.referral_code.trim() || null,
          notes: form.notes.trim() || null,
        });
      }}
    >
      <div className="ma-form-grid ma-form-grid--2">
        <Field id="partner-email" type="email" label={t("البريد الإلكتروني", "Email")} dir="ltr" required disabled={Boolean(partner)} value={form.email} onChange={set("email")} />
        <Field id="partner-name" label={t("الاسم", "Name")} value={form.full_name} onChange={set("full_name")} />
        <Field id="partner-phone" label={t("الجوال", "Phone")} dir="ltr" value={form.phone} onChange={set("phone")} />
        <Field id="partner-country" label={t("رمز الدولة", "Country code")} hint={t("AE, SA, EG… — مطلوب لربط حساب Stripe للتحويلات.", "AE, SA, EG… — needed to connect Stripe for payouts.")} dir="ltr" maxLength={2} value={form.country_code} onChange={set("country_code")} />
        <Field
          id="partner-code"
          label={t("كود الإحالة", "Referral code")}
          hint={partner ? t("ثابت بعد الإنشاء.", "Fixed after creation.") : t("يظهر في الرابط ?ref=… — يُولَّد تلقائيًا إذا تُرك فارغًا.", "Shown in the ?ref=… link — generated when empty.")}
          dir="ltr"
          disabled={Boolean(partner)}
          value={form.referral_code}
          onChange={(v) => set("referral_code")(v.toLowerCase().replace(/\s+/g, "-"))}
        />
      </div>
      <Field id="partner-notes" type="textarea" rows={3} label={t("ملاحظات داخلية", "Internal notes")} value={form.notes} onChange={set("notes")} />
      <ErrorAlert error={error} title={t("تعذّر حفظ المسوّق", "Couldn't save the affiliate")} />
      <FormActions>
        <Button type="submit" kind="primary" icon="check" disabled={disabled} label={pending ? t("جارٍ الحفظ…", "Saving…") : submitLabel} />
        <Button kind="ghost" label={t("إلغاء", "Cancel")} href={cancelHref} />
      </FormActions>
    </form>
  );
}
