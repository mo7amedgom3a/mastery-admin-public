import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import { behaviorQueries } from "@/lib/api";
import { defaultRange, dayEndIso, dayStartIso, percentDelta, previousRange } from "@/lib/dates";
import { formatCompact, formatNumber, formatPercent } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { Button, Card, DateRange, Empty, ErrorAlert, Kpi, Loading, PageHead } from "@/components/ui/kit";
import { PageState } from "@/components/ui/primitives";
import { SelectField } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const PALETTE_STEP = ["var(--coral)", "var(--purple)", "var(--sky)", "var(--teal)", "var(--green)"];

export default function FunnelsPage() {
  const t = useT();
  const initial = useMemo(() => defaultRange(30), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [source, setSource] = useState<"db" | "posthog">("db");

  const params = { start: dayStartIso(from), end: dayEndIso(to) };
  const previous = useMemo(() => previousRange(from, to), [from, to]);
  const previousParams = { start: dayStartIso(previous.from), end: dayEndIso(previous.to) };

  const dbFunnel = useQuery(behaviorQueries.funnels(params));
  const previousDbFunnel = useQuery(behaviorQueries.funnels(previousParams));
  const posthogFunnel = useQuery({
    ...behaviorQueries.posthogFunnels(params),
    enabled: source === "posthog",
  });

  const activeQuery = source === "db" ? dbFunnel : posthogFunnel;
  const report = activeQuery.data;
  const steps = report?.steps ?? [];
  const available = source === "db" ? true : (posthogFunnel.data?.available ?? true);
  const sourceError = source === "posthog" ? posthogFunnel.data?.error : null;
  const firstVisitors = steps[0]?.visitors ?? 0;
  const lastVisitors = steps.length ? steps[steps.length - 1].visitors : 0;
  const overall = firstVisitors ? (lastVisitors / firstVisitors) * 100 : 0;

  const previousSteps = previousDbFunnel.data?.steps ?? [];
  const previousFirst = previousSteps[0]?.visitors ?? 0;
  const previousLast = previousSteps.length ? previousSteps[previousSteps.length - 1].visitors : 0;
  const previousOverall = previousFirst ? (previousLast / previousFirst) * 100 : 0;
  const delta = source === "db" && previousOverall ? percentDelta(overall, previousOverall) : null;

  const funnelConfig = {
    visitors: { label: t("الزوّار", "Visitors"), color: "var(--coral)" },
  } satisfies ChartConfig;

  const chartRows = steps.map((step, index) => ({
    label: step.label,
    visitors: step.visitors,
    fill: PALETTE_STEP[index % PALETTE_STEP.length],
  }));

  return (
    <>
      <PageHead
        title={t("المسار التحويلي", "Conversion funnel")}
        sub={t(
          "الزوّار المميزون في كل خطوة. مصدر «أحداث المنصة» هو قاعدة بياناتنا، و«PostHog» هو متجر الواجهة.",
          "Distinct visitors at each step. “Platform events” is our own event table; “PostHog” is the storefront project.",
        )}
        actions={<Button sm icon="refresh" label={t("تحديث", "Refresh")} onClick={() => activeQuery.refetch()} />}
      />

      <div className="ma-toolbar">
        <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} onClear={() => { setFrom(initial.from); setTo(initial.to); }} />
        <SelectField
          label={t("المصدر", "Source")}
          value={source}
          onChange={(value) => setSource(value as "db" | "posthog")}
          options={[
            { value: "db", label: t("أحداث المنصة", "Platform events") },
            { value: "posthog", label: "PostHog" },
          ]}
        />
      </div>

      <PageState error={activeQuery.error}>
        {activeQuery.isLoading ? (
          <Loading />
        ) : !available ? (
          <ErrorAlert error={sourceError ?? t("PostHog غير متاح حاليًا.", "PostHog is unavailable right now.")} />
        ) : steps.length ? (
          <>
            <div className="ma-kpis">
              <Kpi label={t("دخل المسار", "Entered funnel")} value={<span className="ma-num">{formatNumber(firstVisitors)}</span>} icon="users" field="var(--coral)" />
              <Kpi label={t("أتمّوا المسار", "Completed")} value={<span className="ma-num">{formatNumber(lastVisitors)}</span>} icon="check" field="var(--green)" />
              <Kpi label={t("التحويل الكلي", "Overall conversion")} value={<span className="ma-num">{formatPercent(overall)}</span>} icon="chart" field="var(--purple)" />
              <Kpi
                label={t("مقارنة بالفترة السابقة", "Vs previous period")}
                value={<span className="ma-num">{delta == null ? "—" : formatPercent(delta)}</span>}
                icon="history"
                field="var(--sky)"
              />
            </div>

            <Card title={t("شكل المسار", "Funnel shape")} className="ma-section-gap">
              <ChartContainer config={funnelConfig} className="h-[280px] w-full" dir="ltr">
                <BarChart data={chartRows} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(value: number) => formatCompact(value)} />
                  <YAxis type="category" dataKey="label" width={150} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <ChartTooltip cursor={{ fill: "var(--line)", fillOpacity: 0.25 }} content={<ChartTooltipContent valueFormatter={(value) => formatNumber(Number(value))} />} />
                  <Bar dataKey="visitors" radius={[0, 6, 6, 0]} barSize={26} fill="var(--color-visitors)">
                    {chartRows.map((row, index) => (
                      <Cell key={index} fill={row.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </Card>

            <Card title={t("خطوات المسار", "Funnel steps")} className="ma-section-gap">
              <ul className="ma-list">
                {steps.map((step, index) => (
                  <li key={`${step.event_type}-${index}`}>
                    <div style={{ flex: 1 }}>
                      <div className="ma-cell-main">
                        {index + 1}. {step.label} <span className="ma-cell-sub"><bdi>{step.event_type}</bdi></span>
                      </div>
                      <div className="ma-bar__track" style={{ marginTop: 6 }}>
                        <div className="ma-bar__fill" style={{ width: `${Math.max(2, step.conversion_from_first)}%`, background: PALETTE_STEP[index % PALETTE_STEP.length] }} />
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
