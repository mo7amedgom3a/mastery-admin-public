import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";

import { subscriptionQueries, type SubscriptionPlan } from "@/lib/api";
import { formatAmount, formatDate, formatNumber } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { productStatusBadge } from "@/lib/status";
import { Alert, Badge, Button, Card, DateRange, Dl, Kpi, Loading, PageHead } from "@/components/ui/kit";
import { PageState } from "@/components/ui/primitives";

import { PlanFunnel } from "../components/funnel";
import { PlanActions } from "../components/plan-actions";
import { PlanBenefitsTab } from "../components/plan-benefits-tab";
import { PlanCard } from "../components/plan-card";
import { PlanCardItemsTab } from "../components/plan-card-items-tab";
import { PlanDetailsTab } from "../components/plan-details-tab";
import { PlanDiscountTab } from "../components/plan-discount-tab";
import { PlanFeaturesTab } from "../components/plan-features-tab";
import { PlanPreviewPanel } from "../components/plan-preview";
import { PlanPreviewDraft, usePlanPreviewDraft } from "../components/plan-preview-draft";
import { PlanResourcesTab } from "../components/plan-resources-tab";
import { PlanSubscribersTab } from "../components/plan-subscribers-tab";
import { AUDIENCE_LABELS, INTERVAL_LABELS, adminPlanToPreview, PLAN_TYPE_LABELS, labelOf, planTitle, toNumber, useStatsWindow } from "../lib";

type Tab = "overview" | "details" | "card" | "features" | "resources" | "benefits" | "discount" | "subscribers";

/** Tabs whose edits change what customers see, so the live storefront preview sits beside them. */
const PREVIEW_TABS = new Set<Tab>(["overview", "details", "card", "features", "resources", "discount"]);

/** What still blocks publishing (mirrors the API check, so the admin sees it before clicking). */
function publishBlockers(plan: SubscriptionPlan, t: (ar: string, en: string) => string): string[] {
  const issues: string[] = [];
  const titled = new Set((plan.translations ?? []).filter((tr) => tr.title.trim()).map((tr) => tr.locale_code.split("-")[0]));
  if (!titled.has("ar")) issues.push(t("أضف الاسم بالعربية", "Add the Arabic title"));
  if (!titled.has("en")) issues.push(t("أضف الاسم بالإنجليزية", "Add the English title"));
  if (plan.plan_type === "standard" && !(plan.products ?? []).length) issues.push(t("أضف موردًا واحدًا على الأقل", "Add at least one resource"));
  return issues;
}

function OverviewTab({ plan }: { plan: SubscriptionPlan }) {
  const t = useT();
  const { from, to, setFrom, setTo, window } = useStatsWindow(30);
  const funnel = useQuery(subscriptionQueries.funnel({ ...window, plan_id: plan.plan_id }));
  const row = funnel.data?.plans[0];
  const blockers = plan.status === "published" ? [] : publishBlockers(plan, t);
  const monthly = plan.billing_interval === "year" ? toNumber(plan.effective_price) / 12 : toNumber(plan.effective_price);

  return (
    <>
      {blockers.length ? (
        <Alert kind="warning" title={t("قبل النشر", "Before publishing")}>
          <ul style={{ margin: 0, paddingInlineStart: "1.2em" }}>{blockers.map((b) => <li key={b}>{b}</li>)}</ul>
        </Alert>
      ) : null}
      <div className="ma-kpis">
        <Kpi label={t("مشتركون نشطون", "Active subscribers")} value={formatNumber(plan.active_subscribers ?? 0)} icon="users" />
        <Kpi label={t("كل المشتركين", "All-time subscribers")} value={formatNumber(plan.total_subscribers ?? 0)} icon="history" />
        <Kpi label={t("السعر الحالي", "Current price")} value={formatAmount(toNumber(plan.effective_price), plan.currency_code)}
          meta={plan.compare_at_price ? t(`بدلًا من ${formatAmount(toNumber(plan.compare_at_price), plan.currency_code)}`, `was ${formatAmount(toNumber(plan.compare_at_price), plan.currency_code)}`) : undefined} icon="tag" />
        <Kpi label={t("إيراد شهري لكل مشترك جديد", "Monthly value per new subscriber")} value={formatAmount(monthly, plan.currency_code)} icon="card" />
      </div>
      <div className="ma-cols ma-cols--main-side">
        <Card title={t("شاهدوا مقابل اشتروا", "Viewed vs purchased")} actions={<DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />}>
          <PageState error={funnel.error}>
            {funnel.isLoading ? <Loading /> : row ? <PlanFunnel row={row} /> : null}
          </PageState>
          <p className="ma-help" style={{ marginBlockStart: "var(--space-3)" }}>
            {t(
              "المشاهدات: زوار صفحة الباقة (مميّزون). بدء الدفع: عملاء أنشؤوا طلب اشتراك. الدفع: اشتراكات فُعّلت في الفترة.",
              "Viewed: distinct visitors of the plan page. Started checkout: customers who created a subscription order. Paid: subscriptions activated in the window.",
            )}
          </p>
        </Card>
        <Card title={t("بطاقة الباقة", "Plan card")}>
          <PlanCard plan={plan} showStats={false} />
        </Card>
      </div>
      <Card title={t("ملخص الباقة", "Plan summary")}>
        <Dl rows={[
          [t("النوع", "Type"), t(labelOf(PLAN_TYPE_LABELS, plan.plan_type).ar, labelOf(PLAN_TYPE_LABELS, plan.plan_type).en)],
          [t("الفئة", "Audience"), t(labelOf(AUDIENCE_LABELS, plan.audience_type).ar, labelOf(AUDIENCE_LABELS, plan.audience_type).en)],
          [t("الفوترة", "Billing"), t(labelOf(INTERVAL_LABELS, plan.billing_interval).ar, labelOf(INTERVAL_LABELS, plan.billing_interval).en)],
          [t("السعر الأساسي", "List price"), formatAmount(toNumber(plan.price), plan.currency_code)],
          ...(plan.plan_type === "choose_x"
            ? ([[t("عدد البرامج المسموح", "Programs allowed"), String(plan.selection_allowance ?? "—")],
                [t("حد الاستبدال", "Replacement limit"), plan.max_replacements_per_period == null ? t("بلا حد", "No limit") : String(plan.max_replacements_per_period)]] as [string, string][])
            : []),
          ...(plan.audience_type === "company"
            ? ([[t("حجم الفريق", "Team size"), t(`${plan.min_seats ?? 1}–${plan.max_seats} موظفًا`, `${plan.min_seats ?? 1}–${plan.max_seats} employees`)]] as [string, string][])
            : []),
          [t("الموارد", "Resources"), plan.plan_type === "choose_x"
            ? t(`${(plan.included_products ?? []).length} مضمّنة · الاختيار من الكتالوج المنشور`, `${(plan.included_products ?? []).length} included · picks from published catalog`)
            : t(`${(plan.included_products ?? []).length} مضمّنة`, `${(plan.included_products ?? []).length} included`)],
          [t("الإصدار", "Version"), `v${plan.version}`],
          [t("أُنشئت", "Created"), formatDate(plan.created_at)],
          [t("آخر تحديث", "Updated"), formatDate(plan.updated_at)],
        ]} />
      </Card>
    </>
  );
}

export default function SubscriptionPlanDetailPage() {
  const t = useT();
  const lang = useLang();
  const { id = "" } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab | null) ?? "overview";
  const plan = useQuery(subscriptionQueries.plan(id, lang));
  const p = plan.data;
  const storefront = useQuery({ ...subscriptionQueries.preview(id), retry: false });
  // The storefront-shaped plan; the admin plan stands in while it loads or if the API lacks the endpoint.
  const base = useMemo(() => storefront.data ?? (p ? adminPlanToPreview(p) : undefined), [storefront.data, p]);
  const draft = usePlanPreviewDraft(base);
  const [previewOpen, setPreviewOpen] = useState(true);
  const withPreview = previewOpen && PREVIEW_TABS.has(tab);

  const tabs: [Tab, string][] = [
    ["overview", t("نظرة عامة", "Overview")],
    ["details", t("البيانات والسعر", "Details & price")],
    ["card", t("عناصر البطاقة", "Card items")],
    ["features", t("المزايا", "Features")],
    ["resources", t("الموارد", "Resources")],
    ["benefits", t("الاستحقاقات", "Benefits")],
    ["discount", t("الخصم", "Discount")],
    ["subscribers", t("المشتركون", "Subscribers")],
  ];
  const select = (next: Tab) => setParams((prev) => { const n = new URLSearchParams(prev); n.set("tab", next); return n; }, { replace: true });

  return (
    <>
      <PageHead
        back={{ href: "/subscriptions/plans", label: t("الباقات", "Plans") }}
        title={p ? planTitle(p, lang) : t("باقة", "Plan")}
        status={p ? <Badge def={productStatusBadge(p.status)} /> : null}
        sub={p ? <bdi>{p.slug}</bdi> : undefined}
        actions={p ? <PlanActions plan={p} /> : null}
      />
      <nav className="ma-cell-flex" style={{ marginBlockEnd: "var(--space-4)", flexWrap: "wrap" }} aria-label={t("أقسام الصفحة", "Page sections")}>
        {tabs.map(([key, label]) => (
          <Button key={key} kind={tab === key ? "primary" : "soft"} sm label={label} onClick={() => select(key)} />
        ))}
        {PREVIEW_TABS.has(tab) ? (
          <span style={{ marginInlineStart: "auto" }}>
            <Button kind="ghost" sm icon="eye"
              label={previewOpen ? t("إخفاء المعاينة", "Hide preview") : t("المعاينة الحية", "Live preview")}
              onClick={() => setPreviewOpen((open) => !open)} />
          </span>
        ) : null}
      </nav>
      <PlanPreviewDraft.Provider value={draft.context}>
        <div className={withPreview ? "ma-plan-workspace" : undefined}>
          <div className="ma-plan-workspace__main">
            <PageState error={plan.error}>
              {plan.isLoading ? <Loading /> : null}
              {/* Keyed by version + update time so editors reset to the saved plan after each save. */}
              {p && tab === "overview" ? <OverviewTab plan={p} /> : null}
              {p && tab === "details" ? <PlanDetailsTab key={`${p.version}-${p.updated_at}`} plan={p} /> : null}
              {p && tab === "card" ? <PlanCardItemsTab key={p.updated_at ?? ""} plan={p} /> : null}
              {p && tab === "features" ? <PlanFeaturesTab key={`f-${(p.plan_features ?? []).map((f) => f.feature_id).join()}`} plan={p} /> : null}
              {p && tab === "resources" ? <PlanResourcesTab key={p.updated_at ?? ""} plan={p} libraryCount={storefront.data?.library_count ?? null} /> : null}
              {p && tab === "benefits" ? <PlanBenefitsTab key={p.updated_at ?? ""} plan={p} /> : null}
              {p && tab === "discount" ? <PlanDiscountTab key={p.updated_at ?? ""} plan={p} /> : null}
              {p && tab === "subscribers" ? <PlanSubscribersTab plan={p} /> : null}
            </PageState>
          </div>
          {withPreview ? (
            <aside className="ma-plan-workspace__preview">
              <PlanPreviewPanel plan={draft.plan} />
            </aside>
          ) : null}
        </div>
      </PlanPreviewDraft.Provider>
    </>
  );
}
