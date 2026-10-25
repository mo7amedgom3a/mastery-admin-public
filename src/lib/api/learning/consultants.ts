import { queryOptions } from "@tanstack/react-query";

import { apiGet } from "@/lib/api/client";
import type { PathParams, QueryParams, SuccessResponse } from "@/lib/api/operation-types";

type ListOp = "list_consultants_api_v1_admin_consultations_consultants_get";
type GetOp = "get_consultant_api_v1_admin_consultations_consultants__legacy_consultant_id__get";
type ServicesOp = "consultant_services_api_v1_admin_consultations_consultants__legacy_consultant_id__services_get";

/** A consultation expert with their number of services, paid orders and revenue. */
export type Consultant = SuccessResponse<GetOp>;
export type ConsultantPage = SuccessResponse<ListOp>;
export type ConsultantsParams = QueryParams<ListOp>;
export type ConsultantServicePage = SuccessResponse<ServicesOp>;
export type ConsultantService = ConsultantServicePage["items"][number];

export const consultantsPaths = {
  consultants: "admin/consultations/consultants",
  consultant: "admin/consultations/consultants/{legacy_consultant_id}",
  services: "admin/consultations/consultants/{legacy_consultant_id}/services",
} as const;

export const consultantsKeys = {
  all: ["learning", "consultants"] as const,
  list: (params?: ConsultantsParams) => [...consultantsKeys.all, "list", params ?? {}] as const,
  detail: (id: number) => [...consultantsKeys.all, "detail", id] as const,
  services: (id: number) => [...consultantsKeys.all, "services", id] as const,
};

export function listConsultants(params: ConsultantsParams = {}): Promise<ConsultantPage> {
  return apiGet(consultantsPaths.consultants, { query: params });
}

export function getConsultant(legacy_consultant_id: PathParams<GetOp>["legacy_consultant_id"]): Promise<Consultant> {
  return apiGet(consultantsPaths.consultant, { path: { legacy_consultant_id } });
}

/** The consultation services offered by one consultant. */
export function listConsultantServices(
  legacy_consultant_id: PathParams<ServicesOp>["legacy_consultant_id"],
): Promise<ConsultantServicePage> {
  return apiGet(consultantsPaths.services, { path: { legacy_consultant_id }, query: { limit: 200 } });
}

export const consultantsQueries = {
  list: (params?: ConsultantsParams) =>
    queryOptions({ queryKey: consultantsKeys.list(params), queryFn: () => listConsultants(params) }),
  detail: (id: number) => queryOptions({ queryKey: consultantsKeys.detail(id), queryFn: () => getConsultant(id) }),
  services: (id: number) =>
    queryOptions({ queryKey: consultantsKeys.services(id), queryFn: () => listConsultantServices(id) }),
};
