import { create } from "zustand";

import { REPORT_CURRENCIES, type ReportCurrency, type ReportSource } from "@/lib/api/analytics/reports";

/**
 * Currency the sales numbers are converted to (USD, AED or SAR). One choice for every report page,
 * remembered per browser; the original per-currency amounts are always shown next to it.
 */
const KEY = "admin.reportCurrency";

function stored(): ReportCurrency {
  try {
    const value = localStorage.getItem(KEY);
    return REPORT_CURRENCIES.includes(value as ReportCurrency) ? (value as ReportCurrency) : "USD";
  } catch {
    return "USD";
  }
}

type ReportCurrencyState = {
  currency: ReportCurrency;
  setCurrency: (currency: ReportCurrency) => void;
  /** Systems the sales reports cover: `all` (B2C + legacy platform), `b2c` or `legacy`. */
  source: ReportSource;
  setSource: (source: ReportSource) => void;
};

export const useReportCurrency = create<ReportCurrencyState>((set) => ({
  currency: stored(),
  setCurrency: (currency) => {
    try {
      localStorage.setItem(KEY, currency);
    } catch {
      // Private mode / blocked storage: keep the choice for this session only.
    }
    set({ currency });
  },
  source: "all",
  setSource: (source) => set({ source }),
}));
