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
  const [payoutTerms, setPayoutTerms] = useState<string>("Stripe · monthly");
  const [minPayoutMajor, setMinPayoutMajor] = useState<number>(50);
  const [autoPayouts, setAutoPayouts] = useState(false);
  const [holdDays, setHoldDays] = useState<number>(30);
  const [maxFeePercent, setMaxFeePercent] = useState<number | string>(5);
  const [financialAccountId, setFinancialAccountId] = useState<string>("");

  useEffect(() => {
    if (settings) {
      setOpenApplications(settings.applications_open);
      setCommissionPercent(Number(settings.commission_percent) || 20);
      setCookieDays(settings.cookie_days || 30);
      setPayoutTerms(settings.payout_terms || "Stripe · monthly");
      setMinPayoutMajor(Math.round((settings.minimum_payout_minor || 0) / 100));
      setAutoPayouts(Boolean(settings.auto_payouts_enabled));
      setHoldDays(settings.hold_days ?? 30);
      setMaxFeePercent((settings.max_fee_bps ?? 500) / 100);
      setFinancialAccountId(settings.financial_account_id ?? "");
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
      auto_payouts_enabled: autoPayouts,
      hold_days: Number(holdDays),
      max_fee_bps: Math.round(Number(maxFeePercent) * 100),
      financial_account_id: financialAccountId.trim() || null,
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("إعدادات برنامج المسوقين", "Marketer Program Settings")}
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

          <div className="flex items-center justify-between gap-4 rounded-ctl border border-line p-3 bg-surface-alt">
            <div>
              <span className="text-sm font-bold block">{t("التحويلات التلقائية", "Automatic payouts")}</span>
              <span className="text-xs text-fg-muted">
                {t(
                  "في أول كل شهر تُحوَّل أرباح كل المسوقين الذين بلغ رصيدهم الحد الأدنى وحسابهم جاهز: عبر Stripe Connect في بريطانيا، وتحويلًا بنكيًا (Global Payouts) في مصر والإمارات وغيرها. أوقفه لإيقاف كل التحويلات.",
                  "On the 1st of every month, every marketer whose balance reached the minimum and whose account is ready is paid: Stripe Connect in the UK, a Global Payouts bank transfer in Egypt, the UAE and elsewhere. Turn off to stop all payouts.",
                )}
              </span>
            </div>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoPayouts}
                onChange={(e) => setAutoPayouts(e.target.checked)}
                className="size-5 rounded border-line text-accent"
              />
            </label>
          </div>

          <Field
            id="commission-percent"
            label={t("نسبة العمولة الافتراضية (%)", "Default Commission (%)")}
            hint={t(
              "تُطبَّق على مبيعات كل مسوّق ليست له نسبة خاصة، وتظهر على الصفحة العامة",
              "Applied to the sales of every marketer without an own rate; shown on the public page",
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
            id="hold-days"
            label={t("فترة الاسترداد قبل الاعتماد (بالأيام)", "Refund hold before approval (days)")}
            hint={t("تُعتمد العمولة تلقائيًا بعد هذه المدة من الدفع إذا لم يُسترد الطلب", "A commission is approved this many days after payment unless the order is refunded")}
            required
          >
            <input
              id="hold-days"
              type="number"
              min={0}
              max={180}
              required
              className="ma-ctl"
              value={holdDays}
              onChange={(e) => setHoldDays(Number(e.target.value))}
            />
          </Field>

          <Field
            id="max-fee"
            label={t("حد الرسوم للتأكيد التلقائي (%)", "Auto-confirm fee limit (%)")}
            hint={t(
              "التحويل البنكي الدولي يُؤكَّد تلقائيًا ما دامت رسومه لا تتجاوز هذه النسبة وسعر الصرف مثبّتًا؛ وإلا ينتظر تأكيدك في صفحة التحويلات",
              "International bank payouts are confirmed automatically while fees stay within this share and the FX rate is locked; otherwise they wait for you on the payouts page",
            )}
            required
          >
            <input
              id="max-fee"
              type="number"
              min={0}
              max={100}
              step="0.1"
              required
              className="ma-ctl"
              value={maxFeePercent}
              onChange={(e) => setMaxFeePercent(e.target.value)}
            />
          </Field>

          <Field
            id="financial-account"
            label={t("الحساب المالي للتحويلات البنكية (اختياري)", "Bank payouts financial account (optional)")}
            hint={t("فارغ = أول حساب مالي بالدولار في Stripe", "Empty uses the first USD financial account in Stripe")}
          >
            <input
              id="financial-account"
              type="text"
              dir="ltr"
              maxLength={255}
              className="ma-ctl"
              placeholder="fa_…"
              value={financialAccountId}
              onChange={(e) => setFinancialAccountId(e.target.value)}
            />
          </Field>

          <Field
            id="payout-terms"
            label={t("شروط وطريقة الدفع", "Payout Terms")}
            hint={t(
              "نص يظهر في صفحة المسوقين العامة. مثال: Stripe · شهريًا",
              "Shown on the public marketers page. e.g. Stripe · monthly",
            )}
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
            label={t("الحد الأدنى للتحويل ($)", "Minimum Payout ($)")}
            hint={t(
              "لا يُحوَّل الرصيد قبل أن يبلغ هذا المبلغ؛ يُرحَّل للشهر التالي",
              "A balance below this is carried to the next month",
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
