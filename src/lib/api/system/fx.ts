import { queryOptions } from "@tanstack/react-query";

import { apiGet } from "@/lib/api/client";
import type { QueryParams, SuccessResponse } from "@/lib/api/operation-types";

type FxRatesOp = "exchange_rates_api_v1_admin_fx_rates_get";

/** Daily Frankfurter rates (`1 base = rate quote`) used by the reports and Tamara checkout. */
export type FxRate = SuccessResponse<FxRatesOp>[number];
export type FxRatesParams = QueryParams<FxRatesOp>;

export const fxPaths = { rates: "admin/fx/rates" } as const;

export const fxKeys = {
  all: ["system", "fx"] as const,
  rates: (params?: FxRatesParams) => [...fxKeys.all, "rates", params ?? {}] as const,
};

export function getFxRates(params: FxRatesParams = {}): Promise<FxRate[]> {
  return apiGet(fxPaths.rates, { query: params });
}

export const fxQueries = {
  rates: (params?: FxRatesParams) =>
    queryOptions({ queryKey: fxKeys.rates(params), queryFn: () => getFxRates(params), staleTime: 30 * 60_000 }),
};
