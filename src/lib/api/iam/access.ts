import { queryOptions } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/lib/api/client";
import type { AuditLog, AuditLogPage } from "@/lib/api/iam/rbac";

/**
 * IAM access management: groups (teams), policies (incl. templates), bindings and
 * per-team tracing. Types are written by hand because the endpoints were added
 * after the last OpenAPI snapshot — rerun `npm run api:types` to switch to the
 * generated shapes.
 */

export type ResourceScope = "all" | "team" | "own";

export type AdminScopeOption = {
  scope: string;
  action: string;
  label: Record<string, string>;
};

export type AdminScopeArea = {
  area: string;
  label: Record<string, string>;
  scopes: AdminScopeOption[];
};

export type AdminScopeCatalog = {
  areas: AdminScopeArea[];
  resource_scopes: ResourceScope[];
  super_scope: string;
};

export type AdminGroup = {
  group_id: string;
  code: string;
  name: string;
  description?: string | null;
  lead_admin_user_id?: string | null;
  lead_name?: string | null;
  status: string;
  member_count: number;
  policy_count: number;
  created_at?: string | null;
  /** Default permission boundary for admins created inside the team. */
  boundary_policy_id?: string | null;
};

export type AdminGroupPage = {
  items: AdminGroup[];
  total: number;
  limit: number;
  offset: number;
};

export type AdminGroupCreateRequest = {
  code: string;
  name: string;
  description?: string | null;
  lead_admin_user_id?: string | null;
};

export type AdminGroupUpdateRequest = {
  name?: string;
  description?: string | null;
  lead_admin_user_id?: string | null;
  status?: string;
};

export type AdminPolicy = {
  policy_id: string;
  code: string;
  name: string;
  description?: string | null;
  is_template: boolean;
  is_system: boolean;
  scopes: string[];
  attachment_count: number;
  created_by?: string | null;
  can_manage?: boolean;
  created_at?: string | null;
};

export type AdminPolicyPage = {
  items: AdminPolicy[];
  total: number;
  limit: number;
  offset: number;
};

export type AdminPolicyCreateRequest = {
  code: string;
  name: string;
  description?: string | null;
  scopes: string[];
  is_template?: boolean;
};

export type AdminPolicyUpdateRequest = {
  name?: string;
  description?: string | null;
  is_template?: boolean;
  scopes?: string[];
};

export type AdminAttachment = {
  attachment_id: string;
  policy_id: string;
  subject_type: "group" | "user";
  subject_id: string;
  resource_scope: ResourceScope;
  policy_code?: string | null;
  policy_name?: string | null;
  is_template: boolean;
  created_at?: string | null;
};

export type AdminGroupMemberRequest = { admin_user_id: string };

export type AdminGroupInviteRequest = {
  email: string;
  full_name?: string | null;
  password: string;
  policy_ids?: string[];
  resource_scope?: ResourceScope;
};

export type AdminUserProvisionRequest = {
  email: string;
  full_name?: string | null;
  password: string;
  policy_ids?: string[];
  group_ids?: string[];
  lead_of_group_ids?: string[];
  resource_scope?: ResourceScope;
  /** Optional boundary; defaults to the first selected team's boundary. */
  boundary_policy_id?: string | null;
};

export type IamUserPage = {
  items: IamAdminUser[];
  total: number;
  limit: number;
  offset: number;
};

export type AdminAttachmentCreateRequest = {
  policy_id: string;
  resource_scope?: ResourceScope;
};

export type IamAdminUser = {
  admin_user_id: string;
  email: string;
  full_name?: string | null;
  status: string;
  scopes: string[];
  groups: string[];
  group_ids: string[];
  resource_conditions: Record<string, string>;
  /** Permission boundary: `scopes` is `granted_scopes` capped to `boundary_scopes`. */
  boundary_policy_id?: string | null;
  boundary_scopes?: string[] | null;
  granted_scopes?: string[];
};

export type AdminStatus = "active" | "suspended";

/** Scopes granted to one admin individually (their hidden inline policy). */
export type AdminInlinePolicy = { scopes: string[]; resource_scope: ResourceScope };

/** Inline policies are named `inline-<admin_user_id>`; they never appear in policy lists. */
export const isInlinePolicyCode = (code?: string | null) => Boolean(code?.startsWith("inline-"));

export type AdminSessionSummary = {
  session_id: string;
  status: string;
  created_at?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
  rotated_at?: string | null;
};

export type AdminTrace = {
  admin: IamAdminUser;
  sessions: AdminSessionSummary[];
  audit_logs: AuditLog[];
  total_actions: number;
};

export const accessPaths = {
  scopes: "admin/iam/scopes",
  directory: "admin/iam/directory",
  users: "admin/iam/users",
  user: "admin/iam/users/{admin_user_id}",
  userBoundary: "admin/iam/users/{admin_user_id}/boundary",
  userStatus: "admin/iam/users/{admin_user_id}/status",
  userRevoke: "admin/iam/users/{admin_user_id}/revoke",
  userInlinePolicy: "admin/iam/users/{admin_user_id}/inline-policy",
  groups: "admin/iam/groups",
  group: "admin/iam/groups/{group_id}",
  groupBoundary: "admin/iam/groups/{group_id}/boundary",
  groupMembers: "admin/iam/groups/{group_id}/members",
  groupMember: "admin/iam/groups/{group_id}/members/{admin_user_id}",
  groupPolicies: "admin/iam/groups/{group_id}/policies",
  groupPolicy: "admin/iam/groups/{group_id}/policies/{attachment_id}",
  groupAdminUsers: "admin/iam/groups/{group_id}/admin-users",
  policies: "admin/iam/policies",
  templates: "admin/iam/policies/templates",
  policy: "admin/iam/policies/{policy_id}",
  policyScopes: "admin/iam/policies/{policy_id}/scopes",
  adminPolicies: "admin/iam/admin-users/{admin_user_id}/policies",
  adminPolicy: "admin/iam/admin-users/{admin_user_id}/policies/{attachment_id}",
  trace: "admin/iam/admin-users/{admin_user_id}/trace",
  audit: "admin/iam/audit",
} as const;

export const accessKeys = {
  all: ["iam-access"] as const,
  scopes: () => [...accessKeys.all, "scopes"] as const,
  directory: (search?: string) => [...accessKeys.all, "directory", search ?? ""] as const,
  users: (params?: Record<string, unknown>) => [...accessKeys.all, "users", params ?? {}] as const,
  user: (adminUserId: string) => [...accessKeys.all, "user", adminUserId] as const,
  inlinePolicy: (adminUserId: string) => [...accessKeys.all, "inline-policy", adminUserId] as const,
  groups: (params?: Record<string, unknown>) => [...accessKeys.all, "groups", params ?? {}] as const,
  group: (groupId: string) => [...accessKeys.all, "group", groupId] as const,
  groupMembers: (groupId: string) => [...accessKeys.all, "group-members", groupId] as const,
  groupPolicies: (groupId: string) => [...accessKeys.all, "group-policies", groupId] as const,
  policies: (params?: Record<string, unknown>) => [...accessKeys.all, "policies", params ?? {}] as const,
  templates: () => [...accessKeys.all, "templates"] as const,
  adminPolicies: (adminUserId: string) =>
    [...accessKeys.all, "admin-policies", adminUserId] as const,
  trace: (adminUserId: string) => [...accessKeys.all, "trace", adminUserId] as const,
  audit: (params?: Record<string, unknown>) => [...accessKeys.all, "audit", params ?? {}] as const,
};

// ---- catalog & directory ------------------------------------------------------------

export function fetchScopeCatalog(): Promise<AdminScopeCatalog> {
  return apiGet(accessPaths.scopes);
}

export function fetchAdminDirectory(search?: string): Promise<IamAdminUser[]> {
  return apiGet(accessPaths.directory, { query: { search, limit: 200 } });
}

export function listIamUsers(
  params: { limit?: number; offset?: number; search?: string } = {},
): Promise<IamUserPage> {
  return apiGet(accessPaths.users, { query: params });
}

export function getPolicy(policyId: string): Promise<AdminPolicy> {
  return apiGet(accessPaths.policy, { path: { policy_id: policyId } });
}

export function provisionIamUser(body: AdminUserProvisionRequest): Promise<IamAdminUser> {
  return apiPost(accessPaths.users, { body });
}

export function getIamUser(adminUserId: string): Promise<IamAdminUser> {
  return apiGet(accessPaths.user, { path: { admin_user_id: adminUserId } });
}

/** Set (`policyId`) or clear (`null`) the admin's permission boundary. */
export function setUserBoundary(adminUserId: string, policyId: string | null): Promise<IamAdminUser> {
  return apiPut(accessPaths.userBoundary, {
    path: { admin_user_id: adminUserId },
    body: { policy_id: policyId },
  });
}

export function getInlinePolicy(adminUserId: string): Promise<AdminInlinePolicy> {
  return apiGet(accessPaths.userInlinePolicy, { path: { admin_user_id: adminUserId } });
}

/** Replace the admin's individually granted scopes (empty list removes them). */
export function setInlinePolicy(adminUserId: string, body: AdminInlinePolicy): Promise<IamAdminUser> {
  return apiPut(accessPaths.userInlinePolicy, { path: { admin_user_id: adminUserId }, body });
}

/** Suspend or reactivate an admin (team lead for their members, or super admin). */
export function setMemberStatus(adminUserId: string, status: AdminStatus): Promise<IamAdminUser> {
  return apiPost(accessPaths.userStatus, { path: { admin_user_id: adminUserId }, body: { status } });
}

/** Detach direct policies, remove from the caller's teams and suspend, in one step. */
export function revokeMemberAccess(adminUserId: string): Promise<IamAdminUser> {
  return apiPost(accessPaths.userRevoke, { path: { admin_user_id: adminUserId } });
}

// ---- groups -------------------------------------------------------------------------

export function listGroups(params: { limit?: number; offset?: number; search?: string } = {}): Promise<AdminGroupPage> {
  return apiGet(accessPaths.groups, { query: params });
}

export function createGroup(body: AdminGroupCreateRequest): Promise<AdminGroup> {
  return apiPost(accessPaths.groups, { body });
}

export function getGroup(groupId: string): Promise<AdminGroup> {
  return apiGet(accessPaths.group, { path: { group_id: groupId } });
}

export function updateGroup(groupId: string, body: AdminGroupUpdateRequest): Promise<AdminGroup> {
  return apiPatch(accessPaths.group, { path: { group_id: groupId }, body });
}

export function setGroupBoundary(groupId: string, policyId: string | null): Promise<AdminGroup> {
  return apiPut(accessPaths.groupBoundary, { path: { group_id: groupId }, body: { policy_id: policyId } });
}

export function deleteGroup(groupId: string): Promise<void> {
  return apiDelete(accessPaths.group, { path: { group_id: groupId } });
}

export function listGroupMembers(groupId: string): Promise<IamAdminUser[]> {
  return apiGet(accessPaths.groupMembers, { path: { group_id: groupId } });
}

export function createTeamAdmin(
  groupId: string,
  body: AdminGroupInviteRequest,
): Promise<IamAdminUser> {
  return apiPost(accessPaths.groupAdminUsers, { path: { group_id: groupId }, body });
}

export function addGroupMember(groupId: string, adminUserId: string): Promise<IamAdminUser[]> {
  return apiPost(accessPaths.groupMembers, {
    path: { group_id: groupId },
    body: { admin_user_id: adminUserId },
  });
}

export function removeGroupMember(groupId: string, adminUserId: string): Promise<void> {
  return apiDelete(accessPaths.groupMember, {
    path: { group_id: groupId, admin_user_id: adminUserId },
  });
}

export function listGroupPolicies(groupId: string): Promise<AdminAttachment[]> {
  return apiGet(accessPaths.groupPolicies, { path: { group_id: groupId } });
}

export function attachGroupPolicy(
  groupId: string,
  body: AdminAttachmentCreateRequest,
): Promise<AdminAttachment> {
  return apiPost(accessPaths.groupPolicies, { path: { group_id: groupId }, body });
}

export function detachGroupPolicy(groupId: string, attachmentId: string): Promise<void> {
  return apiDelete(accessPaths.groupPolicy, {
    path: { group_id: groupId, attachment_id: attachmentId },
  });
}

// ---- policies -----------------------------------------------------------------------

export function listPolicies(
  params: { limit?: number; offset?: number; template_only?: boolean; search?: string } = {},
): Promise<AdminPolicyPage> {
  return apiGet(accessPaths.policies, { query: params });
}

export function listPolicyTemplates(): Promise<AdminPolicy[]> {
  return apiGet(accessPaths.templates);
}

export function createPolicy(body: AdminPolicyCreateRequest): Promise<AdminPolicy> {
  return apiPost(accessPaths.policies, { body });
}

export function updatePolicy(policyId: string, body: AdminPolicyUpdateRequest): Promise<AdminPolicy> {
  return apiPatch(accessPaths.policy, { path: { policy_id: policyId }, body });
}

export function replacePolicyScopes(policyId: string, scopes: string[]): Promise<AdminPolicy> {
  return apiPut(accessPaths.policyScopes, { path: { policy_id: policyId }, body: { scopes } });
}

export function deletePolicy(policyId: string): Promise<void> {
  return apiDelete(accessPaths.policy, { path: { policy_id: policyId } });
}

// ---- admin bindings -----------------------------------------------------------------

export function listAdminPolicies(adminUserId: string): Promise<AdminAttachment[]> {
  return apiGet(accessPaths.adminPolicies, { path: { admin_user_id: adminUserId } });
}

export function attachAdminPolicy(
  adminUserId: string,
  body: AdminAttachmentCreateRequest,
): Promise<AdminAttachment> {
  return apiPost(accessPaths.adminPolicies, { path: { admin_user_id: adminUserId }, body });
}

export function detachAdminPolicy(adminUserId: string, attachmentId: string): Promise<void> {
  return apiDelete(accessPaths.adminPolicy, {
    path: { admin_user_id: adminUserId, attachment_id: attachmentId },
  });
}

// ---- tracing ------------------------------------------------------------------------

export function fetchAdminTrace(adminUserId: string, limit = 100): Promise<AdminTrace> {
  return apiGet(accessPaths.trace, { path: { admin_user_id: adminUserId }, query: { limit } });
}

export function fetchTeamAudit(
  params: { group_id?: string; actor_id?: string; action?: string; search?: string; limit?: number; offset?: number } = {},
): Promise<AuditLogPage> {
  return apiGet(accessPaths.audit, { query: params });
}

// ---- React Query factories ----------------------------------------------------------

export const accessQueries = {
  scopes: () => queryOptions({ queryKey: accessKeys.scopes(), queryFn: fetchScopeCatalog, staleTime: 300_000 }),
  directory: (search?: string) =>
    queryOptions({ queryKey: accessKeys.directory(search), queryFn: () => fetchAdminDirectory(search) }),
  users: (params: { limit?: number; offset?: number; search?: string } = {}) =>
    queryOptions({ queryKey: accessKeys.users(params), queryFn: () => listIamUsers(params) }),
  user: (adminUserId: string) =>
    queryOptions({ queryKey: accessKeys.user(adminUserId), queryFn: () => getIamUser(adminUserId) }),
  inlinePolicy: (adminUserId: string) =>
    queryOptions({ queryKey: accessKeys.inlinePolicy(adminUserId), queryFn: () => getInlinePolicy(adminUserId) }),
  policy: (policyId: string) =>
    queryOptions({ queryKey: [...accessKeys.all, "policy", policyId], queryFn: () => getPolicy(policyId) }),
  groups: (params: { limit?: number; offset?: number; search?: string } = {}) =>
    queryOptions({ queryKey: accessKeys.groups(params), queryFn: () => listGroups(params) }),
  group: (groupId: string) =>
    queryOptions({ queryKey: accessKeys.group(groupId), queryFn: () => getGroup(groupId) }),
  groupMembers: (groupId: string) =>
    queryOptions({ queryKey: accessKeys.groupMembers(groupId), queryFn: () => listGroupMembers(groupId) }),
  groupPolicies: (groupId: string) =>
    queryOptions({ queryKey: accessKeys.groupPolicies(groupId), queryFn: () => listGroupPolicies(groupId) }),
  policies: (params: { limit?: number; offset?: number; template_only?: boolean; search?: string } = {}) =>
    queryOptions({ queryKey: accessKeys.policies(params), queryFn: () => listPolicies(params) }),
  templates: () => queryOptions({ queryKey: accessKeys.templates(), queryFn: listPolicyTemplates }),
  adminPolicies: (adminUserId: string) =>
    queryOptions({
      queryKey: accessKeys.adminPolicies(adminUserId),
      queryFn: () => listAdminPolicies(adminUserId),
    }),
  trace: (adminUserId: string) =>
    queryOptions({ queryKey: accessKeys.trace(adminUserId), queryFn: () => fetchAdminTrace(adminUserId) }),
  audit: (params: { group_id?: string; actor_id?: string; action?: string; search?: string; limit?: number; offset?: number } = {}) =>
    queryOptions({ queryKey: accessKeys.audit(params), queryFn: () => fetchTeamAudit(params) }),
};
