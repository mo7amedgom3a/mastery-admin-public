import { queryOptions } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api/client";
import type { PathParams, QueryParams, RequestBody, SuccessResponse } from "@/lib/api/operation-types";

type ListAdminUsersOp = "list_admin_users_api_v1_admin_admin_users_get";
type CreateAdminUserOp = "create_admin_user_api_v1_admin_admin_users_post";
type SetAdminUserStatusOp = "set_admin_user_status_api_v1_admin_admin_users__admin_user_id__status_patch";
type AdminUserRolesOp = "admin_user_roles_api_v1_admin_admin_users__admin_user_id__roles_get";
type AssignAdminRoleOp = "assign_admin_role_api_v1_admin_admin_users__admin_user_id__roles_post";
type RemoveAdminRoleOp = "remove_admin_role_api_v1_admin_admin_users__admin_user_id__roles__role_id__delete";
type CreateRoleOp = "create_role_api_v1_admin_roles_post";
type AuditLogsOp = "list_audit_logs_api_v1_admin_audit_logs_get";

export type AdminUser = SuccessResponse<CreateAdminUserOp>;
export type AdminUserPage = SuccessResponse<ListAdminUsersOp>;
export type AdminUserCreateRequest = RequestBody<CreateAdminUserOp>;
export type AdminUserStatusRequest = RequestBody<SetAdminUserStatusOp>;
export type AdminUsersParams = QueryParams<ListAdminUsersOp>;
export type AdminRole = SuccessResponse<CreateRoleOp>;
export type AdminRoleCreateRequest = RequestBody<CreateRoleOp>;
export type AssignRoleRequest = RequestBody<AssignAdminRoleOp>;
export type AuditLog = SuccessResponse<AuditLogsOp>["items"][number];
export type AuditLogPage = SuccessResponse<AuditLogsOp>;
export type AuditLogsParams = QueryParams<AuditLogsOp>;

/** All of these require the super-admin scope `*`. */
export const iamPaths = {
  adminUsers: "admin/admin-users",
  adminUserStatus: "admin/admin-users/{admin_user_id}/status",
  adminUserRoles: "admin/admin-users/{admin_user_id}/roles",
  adminUserRole: "admin/admin-users/{admin_user_id}/roles/{role_id}",
  roles: "admin/roles",
  auditLogs: "admin/audit-logs",
} as const;

export const iamKeys = {
  all: ["iam"] as const,
  adminUsers: (params?: AdminUsersParams) => [...iamKeys.all, "admin-users", params ?? {}] as const,
  adminUserRoles: (adminUserId: string) => [...iamKeys.all, "admin-user-roles", adminUserId] as const,
  roles: () => [...iamKeys.all, "roles"] as const,
  auditLogs: (params?: AuditLogsParams) => [...iamKeys.all, "audit-logs", params ?? {}] as const,
};

export function listAdminUsers(params: AdminUsersParams = {}): Promise<AdminUserPage> {
  return apiGet(iamPaths.adminUsers, { query: params });
}

export function createAdminUser(body: AdminUserCreateRequest): Promise<AdminUser> {
  return apiPost(iamPaths.adminUsers, { body });
}

export function setAdminUserStatus(
  admin_user_id: PathParams<SetAdminUserStatusOp>["admin_user_id"],
  body: AdminUserStatusRequest,
): Promise<AdminUser> {
  return apiPatch(iamPaths.adminUserStatus, { path: { admin_user_id }, body });
}

export function listAdminUserRoles(
  admin_user_id: PathParams<AdminUserRolesOp>["admin_user_id"],
): Promise<AdminRole[]> {
  return apiGet(iamPaths.adminUserRoles, { path: { admin_user_id } });
}

export function assignAdminRole(
  admin_user_id: PathParams<AssignAdminRoleOp>["admin_user_id"],
  body: AssignRoleRequest,
): Promise<AdminRole[]> {
  return apiPost(iamPaths.adminUserRoles, { path: { admin_user_id }, body });
}

export function removeAdminRole(
  admin_user_id: PathParams<RemoveAdminRoleOp>["admin_user_id"],
  role_id: PathParams<RemoveAdminRoleOp>["role_id"],
): Promise<void> {
  return apiDelete(iamPaths.adminUserRole, { path: { admin_user_id, role_id } });
}

export function listRoles(): Promise<AdminRole[]> {
  return apiGet(iamPaths.roles);
}

export function createRole(body: AdminRoleCreateRequest): Promise<AdminRole> {
  return apiPost(iamPaths.roles, { body });
}

export function listAuditLogs(params: AuditLogsParams = {}): Promise<AuditLogPage> {
  return apiGet(iamPaths.auditLogs, { query: params });
}

export const iamQueries = {
  adminUsers: (params?: AdminUsersParams) =>
    queryOptions({ queryKey: iamKeys.adminUsers(params), queryFn: () => listAdminUsers(params) }),
  adminUserRoles: (adminUserId: string) =>
    queryOptions({ queryKey: iamKeys.adminUserRoles(adminUserId), queryFn: () => listAdminUserRoles(adminUserId) }),
  roles: () => queryOptions({ queryKey: iamKeys.roles(), queryFn: listRoles }),
  auditLogs: (params?: AuditLogsParams) =>
    queryOptions({ queryKey: iamKeys.auditLogs(params), queryFn: () => listAuditLogs(params) }),
};
