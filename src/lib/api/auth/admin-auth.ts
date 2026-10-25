import { queryOptions } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api/client";
import type { RequestBody, SuccessResponse } from "@/lib/api/operation-types";

type LoginOp = "admin_login_api_v1_admin_auth_login_post";
type RefreshOp = "admin_refresh_api_v1_admin_auth_refresh_post";
type LogoutOp = "admin_logout_api_v1_admin_auth_logout_post";
type MeOp = "admin_me_api_v1_admin_me_get";

export type AdminLoginRequest = RequestBody<LoginOp>;
export type AdminRefreshRequest = RequestBody<RefreshOp>;
export type AdminLogoutRequest = RequestBody<LogoutOp>;
export type AdminAuthResponse = SuccessResponse<LoginOp>;
export type AdminTokenPair = AdminAuthResponse["tokens"];
/** The signed-in admin's profile (also `GET /admin/me`). */
export type AdminProfile = SuccessResponse<MeOp>;
export type AdminWho = AdminProfile;

export const authPaths = {
  login: "admin/auth/login",
  qaLogin: "admin/auth/qa/login",
  refresh: "admin/auth/refresh",
  logout: "admin/auth/logout",
  me: "admin/me",
} as const;

export const authKeys = {
  all: ["auth"] as const,
  me: () => [...authKeys.all, "me"] as const,
};

export function adminLogin(body: AdminLoginRequest): Promise<AdminAuthResponse> {
  return apiPost(authPaths.login, { body });
}

export function adminQALogin(body: { email: string; key: string }): Promise<AdminAuthResponse> {
  return apiPost(authPaths.qaLogin, { body });
}

export function adminRefresh(body: AdminRefreshRequest = {}): Promise<AdminAuthResponse> {
  return apiPost(authPaths.refresh, { body });
}

export function adminLogout(body: AdminLogoutRequest = {}): Promise<void> {
  return apiPost(authPaths.logout, { body });
}

export function adminMe(): Promise<AdminProfile> {
  return apiGet(authPaths.me);
}

export const authQueries = {
  me: () => queryOptions({ queryKey: authKeys.me(), queryFn: adminMe, staleTime: 60_000 }),
};
