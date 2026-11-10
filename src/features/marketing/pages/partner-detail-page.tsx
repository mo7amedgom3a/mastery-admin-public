import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";

import {
  affiliatesKeys,
  affiliatesQueries,
  archivePartner,
  createPartnerCoupon,
  listAffiliateCommissions,
  listConversions,
  listPartnerCustomers,
  approveAffiliateCommission,
  declineAffiliateCommission,
  setPartnerCommission,
  setPartnerPayoutHold,
  setPartnerStatus,
  updatePartner,
  type AffiliateCommission,
  type AffiliatePayout,
  type Conversion,
  type Coupon,
  type Partner,
  type PartnerAttribution,
} from "@/lib/api";
import { formatDateTime, formatMinor, formatNumber } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { AppLink } from "@/components/ui/app-link";
import { Alert, Badge, Button, Card, Dl, ErrorAlert, Field, Kpi, Loading, PageHead } from "@/components/ui/kit";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PagedList } from "@/components/ui/paged-list";
import { PageState } from "@/components/ui/primitives";

import { CouponForm } from "../components/coupon-form";
import { PartnerForm } from "../components/partner-form";
import {
  commissionStatusBadge,
  connectStatusBadge,
  conversionStatusBadge,
  partnerStatusBadge,
  payoutProviderLabel,
  payoutStatusBadge,
} from "../lib/affiliates";
import { couponStatusBadge, couponValueLabel } from "../lib/coupons";

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X (Twitter)",
  youtube: "YouTube",
  snapchat: "Snapchat",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  website: "Website / blog",
};

type Tab = "overview" | "customers" | "sales" | "commissions" | "payouts" | "coupons" | "settings";

/** Payout destination, payout hold and the partner's own commission rate (payouts are automatic). */
function PayoutControls({ partner }: { partner: Partner }) {
  const t = useT();
  const lang = useLang();
  const queryClient = useQueryClient();
  const program = useQuery(affiliatesQueries.affiliateProgram()).data;
  const canWrite = can("affiliatesWrite.manage");
  const [rate, setRate] = useState(partner.commission_rate_bps != null ? String(partner.commission_rate_bps / 100) : "");
  const [reason, setReason] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: affiliatesKeys.all });
  const saveRate = useMutation({
    mutationFn: () => setPartnerCommission(partner.partner_id, rate.trim() === "" ? null : Number(rate)),
    onSuccess: refresh,
  });
  const hold = useMutation({
    mutationFn: (next: boolean) => setPartnerPayoutHold(partner.partner_id, next, next ? reason.trim() || null : null),
    onSuccess: () => { setReason(""); refresh(); },
  });
  const rateValid = rate.trim() === "" || (Number(rate) >= 0 && Number(rate) <= 100);
  const defaultRate = program ? `${Number(program.commission_percent)}%` : "—";
  return (
    <Card title={t("الأرباح والتحويلات", "Earnings & payouts")}>
      <p className="ma-help">
        {t(
          "تُعتمد العمولات تلقائيًا بعد فترة الاسترداد، وتُحوَّل لكل المسوقين معًا في أول كل شهر: عبر Stripe Connect أو تحويلًا بنكيًا (Global Payouts) حسب بلد الحساب. لا حاجة لموافقة أو تحويل يدوي.",
          "Commissions are approved automatically after the refund hold and paid to all affiliates together on the 1st of every month, through Stripe Connect or a Global Payouts bank transfer depending on the account's country. No manual approval or transfer.",
        )}
      </p>
      <Dl
        rows={[
          [t("حساب Stripe", "Stripe account"), <Badge key="c" def={connectStatusBadge(partner.connect_status)} />],
          [t("معرّف الحساب", "Account ID"), partner.stripe_account_id ? <bdi key="a" dir="ltr" className="ma-num">{partner.stripe_account_id}</bdi> : "—"],
          [t("طريقة التحويل", "Payout route"), payoutProviderLabel(partner.payout_provider, lang)],
          [
            t("الحساب البنكي", "Bank account"),
            partner.payout_method_label ? (
              <bdi key="b" dir="ltr">{partner.payout_method_label}{partner.payout_currency ? ` · ${partner.payout_currency}` : ""}</bdi>
            ) : (
              "—"
            ),
          ],
          [
            t("التحويلات", "Payouts"),
            partner.payout_hold ? (
              <span key="h" className="ma-badge ma-badge--danger">{t("موقوفة", "On hold")}{partner.payout_hold_reason ? ` — ${partner.payout_hold_reason}` : ""}</span>
            ) : (
              <span key="h" className="ma-badge ma-badge--success">{t("تلقائية", "Automatic")}</span>
            ),
          ],
          [t("نسبة العمولة", "Commission rate"), partner.commission_rate_bps != null ? `${partner.commission_rate_bps / 100}%` : t(`الافتراضية (${defaultRate})`, `Program default (${defaultRate})`)],
        ]}
      />
      {canWrite && partner.kind === "marketer" ? (
        <div className="ma-form" style={{ marginTop: "var(--space-3)" }}>
          <div className="ma-form-grid ma-form-grid--2">
            <Field
              id="partner-rate"
              type="number"
              label={t("نسبة عمولة خاصة (%)", "Own commission rate (%)")}
              hint={t("للمبيعات القادمة. اتركها فارغة لاستخدام النسبة الافتراضية.", "For future sales. Leave empty for the program default.")}
              dir="ltr"
              min={0}
              max={100}
              step="0.5"
              value={rate}
              onChange={setRate}
            />
            {!partner.payout_hold ? (
              <Field id="partner-hold-reason" label={t("سبب الإيقاف (اختياري)", "Hold reason (optional)")} value={reason} onChange={setReason} />
            ) : null}
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <Button sm kind="primary" icon="check" label={t("حفظ النسبة", "Save rate")} disabled={!rateValid || saveRate.isPending} onClick={() => saveRate.mutate()} />
            {partner.payout_hold ? (
              <Button sm icon="refresh" label={t("استئناف التحويلات", "Resume payouts")} disabled={hold.isPending} onClick={() => hold.mutate(false)} />
            ) : (
              <Button sm kind="ghost" label={t("إيقاف التحويلات مؤقتًا", "Put payouts on hold")} disabled={hold.isPending} onClick={() => hold.mutate(true)} />
            )}
          </div>
          <ErrorAlert error={saveRate.error ?? hold.error} title={t("تعذّر الحفظ", "Couldn't save")} />
        </div>
      ) : null}
    </Card>
  );
}

function Payouts({ partner }: { partner: Partner }) {
  const t = useT();
  const payouts = useQuery(affiliatesQueries.partnerPayouts(partner.partner_id));
  const columns: Column<AffiliatePayout>[] = [
    { key: "at", header: t("التاريخ", "Date"), cell: (r) => formatDateTime(r.paid_at ?? r.created_at) },
    { key: "amount", header: t("المبلغ", "Amount"), align: "end", cell: (r) => <span className="ma-num">{formatMinor(r.amount_minor)}</span> },
    { key: "status", header: t("الحالة", "Status"), cell: (r) => <Badge def={payoutStatusBadge(r.status)} /> },
    { key: "transfer", header: t("تحويل Stripe", "Stripe transfer"), cell: (r) => (r.stripe_transfer_id ? <bdi dir="ltr" className="ma-num">{r.stripe_transfer_id}</bdi> : "—") },
    { key: "failure", header: t("سبب الفشل", "Failure"), cell: (r) => r.failure_message ?? r.failure_code ?? "—" },
  ];
  return (
    <>
      <PayoutControls partner={partner} />
      <Card title={t("سجل التحويلات", "Payout history")} flush>
        <PageState error={payouts.error}>
          {payouts.isLoading ? <Loading /> : <DataTable rows={payouts.data?.items ?? []} columns={columns} empty={t("لا تحويلات بعد.", "No payouts yet.")} />}
        </PageState>
      </Card>
    </>
  );
}

function Overview({ partner }: { partner: Partner }) {
  const t = useT();
  const s = partner.stats;
  const [copied, setCopied] = useState(false);
  return (
    <>
      <div className="ma-kpis">
        <Kpi label={t("عملاء منسوبون", "Attributed customers")} value={formatNumber(s.customers)} meta={t(`${formatNumber(s.paying_customers)} اشتروا`, `${formatNumber(s.paying_customers)} bought`)} icon="users" />
        <Kpi label={t("المبيعات", "Sales")} value={formatMinor(s.revenue_minor)} meta={t(`${formatNumber(s.conversions)} طلب`, `${formatNumber(s.conversions)} orders`)} icon="receipt" />
        <Kpi label={t("العمولات المعلّقة", "Pending commission")} value={formatMinor(s.commission_pending_minor)} icon="clock" />
        <Kpi label={t("العمولات المعتمدة", "Approved commission")} value={formatMinor(s.commission_approved_minor)} icon="check" />
        <Kpi label={t("العمولات المدفوعة", "Paid commission")} value={formatMinor(s.commission_paid_minor)} icon="card" />
      </div>
      {partner.kind === "marketer" && partner.payout_hold ? (
        <Alert kind="warning" title={t("التحويلات لهذا المسوّق موقوفة", "Payouts to this affiliate are on hold")}>{partner.payout_hold_reason}</Alert>
      ) : null}
      {partner.application ? (
        <Card title={t("طلب الانضمام (بيانات الاستبيان)", "Application Form Answers")}>
          <Dl
            rows={[
              [t("المدينة والدولة", "City & Country"), `${(partner.application as Record<string, string>).city || "—"}، ${(partner.application as Record<string, string>).country || partner.country_code || "—"}`],
              [t("العنوان التفصيلي", "Address"), (partner.application as Record<string, string>).address || "—"],
              [t("صندوق / رمز بريدي", "PO Box / Postal"), [(partner.application as Record<string, string>).po_box, (partner.application as Record<string, string>).postal_code].filter(Boolean).join(" · ") || "—"],
              [t("مدونة أو موقع", "Blogger / Website"), (partner.application as Record<string, string>).is_blogger === "yes" ? t("نعم", "Yes") : t("لا", "No")],
              [t("قائمة بريدية", "Email List"), (partner.application as Record<string, string>).has_email_list === "yes" ? t("نعم", "Yes") : t("لا", "No")],
              [t("متابعون سوشيال", "Social Followers"), (partner.application as Record<string, string>).has_social_followers === "yes" ? t("نعم", "Yes") : t("لا", "No")],
              [t("صانع محتوى / مؤثر", "Influencer"), (partner.application as Record<string, string>).is_influencer === "yes" ? t("نعم", "Yes") : t("لا", "No")],
              [t("مجموعات واتساب / تيليجرام", "WhatsApp / Telegram"), (partner.application as Record<string, string>).has_whatsapp_list === "yes" ? t("نعم", "Yes") : t("لا", "No")],
              [
                t("روابط الحسابات والمنصات", "Channels & Links"),
                (partner.application as Record<string, string>).channels ? (
                  <div dir="ltr" style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                    {(partner.application as Record<string, string>).channels}
                  </div>
                ) : (
                  "—"
                ),
              ],
              ...Object.entries(((partner.application as { links?: Record<string, string> }).links ?? {})).map(
                ([platform, url]) =>
                  [
                    PLATFORM_LABELS[platform] ?? platform,
                    <a key={platform} className="ma-link" href={url} target="_blank" rel="noopener noreferrer nofollow" dir="ltr" style={{ wordBreak: "break-all" }}>
                      {url}
                    </a>,
                  ] as [string, ReactNode],
              ),
              [t("حجم الجمهور", "Audience Size"), (partner.application as Record<string, string>).audience_size || "—"],
              [
                t("سياسة البرنامج", "Programme policy"),
                (partner.application as Record<string, string>).policy_accepted_at
                  ? t(
                      `وافق في ${formatDateTime((partner.application as Record<string, string>).policy_accepted_at)}`,
                      `Accepted ${formatDateTime((partner.application as Record<string, string>).policy_accepted_at)}`,
                    )
                  : "—",
              ],
              [
                t("الخطة التسويقية المقترحة", "Marketing Plan"),
                <div key="plan" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                  {(partner.application as Record<string, string>).marketing_plan || "—"}
                </div>,
              ],
            ]}
          />
        </Card>
      ) : null}
      <Card title={t("رابط الإحالة", "Referral link")}>
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
          <code dir="ltr" className="ma-num" style={{ wordBreak: "break-all" }}>{partner.referral_link}</code>
          <Button sm icon={copied ? "check" : "copy"} label={copied ? t("تم النسخ", "Copied") : t("نسخ", "Copy")} onClick={() => { void navigator.clipboard?.writeText(partner.referral_link); setCopied(true); }} />
        </div>
      </Card>
      <Card title={t("التفاصيل", "Details")}>
        <Dl
          rows={[
            [t("النوع", "Type"), partner.kind === "student" ? t("طالب (برنامج الإحالة)", "Student (referral program)") : t("مسوّق", "Marketer")],
            [
              t("حساب المتجر", "Store account"),
              partner.customer_id ? (
                <AppLink key="acct" className="ma-link" to={`/customers/${partner.customer_id}`}>{t("مرتبط", "Linked")}</AppLink>
              ) : (
                t("غير مرتبط بعد — يرتبط عند تسجيل الدخول بنفس البريد", "Not linked yet — links when they sign in with this email")
              ),
            ],
            [t("الجوال", "Phone"), partner.phone ?? "—"],
            [t("الدولة", "Country"), partner.country_code ?? "—"],
            [t("المصدر", "Source"), partner.source === "application" ? t("طلب انضمام", "Application") : partner.source],
            ...(partner.kind === "marketer"
              ? ([[t("حساب Stripe", "Stripe account"), <Badge key="c" def={connectStatusBadge(partner.connect_status)} />]] as [ReactNode, ReactNode][])
              : []),
            [t("معرّف النظام القديم", "Legacy ID"), partner.legacy_affiliate_id ?? "—"],
            [t("انضم", "Joined"), formatDateTime(partner.created_at)],
            [t("ملاحظات", "Notes"), partner.notes ?? "—"],
          ]}
        />
      </Card>
    </>
  );
}

function Customers({ partner }: { partner: Partner }) {
  const t = useT();
  const columns: Column<PartnerAttribution>[] = [
    {
      key: "customer", header: t("العميل", "Customer"), exportValue: (r) => r.customer_email ?? "",
      cell: (r) => (
        <AppLink className="ma-link ma-link--plain" to={`/customers/${r.customer_id}`}>
          <span className="ma-cell-main">{r.customer_name || r.customer_email}</span>
          <span className="ma-cell-sub"><bdi>{r.customer_email}</bdi></span>
        </AppLink>
      ),
    },
    { key: "source", header: t("المصدر", "Source"), exportValue: (r) => r.source, cell: (r) => r.source },
    { key: "orders", header: t("طلبات", "Orders"), align: "end", exportKind: "number", exportValue: (r) => r.paid_orders, cell: (r) => <span className="ma-num">{formatNumber(r.paid_orders)}</span> },
    { key: "revenue", header: t("المبيعات", "Revenue"), align: "end", exportKind: "number", exportValue: (r) => r.revenue_minor / 100, cell: (r) => <span className="ma-num">{formatMinor(r.revenue_minor)}</span> },
    { key: "at", header: t("التاريخ", "Date"), exportKind: "datetime", exportValue: (r) => r.attributed_at ?? null, cell: (r) => formatDateTime(r.attributed_at) },
  ];
  return (
    <PagedList
      queryKeyBase={affiliatesKeys.partnerCustomers(partner.partner_id)}
      fetchPage={({ offset, limit }) => listPartnerCustomers(partner.partner_id, { offset, limit })}
      columns={columns}
      empty={t("لا عملاء منسوبين بعد.", "No attributed customers yet.")}
      exportConfig={{ filename: `affiliate-${partner.referral_code}-customers`, title: partner.referral_code, fetchSize: 200 }}
    />
  );
}

export function SalesList({ partnerId }: { partnerId?: string }) {
  const t = useT();
  const columns: Column<Conversion>[] = [
    { key: "order", header: t("الطلب", "Order"), exportValue: (r) => r.order_id, cell: (r) => <AppLink className="ma-link ma-num" to={`/sales/orders/${r.order_id}`}>{r.order_id.slice(0, 8)}</AppLink> },
    ...(partnerId ? [] : [{ key: "partner", header: t("المسوّق", "Affiliate"), exportValue: (r: Conversion) => r.partner_name ?? "", cell: (r: Conversion) => <AppLink className="ma-link" to={`/marketing/affiliates/${r.partner_id}`}>{r.partner_name ?? "—"}</AppLink> } as Column<Conversion>]),
    { key: "customer", header: t("العميل", "Customer"), exportValue: (r) => r.customer_email ?? "", cell: (r) => <bdi>{r.customer_email}</bdi> },
    { key: "product", header: t("المنتج", "Product"), exportValue: (r) => r.product_name ?? "", cell: (r) => r.product_name ?? "—" },
    { key: "base", header: t("المبلغ", "Amount"), align: "end", exportKind: "number", exportValue: (r) => r.base_amount_minor / 100, cell: (r) => <span className="ma-num">{formatMinor(r.base_amount_minor)}</span> },
    { key: "commission", header: t("العمولة", "Commission"), align: "end", exportKind: "number", exportValue: (r) => (r.commission_minor ?? 0) / 100, cell: (r) => (r.commission_minor != null ? <span className="ma-num">{formatMinor(r.commission_minor)}</span> : "—") },
    { key: "first", header: t("أول شراء", "First buy"), exportValue: (r) => (r.is_first_purchase ? "yes" : "no"), cell: (r) => (r.is_first_purchase ? t("نعم", "Yes") : t("لا", "No")) },
    { key: "status", header: t("الحالة", "Status"), exportValue: (r) => r.status, cell: (r) => <Badge def={conversionStatusBadge(r.status)} /> },
    { key: "at", header: t("التاريخ", "Date"), exportKind: "datetime", exportValue: (r) => r.created_at ?? null, cell: (r) => formatDateTime(r.created_at) },
  ];
  return (
    <PagedList
      queryKeyBase={affiliatesKeys.conversions({ partner_id: partnerId })}
      fetchPage={({ offset, limit }) => listConversions({ partner_id: partnerId, offset, limit })}
      columns={columns}
      empty={t("لا مبيعات بعد.", "No sales yet.")}
      exportConfig={{ filename: "affiliate-sales", title: t("مبيعات المسوقين", "Affiliate sales"), fetchSize: 200 }}
    />
  );
}

export function CommissionsList({ partnerId }: { partnerId?: string }) {
  const t = useT();
  const queryClient = useQueryClient();
  // Commissions are approved automatically after the refund hold. An admin may approve one early or
  // decline (reverse) one; a reversed paid commission is taken off the next payout.
  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "approve" | "decline" }) =>
      action === "approve" ? approveAffiliateCommission(id) : declineAffiliateCommission(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: affiliatesKeys.all }),
  });
  const canWrite = can("affiliatesWrite.manage");
  const columns: Column<AffiliateCommission>[] = [
    { key: "id", header: "ID", exportValue: (r) => r.commission_id, cell: (r) => <span className="ma-num">{r.commission_id.slice(0, 12)}</span> },
    ...(partnerId ? [] : [{ key: "partner", header: t("المسوّق", "Affiliate"), exportValue: (r: AffiliateCommission) => r.partner_name ?? "", cell: (r: AffiliateCommission) => (r.partner_id ? <AppLink className="ma-link" to={`/marketing/affiliates/${r.partner_id}`}>{r.partner_name ?? "—"}</AppLink> : "—") } as Column<AffiliateCommission>]),
    { key: "order", header: t("الطلب", "Order"), exportValue: (r) => r.order_id ?? "", cell: (r) => (r.order_id ? <AppLink className="ma-link ma-num" to={`/sales/orders/${r.order_id}`}>{r.order_id.slice(0, 8)}</AppLink> : "—") },
    { key: "amount", header: t("العمولة", "Amount"), align: "end", exportKind: "number", exportValue: (r) => r.amount_minor / 100, cell: (r) => <span className="ma-num">{formatMinor(r.amount_minor)}</span> },
    { key: "status", header: t("الحالة", "Status"), exportValue: (r) => r.status, cell: (r) => <Badge def={commissionStatusBadge(r.status)} /> },
    { key: "payable", header: t("تُعتمد في", "Approves on"), exportKind: "datetime", exportValue: (r) => r.payable_at ?? null, cell: (r) => (r.status === "pending" ? formatDateTime(r.payable_at) : "—") },
    { key: "paid", header: t("حُوّلت في", "Paid on"), exportKind: "datetime", exportValue: (r) => r.settled_at ?? null, cell: (r) => (r.settled_at ? formatDateTime(r.settled_at) : "—") },
    { key: "at", header: t("التاريخ", "Date"), exportKind: "datetime", exportValue: (r) => r.created_at ?? null, cell: (r) => formatDateTime(r.created_at) },
    {
      key: "actions", header: "", exportable: false, align: "end",
      cell: (r) =>
        canWrite && r.status !== "reversed" ? (
          <span style={{ display: "inline-flex", gap: "var(--space-1)" }}>
            {r.status === "pending" ? (
              <Button sm label={t("اعتماد الآن", "Approve now")} disabled={act.isPending} onClick={() => act.mutate({ id: r.commission_id, action: "approve" })} />
            ) : null}
            <Button sm kind="ghost" label={t("إلغاء", "Reverse")} disabled={act.isPending} onClick={() => act.mutate({ id: r.commission_id, action: "decline" })} />
          </span>
        ) : null,
    },
  ];
  return (
    <>
      <ErrorAlert error={act.error} title={t("تعذّر تحديث العمولة", "Couldn't update the commission")} />
      <PagedList
        queryKeyBase={affiliatesKeys.commissions({ partner_id: partnerId })}
        fetchPage={({ offset, limit, filters }) => listAffiliateCommissions({ partner_id: partnerId, status: filters.status || undefined, offset, limit })}
        columns={columns}
        filters={[{ key: "status", label: t("كل الحالات", "All states"), options: ["pending", "approved", "paid", "reversed"].map((value) => ({ value, label: value })) }]}
        empty={t("لا عمولات بعد. تُحسب تلقائيًا بعد كل بيع.", "No commissions yet. They are computed after each sale.")}
        exportConfig={{ filename: "affiliate-commissions", title: t("العمولات", "Commissions"), fetchSize: 200 }}
      />
    </>
  );
}

function Coupons({ partner }: { partner: Partner }) {
  const t = useT();
  const queryClient = useQueryClient();
  const coupons = useQuery(affiliatesQueries.partnerCoupons(partner.partner_id));
  const [adding, setAdding] = useState(false);
  const create = useMutation({
    mutationFn: (body: Parameters<typeof createPartnerCoupon>[1]) => createPartnerCoupon(partner.partner_id, body),
    onSuccess: () => { setAdding(false); queryClient.invalidateQueries({ queryKey: affiliatesKeys.all }); },
  });
  const columns: Column<Coupon>[] = [
    { key: "code", header: t("الكود", "Code"), cell: (r) => <AppLink className="ma-link ma-num" to={`/sales/coupons/${r.promotion_id}`}>{r.code}</AppLink> },
    { key: "value", header: t("الخصم", "Discount"), cell: (r) => couponValueLabel(r) },
    { key: "uses", header: t("الاستخدام", "Uses"), align: "end", cell: (r) => <span className="ma-num">{formatNumber(r.stats.redemptions)}</span> },
    { key: "revenue", header: t("الإيراد", "Revenue"), align: "end", cell: (r) => <span className="ma-num">{formatMinor(r.stats.revenue_minor)}</span> },
    { key: "status", header: t("الحالة", "Status"), cell: (r) => <Badge def={couponStatusBadge(r.status)} /> },
  ];
  return (
    <>
      <Card
        title={t("كوبونات المسوّق", "Affiliate coupons")}
        actions={can("affiliatesWrite.manage") && !adding ? <Button sm kind="primary" icon="plus" label={t("كوبون جديد", "New coupon")} onClick={() => setAdding(true)} /> : null}
        flush
      >
        <p className="ma-help" style={{ padding: "0 var(--space-4)" }}>
          {t("من يستخدم الكوبون يُنسب لهذا المسوّق حتى بدون رابط.", "Anyone who uses the coupon is attributed to this affiliate, even without the link.")}
        </p>
        <PageState error={coupons.error}>
          {coupons.isLoading ? <Loading /> : <DataTable rows={coupons.data ?? []} columns={columns} empty={t("لا كوبونات.", "No coupons.")} />}
        </PageState>
      </Card>
      {adding ? (
        <Card title={t("كوبون للمسوّق", "Coupon for this affiliate")}>
          <CouponForm pending={create.isPending} error={create.error} submitLabel={t("إنشاء الكوبون", "Create coupon")} cancelHref={`/marketing/affiliates/${partner.partner_id}?tab=coupons`} onSubmit={(body) => create.mutate(body)} />
        </Card>
      ) : null}
    </>
  );
}

function Settings({ partner }: { partner: Partner }) {
  const t = useT();
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (body: Parameters<typeof updatePartner>[1]) => updatePartner(partner.partner_id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: affiliatesKeys.all }),
  });
  return (
    <Card title={t("تعديل المسوّق", "Edit affiliate")}>
      <PartnerForm key={partner.partner_id} partner={partner} pending={save.isPending} error={save.error} submitLabel={t("حفظ", "Save")} cancelHref={`/marketing/affiliates/${partner.partner_id}`} onSubmit={(body) => save.mutate(body)} />
    </Card>
  );
}

export default function PartnerDetailPage() {
  const t = useT();
  const { partnerId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab | null) ?? "overview";
  const select = (next: Tab) => setParams((prev) => { const n = new URLSearchParams(prev); n.set("tab", next); return n; }, { replace: true });
  const queryClient = useQueryClient();
  const partner = useQuery(affiliatesQueries.partner(partnerId));
  const p = partner.data;
  const canWrite = can("affiliatesWrite.manage");
  const [confirmArchive, setConfirmArchive] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: affiliatesKeys.all });
  const status = useMutation({ mutationFn: (s: "active" | "suspended" | "rejected") => setPartnerStatus(partnerId, s), onSuccess: refresh });
  const archive = useMutation({ mutationFn: () => archivePartner(partnerId), onSuccess: () => { setConfirmArchive(false); refresh(); } });

  const tabs: [Tab, string][] = [
    ["overview", t("نظرة عامة", "Overview")],
    ["customers", t("العملاء", "Customers")],
    ["sales", t("المبيعات", "Sales")],
    ["commissions", t("العمولات", "Commissions")],
    ...(p?.kind === "marketer" ? ([["payouts", t("التحويلات", "Payouts")]] as [Tab, string][]) : []),
    ["coupons", t("الكوبونات", "Coupons")],
    ...(canWrite ? ([["settings", t("تعديل", "Edit")]] as [Tab, string][]) : []),
  ];

  return (
    <>
      <PageHead
        title={p ? p.full_name || p.email : t("مسوّق", "Affiliate")}
        status={
          p ? (
            <div style={{ display: "flex", gap: "var(--space-1)", alignItems: "center" }}>
              <Badge def={partnerStatusBadge(p.status)} />
              {p.source === "application" ? (
                <span className="ma-badge ma-badge--info">{t("من نموذج الانضمام", "From the application form")}</span>
              ) : null}
            </div>
          ) : null
        }
        sub={p ? <bdi>{p.email} · {p.referral_code}</bdi> : undefined}
        back={{ href: `/marketing/affiliates${p?.kind === "student" ? "?view=student" : ""}`, label: t("المسوقون", "Affiliates") }}
        actions={
          p && canWrite ? (
            <>
              {p.status !== "active" ? (
                <Button
                  kind="primary"
                  icon="check"
                  label={t("تفعيل", "Activate")}
                  disabled={status.isPending}
                  onClick={() => status.mutate("active")}
                />
              ) : null}
              {p.status === "active" ? <Button label={t("إيقاف", "Suspend")} disabled={status.isPending} onClick={() => status.mutate("suspended")} /> : null}
              <Button kind="ghost" icon="folder" label={t("أرشفة", "Archive")} onClick={() => setConfirmArchive(true)} />
            </>
          ) : null
        }
      />
      <ErrorAlert error={status.error ?? archive.error} title={t("تعذّر تحديث المسوّق", "Couldn't update the affiliate")} />
      <nav className="ma-tabs mb-4" aria-label={t("أقسام المسوّق", "Affiliate sections")}>
        {tabs.map(([key, label]) => (
          <button key={key} type="button" aria-selected={tab === key} onClick={() => select(key)}>{label}</button>
        ))}
      </nav>
      <PageState error={partner.error}>
        {partner.isLoading ? <Loading /> : null}
        {p && tab === "overview" ? <Overview partner={p} /> : null}
        {p && tab === "customers" ? <Customers partner={p} /> : null}
        {p && tab === "sales" ? <SalesList partnerId={p.partner_id} /> : null}
        {p && tab === "commissions" ? <CommissionsList partnerId={p.partner_id} /> : null}
        {p && tab === "payouts" ? <Payouts partner={p} /> : null}
        {p && tab === "coupons" ? <Coupons partner={p} /> : null}
        {p && tab === "settings" && canWrite ? <Settings partner={p} /> : null}
      </PageState>
      <ConfirmModal
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={t("أرشفة المسوّق؟", "Archive this affiliate?")}
        message={t("يتوقف رابطه عن النسب ولا تُحوَّل له أرباح جديدة. تبقى المبيعات والعمولات.", "The link stops attributing and no new payouts are made. Sales and commissions stay.")}
        confirmLabel={t("أرشفة", "Archive")}
        loading={archive.isPending}
        onConfirm={() => archive.mutate()}
      />
    </>
  );
}

