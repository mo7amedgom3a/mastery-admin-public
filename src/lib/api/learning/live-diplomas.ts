import { queryOptions } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/lib/api/client";
import type { PathParams, RequestBody, SuccessResponse } from "@/lib/api/operation-types";

/*
 * Live diplomas (`/admin/catalog/live-diplomas`): cohort-based, live-taught diplomas. A live diploma is a B2C
 * product (`product_type = live_diploma`) with cohorts, per-cohort sessions and a waitlist. Addressed by `slug`.
 */

type CreateOp = "create_live_diploma_api_v1_admin_catalog_live_diplomas_post";
type GetOp = "get_live_diploma_api_v1_admin_catalog_live_diplomas__slug__get";
type UpdateOp = "update_live_diploma_api_v1_admin_catalog_live_diplomas__slug__put";
type ArchiveOp = "archive_live_diploma_api_v1_admin_catalog_live_diplomas__slug__delete";
type CreateCohortOp = "create_cohort_api_v1_admin_catalog_live_diplomas__slug__cohorts_post";
type CohortOp = "get_cohort_api_v1_admin_catalog_live_diplomas__slug__cohorts__cohort_id__get";
type StudentsOp = "list_cohort_students_api_v1_admin_catalog_live_diplomas__slug__cohorts__cohort_id__students_get";
type CreateSessionOp = "create_session_api_v1_admin_catalog_live_diplomas__slug__cohorts__cohort_id__sessions_post";
type UpdateSessionOp =
  "update_session_api_v1_admin_catalog_live_diplomas__slug__cohorts__cohort_id__sessions__session_id__put";
type WaitlistOp = "list_waitlist_api_v1_admin_catalog_live_diplomas__slug__waitlist_get";
type UpdateWaitlistOp = "update_waitlist_api_v1_admin_catalog_live_diplomas__slug__waitlist__waitlist_id__patch";

export type LiveDiploma = SuccessResponse<GetOp>;
export type LiveDiplomaWrite = RequestBody<CreateOp>;
export type LiveDiplomaStatus = LiveDiploma["status"];
export type Cohort = SuccessResponse<CohortOp>;
export type CohortWrite = RequestBody<CreateCohortOp>;
export type CohortStatus = Cohort["status"];
export type Session = SuccessResponse<UpdateSessionOp>;
export type SessionWrite = RequestBody<CreateSessionOp>;
export type CohortStudent = SuccessResponse<StudentsOp>[number];
export type WaitlistEntry = SuccessResponse<WaitlistOp>[number];
export type WaitlistStatus = RequestBody<UpdateWaitlistOp>["status"];

export const liveDiplomaPaths = {
  list: "admin/catalog/live-diplomas",
  diploma: "admin/catalog/live-diplomas/{slug}",
  cohorts: "admin/catalog/live-diplomas/{slug}/cohorts",
  cohort: "admin/catalog/live-diplomas/{slug}/cohorts/{cohort_id}",
  students: "admin/catalog/live-diplomas/{slug}/cohorts/{cohort_id}/students",
  sessions: "admin/catalog/live-diplomas/{slug}/cohorts/{cohort_id}/sessions",
  session: "admin/catalog/live-diplomas/{slug}/cohorts/{cohort_id}/sessions/{session_id}",
  waitlist: "admin/catalog/live-diplomas/{slug}/waitlist",
  waitlistEntry: "admin/catalog/live-diplomas/{slug}/waitlist/{waitlist_id}",
  notifyWaitlist: "admin/catalog/live-diplomas/{slug}/cohorts/{cohort_id}/notify-waitlist",
} as const;

export const liveDiplomaKeys = {
  all: ["learning", "live-diplomas"] as const,
  list: () => [...liveDiplomaKeys.all, "list"] as const,
  detail: (slug: string) => [...liveDiplomaKeys.all, "detail", slug] as const,
  cohorts: (slug: string) => [...liveDiplomaKeys.all, "cohorts", slug] as const,
  cohort: (slug: string, cohortId: string) => [...liveDiplomaKeys.all, "cohort", slug, cohortId] as const,
  students: (slug: string, cohortId: string) => [...liveDiplomaKeys.all, "students", slug, cohortId] as const,
  waitlist: (slug: string) => [...liveDiplomaKeys.all, "waitlist", slug] as const,
};

export function listLiveDiplomas(): Promise<LiveDiploma[]> {
  return apiGet(liveDiplomaPaths.list);
}

export function getLiveDiploma(slug: PathParams<GetOp>["slug"]): Promise<LiveDiploma> {
  return apiGet(liveDiplomaPaths.diploma, { path: { slug } });
}

export function createLiveDiploma(body: LiveDiplomaWrite): Promise<LiveDiploma> {
  return apiPost(liveDiplomaPaths.list, { body });
}

export function updateLiveDiploma(slug: PathParams<UpdateOp>["slug"], body: LiveDiplomaWrite): Promise<LiveDiploma> {
  return apiPut(liveDiplomaPaths.diploma, { path: { slug }, body });
}

/** Archives (soft-deletes) a live diploma. */
export function archiveLiveDiploma(slug: PathParams<ArchiveOp>["slug"]): Promise<void> {
  return apiDelete(liveDiplomaPaths.diploma, { path: { slug } });
}

export function listCohorts(slug: string): Promise<Cohort[]> {
  return apiGet(liveDiplomaPaths.cohorts, { path: { slug } });
}

export function getCohort(slug: string, cohort_id: string): Promise<Cohort> {
  return apiGet(liveDiplomaPaths.cohort, { path: { slug, cohort_id } });
}

export function createCohort(slug: string, body: CohortWrite): Promise<Cohort> {
  return apiPost(liveDiplomaPaths.cohorts, { path: { slug }, body });
}

export function updateCohort(slug: string, cohort_id: string, body: CohortWrite): Promise<Cohort> {
  return apiPut(liveDiplomaPaths.cohort, { path: { slug, cohort_id }, body });
}

export function deleteCohort(slug: string, cohort_id: string): Promise<void> {
  return apiDelete(liveDiplomaPaths.cohort, { path: { slug, cohort_id } });
}

export function listCohortStudents(slug: string, cohort_id: string): Promise<CohortStudent[]> {
  return apiGet(liveDiplomaPaths.students, { path: { slug, cohort_id } });
}

export function createCohortSession(slug: string, cohort_id: string, body: SessionWrite): Promise<Session> {
  return apiPost(liveDiplomaPaths.sessions, { path: { slug, cohort_id }, body });
}

export function updateCohortSession(
  slug: string,
  cohort_id: string,
  session_id: string,
  body: SessionWrite,
): Promise<Session> {
  return apiPut(liveDiplomaPaths.session, { path: { slug, cohort_id, session_id }, body });
}

export function deleteCohortSession(slug: string, cohort_id: string, session_id: string): Promise<void> {
  return apiDelete(liveDiplomaPaths.session, { path: { slug, cohort_id, session_id } });
}

export function listWaitlist(slug: string): Promise<WaitlistEntry[]> {
  return apiGet(liveDiplomaPaths.waitlist, { path: { slug } });
}

export function updateWaitlistEntry(slug: string, waitlist_id: string, status: WaitlistStatus): Promise<WaitlistEntry> {
  return apiPatch(liveDiplomaPaths.waitlistEntry, { path: { slug, waitlist_id }, body: { status } });
}

export function notifyWaitlist(slug: string, cohort_id: string): Promise<unknown> {
  return apiPost(liveDiplomaPaths.notifyWaitlist, { path: { slug, cohort_id } });
}

export const liveDiplomaQueries = {
  list: () => queryOptions({ queryKey: liveDiplomaKeys.list(), queryFn: () => listLiveDiplomas() }),
  detail: (slug: string) =>
    queryOptions({ queryKey: liveDiplomaKeys.detail(slug), queryFn: () => getLiveDiploma(slug) }),
  cohorts: (slug: string) =>
    queryOptions({ queryKey: liveDiplomaKeys.cohorts(slug), queryFn: () => listCohorts(slug) }),
  cohortStudents: (slug: string, cohortId: string) =>
    queryOptions({
      queryKey: liveDiplomaKeys.students(slug, cohortId),
      queryFn: () => listCohortStudents(slug, cohortId),
    }),
  waitlist: (slug: string) =>
    queryOptions({ queryKey: liveDiplomaKeys.waitlist(slug), queryFn: () => listWaitlist(slug) }),
};
