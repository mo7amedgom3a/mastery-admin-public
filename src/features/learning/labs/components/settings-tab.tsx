import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  exportLab,
  labsKeys,
  setLabStatus,
  updateLabRelease,
  type LabDetail,
  type LabStatus,
} from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Button, Card, ErrorAlert, Field, FormActions } from "@/components/ui/kit";
import { SelectField } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";

import { LAB_STATUS, LAB_STATUSES } from "../model";

function toLocal(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocal(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Settings tab: release window, rollout, kill switch, workflow status and export. */
export function SettingsTab({ detail, canPublish }: { detail: LabDetail; canPublish: boolean }) {
  const t = useT();
  const queryClient = useQueryClient();
  const lab = detail.lab;
  const release = lab.release ?? {};
  const [locales, setLocales] = useState(((release.locales as string[] | undefined) ?? ["ar"]).join(", "));
  const [startsAt, setStartsAt] = useState(toLocal(release.starts_at as string | undefined));
  const [endsAt, setEndsAt] = useState(toLocal(release.ends_at as string | undefined));
  const [rollout, setRollout] = useState(String(release.rollout_pct ?? 100));
  const [killSwitch, setKillSwitch] = useState(Boolean(release.kill_switch));
  const [status, setStatus] = useState<LabStatus>(lab.status);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: labsKeys.detail(lab.lab_id) });
    void queryClient.invalidateQueries({ queryKey: labsKeys.list() });
  };

  const saveRelease = useMutation({
    mutationFn: () =>
      updateLabRelease(lab.lab_id, {
        locales: locales.split(",").map((item) => item.trim()).filter(Boolean),
        starts_at: fromLocal(startsAt),
        ends_at: fromLocal(endsAt),
        rollout_pct: Number.parseInt(rollout || "100", 10),
        kill_switch: killSwitch,
      }),
    onSuccess: () => {
      toast.success(t("حُدّثت إعدادات الإطلاق", "Release settings saved"));
      refresh();
    },
  });

  const saveStatus = useMutation({
    mutationFn: () => setLabStatus(lab.lab_id, status as Exclude<LabStatus, "published">),
    onSuccess: () => {
      toast.success(t("حُدّثت الحالة", "Status updated"));
      refresh();
    },
  });

  const download = useMutation({
    mutationFn: () => exportLab(lab.lab_id),
    onSuccess: (bundle) => {
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${lab.slug}.lab.json`;
      link.click();
      URL.revokeObjectURL(url);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : String(error)),
  });

  return (
    <>
      <Card title={t("الإطلاق", "Release")}>
        <p className="ma-help">
          {t(
            "نافذة الإطلاق ونسبة الطرح والقتل السريع تُطبَّق على الجلسات الجديدة فقط (تُحفظ في عمود الإصدار ولا تغيّر اللقطة المنشورة).",
            "The release window, rollout percentage and kill switch apply to new sessions only (stored with the release, not baked into the published snapshot).",
          )}
        </p>
        <div className="ma-form-grid">
          <Field id="rel-locales" label={t("اللغات", "Locales")} value={locales} onChange={setLocales} hint="ar, en" />
          <Field id="rel-start" label={t("تبدأ", "Starts at")} type="datetime-local" value={startsAt} onChange={setStartsAt} />
          <Field id="rel-end" label={t("تنتهي", "Ends at")} type="datetime-local" value={endsAt} onChange={setEndsAt} />
          <Field id="rel-rollout" label={t("نسبة الطرح %", "Rollout %")} type="number" value={rollout} onChange={setRollout} />
        </div>
        <label className="ma-check" style={{ justifyContent: "flex-start", gap: 8, marginBlockStart: "var(--space-3)", width: "fit-content" }}>
          <input type="checkbox" checked={killSwitch} disabled={!canPublish} onChange={() => setKillSwitch((value) => !value)} />
          {t("قتل سريع: أوقف بدء جلسات جديدة فورًا", "Kill switch: stop new sessions immediately")}
        </label>
        {saveRelease.error ? <ErrorAlert error={saveRelease.error} /> : null}
        <FormActions>
          <Button
            kind="primary"
            label={saveRelease.isPending ? t("جارٍ الحفظ…", "Saving…") : t("حفظ الإطلاق", "Save release")}
            disabled={!canPublish || saveRelease.isPending}
            onClick={() => saveRelease.mutate()}
          />
        </FormActions>
      </Card>

      <Card title={t("دورة الحالة", "Workflow status")}>
        <p className="ma-help">
          {t(
            "النشر يتم من زر «نشر». هنا تنقل المسودة بين المراجعة والجدولة والإيقاف، أو تعيدها إلى المسودة.",
            "Publishing happens from the Publish button. Here you move the draft through review, scheduling and pause, or back to draft.",
          )}
        </p>
        <div className="ma-form-grid">
          <div className="ma-field">
            <span className="ma-label">{t("الحالة", "Status")}</span>
            <SelectField
              label={t("الحالة", "Status")}
              size="md"
              fullWidth
              value={status}
              onChange={(value) => setStatus(value as LabStatus)}
              options={LAB_STATUSES.filter((item) => item !== "published").map((item) => ({
                value: item,
                label: t(LAB_STATUS[item].label.ar, LAB_STATUS[item].label.en),
              }))}
            />
          </div>
        </div>
        {saveStatus.error ? <ErrorAlert error={saveStatus.error} /> : null}
        <FormActions>
          <Button
            kind="soft"
            label={saveStatus.isPending ? t("جارٍ التحديث…", "Updating…") : t("تحديث الحالة", "Update status")}
            disabled={!canPublish || saveStatus.isPending || status === lab.status}
            onClick={() => saveStatus.mutate()}
          />
        </FormActions>
      </Card>

      <Card title={t("نقل المختبر", "Portability")}>
        <p className="ma-help">
          {t(
            "تصدير حزمة تحمل البطاقة والتعريف والإطلاق ومسودات السيناريوهات. يمكن استيرادها في بيئة أخرى عبر POST /admin/labs/import.",
            "Export a bundle with the card, definition, release and scenario drafts. Import it elsewhere with POST /admin/labs/import.",
          )}
        </p>
        <Button
          kind="soft"
          icon="download"
          label={download.isPending ? t("جارٍ التصدير…", "Exporting…") : t("تنزيل الحزمة (JSON)", "Download bundle (JSON)")}
          disabled={download.isPending}
          onClick={() => download.mutate()}
        />
      </Card>
    </>
  );
}
