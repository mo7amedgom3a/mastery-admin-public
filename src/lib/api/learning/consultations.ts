import { queryOptions } from "@tanstack/react-query";

import { apiGet } from "@/lib/api/client";
import type { PathParams, QueryParams, SuccessResponse } from "@/lib/api/operation-types";

type ListServicesOp = "list_services_api_v1_admin_consultations_services_get";
type GetServiceOp = "get_service_api_v1_admin_consultations_services__legacy_consultancy_id__get";
type InfoOp = "service_info_api_v1_admin_consultations_services__legacy_consultancy_id__info_get";
type SessionRequestsOp =
  "service_session_requests_api_v1_admin_consultations_services__legacy_consultancy_id__session_requests_get";
type MilestonesOp = "service_milestones_api_v1_admin_consultations_services__legacy_consultancy_id__milestones_get";
type AvailabilityOp = "service_availability_api_v1_admin_consultations_services__legacy_consultancy_id__availability_get";
type RevenueOp = "service_revenue_api_v1_admin_consultations_services__legacy_consultancy_id__revenue_get";

export type ConsultationServicesParams = QueryParams<ListServicesOp>;
export type ConsultationServicePage = SuccessResponse<ListServicesOp>;
export type ConsultationServiceDetail = SuccessResponse<GetServiceOp>;
export type ConsultationSection = SuccessResponse<InfoOp>[number];
export type ConsultationSessionRequest = SuccessResponse<SessionRequestsOp>[number];
export type ConsultationMilestone = SuccessResponse<MilestonesOp>[number];
export type AvailabilitySlot = SuccessResponse<AvailabilityOp>[number];
export type ConsultationRevenue = SuccessResponse<RevenueOp>;
type ServiceId = PathParams<GetServiceOp>["legacy_consultancy_id"];

export const consultationsPaths = {
  services: "admin/consultations/services",
  service: "admin/consultations/services/{legacy_consultancy_id}",
  info: "admin/consultations/services/{legacy_consultancy_id}/info",
  sessionRequests: "admin/consultations/services/{legacy_consultancy_id}/session-requests",
  milestones: "admin/consultations/services/{legacy_consultancy_id}/milestones",
  availability: "admin/consultations/services/{legacy_consultancy_id}/availability",
  revenue: "admin/consultations/services/{legacy_consultancy_id}/revenue",
} as const;

export const consultationsKeys = {
  all: ["learning", "consultations"] as const,
  list: (params?: ConsultationServicesParams) => [...consultationsKeys.all, "services", params ?? {}] as const,
  detail: (legacyConsultancyId: number) => [...consultationsKeys.all, "service", legacyConsultancyId] as const,
  part: (legacyConsultancyId: number, part: string) =>
    [...consultationsKeys.all, "service", legacyConsultancyId, part] as const,
};

export function listConsultationServices(
  params: ConsultationServicesParams = {},
): Promise<ConsultationServicePage> {
  return apiGet(consultationsPaths.services, { query: params });
}

export function getConsultationService(legacy_consultancy_id: ServiceId): Promise<ConsultationServiceDetail> {
  return apiGet(consultationsPaths.service, { path: { legacy_consultancy_id } });
}

function part<T>(path: string, legacy_consultancy_id: ServiceId): Promise<T> {
  return apiGet(path, { path: { legacy_consultancy_id } });
}

export const getConsultationInfo = (id: ServiceId) => part<ConsultationSection[]>(consultationsPaths.info, id);
export const getConsultationSessionRequests = (id: ServiceId) =>
  part<ConsultationSessionRequest[]>(consultationsPaths.sessionRequests, id);
export const getConsultationMilestones = (id: ServiceId) =>
  part<ConsultationMilestone[]>(consultationsPaths.milestones, id);
export const getConsultationAvailability = (id: ServiceId) =>
  part<AvailabilitySlot[]>(consultationsPaths.availability, id);
export const getConsultationRevenue = (id: ServiceId) => part<ConsultationRevenue>(consultationsPaths.revenue, id);

export const consultationsQueries = {
  list: (params?: ConsultationServicesParams) =>
    queryOptions({ queryKey: consultationsKeys.list(params), queryFn: () => listConsultationServices(params) }),
  detail: (id: number) =>
    queryOptions({ queryKey: consultationsKeys.detail(id), queryFn: () => getConsultationService(id) }),
  info: (id: number) => queryOptions({ queryKey: consultationsKeys.part(id, "info"), queryFn: () => getConsultationInfo(id) }),
  sessionRequests: (id: number) =>
    queryOptions({ queryKey: consultationsKeys.part(id, "session-requests"), queryFn: () => getConsultationSessionRequests(id) }),
  milestones: (id: number) =>
    queryOptions({ queryKey: consultationsKeys.part(id, "milestones"), queryFn: () => getConsultationMilestones(id) }),
  availability: (id: number) =>
    queryOptions({ queryKey: consultationsKeys.part(id, "availability"), queryFn: () => getConsultationAvailability(id) }),
  revenue: (id: number) =>
    queryOptions({ queryKey: consultationsKeys.part(id, "revenue"), queryFn: () => getConsultationRevenue(id) }),
};
