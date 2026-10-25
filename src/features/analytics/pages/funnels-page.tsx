import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { behaviorQueries } from "@/lib/api";
import { buildWindows } from "@/lib/dates";
import { formatNumber, formatPercent } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { Button, Card, DateRange, Empty, Kpi, Loading, PageHead } from "@/components/ui/kit";
import { PageState } from "@/components/ui/primitives";

export default function FunnelsPage() {
  const t = useT();
  const initial = useMemo(() => buildWindows(30).current, []);
  const [from, setFrom] = useState(initial.start);
  const [to, setTo] = useState(initial.end);

  const funnel = useQuery(behaviorQueries.funnels({ start: from, end: to }));
  const steps = funnel.data?.steps ?? [];
  const firstVisitors = steps[0]?.visitors ?? 0;
  const lastVisitors = steps.length ? steps[steps.length - 1].visitors : 0;
  const overall = firstVisitors ? (lastVisitors / firstVisitors) * 100 : 0;

  return (
    <>
      <PageHead
        title={t("المسار التحويلي", "Conversion funnel")}
        sub={t("الزوّار المميزون في كل خطوة: مشاهدة المنتج ← البحث ← بدء الدفع ← إتمام الشراء.", "Distinct visitors at each step: product view → search → checkout started → order paid.")}
        actions={<Button sm icon="refresh" label={t("تحديث", "Refresh")} onClick={() => funnel.refetch()} />}
      />

      <div className="ma-toolbar">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} onClear={() => { setFrom(initial.start); setTo(initial.end); }} />
      </div>

      <PageState error={funnel.error}>
        {funnel.isLoading ? (
          <Loading />
        ) : steps.length ? (
          <>
            <div className="ma-kpis">
              <Kpi label={t("دخل المسار", "Entered funnel")} value={<span className="ma-num">{formatNumber(firstVisitors)}</span>} icon="users" field="var(--coral)" />
              <Kpi label={t("أتمّوا المسار", "Completed")} value={<span className="ma-num">{formatNumber(lastVisitors)}</span>} icon="check" field="var(--green)" />
              <Kpi label={t("التحويل الكلي", "Overall conversion")} value={<span className="ma-num">{formatPercent(overall)}</span>} icon="chart" field="var(--purple)" />
            </div>

            <Card title={t("خطوات المسار", "Funnel steps")} className="ma-section-gap">
              <ul className="ma-list">
                {steps.map((step, index) => (
                  <li key={step.event_type}>
                    <div style={{ flex: 1 }}>
                      <div className="ma-cell-main">
                        {index + 1}. {step.label} <span className="ma-cell-sub"><bdi>{step.event_type}</bdi></span>
                      </div>
                      <div className="ma-bar__track" style={{ marginTop: 6 }}>
                        <div className="ma-bar__fill" style={{ width: `${Math.max(2, step.conversion_from_first)}%`, background: "var(--coral)" }} />
                      </div>
                    </div>
                    <div style={{ textAlign: "end", minWidth: 160 }}>
                      <div className="ma-num">{formatNumber(step.visitors)} {t("زائر", "visitors")}</div>
                      <div className="ma-cell-sub">
                        {formatPercent(step.conversion_from_first)} {t("من البداية", "from first")} · {formatPercent(step.conversion_from_previous)} {t("من السابق", "from previous")}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        ) : (
          <Empty icon="chart" text={t("لا بيانات في هذا النطاق.", "No data in this window.")} />
        )}
      </PageState>
    </>
  );
}
