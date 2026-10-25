import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { subscriptionQueries, type SubscriptionPlan, type SubscriptionPlansParams } from "@/lib/api";
import { formatAmount, formatDate, formatNumber } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { productStatusBadge } from "@/lib/status";
import { AppLink } from "@/components/ui/app-link";
import { Badge, Button, Card, Empty, Loading, PageHead } from "@/components/ui/kit";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageState } from "@/components/ui/primitives";
import { SearchBox } from "@/components/ui/paged-list";
import { SelectField } from "@/components/ui/select";

import { PlanActions } from "../components/plan-actions";
import { PlanCard } from "../components/plan-card";
import { AUDIENCE_LABELS, INTERVAL_LABELS, PLAN_TYPE_LABELS, labelOf, planTitle, toNumber } from "../lib";

type View = "cards" | "table";

export default function SubscriptionPlansPage() {
  const t = useT();
  const lang = useLang();
  const [view, setView] = useState<View>("cards");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [audience, setAudience] = useState("all");
  const [interval, setInterval] = useState("all");
  const [planType, setPlanType] = useState("all");
  const set = (value: string) => (value === "all" ? undefined : value);

  const params: SubscriptionPlansParams = {
    lang,
    ...(query.trim() ? { query: query.trim() } : {}),
    status: set(status),
    audience_type: set(audience) as SubscriptionPlansParams["audience_type"],
    billing_interval: set(interval) as SubscriptionPlansParams["billing_interval"],
    plan_type: set(planType) as SubscriptionPlansParams["plan_type"],
  };
  const plans = useQuery(subscriptionQueries.plans(params));
  const rows = plans.data ?? [];

  const all = (ar: string, en: string) => ({ value: "all", label: t(ar, en) });
  const opts = (allLabel: { value: string; label: string }, map: Record<string, { ar: string; en: string }>) =>
    [allLabel, ...Object.entries(map).map(([value, l]) => ({ value, label: t(l.ar, l.en) }))];

  const columns: Column<SubscriptionPlan>[] = [
    {
      key: "title",
      header: t("الباقة", "Plan"),
      exportValue: (p) => planTitle(p, lang),
      cell: (p) => (
        <AppLink className="ma-link ma-link--plain" to={`/subscriptions/plans/${p.plan_id}`}>
          <span className="ma-cell-main">{planTitle(p, lang)}</span>
          <span className="ma-cell-sub"><bdi>{p.slug}</bdi></span>
        </AppLink>
      ),
    },
    { key: "status", header: t("الحالة", "Status"), exportValue: (p) => p.status, cell: (p) => <Badge def={productStatusBadge(p.status)} /> },
    { key: "type", header: t("النوع", "Type"), exportValue: (p) => p.plan_type, cell: (p) => t(labelOf(PLAN_TYPE_LABELS, p.plan_type).ar, labelOf(PLAN_TYPE_LABELS, p.plan_type).en) },
    { key: "audience", header: t("الفئة", "Audience"), exportValue: (p) => p.audience_type, cell: (p) => t(labelOf(AUDIENCE_LABELS, p.audience_type).ar, labelOf(AUDIENCE_LABELS, p.audience_type).en) },
    { key: "interval", header: t("الفوترة", "Billing"), exportValue: (p) => p.billing_interval, cell: (p) => t(labelOf(INTERVAL_LABELS, p.billing_interval).ar, labelOf(INTERVAL_LABELS, p.billing_interval).en) },
    {
      key: "price", header: t("السعر", "Price"), align: "end", exportKind: "money", exportValue: (p) => toNumber(p.effective_price),
      sortValue: (p) => toNumber(p.effective_price),
      cell: (p) => (
        <span className="ma-num">
          {formatAmount(toNumber(p.effective_price), p.currency_code)}
          {p.compare_at_price ? <span className="ma-cell-sub" style={{ textDecoration: "line-through" }}>{formatAmount(toNumber(p.compare_at_price), p.currency_code)}</span> : null}
        </span>
      ),
    },
    { key: "active", header: t("نشطون", "Active"), align: "end", exportKind: "number", sortValue: (p) => p.active_subscribers ?? 0, exportValue: (p) => p.active_subscribers ?? 0, cell: (p) => <span className="ma-num">{formatNumber(p.active_subscribers ?? 0)}</span> },
    { key: "total", header: t("الإجمالي", "All-time"), align: "end", exportKind: "number", sortValue: (p) => p.total_subscribers ?? 0, exportValue: (p) => p.total_subscribers ?? 0, cell: (p) => <span className="ma-num">{formatNumber(p.total_subscribers ?? 0)}</span> },
    { key: "resources", header: t("الموارد", "Resources"), align: "end", exportKind: "number", exportValue: (p) => p.products?.length ?? 0, cell: (p) => <span className="ma-num">{formatNumber(p.products?.length ?? 0)}</span> },
    { key: "updated", header: t("آخر تحديث", "Updated"), exportKind: "datetime", exportValue: (p) => p.updated_at ?? null, cell: (p) => formatDate(p.updated_at) },
  ];

  return (
    <>
      <PageHead
        title={t("باقات الاشتراك", "Subscription plans")}
        sub={t(
          "بطاقات الباقات كما يراها العملاء، مع الحالة وعدد المشتركين. انشر الباقة أو أعدها لمسودة من هنا.",
          "Plan cards as customers see them, with status and subscribers. Publish or move a plan back to draft from here.",
        )}
        actions={can("subscriptionsWrite.write") ? <Button kind="primary" icon="plus" label={t("باقة جديدة", "New plan")} href="/subscriptions/plans/new" /> : null}
      />

      <Card flush>
        <div className="ma-toolbar">
          <SearchBox value={query} onChange={setQuery} placeholder={t("ابحث بالاسم أو الرابط…", "Search title or slug…")} />
          <SelectField label={t("الحالة", "Status")} value={status} onChange={setStatus}
            options={[all("كل الحالات", "All statuses"), { value: "published", label: t("منشورة", "Published") }, { value: "draft", label: t("مسودة", "Draft") }, { value: "archived", label: t("مؤرشفة", "Archived") }]} />
          <SelectField label={t("الفئة", "Audience")} value={audience} onChange={setAudience} options={opts(all("كل الفئات", "All audiences"), AUDIENCE_LABELS)} />
          <SelectField label={t("الفوترة", "Billing")} value={interval} onChange={setInterval} options={opts(all("كل دورات الفوترة", "All billing"), INTERVAL_LABELS)} />
          <SelectField label={t("النوع", "Type")} value={planType} onChange={setPlanType} options={opts(all("كل الأنواع", "All types"), PLAN_TYPE_LABELS)} />
          <div className="ma-toolbar__end ma-segmented" role="tablist" aria-label={t("طريقة العرض", "View")}>
            {(["cards", "table"] as View[]).map((v) => (
              <button key={v} type="button" role="tab" aria-selected={view === v}
                className={`ma-btn ma-btn--sm ${view === v ? "ma-btn--secondary" : "ma-btn--soft"}`} onClick={() => setView(v)}>
                {v === "cards" ? t("بطاقات", "Cards") : t("جدول", "Table")}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <PageState error={plans.error}>
        {plans.isLoading ? <Loading /> : null}
        {!plans.isLoading && rows.length === 0 ? (
          <Card>
            <Empty text={t("لا توجد باقات مطابقة.", "No matching plans.")}
              action={can("subscriptionsWrite.write") ? <Button kind="primary" icon="plus" label={t("باقة جديدة", "New plan")} href="/subscriptions/plans/new" /> : null} />
          </Card>
        ) : null}
        {rows.length > 0 && view === "cards" ? (
          <div className="ma-plangrid" style={{ marginBlockStart: "var(--space-4)" }}>
            {rows.map((plan) => (
              <PlanCard key={plan.plan_id} plan={plan} actions={<PlanActions plan={plan} showEdit />} />
            ))}
          </div>
        ) : null}
        {rows.length > 0 && view === "table" ? (
          <Card flush>
            <DataTable columns={columns} rows={rows} exportConfig={{ filename: "subscription-plans", title: t("باقات الاشتراك", "Subscription plans") }} />
          </Card>
        ) : null}
      </PageState>
    </>
  );
}
