import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  affiliatesKeys,
  affiliatesQueries,
  saveAffiliateProgramSettings,
  type AffiliateProgramSettingsInput,
} from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Modal } from "@/components/ui/modal";
import { Button, ErrorAlert, Field, Loading } from "@/components/ui/kit";

export function AffiliateProgramSettingsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();

  const { data: settings, isLoading, error } = useQuery({
    ...affiliatesQueries.affiliateProgram(),
    enabled: open,
  });

  const [openApplications, setOpenApplications] = useState(true);
  const [commissionPercent, setCommissionPercent] = useState<number | string>(20);
  const [cookieDays, setCookieDays] = useState<number>(30);
  const [payoutTerms, setPayoutTerms] = useState<string>("PayPal · NET-15");
  const [minPayoutMajor, setMinPayoutMajor] = useState<number>(0);

  useEffect(() => {
    if (settings) {
      setOpenApplications(settings.applications_open);
      setCommissionPercent(Number(settings.commission_percent) || 20);
      setCookieDays(settings.cookie_days || 30);
      setPayoutTerms(settings.payout_terms || "PayPal · NET-15");
      setMinPayoutMajor(Math.round((settings.minimum_payout_minor || 0) / 100));
    }
  }, [settings]);

  const save = useMutation({
    mutationFn: (body: AffiliateProgramSettingsInput) => saveAffiliateProgramSettings(body),
    onSuccess: (updated) => {
      queryClient.setQueryData([...affiliatesKeys.all, "program-settings"], updated);
      void queryClient.invalidateQueries({ queryKey: affiliatesKeys.all });
      onOpenChange(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate({
      applications_open: openApplications,
      commission_percent: Number(commissionPercent),
      cookie_days: Number(cookieDays),
      payout_terms: payoutTerms.trim(),
      minimum_payout_minor: Math.round(Number(minPayoutMajor) * 100),
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("إعدادات برنامج المسوقين (الصفحة العامة)", "Marketer Program Terms")}
      size="md"
    >
      {isLoading ? (
        <Loading label={t("جاري تحميل الإعدادات…", "Loading settings…")} />
      ) : error ? (
        <ErrorAlert error={error} />
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {save.error ? <ErrorAlert error={save.error} /> : null}

          <div className="flex items-center justify-between gap-4 rounded-ctl border border-line p-3 bg-surface-alt">
            <div>
              <span className="text-sm font-bold block">{t("استقبال طلبات المسوقين", "Accept Applications")}</span>
              <span className="text-xs text-fg-muted">
                {t(
                  "تفعيل أو إيقاف استقبال الطلبات من صفحة المسوقين العامة /marketers",
                  "Open or close public applications on the /marketers page",
                )}
              </span>
            </div>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={openApplications}
                onChange={(e) => setOpenApplications(e.target.checked)}
                className="size-5 rounded border-line text-accent"
              />
            </label>
          </div>

          <Field
            id="commission-percent"
            label={t("نسبة العمولة الافتراضية (%)", "Default Commission (%)")}
            hint={t(
              "النسبة المعروضة على الصفحة العامة (احرص على مطابقتها لمجموعة Tolt)",
              "Displayed on public page; keep in line with the Tolt group",
            )}
            required
          >
            <input
              id="commission-percent"
              type="number"
              min={0}
              max={100}
              step="0.5"
              required
              className="ma-ctl"
              value={commissionPercent}
              onChange={(e) => setCommissionPercent(e.target.value)}
            />
          </Field>

          <Field
            id="cookie-days"
            label={t("مدة صلاحية التتبع (بالأيام)", "Cookie Tracking Days")}
            hint={t("فترة تتبع الزائر بعد الضغط على الرابط (افتراضي 30 يوماً)", "Cookie tracking duration (default 30 days)")}
            required
          >
            <input
              id="cookie-days"
              type="number"
              min={1}
              max={365}
              required
              className="ma-ctl"
              value={cookieDays}
              onChange={(e) => setCookieDays(Number(e.target.value))}
            />
          </Field>

          <Field
            id="payout-terms"
            label={t("شروط وطريقة الدفع", "Payout Terms")}
            hint={t("مثال: PayPal · NET-15", "e.g. PayPal · NET-15")}
            required
          >
            <input
              id="payout-terms"
              type="text"
              required
              maxLength={300}
              className="ma-ctl"
              value={payoutTerms}
              onChange={(e) => setPayoutTerms(e.target.value)}
            />
          </Field>

          <Field
            id="min-payout"
            label={t("الحد الأدنى للسحب ($)", "Minimum Payout ($)")}
            hint={t(
              "أقل مبلغ يمكن للمسوّق طلب صرفه من رصيده (0 يعني بدون حد أدنى)",
              "Smallest amount a marketer can request from their balance (0 = no minimum)",
            )}
            required
          >
            <input
              id="min-payout"
              type="number"
              min={0}
              step="1"
              required
              className="ma-ctl"
              value={minPayoutMajor}
              onChange={(e) => setMinPayoutMajor(Number(e.target.value))}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-4 border-t border-line mt-2">
            <Button label={t("إلغاء", "Cancel")} onClick={() => onOpenChange(false)} />
            <Button
              type="submit"
              kind="primary"
              label={save.isPending ? t("جاري الحفظ…", "Saving…") : t("حفظ الإعدادات", "Save Terms")}
              disabled={save.isPending}
            />
          </div>
        </form>
      )}
    </Modal>
  );
}
