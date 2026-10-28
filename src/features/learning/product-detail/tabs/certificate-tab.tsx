import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  certificateKeys,
  certificateQueries,
  openPdfBlob,
  renderCertificatePreviewPdf,
  saveCertificateSettings,
  type CertificatePreviewInput,
  type CertificateSettings,
  type CertificateSettingsInput,
  type CertificateSignatory,
} from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useCan } from "@/lib/permissions";
import { toast } from "@/components/ui/toast";
import { Button, Card, ErrorAlert, Field, FormActions, Loading } from "@/components/ui/kit";
import { CertificatePreviewFrame } from "@/features/certificates/components/certificate-preview-frame";
import { CertificateRecipients } from "@/features/certificates/components/certificate-recipients";
import { ToggleField } from "@/features/learning/product-form";

type Draft = {
  enabled: boolean;
  titleOverride: string;
  trainingHours: string;
  signatories: { name: string; lines: string }[];
  autoIssue: boolean;
  threshold: string;
  cpdEnabled: boolean;
  cpdHours: string;
  cpdRef: string;
  physicalEnabled: boolean;
  cpdPrice: string;
  physicalPrice: string;
};

function toDraft(s: CertificateSettings): Draft {
  return {
    enabled: s.enabled ?? true,
    titleOverride: s.title_override ?? "",
    trainingHours: s.training_hours != null ? String(s.training_hours) : "",
    signatories: s.signatories.map((sig) => ({ name: sig.name, lines: (sig.lines ?? []).join("\n") })),
    autoIssue: s.auto_issue ?? false,
    threshold: String(s.completion_threshold_pct ?? 100),
    cpdEnabled: s.cpd_enabled ?? false,
    cpdHours: s.cpd_hours != null ? String(s.cpd_hours) : "",
    cpdRef: s.cpd_provider_ref ?? "",
    physicalEnabled: s.physical_enabled ?? false,
    cpdPrice: s.cpd_price_minor != null ? String(s.cpd_price_minor / 100) : "",
    physicalPrice: s.physical_price_minor != null ? String(s.physical_price_minor / 100) : "",
  };
}

const intOrNull = (value: string): number | null => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const minorOrNull = (value: string): number | null => {
  const parsed = Number(value.trim());
  return value.trim() !== "" && Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null;
};

function toInput(d: Draft, currency: string | null | undefined): CertificateSettingsInput {
  const signatories: CertificateSignatory[] = d.signatories
    .filter((s) => s.name.trim())
    .map((s) => ({
      name: s.name.trim(),
      lines: s.lines
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 4),
    }));
  return {
    enabled: d.enabled,
    title_override: d.titleOverride.trim() || null,
    training_hours: intOrNull(d.trainingHours),
    signatories,
    auto_issue: d.autoIssue,
    completion_threshold_pct: Math.min(100, Math.max(1, intOrNull(d.threshold) ?? 100)),
    cpd_enabled: d.cpdEnabled,
    cpd_hours: intOrNull(d.cpdHours),
    cpd_provider_ref: d.cpdRef.trim() || null,
    physical_enabled: d.physicalEnabled,
    cpd_price_minor: minorOrNull(d.cpdPrice),
    physical_price_minor: minorOrNull(d.physicalPrice),
    currency: currency ?? null,
  };
}

/**
 * Certificate section of a course, diploma or live diploma: how the certificate looks (live preview of the
 * real template), when it is issued, the paid CPD / printed-copy add-ons, and who has received one.
 */
export function CertificateTab({
  productRef,
  productId,
  productType,
}: {
  productRef: string;
  productId: string;
  productType: string;
}) {
  const t = useT();
  const settings = useQuery(certificateQueries.settings(productRef));

  if (settings.isLoading) return <Loading />;
  if (settings.error || !settings.data) return <ErrorAlert error={settings.error} />;

  return (
    <>
      <CertificateSettingsEditor key={settings.data.updated_at ?? "new"} productRef={productRef} settings={settings.data} />
      <CertificateRecipients productRef={productRef} productId={productId} isLiveDiploma={productType === "live_diploma"} />
      {!settings.data.configured ? (
        <p className="ma-help" style={{ marginTop: 8 }}>
          {t(
            "الإعدادات المعروضة افتراضية من بيانات المنتج؛ احفظها لتفعيل الشهادة بهذه القيم.",
            "These are defaults from the product; save them to use these values.",
          )}
        </p>
      ) : null}
    </>
  );
}

function CertificateSettingsEditor({ productRef, settings }: { productRef: string; settings: CertificateSettings }) {
  const t = useT();
  const queryClient = useQueryClient();
  const canWrite = useCan("certificates.write");
  const [draft, setDraft] = useState<Draft>(() => toDraft(settings));
  const [sampleName, setSampleName] = useState("");
  const [showCpd, setShowCpd] = useState(true);
  const [showQr, setShowQr] = useState(true);
  const patch = (next: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...next }));

  const input = useMemo(() => toInput(draft, settings.currency), [draft, settings.currency]);
  const previewInput: CertificatePreviewInput = useMemo(
    () => ({ settings: input, sample_name: sampleName.trim() || null, show_cpd: showCpd, show_qr: showQr }),
    [input, sampleName, showCpd, showQr],
  );
  const dirty = JSON.stringify(input) !== JSON.stringify(toInput(toDraft(settings), settings.currency));
  const invalid = input.signatories.length === 0;

  const save = useMutation({
    mutationFn: () => saveCertificateSettings(productRef, input),
    onSuccess: (saved) => {
      toast.success(t("تم حفظ إعدادات الشهادة", "Certificate settings saved"));
      queryClient.setQueryData(certificateKeys.settings(productRef), saved);
    },
  });
  const samplePdf = useMutation({
    mutationFn: () => renderCertificatePreviewPdf(productRef, previewInput),
    onSuccess: (blob) => openPdfBlob(blob, "certificate-sample.pdf"),
  });

  const setSignatory = (index: number, next: Partial<Draft["signatories"][number]>) =>
    patch({ signatories: draft.signatories.map((s, i) => (i === index ? { ...s, ...next } : s)) });

  return (
    <div
      className="ma-cert-editor"
      style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 5fr) minmax(0, 7fr)", alignItems: "start" }}
    >
      <form
        className="ma-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!invalid && canWrite) save.mutate();
        }}
      >
        <Card title={t("محتوى الشهادة", "Certificate content")}>
          <div className="ma-form">
            <ToggleField
              id="cert-enabled"
              label={t("إصدار شهادة لهذا المنتج", "Issue a certificate for this product")}
              checked={draft.enabled}
              onChange={(enabled) => patch({ enabled })}
            />
            <Field
              id="cert-title"
              dir="ltr"
              label={t("العنوان المطبوع (بالإنجليزية)", "Printed title (English)")}
              hint={t("اتركه فارغًا لاستخدام عنوان المنتج.", "Leave empty to use the product title.")}
              value={draft.titleOverride}
              maxLength={300}
              onChange={(titleOverride) => patch({ titleOverride })}
            />
            <Field
              id="cert-hours"
              type="number"
              min={0}
              dir="ltr"
              label={t("ساعات التدريب", "Training hours")}
              value={draft.trainingHours}
              onChange={(trainingHours) => patch({ trainingHours })}
            />
            {draft.signatories.map((sig, index) => (
              <div key={index} className="ma-form" style={{ gap: 8 }}>
                <Field
                  id={`cert-sig-${index}`}
                  dir="ltr"
                  label={t(`الموقّع ${index + 1}`, `Signatory ${index + 1}`)}
                  value={sig.name}
                  maxLength={120}
                  onChange={(name) => setSignatory(index, { name })}
                />
                <Field
                  id={`cert-sig-lines-${index}`}
                  type="textarea"
                  rows={2}
                  dir="ltr"
                  label={t("المسمّى (سطر لكل مسمّى)", "Titles (one per line)")}
                  value={sig.lines}
                  onChange={(lines) => setSignatory(index, { lines })}
                />
                {draft.signatories.length > 1 ? (
                  <Button
                    sm
                    kind="ghost"
                    icon="trash"
                    label={t("إزالة الموقّع", "Remove signatory")}
                    onClick={() => patch({ signatories: draft.signatories.filter((_, i) => i !== index) })}
                  />
                ) : null}
              </div>
            ))}
            {draft.signatories.length < 2 ? (
              <Button
                sm
                kind="soft"
                icon="plus"
                label={t("إضافة موقّع", "Add signatory")}
                onClick={() => patch({ signatories: [...draft.signatories, { name: "", lines: "" }] })}
              />
            ) : null}
          </div>
        </Card>

        <Card title={t("الإصدار", "Issuing")}>
          <div className="ma-form">
            <ToggleField
              id="cert-auto"
              label={t("إصدار تلقائي عند إتمام التقدّم", "Issue automatically when progress is complete")}
              hint={t("لا ينطبق على الدبلومات المباشرة", "not for live diplomas")}
              checked={draft.autoIssue}
              onChange={(autoIssue) => patch({ autoIssue })}
            />
            {draft.autoIssue ? (
              <Field
                id="cert-threshold"
                type="number"
                min={1}
                max={100}
                dir="ltr"
                label={t("نسبة الإتمام المطلوبة %", "Required completion %")}
                value={draft.threshold}
                onChange={(threshold) => patch({ threshold })}
              />
            ) : null}
          </div>
        </Card>

        <Card title={t("الإضافات المدفوعة عند الشراء", "Paid add-ons at checkout")}>
          <div className="ma-form">
            <ToggleField
              id="cert-cpd"
              label={t("شهادة CPD معتمدة", "CPD-accredited certificate")}
              checked={draft.cpdEnabled}
              onChange={(cpdEnabled) => patch({ cpdEnabled })}
            />
            {draft.cpdEnabled ? (
              <>
                <Field
                  id="cert-cpd-hours"
                  type="number"
                  min={0}
                  dir="ltr"
                  label={t("ساعات CPD", "CPD hours")}
                  value={draft.cpdHours}
                  onChange={(cpdHours) => patch({ cpdHours })}
                />
                <Field
                  id="cert-cpd-ref"
                  dir="ltr"
                  label={t("رقم اعتماد CPD", "CPD reference")}
                  value={draft.cpdRef}
                  maxLength={120}
                  onChange={(cpdRef) => patch({ cpdRef })}
                />
                <Field
                  id="cert-cpd-price"
                  type="number"
                  min={0}
                  step="any"
                  dir="ltr"
                  label={t(`سعر CPD لهذا المنتج (${settings.currency ?? "USD"})`, `CPD price for this product (${settings.currency ?? "USD"})`)}
                  hint={t("اتركه فارغًا لاستخدام السعر العام للإضافة.", "Leave empty to use the global add-on price.")}
                  value={draft.cpdPrice}
                  onChange={(cpdPrice) => patch({ cpdPrice })}
                />
              </>
            ) : null}
            <ToggleField
              id="cert-physical"
              label={t("نسخة مطبوعة تُشحن للعميل", "Printed copy shipped to the customer")}
              checked={draft.physicalEnabled}
              onChange={(physicalEnabled) => patch({ physicalEnabled })}
            />
            {draft.physicalEnabled ? (
              <Field
                id="cert-physical-price"
                type="number"
                min={0}
                step="any"
                dir="ltr"
                label={t(`سعر النسخة المطبوعة (${settings.currency ?? "USD"})`, `Printed copy price (${settings.currency ?? "USD"})`)}
                hint={t("اتركه فارغًا لاستخدام السعر العام للإضافة.", "Leave empty to use the global add-on price.")}
                value={draft.physicalPrice}
                onChange={(physicalPrice) => patch({ physicalPrice })}
              />
            ) : null}
          </div>
        </Card>

        <ErrorAlert error={save.error} title={t("تعذّر حفظ الإعدادات", "Couldn't save the settings")} />
        <FormActions>
          {dirty ? (
            <Button kind="ghost" label={t("تراجع", "Discard")} onClick={() => setDraft(toDraft(settings))} />
          ) : null}
          <Button
            type="submit"
            kind="primary"
            icon="check"
            label={save.isPending ? t("جارٍ الحفظ…", "Saving…") : t("حفظ إعدادات الشهادة", "Save certificate settings")}
            disabled={!canWrite || save.isPending || invalid || (!dirty && settings.configured)}
          />
        </FormActions>
      </form>

      <div style={{ position: "sticky", top: 72 }}>
        <Card
          title={t("معاينة مباشرة", "Live preview")}
          actions={
            <Button
              sm
              kind="soft"
              icon="download"
              label={samplePdf.isPending ? t("جارٍ الإنشاء…", "Rendering…") : t("PDF تجريبي", "Sample PDF")}
              disabled={samplePdf.isPending}
              onClick={() => samplePdf.mutate()}
            />
          }
        >
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 12 }}>
            <div style={{ flex: "1 1 200px" }}>
              <Field
                id="cert-sample-name"
                dir="ltr"
                label={t("اسم تجريبي", "Sample name")}
                placeholder="Student Name"
                value={sampleName}
                onChange={setSampleName}
              />
            </div>
            <ToggleField id="cert-show-cpd" label={t("إظهار علامة CPD", "Show CPD mark")} checked={showCpd} onChange={setShowCpd} />
            <ToggleField id="cert-show-qr" label={t("رمز التحقق QR", "Verification QR")} checked={showQr} onChange={setShowQr} />
          </div>
          <CertificatePreviewFrame productRef={productRef} input={previewInput} />
          <ErrorAlert error={samplePdf.error} />
        </Card>
      </div>
    </div>
  );
}

