/* oxlint-disable react/only-export-components -- shadcn chart primitives ship hooks/helpers together */
import * as React from "react";
import * as RechartsPrimitive from "recharts";

import { cn } from "@/lib/cn";

/**
 * shadcn/ui chart primitives (recharts) dressed in the Mastery kit: role tokens for surfaces and
 * text, 1px `--line` rules instead of a border-grid, no shadows, radius from the scale. Series
 * colours come from `chartConfig` and land on `--color-<key>` so both themes follow the tokens.
 */

const THEMES = { light: "", dark: '[data-theme="dark"]' } as const;

export type ChartConfig = {
  [key: string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & ({ color?: string; theme?: never } | { color?: never; theme: Record<keyof typeof THEMES, string> });
};

type ChartContextProps = { config: ChartConfig };

const ChartContext = React.createContext<ChartContextProps | null>(null);

export function useChart(): ChartContextProps {
  const context = React.useContext(ChartContext);
  if (!context) throw new Error("useChart must be used within a <ChartContainer />");
  return context;
}

export const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig;
    children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div ref={ref} data-chart={chartId} className={cn("ma-chart-scope", className)} {...props}>
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});
ChartContainer.displayName = "ChartContainer";

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(([, item]) => item.theme ?? item.color);
  if (!colorConfig.length) return null;

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, item]) => {
    const color = item.theme?.[theme as keyof typeof THEMES] ?? item.color;
    return color ? `  --color-${key}: ${color};` : null;
  })
  .join("\n")}
}`,
          )
          .join("\n"),
      }}
    />
  );
}

const ChartTooltip = RechartsPrimitive.Tooltip;

type ValueType = number | string | Array<number | string>;
type NameType = number | string;

type ChartTooltipContentProps = React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
  React.ComponentProps<"div"> & {
    hideLabel?: boolean;
    hideIndicator?: boolean;
    indicator?: "line" | "dot" | "dashed";
    nameKey?: string;
    labelKey?: string;
    /** Formats the header (e.g. a day → a readable date). */
    labelFormatter?: (label: unknown) => React.ReactNode;
    /** Formats each series value. */
    valueFormatter?: (value: ValueType) => React.ReactNode;
  };

export const ChartTooltipContent = React.forwardRef<HTMLDivElement, ChartTooltipContentProps>(
  (
    {
      active,
      payload,
      label,
      className,
      indicator = "dot",
      hideLabel = false,
      hideIndicator = false,
      labelKey,
      nameKey,
      labelFormatter,
      valueFormatter,
    },
    ref,
  ) => {
    const { config } = useChart();

    const tooltipLabel = React.useMemo(() => {
      if (hideLabel || !payload?.length) return null;
      if (labelFormatter) return <span className="ma-chart-tip__label">{labelFormatter(label)}</span>;
      const [item] = payload;
      const key = `${labelKey || item?.dataKey || item?.name || "value"}`;
      const itemConfig = getPayloadConfigFromPayload(config, item, key);
      const value =
        !labelKey && typeof label === "string" ? (config[label]?.label ?? label) : itemConfig?.label;
      if (React.isValidElement(value)) return value;
      return value ? <span className="ma-chart-tip__label">{value}</span> : null;
    }, [label, labelKey, payload, hideLabel, config, labelFormatter]);

    if (!active || !payload?.length) return null;

    const nestLabel = payload.length === 1 && indicator !== "dot";

    return (
      <div ref={ref} className={cn("ma-chart-tip", className)}>
        {!nestLabel ? tooltipLabel : null}
        <div className="ma-chart-tip__rows">
          {payload
            .filter((item) => item.type !== "none")
            .map((item, index) => {
              const key = `${nameKey || item.name || item.dataKey || "value"}`;
              const itemConfig = getPayloadConfigFromPayload(config, item, key);
              const indicatorColor = itemConfig?.color ?? item.color;

              return (
                <div className="ma-chart-tip__row" key={`${item.dataKey ?? index}`}>
                  {itemConfig?.icon ? (
                    <itemConfig.icon />
                  ) : (
                    !hideIndicator && (
                      <span
                        className={cn("ma-chart-tip__dot", indicator)}
                        style={{ "--c": indicatorColor } as React.CSSProperties}
                      />
                    )
                  )}
                  <span className="ma-chart-tip__name">{itemConfig?.label ?? item.name}</span>
                  {item.value != null ? (
                    <span className="ma-chart-tip__value">
                      {valueFormatter
                        ? valueFormatter(item.value as ValueType)
                        : typeof item.value === "number"
                          ? item.value.toLocaleString("en")
                          : String(item.value)}
                    </span>
                  ) : null}
                </div>
              );
            })}
        </div>
      </div>
    );
  },
);
ChartTooltipContent.displayName = "ChartTooltipContent";

export const ChartLegend = RechartsPrimitive.Legend;

export const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    payload?: Array<{ value?: unknown; dataKey?: unknown; color?: string }>;
    verticalAlign?: "top" | "bottom";
    hideIcon?: boolean;
    nameKey?: string;
  }
>(({ className, hideIcon = false, payload, verticalAlign = "bottom", nameKey }, ref) => {
  const { config } = useChart();
  if (!payload?.length) return null;

  return (
    <div ref={ref} className={cn("ma-chart-legend", verticalAlign === "top" && "is-top", className)}>
      {payload.map((item) => {
        const key = `${nameKey || item.dataKey || "value"}`;
        const itemConfig = getPayloadConfigFromPayload(config, item, key);
        return (
          <span key={String(item.value)} className="ma-chart-legend__item">
            {itemConfig?.icon && !hideIcon ? (
              <itemConfig.icon />
            ) : (
              <span className="ma-chart-legend__swatch" style={{ "--c": item.color } as React.CSSProperties} />
            )}
            {itemConfig?.label}
          </span>
        );
      })}
    </div>
  );
});
ChartLegendContent.displayName = "ChartLegendContent";

export { ChartTooltip };

function getPayloadConfigFromPayload(config: ChartConfig, payload: unknown, key: string): ChartConfig[string] | undefined {
  if (typeof payload !== "object" || payload === null) return undefined;

  const payloadRecord = payload as Record<string, unknown>;
  const payloadPayload =
    "payload" in payloadRecord && typeof payloadRecord.payload === "object" && payloadRecord.payload !== null
      ? (payloadRecord.payload as Record<string, unknown>)
      : undefined;

  let configLabelKey: string = key;
  if (key in payloadRecord && typeof payloadRecord[key] === "string") {
    configLabelKey = payloadRecord[key] as string;
  } else if (payloadPayload && key in payloadPayload && typeof payloadPayload[key] === "string") {
    configLabelKey = payloadPayload[key] as string;
  }

  return configLabelKey in config ? config[configLabelKey] : config[key];
}

// Recharts item aliases used by the tooltip callbacks (kept for readable signatures).
export type { NameType, ValueType };
