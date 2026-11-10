import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import {
  affiliatesKeys,
  affiliatesQueries,
  cancelAffiliatePayout,
  confirmAffiliatePayout,
  runPayoutBatch,
  type AffiliatePayout,
  type PayoutBatch,
} from "@/lib/api";
import { formatDateTime, formatMinor, formatNumber } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { AppLink } from "@/components/ui/app-link";
import { Alert, Badge, Button, Card, ErrorAlert, Loading, PageHead } from "@/components/ui/kit";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageState } from "@/components/ui/primitives";

import { AffiliateProgramSettingsModal } from "../components/affiliate-program-settings-modal";
import { LegacyPayoutsList } from "../components/legacy-payouts-list";
import { batchStatusBadge, payoutProviderLabel, payoutStatusBadge } from "../lib/affiliates";

function money(minor: number | null | undefined, currency: string | null | undefined): string {
  if (minor == null || !currency) return "—";
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

/** Whether the platform can fund payouts: Global Payouts financial accounts and the Connect balance. */
function SenderStatus() {
  const t = useT();
  const sender = useQuery(affiliatesQueries.payoutSenderStatus());
  if (!sender.data) return null;
  const usd = sender.data.connect_available.find((b) => b.currency === "USD");
  return (
    <>
      {!sender.data.global_enabled ? (
        <Alert kind="warning" title={t("التحويلات البنكية الدولية غير مفعّلة", "Global Payouts is not enabled")}>
          {t(
            "لا يوجد حساب مالي (Financial Account) بالدولار في Stripe، فلن تُرسل تحويلات مسوقي مصر والإمارات وتبقى أرصدتهم محفوظة. اطلب من Stripe تفعيل Global Payouts وتمويل الحساب.",
            "Stripe has no USD financial account, so payouts to Egypt / UAE affiliates are not sent and their balances are kept. Ask Stripe to enable and fund Global Payouts.",
          )}
        </Alert>
      ) : null}
      {!usd || usd.amount_minor <= 0 ? (
        <Alert kind="info" title={t("لا رصيد دولار متاح لـ Stripe Connect", "No available USD for Stripe Connect")}>
          {t(
            "تحويلات Connect (بريطانيا) تُدفع من رصيد المنصة بالدولار. الرصيد المتاح الآن: ",
            "Connect transfers (UK) are paid from the platform's USD balance. Available now: ",
          )}
          {sender.data.connect_available.map((b) => money(b.amount_minor, b.currency)).join(" · ") || "—"}
        </Alert>
      ) : null}
    </>
  );
}

function PayoutActions({ payout }: { payout: AffiliatePayout }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState<"confirm" | "cancel" | null>(null);
  const action = useMutation({
    mutationFn: (kind: "confirm" | "cancel") =>
      kind === "confirm" ? confirmAffiliatePayout(payout.payout_id) : cancelAffiliatePayout(payout.payout_id),
    onSuccess: () => {
      setConfirm(null);
      void queryClient.invalidateQueries({ queryKey: affiliatesKeys.all });
    },
  });
  if (!can("affiliatesWrite.manage") || payout.provider !== "global") return null;
  const waiting = payout.status === "pending_confirmation";
  if (!waiting && payout.status !== "sent") return null;
  return (
    <span className="inline-flex gap-1">
      {waiting ? (
        <Button sm kind="primary" label={t("تأكيد", "Confirm")} onClick={() => setConfirm("confirm")} />
      ) : null}
      <Button sm kind="ghost" label={t("إلغاء", "Cancel")} onClick={() => setConfirm("cancel")} />
      <ConfirmModal
        open={confirm !== null}
        onOpenChange={(open) => (open ? null : setConfirm(null))}
        tone={confirm === "cancel" ? "danger" : "primary"}
        title={confirm === "cancel" ? t("إلغاء التحويل؟", "Cancel this payout?") : t("تأكيد التحويل؟", "Confirm this payout?")}
        message={
          confirm === "cancel"
            ? t("يعود المبلغ إلى رصيد المسوّق ويُحوَّل في الدفعة القادمة.", "The amount returns to the affiliate's balance for the next batch.")
            : t(
                `الرسوم التقديرية ${money(payout.fees_minor, payout.currency_code)}، ويصل للمسوّق ${money(payout.credited_minor, payout.credited_currency)}.`,
                `Estimated fees ${money(payout.fees_minor, payout.currency_code)}; the affiliate receives ${money(payout.credited_minor, payout.credited_currency)}.`,
              )
        }
        confirmLabel={confirm === "cancel" ? t("إلغاء التحويل", "Cancel payout") : t("تأكيد", "Confirm")}
        loading={action.isPending}
        onConfirm={() => confirm && action.mutate(confirm)}
      />
      {action.error ? <span className="text-xs text-danger">{(action.error as Error).message}</span> : null}
    </span>
  );
}

function BatchDetail({ batchId }: { batchId: string }) {
  const t = useT();
  const lang = useLang();
  const detail = useQuery(affiliatesQueries.payoutBatch(batchId));
  const columns: Column<AffiliatePayout>[] = [
    {
      key: "partner",
      header: t("المسوّق", "Affiliate"),
      cell: (r) => (
        <AppLink className="ma-link ma-link--plain" to={`/marketing/affiliates/${r.partner_id}?tab=payouts`}>
          <span className="ma-cell-main">{r.partner_name || r.partner_email}</span>
          <span className="ma-cell-sub"><bdi>{r.partner_email}</bdi></span>
        </AppLink>
      ),
    },
    { key: "amount", header: t("المبلغ", "Amount"), align: "end", cell: (r) => <span className="ma-num">{formatMinor(r.amount_minor)}</span> },
    { key: "route", header: t("الطريقة", "Route"), cell: (r) => payoutProviderLabel(r.provider, lang) },
    {
      key: "credited",
      header: t("يصل للمسوّق", "Recipient gets"),
      align: "end",
      cell: (r) => (
        <span className="ma-num">
          {money(r.credited_minor, r.credited_currency)}
          {r.fees_minor != null ? (
            <span className="ma-cell-sub">{t("رسوم", "fees")} {money(r.fees_minor, r.currency_code)}</span>
          ) : null}
        </span>
      ),
    },
    { key: "status", header: t("الحالة", "Status"), cell: (r) => <Badge def={payoutStatusBadge(r.status)} /> },
    {
      key: "transfer",
      header: t("مرجع Stripe", "Stripe reference"),
      cell: (r) => {
        const ref = r.provider_ref ?? r.stripe_transfer_id;
        return ref ? <bdi dir="ltr" className="ma-num">{ref}</bdi> : "—";
      },
    },
    {
      key: "failure",
      header: t("ملاحظة", "Note"),
      cell: (r) => r.failure_message ?? r.failure_code ?? r.next_action ?? (r.bank_status ? `bank: ${r.bank_status}` : "—"),
    },
    { key: "actions", header: "", align: "end", cell: (r) => <PayoutActions payout={r} /> },
  ];
  return (
    <Card title={detail.data ? t(`دفعة ${detail.data.period}`, `Batch ${detail.data.period}`) : t("الدفعة", "Batch")} flush>
      <PageState error={detail.error}>
        {detail.isLoading ? <Loading /> : <DataTable rows={detail.data?.payouts ?? []} columns={columns} empty={t("لم يكن أحد مؤهلًا في هذه الدفعة.", "Nobody was eligible in this batch.")} />}
      </PageState>
    </Card>
  );
}

function Batches() {
  const t = useT();
  const queryClient = useQueryClient();
  const canWrite = can("affiliatesWrite.manage");
  const program = useQuery(affiliatesQueries.affiliateProgram());
  const batches = useQuery(affiliatesQueries.payoutBatches({ limit: 24 }));
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmRun, setConfirmRun] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const run = useMutation({
    mutationFn: runPayoutBatch,
    onSuccess: () => {
      setConfirmRun(false);
      void queryClient.invalidateQueries({ queryKey: affiliatesKeys.all });
    },
  });
  const enabled = program.data?.auto_payouts_enabled ?? false;
  const failedLast = batches.data?.items[0] && ["partial", "failed"].includes(batches.data.items[0].status);

  const columns: Column<PayoutBatch>[] = [
    { key: "period", header: t("الفترة", "Period"), cell: (r) => <span className="ma-num">{r.period}</span> },
    { key: "status", header: t("الحالة", "Status"), cell: (r) => <Badge def={batchStatusBadge(r.status)} /> },
    { key: "paid", header: t("حُوّل", "Paid"), align: "end", cell: (r) => <span className="ma-num">{formatNumber(r.paid_count)} / {formatNumber(r.payouts_count)}</span> },
    { key: "amount", header: t("المبلغ المحوّل", "Amount paid"), align: "end", cell: (r) => <span className="ma-num">{formatMinor(r.paid_minor)}</span> },
    { key: "failed", header: t("فشل", "Failed"), align: "end", cell: (r) => <span className="ma-num">{formatNumber(r.failed_count)}</span> },
    { key: "at", header: t("التاريخ", "Date"), cell: (r) => formatDateTime(r.finished_at ?? r.started_at) },
    {
      key: "view",
      header: "",
      align: "end",
      cell: (r) => (
        <Button sm kind={selected === r.batch_id ? "primary" : "ghost"} label={t("التفاصيل", "Details")} onClick={() => setSelected(selected === r.batch_id ? null : r.batch_id)} />
      ),
    },
  ];

  return (
    <>
      {program.data && !enabled ? (
        <Alert kind="warning" title={t("التحويلات التلقائية متوقفة", "Automatic payouts are off")}>
          {t("لن تُرسل أي دفعة حتى تُفعَّل من إعدادات البرنامج. تستمر العمولات في التراكم.", "No batch is sent until it is turned on in the program settings. Commissions keep accruing.")}
        </Alert>
      ) : null}
      <SenderStatus />
      {failedLast ? (
        <Alert kind="danger" title={t("آخر دفعة لم تكتمل", "The last batch did not complete")}>
          {t(
            "بقي رصيد من فشل تحويله لديهم. السبب الشائع: رصيد Stripe غير كافٍ. بعد معالجته شغّل الدفعة يدويًا.",
            "Failed payouts stay in the affiliates' balance. The usual cause is an insufficient Stripe balance; fix it, then run the batch manually.",
          )}
        </Alert>
      ) : null}
      <Card
        title={t("الدفعات الشهرية", "Monthly batches")}
        actions={
          canWrite ? (
            <>
              <Button sm icon="settings" label={t("إعدادات التحويل", "Payout settings")} onClick={() => setSettingsOpen(true)} />
              <Button sm kind="primary" icon="send" label={t("تشغيل الدفعة الآن", "Run payouts now")} disabled={!enabled || run.isPending} onClick={() => setConfirmRun(true)} />
            </>
          ) : null
        }
        flush
      >
        <p className="ma-help" style={{ padding: "0 var(--space-4)" }}>
          {t(
            "في أول كل شهر تُحوَّل أرباح كل المسوقين المؤهلين معًا: Stripe Connect في بريطانيا، وتحويل بنكي (Global Payouts) في مصر والإمارات وغيرها. الشروط: رصيد معتمد يبلغ الحد الأدنى، وحساب جاهز، وبدون إيقاف. لا موافقة ولا تحويل يدوي، إلا تحويلًا بنكيًا تتجاوز رسومه الحد فينتظر تأكيدك.",
            "On the 1st of every month all eligible affiliates are paid together: Stripe Connect in the UK, a Global Payouts bank transfer in Egypt, the UAE and elsewhere. Rules: approved balance at or above the minimum, a ready account and no hold. No approval or manual transfer, except a bank payout over the fee limit, which waits for your confirmation.",
          )}
        </p>
        <ErrorAlert error={run.error} title={t("تعذّر تشغيل الدفعة", "Couldn't start the batch")} />
        {run.data ? <Alert kind="success" title={t("بدأت الدفعة. حدّث الصفحة بعد دقيقة.", "The batch started. Refresh in a minute.")} /> : null}
        <PageState error={batches.error}>
          {batches.isLoading ? <Loading /> : <DataTable rows={batches.data?.items ?? []} columns={columns} empty={t("لا دفعات بعد. أول دفعة في أول الشهر القادم.", "No batches yet. The first runs on the 1st of next month.")} />}
        </PageState>
      </Card>
      {selected ? <BatchDetail batchId={selected} /> : null}
      <ConfirmModal
        open={confirmRun}
        onOpenChange={setConfirmRun}
        tone="primary"
        title={t("تشغيل دفعة التحويل الآن؟", "Run the payout batch now?")}
        message={t(
          "يُحوَّل لكل مسوّق مؤهل رصيده عبر Stripe. من حُوّل له هذا الشهر لن يُحوَّل له مرة أخرى.",
          "Every eligible affiliate is paid their balance through Stripe. Anyone already paid this month is not paid again.",
        )}
        confirmLabel={t("تشغيل", "Run")}
        loading={run.isPending}
        onConfirm={() => run.mutate()}
      />
      <AffiliateProgramSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}

/** Affiliate payouts (`/marketing/payouts`): the automatic monthly Stripe batches, plus legacy requests. */
export default function PayoutsPage() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "legacy" ? "legacy" : "batches";
  const select = (next: string) => setParams((prev) => { const n = new URLSearchParams(prev); n.set("view", next); return n; }, { replace: true });
  return (
    <>
      <PageHead
        title={t("تحويلات المسوقين", "Affiliate payouts")}
        sub={t(
          "تحويلات تلقائية شهرية: Stripe Connect أو تحويل بنكي (Global Payouts) حسب بلد المسوّق.",
          "Automatic monthly payouts: Stripe Connect or a Global Payouts bank transfer, by the affiliate's country.",
        )}
      />
      <nav className="ma-tabs mb-4" aria-label={t("القسم", "Section")}>
        <button type="button" aria-selected={view === "batches"} onClick={() => select("batches")}>{t("الدفعات التلقائية", "Automatic batches")}</button>
        <button type="button" aria-selected={view === "legacy"} onClick={() => select("legacy")}>{t("طلبات النظام القديم", "Legacy requests")}</button>
      </nav>
      {view === "legacy" ? <LegacyPayoutsList /> : <Batches />}
    </>
  );
}
