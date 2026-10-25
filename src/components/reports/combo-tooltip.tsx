import type { CSSProperties } from "react";
import { formatAmount, formatDate, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";

export type ComboTooltipPayload = {
  dataKey?: string | number;
  value?: number;
  color?: string;
};

export type ComboTooltipProps = {
  active?: boolean;
  payload?: ComboTooltipPayload[];
  label?: string;
  currency: string;
};

/** Revenue (currency) and orders (count) share the tooltip, so each series formats itself. */
export function ComboTooltip({ active, payload, label, currency }: ComboTooltipProps) {
  const t = useT();
  if (!active || !payload?.length) return null;
  return (
    <div className="ma-chart-tip">
      <span className="ma-chart-tip__label">{formatDate(String(label))}</span>
      <div className="ma-chart-tip__rows">
        {payload.map((item) => (
          <div className="ma-chart-tip__row" key={String(item.dataKey)}>
            <span className="ma-chart-tip__dot" style={{ "--c": item.color } as CSSProperties} />
            <span className="ma-chart-tip__name">
              {item.dataKey === "amount" ? t("الإيراد", "Revenue") : t("الطلبات", "Orders")}
            </span>
            <span className="ma-chart-tip__value">
              {item.dataKey === "amount"
                ? formatAmount(Number(item.value), currency)
                : formatNumber(Number(item.value))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
