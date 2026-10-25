import type { MoneyAmount, SalesPoint } from "@/lib/api";
import { formatAmount } from "@/lib/format";

export type MonthPoint = { month: string; amount: number; orders: number };

/** Net revenue of a day (gross − refunds), in the report currency. */
export function netOf(point: SalesPoint): number {
  return point.net ?? point.revenue;
}

/** Rolls a daily B2C sales series up to calendar months (net revenue and paid orders). */
export function monthlyFromDays(days: SalesPoint[]): MonthPoint[] {
  const map = new Map<string, MonthPoint>();
  for (const day of days) {
    const month = day.day.slice(0, 7);
    const current = map.get(month) ?? { month, amount: 0, orders: 0 };
    current.amount += netOf(day);
    current.orders += day.orders;
    map.set(month, current);
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/** `AED 1,314.76 + USD 24,054.00` — the exact amounts behind a converted total. */
export function formatByCurrency(amounts: MoneyAmount[] | undefined): string {
  const nonZero = (amounts ?? []).filter((item) => item.amount !== 0);
  return nonZero.length ? nonZero.map((item) => formatAmount(item.amount, item.currency)).join(" + ") : "—";
}
