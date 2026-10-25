import { useState, type CSSProperties, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cell, Pie, PieChart, Tooltip } from "recharts";

import { productQueries, type ProductInsightItem, type ProductInsightSegment } from "@/lib/api";
import { formatNumber, formatPercent } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { initialsOf } from "@/lib/status";
import { AppLink } from "@/components/ui/app-link";
import { Avatar, Card, DateRange, Empty, ErrorAlert, Loading } from "@/components/ui/kit";
import { ChartContainer } from "@/components/ui/chart";
import { SelectField } from "@/components/ui/select";

const DAY_MS = 86_400_000;
const PRESETS = ["7", "30", "90", "365", "custom"] as const;
type Preset = (typeof PRESETS)[number];

/** Product type → fixed categorical slot, so a type keeps its colour whatever else is in the range. */
const TYPE_SLOT: Record<string, number> = { course: 1, package: 2, diploma: 3, bundle: 4, consultation: 5 };

const TYPE_LABELS: Record<string, [string, string]> = {
  course: ["دورة", "Course"],
  package: ["حزمة", "Package"],
  diploma: ["دبلوم", "Diploma"],
  bundle: ["باقة", "Bundle"],
  consultation: ["استشارة", "Consultation"],
};

function toDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function presetRange(days: number): { from: string; to: string } {
  const to = new Date();
  return { from: toDay(new Date(to.getTime() - (days - 1) * DAY_MS)), to: toDay(to) };
}

/** English count with its noun, singular for one ("1 order", "3 orders"). */
function countOf(value: number, noun: string): string {
  return `${formatNumber(value)} ${noun}${value === 1 ? "" : "s"}`;
}

function seriesColor(slot: number | "other"): string {
  return slot === "other" ? "var(--series-other)" : `var(--series-${((slot - 1) % 6) + 1})`;
}

/**
 * Sales insights for the products on a catalog page: a donut of paid orders (top products + other,
 * or per product type) and four ranked lists — best sellers, most viewed, lowest rated and never sold.
 * The range defaults to the last 30 days.
 */
export function CatalogInsightsPanel({ productType }: { productType: string }) {
  const t = useT();
  const [preset, setPreset] = useState<Preset>("30");
  const [range, setRange] = useState(() => presetRange(30));
  const [split, setSplit] = useState<"product" | "type">("product");
  const multiType = productType.includes(",");

  const ready = Boolean(range.from && range.to);
  const params = { start: range.from, end: range.to, product_type: productType, limit: 5 };
  const result = useQuery({ ...productQueries.insights(params), enabled: ready });
  const data = result.data;

  const choosePreset = (value: Preset) => {
    setPreset(value);
    if (value !== "custom") setRange(presetRange(Number(value)));
  };

  const segments: (ProductInsightSegment & { color: string })[] = (
    split === "type" ? data?.segments_by_type ?? [] : data?.segments_by_product ?? []
  ).map((segment, index) => ({
    ...segment,
    label:
      segment.key === "other"
        ? t("أخرى", "Other")
        : split === "type" && TYPE_LABELS[segment.key]
          ? t(...TYPE_LABELS[segment.key])
          : segment.label,
    color: seriesColor(segment.key === "other" ? "other" : split === "type" ? (TYPE_SLOT[segment.key] ?? index + 1) : index + 1),
  }));
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <Card
      title={t("أداء المنتجات", "Product insights")}
      className="ma-insights"
      actions={
        <div className="ma-toolbar__end">
          <SelectField
            label={t("الفترة", "Period")}
            value={preset}
            onChange={choosePreset}
            options={[
              { value: "7", label: t("آخر 7 أيام", "Last 7 days") },
              { value: "30", label: t("آخر 30 يومًا", "Last 30 days") },
              { value: "90", label: t("آخر 90 يومًا", "Last 90 days") },
              { value: "365", label: t("آخر 12 شهرًا", "Last 12 months") },
              { value: "custom", label: t("فترة مخصصة", "Custom range") },
            ]}
          />
          {preset === "custom" ? (
            <DateRange
              from={range.from}
              to={range.to}
              onFrom={(from) => setRange((prev) => ({ ...prev, from }))}
              onTo={(to) => setRange((prev) => ({ ...prev, to }))}
            />
          ) : null}
        </div>
      }
    >
      {result.isLoading ? (
        <Loading />
      ) : result.error ? (
        <ErrorAlert error={result.error} title={t("تعذّر تحميل المؤشرات", "Couldn't load the insights")} />
      ) : data ? (
        <div className="ma-insights__grid">
          <section className="ma-insights__share" aria-labelledby="insights-share">
            <div className="ma-insights__share-head">
              <h3 id="insights-share" className="ma-insights__title">
                {t("حصة الطلبات المدفوعة", "Share of paid orders")}
              </h3>
              {multiType ? (
                <SelectField
                  label={t("التقسيم", "Split")}
                  value={split}
                  onChange={setSplit}
                  options={[
                    { value: "product", label: t("حسب المنتج", "By product") },
                    { value: "type", label: t("حسب النوع", "By type") },
                  ]}
                />
              ) : null}
            </div>
            {total === 0 ? (
              <Empty text={t("لا طلبات مدفوعة في هذه الفترة.", "No paid orders in this period.")} icon="chart" />
            ) : (
              <>
                <ChartContainer config={{}} className="ma-insights__donut" dir="ltr">
                  <PieChart>
                    <Tooltip
                      content={({ active, payload }) => {
                        const item = active ? (payload?.[0]?.payload as (typeof segments)[number] | undefined) : undefined;
                        if (!item) return null;
                        return (
                          <div className="ma-chart-tip">
                            <div className="ma-chart-tip__row" style={{ "--c": item.color } as CSSProperties}>
                              <span className="ma-chart-tip__dot" />
                              <span className="ma-chart-tip__name">{item.label}</span>
                              <span className="ma-chart-tip__value">
                                {formatNumber(item.value)} · {formatPercent((item.value / total) * 100)}
                              </span>
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Pie
                      data={segments}
                      dataKey="value"
                      nameKey="label"
                      innerRadius="58%"
                      outerRadius="92%"
                      paddingAngle={1}
                      stroke="var(--surface)"
                      strokeWidth={2}
                      isAnimationActive={false}
                    >
                      {segments.map((segment) => (
                        <Cell key={segment.key} fill={segment.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                {/* Legend doubles as the table view: every segment with its count and share. */}
                <ul className="ma-insights__legend">
                  {segments.map((segment) => (
                    <li key={segment.key} style={{ "--c": segment.color } as CSSProperties}>
                      <span className="ma-chart-legend__swatch" aria-hidden="true" />
                      <span className="ma-insights__legend-label">
                        {segment.key === "other" || split === "type" ? (
                          segment.label
                        ) : (
                          <AppLink to={`/learning/catalog/${segment.key}`} className="ma-link ma-link--plain">
                            {segment.label}
                          </AppLink>
                        )}
                      </span>
                      <span className="ma-num">{formatNumber(segment.value)}</span>
                      <span className="ma-num ma-insights__share-pct">{formatPercent((segment.value / total) * 100)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <RankList
            title={t("الأكثر شراءً", "Top purchased")}
            items={data.top_sellers}
            empty={t("لا مبيعات في هذه الفترة.", "No sales in this period.")}
            value={(item) => t(`${formatNumber(item.value)} طلب`, countOf(item.value, "order"))}
          />
          <RankList
            title={t("الأكثر مشاهدة", "Most popular")}
            hint={t("حسب مشاهدات صفحة المنتج", "By product page views")}
            items={data.popular}
            empty={t("لا مشاهدات مسجلة في هذه الفترة.", "No views recorded in this period.")}
            value={(item) => t(`${formatNumber(item.value)} مشاهدة`, countOf(item.value, "view"))}
            sub={(item) =>
              item.value
                ? t(
                    `${formatNumber(item.secondary ?? 0)} طلب · تحويل ${formatPercent(((item.secondary ?? 0) / item.value) * 100)}`,
                    `${countOf(item.secondary ?? 0, "order")} · ${formatPercent(((item.secondary ?? 0) / item.value) * 100)} conversion`,
                  )
                : null
            }
          />
          <RankList
            title={t("الأقل تقييمًا", "Lowest rated")}
            hint={t("التقييمات المنشورة، كل الفترات", "Published reviews, all time")}
            items={data.low_rated}
            empty={t("لا تقييمات منشورة بعد.", "No published reviews yet.")}
            value={(item) => `★ ${item.value.toFixed(1)}`}
            sub={(item) => t(`${formatNumber(item.secondary ?? 0)} تقييم`, countOf(item.secondary ?? 0, "review"))}
            tone="danger"
          />
          <RankList
            title={t("لم يُشترَ", "Not purchased")}
            hint={t(
              `${formatNumber(data.not_purchased_total)} منتج منشور بلا طلب مدفوع · الأكثر مشاهدة أولًا`,
              `${formatNumber(data.not_purchased_total)} published products without a paid order · most viewed first`,
            )}
            items={data.not_purchased}
            empty={t("كل المنتجات المنشورة بيعت في هذه الفترة.", "Every published product sold in this period.")}
            value={(item) => t(`${formatNumber(item.value)} مشاهدة`, countOf(item.value, "view"))}
          />
        </div>
      ) : null}
    </Card>
  );
}

function RankList({
  title,
  hint,
  items,
  empty,
  value,
  sub,
  tone,
}: {
  title: string;
  hint?: string;
  items: ProductInsightItem[];
  empty: string;
  value: (item: ProductInsightItem) => ReactNode;
  sub?: (item: ProductInsightItem) => ReactNode;
  tone?: "danger";
}) {
  const t = useT();
  return (
    <section className="ma-insights__rank">
      <h3 className="ma-insights__title">{title}</h3>
      {hint ? <p className="ma-list__sub">{hint}</p> : null}
      {items.length === 0 ? (
        <p className="ma-insights__empty">{empty}</p>
      ) : (
        <ol className="ma-list">
          {items.map((item) => {
            const name = item.title ?? item.slug;
            const type = TYPE_LABELS[item.product_type];
            return (
              <li key={item.product_id}>
                <Avatar initials={initialsOf(name)} src={item.image} color="var(--teal)" alt={name} square />
                <span className="ma-list__main">
                  <AppLink to={`/learning/catalog/${item.product_id}`} className="ma-list__title">
                    {name}
                  </AppLink>
                  <span className="ma-list__sub">
                    {[type ? t(...type) : item.product_type, sub?.(item)].filter(Boolean).map((part, index) => (
                      <span key={index}>
                        {index ? " · " : null}
                        {part}
                      </span>
                    ))}
                  </span>
                </span>
                <span className={tone === "danger" ? "ma-num ma-insights__value is-danger" : "ma-num ma-insights__value"}>
                  {value(item)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
