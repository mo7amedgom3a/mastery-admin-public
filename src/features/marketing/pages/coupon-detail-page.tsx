import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";

import {
  archiveCoupon,
  couponsKeys,
  couponsQueries,
  listCouponRedemptions,
  setCouponActive,
  updateCoupon,
  type Coupon,
  type CouponRedemption,
} from "@/lib/api";
import { formatDate, formatDateTime, formatMinor, formatNumber, formatPercent } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { AppLink } from "@/components/ui/app-link";
import { Badge, Button, Card, Dl, ErrorAlert, Kpi, Loading, PageHead } from "@/components/ui/kit";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { type Column } from "@/components/ui/data-table";
import { PagedList } from "@/components/ui/paged-list";
import { PageState } from "@/components/ui/primitives";

import { CouponForm } from "../components/coupon-form";
import { couponStatusBadge, couponValueLabel } from "../lib/coupons";

type Tab = "overview" | "redemptions" | "settings";

const REDEMPTION_STATUS = {
  confirmed: { label: { ar: "مدفوع", en: "Paid" }, tone: "success" },
  reserved: { label: { ar: "محجوز", en: "Reserved" }, tone: "info" },
  released: { label: { ar: "أُلغي", en: "Released" }, tone: "neutral" },
  refunded: { label: { ar: "مسترد", en: "Refunded" }, tone: "warning" },
} as const;

function OverviewTab({ coupon }: { coupon: Coupon }) {
  const t = useT();
  const { stats } = coupon;
  const scope = coupon.product_ids?.length || coupon.category_ids?.length
    ? t(`${coupon.product_ids?.length ?? 0} منتج · ${coupon.category_ids?.length ?? 0} فئة`, `${coupon.product_ids?.length ?? 0} products · ${coupon.category_ids?.length ?? 0} categories`)
    : t("الطلب كله", "Whole order");
  return (
    <>
      <div className="ma-kpis">
        <Kpi label={t("استخدامات مدفوعة", "Paid uses")} value={formatNumber(stats.redemptions)} meta={coupon.usage_limit ? t(`من ${formatNumber(coupon.usage_limit)}`, `of ${formatNumber(coupon.usage_limit)}`) : undefined} icon="tag" />
        <Kpi label={t("عملاء فريدون", "Unique customers")} value={formatNumber(stats.unique_customers)} icon="users" />
        <Kpi label={t("الخصم الممنوح", "Discount given")} value={formatMinor(stats.discount_minor, coupon.currency_code)} icon="card" />
        <Kpi label={t("إيراد الطلبات", "Order revenue")} value={formatMinor(stats.revenue_minor, coupon.currency_code)} icon="receipt" />
        <Kpi
          label={t("معدل التحويل", "Conversion rate")}
          value={stats.conversion_rate == null ? "—" : formatPercent(stats.conversion_rate * 100)}
          meta={t(`${formatNumber(stats.attempts)} عميل جرّب الكود`, `${formatNumber(stats.attempts)} code applies`)}
          icon="chart"
        />
      </div>
      <Card title={t("الإعدادات", "Settings")}>
        <Dl
          rows={[
            [t("الخصم", "Discount"), couponValueLabel(coupon)],
            [t("يسري على", "Applies to"), scope],
            [t("أدنى قيمة للطلب", "Minimum order"), coupon.min_subtotal_minor ? formatMinor(coupon.min_subtotal_minor, coupon.currency_code) : "—"],
            [t("حد الاستخدام", "Usage limit"), coupon.usage_limit ? formatNumber(coupon.usage_limit) : t("بلا حد", "Unlimited")],
            [t("لكل عميل", "Per customer"), coupon.per_customer_limit ? formatNumber(coupon.per_customer_limit) : t("بلا حد", "Unlimited")],
            [t("أول شراء فقط", "First purchase only"), coupon.first_purchase_only ? t("نعم", "Yes") : t("لا", "No")],
            [t("الفترة", "Window"), `${formatDate(coupon.starts_at) || "—"} → ${formatDate(coupon.ends_at) || "—"}`],
            [t("محجوز الآن", "Reserved now"), formatNumber(stats.reserved)],
            [t("أُنشئ", "Created"), formatDateTime(coupon.created_at)],
          ]}
        />
      </Card>
    </>
  );
}

function RedemptionsTab({ coupon }: { coupon: Coupon }) {
  const t = useT();
  const columns: Column<CouponRedemption>[] = [
    {
      key: "customer", header: t("العميل", "Customer"), exportValue: (r) => r.customer_email ?? r.customer_id,
      cell: (r) => (
        <AppLink className="ma-link ma-link--plain" to={`/customers/${r.customer_id}`}>
          <span className="ma-cell-main">{r.customer_name || r.customer_email || "—"}</span>
          <span className="ma-cell-sub"><bdi>{r.customer_email ?? r.customer_id}</bdi></span>
        </AppLink>
      ),
    },
    {
      key: "order", header: t("الطلب", "Order"), exportValue: (r) => r.order_id ?? "",
      cell: (r) => (r.order_id ? <AppLink className="ma-link ma-num" to={`/sales/orders/${r.order_id}`}>{r.order_id.slice(0, 8)}</AppLink> : "—"),
    },
    { key: "discount", header: t("الخصم", "Discount"), align: "end", exportKind: "number", exportValue: (r) => r.discount_minor / 100, cell: (r) => <span className="ma-num">{formatMinor(r.discount_minor, r.currency_code)}</span> },
    { key: "total", header: t("إجمالي الطلب", "Order total"), align: "end", exportKind: "number", exportValue: (r) => r.order_total_minor / 100, cell: (r) => <span className="ma-num">{formatMinor(r.order_total_minor, r.currency_code)}</span> },
    { key: "status", header: t("الحالة", "Status"), exportValue: (r) => r.status, cell: (r) => <Badge def={REDEMPTION_STATUS[r.status as keyof typeof REDEMPTION_STATUS] ?? { label: { ar: r.status, en: r.status } }} /> },
    { key: "at", header: t("التاريخ", "Date"), exportKind: "datetime", exportValue: (r) => r.redeemed_at ?? null, cell: (r) => formatDateTime(r.redeemed_at) },
  ];
  return (
    <PagedList
      queryKeyBase={couponsKeys.redemptions(coupon.promotion_id)}
      fetchPage={({ offset, limit }) => listCouponRedemptions(coupon.promotion_id, { offset, limit })}
      columns={columns}
      empty={t("لم يُستخدم الكوبون بعد.", "The coupon hasn't been used yet.")}
      exportConfig={{ filename: `coupon-${coupon.code}-redemptions`, title: coupon.code, fetchSize: 200 }}
    />
  );
}

function SettingsTab({ coupon }: { coupon: Coupon }) {
  const t = useT();
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (body: Parameters<typeof updateCoupon>[1]) => updateCoupon(coupon.promotion_id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: couponsKeys.all }),
  });
  return (
    <Card title={t("تعديل الكوبون", "Edit coupon")}>
      <CouponForm
        key={coupon.updated_at ?? ""}
        coupon={coupon}
        pending={save.isPending}
        error={save.error}
        submitLabel={t("حفظ التغييرات", "Save changes")}
        cancelHref={`/sales/coupons/${coupon.promotion_id}`}
        onSubmit={(body) => save.mutate(body)}
      />
    </Card>
  );
}

export default function CouponDetailPage() {
  const t = useT();
  const { promotionId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab | null) ?? "overview";
  const select = (next: Tab) => setParams((prev) => { const n = new URLSearchParams(prev); n.set("tab", next); return n; }, { replace: true });
  const queryClient = useQueryClient();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const coupon = useQuery(couponsQueries.detail(promotionId));
  const c = coupon.data;
  const canWrite = can("coupons.write") && c?.status !== "archived";

  const toggle = useMutation({
    mutationFn: () => setCouponActive(promotionId, !c?.is_active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: couponsKeys.all }),
  });
  const archive = useMutation({
    mutationFn: () => archiveCoupon(promotionId),
    onSuccess: () => {
      setConfirmArchive(false);
      queryClient.invalidateQueries({ queryKey: couponsKeys.all });
    },
  });

  const tabs: [Tab, string][] = [
    ["overview", t("نظرة عامة", "Overview")],
    ["redemptions", t("الاستخدامات", "Redemptions")],
    ...(canWrite ? ([["settings", t("تعديل", "Edit")]] as [Tab, string][]) : []),
  ];

  return (
    <>
      <PageHead
        title={c ? <span className="ma-num">{c.code}</span> : t("كوبون", "Coupon")}
        status={c ? <Badge def={couponStatusBadge(c.status)} /> : null}
        sub={c?.name ?? undefined}
        back={{ href: "/sales/coupons", label: t("الكوبونات", "Coupons") }}
        actions={
          c && canWrite ? (
            <>
              <Button label={c.is_active ? t("إيقاف", "Deactivate") : t("تفعيل", "Activate")} disabled={toggle.isPending} onClick={() => toggle.mutate()} />
              <Button kind="ghost" icon="folder" label={t("أرشفة", "Archive")} onClick={() => setConfirmArchive(true)} />
            </>
          ) : null
        }
      />
      <ErrorAlert error={toggle.error ?? archive.error} title={t("تعذّر تحديث الكوبون", "Couldn't update the coupon")} />
      <nav className="ma-tabs mb-4" aria-label={t("أقسام الكوبون", "Coupon sections")}>
        {tabs.map(([key, label]) => (
          <button key={key} type="button" aria-selected={tab === key} onClick={() => select(key)}>{label}</button>
        ))}
      </nav>
      <PageState error={coupon.error}>
        {coupon.isLoading ? <Loading /> : null}
        {c && tab === "overview" ? <OverviewTab coupon={c} /> : null}
        {c && tab === "redemptions" ? <RedemptionsTab coupon={c} /> : null}
        {c && tab === "settings" && canWrite ? <SettingsTab coupon={c} /> : null}
      </PageState>
      <ConfirmModal
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={t("أرشفة الكوبون؟", "Archive this coupon?")}
        message={t("يتوقف الكود فورًا. تبقى الاستخدامات والتقارير.", "The code stops working at once. Its redemptions and reports are kept.")}
        confirmLabel={t("أرشفة", "Archive")}
        loading={archive.isPending}
        onConfirm={() => archive.mutate()}
      />
    </>
  );
}
