import { queryOptions } from "@tanstack/react-query";

import { apiGet } from "@/lib/api/client";
import type { PathParams, QueryParams, SuccessResponse } from "@/lib/api/operation-types";

type SearchOp = "search_instructors_api_v1_search_instructors_get";
type AdminListOp = "list_instructors_api_v1_admin_instructors_get";
type AdminGetOp = "get_instructor_api_v1_admin_instructors__legacy_trainer_id__get";

export type InstructorListParams = QueryParams<SearchOp>;
export type InstructorListItem = SuccessResponse<SearchOp>[number];
/** Back-office instructor (`/admin/instructors`, legacy trainers). */
export type AdminInstructor = SuccessResponse<AdminGetOp>;
export type AdminInstructorsParams = QueryParams<AdminListOp>;
export type AdminInstructorPage = SuccessResponse<AdminListOp>;
export type InstructorApplicationsParams = { query?: string; limit?: number; offset?: number };
export type InstructorApplicationPage = {
  items: Array<{ request_id: string; name: string; email: string; mobile: string; country: string | null;
    city: string | null; status: string; submitted_at: string; payload: Record<string, unknown> }>;
  total: number;
  limit: number;
  offset: number;
};
export type InstructorApplication = InstructorApplicationPage["items"][number];

export const instructorsPaths = {
  search: "search/instructors",
  adminList: "admin/instructors",
  adminDetail: "admin/instructors/{legacy_trainer_id}",
  applications: "admin/requests/trainer-applications",
} as const;

export const instructorsKeys = {
  all: ["learning", "instructors"] as const,
  adminList: (params?: AdminInstructorsParams) => [...instructorsKeys.all, "admin-list", params ?? {}] as const,
  applications: (params?: InstructorApplicationsParams) =>
    [...instructorsKeys.all, "applications", params ?? {}] as const,
};

/** `GET /admin/instructors` — back-office instructor list (legacy trainers). */
export function listAdminInstructors(params: AdminInstructorsParams = {}): Promise<AdminInstructorPage> {
  return apiGet(instructorsPaths.adminList, { query: params });
}

export function getAdminInstructor(
  legacy_trainer_id: PathParams<AdminGetOp>["legacy_trainer_id"],
): Promise<AdminInstructor> {
  return apiGet(instructorsPaths.adminDetail, { path: { legacy_trainer_id } });
}

/** B2C-owned applications to become an instructor, newest first. */
export function listInstructorApplications(
  params: InstructorApplicationsParams = {},
): Promise<InstructorApplicationPage> {
  return apiGet(instructorsPaths.applications, { query: params });
}

/** `GET /search/instructors` — public instructor search (the dashboard search box). */
export function listInstructors(params: InstructorListParams = {}): Promise<InstructorListItem[]> {
  return apiGet(instructorsPaths.search, { query: params });
}

export const instructorsQueries = {
  adminList: (params?: AdminInstructorsParams) =>
    queryOptions({ queryKey: instructorsKeys.adminList(params), queryFn: () => listAdminInstructors(params) }),
  applications: (params?: InstructorApplicationsParams) =>
    queryOptions({ queryKey: instructorsKeys.applications(params), queryFn: () => listInstructorApplications(params) }),
};
