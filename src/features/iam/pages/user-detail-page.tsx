import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  accessKeys,
  accessQueries,
  addGroupMember,
  attachAdminPolicy,
  detachAdminPolicy,
  isInlinePolicyCode,
  revokeMemberAccess,
  setInlinePolicy,
  setMemberStatus,
  setUserBoundary,
  updateGroup,
  type ResourceScope,
} from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useAdminAuth } from "@/lib/auth/store";
import { canManageAccess } from "@/lib/permissions";
import {
  Badge,
  Button,
  Card,
  ErrorAlert,
  IconButton,
  Kpi,
  Loading,
  PageHead,
} from "@/components/ui/kit";
import { InfoHint } from "@/components/ui/info-hint";
import { SelectField } from "@/components/ui/select";
import { SearchSelect } from "@/components/ui/search-select";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { ScopePicker } from "../components/scope-picker";

const RESOURCE_SCOPES: { value: ResourceScope; label: string }[] = [
  { value: "all", label: "All records" },
  { value: "team", label: "Team records" },
  { value: "own", label: "Own records" },
];

export default function UserDetailPage() {
  const t = useT();
  const { adminUserId = "" } = useParams<{ adminUserId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const admin = useAdminAuth((state) => state.admin);
  const isSuper = Boolean(admin?.scopes.includes("*"));
  const canWrite = canManageAccess(admin?.scopes);

  const userQuery = useQuery(accessQueries.user(adminUserId));
  const teams = useQuery(accessQueries.groups({ limit: 200 }));
  const policies = useQuery(accessQueries.policies({ limit: 200 }));
  const allBindings = useQuery(accessQueries.adminPolicies(adminUserId));
  // The inline policy is edited in its own card, not listed as a named policy.
  const bindings = {
    ...allBindings,
    data: allBindings.data?.filter((binding) => !isInlinePolicyCode(binding.policy_code)),
  };
  const trace = useQuery(accessQueries.trace(adminUserId));

  const memberGroupIds = userQuery.data?.group_ids ?? [];
  const teamPolicyQueries = useQueries({
    queries: memberGroupIds.map((groupId) => accessQueries.groupPolicies(groupId)),
  });
  const teamBindings = useMemo(() => {
    const map = new Map<string, { policy_id: string; policy_name: string | null; policy_code: string | null }>();
    for (const query of teamPolicyQueries) {
      for (const binding of query.data ?? []) {
        map.set(binding.policy_id, {
          policy_id: binding.policy_id,
          policy_name: binding.policy_name ?? null,
          policy_code: binding.policy_code ?? null,
        });
      }
    }
    return [...map.values()];
  }, [teamPolicyQueries]);

  const [policyId, setPolicyId] = useState("");
  const [resourceScope, setResourceScope] = useState<ResourceScope>("all");
  const [teamId, setTeamId] = useState("");
  const [showAllPolicies, setShowAllPolicies] = useState(false);
  const [boundaryId, setBoundaryId] = useState("");
  const [revoking, setRevoking] = useState(false);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: accessKeys.all });
    queryClient.invalidateQueries({ queryKey: accessKeys.user(adminUserId) });
    queryClient.invalidateQueries({ queryKey: accessKeys.adminPolicies(adminUserId) });
    queryClient.invalidateQueries({ queryKey: accessKeys.trace(adminUserId) });
    queryClient.invalidateQueries({ queryKey: accessKeys.inlinePolicy(adminUserId) });
  };

  const attach = useMutation({
    mutationFn: () =>
      attachAdminPolicy(adminUserId, { policy_id: policyId, resource_scope: resourceScope }),
    onSuccess: () => {
      setPolicyId("");
      refresh();
    },
  });
  const detach = useMutation({
    mutationFn: (attachmentId: string) => detachAdminPolicy(adminUserId, attachmentId),
    onSuccess: refresh,
  });
  const addTeam = useMutation({
    mutationFn: () => addGroupMember(teamId, adminUserId),
    onSuccess: () => {
      setTeamId("");
      refresh();
    },
  });
  const makeLead = useMutation({
    mutationFn: (groupId: string) => updateGroup(groupId, { lead_admin_user_id: adminUserId }),
    onSuccess: refresh,
  });
  const toggleStatus = useMutation({
    mutationFn: () =>
      setMemberStatus(adminUserId, userQuery.data?.status === "active" ? "suspended" : "active"),
    onSuccess: refresh,
  });
  const revoke = useMutation({
    mutationFn: () => revokeMemberAccess(adminUserId),
    onSuccess: () => {
      setRevoking(false);
      refresh();
    },
    onError: () => setRevoking(false),
  });
  const boundary = useMutation({
    mutationFn: (policy: string | null) => setUserBoundary(adminUserId, policy),
    onSuccess: () => {
      setBoundaryId("");
      refresh();
    },
  });

  if (userQuery.isLoading) return <Loading />;
  if (userQuery.error) return <ErrorAlert error={userQuery.error} />;
  const user = userQuery.data;
  if (!user) return null;

  const directIds = new Set((bindings.data ?? []).map((binding) => binding.policy_id));
  const heldScopes = new Set(admin?.scopes ?? []);
  const canGrant = (policy: { scopes: string[] }) =>
    Boolean(admin?.scopes.includes("*")) || policy.scopes.every((scope) => heldScopes.has(scope));
  const teamPolicyIds = new Set(teamBindings.map((binding) => binding.policy_id));
  const attachable = (policies.data?.items ?? []).filter(
    (policy) =>
      !directIds.has(policy.policy_id) &&
      canGrant(policy) &&
      (showAllPolicies || policy.is_template || teamPolicyIds.has(policy.policy_id)),
  );
  const userGroupIds = new Set(user.group_ids);
  const addableTeams = (teams.data?.items ?? []).filter((group) => !userGroupIds.has(group.group_id));
  const leadGroups = (teams.data?.items ?? []).filter(
    (group) => group.lead_admin_user_id === user.admin_user_id,
  );
  // A lead manages the accounts of non-lead members of the teams they lead; the API re-checks.
  const isSelf = admin?.admin_user_id === user.admin_user_id;
  const ledTeamIds = new Set(
    (teams.data?.items ?? [])
      .filter((group) => group.lead_admin_user_id === admin?.admin_user_id)
      .map((group) => group.group_id),
  );
  const canManageUser =
    isSuper ||
    (canWrite && !isSelf && !leadGroups.length && user.group_ids.some((id) => ledTeamIds.has(id)));
  const boundaryPolicy = (policies.data?.items ?? []).find(
    (policy) => policy.policy_id === user.boundary_policy_id,
  );
  const blockedScopes = (user.granted_scopes ?? []).filter((scope) => !user.scopes.includes(scope));
  const boundaryChoices = (policies.data?.items ?? []).filter(
    (policy) => policy.policy_id !== user.boundary_policy_id && canGrant(policy),
  );

  return (
    <>
      <PageHead
        back={{ href: "/access/users", label: t("المستخدمون", "Users") }}
        title={
          <span className="ma-row" style={{ justifyContent: "flex-start", gap: 12, flexWrap: "wrap" }}>
            {user.full_name || user.email}
            <Badge
              def={
                user.status === "active"
                  ? { label: { ar: "نشط", en: "Active" }, tone: "success" }
                  : { label: { ar: "موقوف", en: "Suspended" }, tone: "warning" }
              }
            />
          </span>
        }
        sub={<span dir="ltr">{user.email}</span>}
        actions={
          canManageUser ? (
            <>
              <Button
                kind={user.status === "active" ? "secondary" : "primary"}
                label={user.status === "active" ? t("إيقاف الحساب", "Suspend account") : t("تفعيل الحساب", "Activate account")}
                disabled={toggleStatus.isPending}
                onClick={() => toggleStatus.mutate()}
              />
              {user.status === "active" ? (
                <Button
                  kind="danger"
                  icon="x"
                  label={t("سحب الوصول", "Revoke access")}
                  disabled={revoke.isPending}
                  onClick={() => setRevoking(true)}
                />
              ) : null}
            </>
          ) : null
        }
      />

      <div className="ma-cols ma-cols--4 ma-section-gap">
        <Kpi label={t("الصلاحيات الفعلية", "Effective scopes")} value={user.scopes.length} icon="key" field="var(--purple)" />
        <Kpi label={t("الفرق", "Teams")} value={user.group_ids.length} icon="users" field="var(--teal)" />
        <Kpi label={t("السياسات المباشرة", "Direct policies")} value={bindings.data?.length ?? 0} icon="shield" field="var(--yellow)" />
        <Kpi label={t("الإجراءات المسجلة", "Recorded actions")} value={trace.data?.total_actions ?? 0} icon="activity" field="var(--coral)" />
      </div>

      <div className="ma-cols ma-cols--2 ma-section-gap">
        <Card
          title={
            <SectionTitle
              title={t("الفرق والعضوية", "Teams & membership")}
              hint={t(
                "عضوية الفرق تمنح المستخدم سياسات الفريق. القائد يستطيع إدارة فريقه فقط.",
                "Team membership grants the team's policies. A lead can manage only their own team.",
              )}
            />
          }
        >
          <div className="ma-stack">
            {user.group_ids.map((groupId) => {
              const group = teams.data?.items.find((item) => item.group_id === groupId);
              const isLead = group?.lead_admin_user_id === user.admin_user_id;
              return (
                <div key={groupId} className="ma-row">
                  <span>
                    <span className="ma-cell-main">{group?.name ?? groupId}</span>
                    <span className="ma-cell-sub">{group?.code}</span>
                  </span>
                  {isLead ? (
                    <Badge def={{ label: { ar: "قائد", en: "Lead" }, tone: "success" }} />
                  ) : isSuper ? (
                    <Button
                      sm
                      label={t("تعيين قائدًا", "Make lead")}
                      disabled={makeLead.isPending}
                      onClick={() => makeLead.mutate(groupId)}
                    />
                  ) : null}
                </div>
              );
            })}
            {!user.group_ids.length ? (
              <p className="ma-muted">{t("ليس عضوًا في أي فريق.", "Not a member of any team.")}</p>
            ) : null}
          </div>
          {canWrite && addableTeams.length ? (
            <div className="ma-inline-form">
              <SelectField
                label={t("إضافة إلى فريق", "Add to team")}
                value={teamId}
                onChange={setTeamId}
                options={[
                  { value: "", label: t("اختر فريقًا", "Pick a team") },
                  ...addableTeams.map((group) => ({ value: group.group_id, label: group.name })),
                ]}
                showLabel
              />
              <Button sm icon="plus" label={t("إضافة", "Add")} disabled={!teamId || addTeam.isPending} onClick={() => addTeam.mutate()} />
            </div>
          ) : null}
          {leadGroups.length ? (
            <p className="ma-muted">{t("يقود", "Leads")}: {leadGroups.map((group) => group.name).join(", ")}</p>
          ) : null}
          <ErrorAlert error={addTeam.error ?? makeLead.error} />
        </Card>

        <Card
          title={
            <SectionTitle
              title={t("الصلاحيات الفعلية", "Effective scopes")}
              hint={t(
                "اتحاد كل السياسات المباشرة وسياسات الفرق، مقيدًا بحدود الصلاحيات إن وُجدت. الوسم team/own يحدد السجلات التي يراها.",
                "The union of direct and team policies, capped by the permission boundary when set. A team/own tag narrows the records they see.",
              )}
            />
          }
        >
          <p className="ma-muted">
            {t("مجموع صلاحيات", "Total")}: {user.scopes.length}
            {user.scopes.includes("*") ? ` (${t("كل الصلاحيات", "all")})` : ""}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {user.scopes.sort().map((scope) => (
              <code key={scope} className="ma-badge ma-badge--neutral" dir="ltr">
                {scope}
                {user.resource_conditions[scope] && user.resource_conditions[scope] !== "all"
                  ? ` · ${user.resource_conditions[scope]}`
                  : ""}
              </code>
            ))}
          </div>
        </Card>
      </div>

      <Card
        className="ma-section-gap"
        title={
          <SectionTitle
            title={t("حدود الصلاحيات", "Permission boundary")}
            hint={t(
              "الحد الأقصى لما يستطيع المستخدم فعله: الصلاحيات الفعلية = سياساته ∩ سياسة الحدود. لا يستطيع قائد الفريق إزالة الحدود أو توسيعها خارج صلاحياته.",
              "The most this user can ever do: effective scopes = their policies ∩ the boundary policy. A team lead cannot remove a boundary or widen it beyond their own scopes.",
            )}
          />
        }
        actions={
          isSuper && user.boundary_policy_id ? (
            <Button
              sm
              kind="ghost"
              icon="x"
              label={t("إزالة الحدود", "Remove boundary")}
              disabled={boundary.isPending}
              onClick={() => boundary.mutate(null)}
            />
          ) : undefined
        }
      >
        {user.boundary_policy_id ? (
          <div className="ma-stack">
            <div className="ma-row">
              <span>
                <span className="ma-cell-main">{boundaryPolicy?.name ?? user.boundary_policy_id}</span>
                <span className="ma-cell-sub" dir="ltr">
                  {(user.boundary_scopes ?? []).join(" · ")}
                </span>
              </span>
              <Badge def={{ label: { ar: "حدود مفعّلة", en: "Boundary set" }, tone: "info" }} />
            </div>
            {blockedScopes.length ? (
              <div className="ma-field">
                <span className="ma-label">{t("صلاحيات تحجبها الحدود", "Scopes blocked by the boundary")}</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {blockedScopes.map((scope) => (
                    <code key={scope} className="ma-badge ma-badge--warning" dir="ltr">{scope}</code>
                  ))}
                </div>
              </div>
            ) : (
              <p className="ma-muted">{t("لا تحجب الحدود أي صلاحية ممنوحة حاليًا.", "The boundary blocks none of the current grants.")}</p>
            )}
          </div>
        ) : (
          <p className="ma-muted">
            {t("بلا حدود — الصلاحيات الفعلية هي اتحاد السياسات.", "No boundary — effective scopes are the union of policies.")}
          </p>
        )}
        {canManageUser ? (
          <div className="ma-inline-form">
            <SearchSelect
              label={user.boundary_policy_id ? t("تغيير الحدود", "Change boundary") : t("تعيين حدود", "Set boundary")}
              value={boundaryId}
              onChange={setBoundaryId}
              placeholder={t("اختر سياسة الحدود", "Pick a boundary policy")}
              searchPlaceholder={t("ابحث في السياسات…", "Search policies…")}
              options={[
                { value: "", label: t("بدون اختيار", "None selected") },
                ...boundaryChoices.map((policy) => ({
                  value: policy.policy_id,
                  label: policy.name,
                  description: `${policy.code} · ${policy.scopes.length} ${t("صلاحية", "scopes")}`,
                })),
              ]}
              showLabel
            />
            <Button
              sm
              icon="shield"
              label={t("تطبيق", "Apply")}
              disabled={!boundaryId || boundary.isPending}
              onClick={() => boundary.mutate(boundaryId)}
            />
          </div>
        ) : null}
        <ErrorAlert error={boundary.error} />
      </Card>

      <InlinePermissionsCard adminUserId={user.admin_user_id} canEdit={canManageUser} onSaved={refresh} />

      <Card
        className="ma-section-gap"
        title={
          <SectionTitle
            title={t("السياسات المباشرة", "Direct policies")}
            hint={t(
              "السياسة المباشرة تُمنح لهذا الشخص وحده، إضافة إلى سياسات فرقه. اختر نطاق السجلات عند الربط.",
              "A direct policy applies to this person only, on top of their teams. Pick the record scope when attaching.",
            )}
          />
        }
      >
        <div className="ma-stack">
          {(bindings.data ?? []).map((binding) => (
            <div key={binding.attachment_id} className="ma-row">
              <span>
                <span className="ma-cell-main">{binding.policy_name}</span>
                <span className="ma-cell-sub">{binding.policy_code} · {binding.resource_scope}</span>
              </span>
              {canWrite ? (
                <IconButton icon="x" label={t("فك الربط", "Detach")} onClick={() => detach.mutate(binding.attachment_id)} />
              ) : null}
            </div>
          ))}
          {!bindings.data?.length ? <p className="ma-muted">{t("لا سياسات مباشرة.", "No direct policies.")}</p> : null}
        </div>
        {teamBindings.length ? (
          <div className="ma-field">
            <span className="ma-label">{t("سياسات فرق المستخدم", "The user's team policies")}</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {teamBindings.map((binding) => (
                <code key={binding.policy_id} className="ma-badge ma-badge--neutral">
                  {binding.policy_name ?? binding.policy_code}
                </code>
              ))}
            </div>
          </div>
        ) : null}
        <div className="ma-hintline">
          <InfoHint label={t("اختيار السياسة", "Policy choices")} title={t("اختيار السياسة", "Policy choices")}>
            {t(
              "تُعرض القوالب وسياسات فرق المستخدم فقط. عند الانضمام لأكثر من فريق تُدمج سياسات كل الفرق في قائمة واحدة.",
              "Only templates and the user's team policies are listed. When the user belongs to multiple teams, their policies are combined into one list.",
            )}
          </InfoHint>
          <span className="ma-muted">
            {teamBindings.length
              ? t(
                  `القوالب + ${teamBindings.length} سياسة من ${user.groups.join(", ")}`,
                  `Templates + ${teamBindings.length} team policies from ${user.groups.join(", ")}`,
                )
              : user.groups.length
                ? t(
                    `القوالب فقط — لا سياسات على ${user.groups.join(", ")}`,
                    `Templates only — ${user.groups.join(", ")} has no policies`,
                  )
                : t("القوالب فقط — المستخدم ليس في فريق بعد.", "Templates only — the user is not in a team yet.")}
          </span>
        </div>
        {isSuper ? (
          <label className="ma-check">
            <input
              type="checkbox"
              checked={showAllPolicies}
              onChange={(event) => setShowAllPolicies(event.target.checked)}
            />
            <span>{t("عرض كل السياسات (مدير أعلى)", "Show all policies (super admin)")}</span>
          </label>
        ) : null}
        {canWrite ? (
          <div className="ma-inline-form">
            <SearchSelect
              label={t("ربط سياسة", "Attach policy")}
              value={policyId}
              onChange={setPolicyId}
              placeholder={t("اختر سياسة", "Pick a policy")}
              searchPlaceholder={t("ابحث في السياسات…", "Search policies…")}
              options={[
                { value: "", label: t("بدون سياسة", "No policy") },
                ...attachable.map((policy) => ({
                  value: policy.policy_id,
                  label: policy.name,
                  description: `${policy.code} · ${policy.scopes.length} ${t("صلاحية", "scopes")}${
                    policy.is_template ? ` · ${t("قالب", "template")}` : ""
                  }`,
                })),
              ]}
              showLabel
            />
            <SelectField
              label={t("نطاق السجلات", "Record scope")}
              value={resourceScope}
              onChange={(value) => setResourceScope(value as ResourceScope)}
              options={RESOURCE_SCOPES.map((item) => ({ value: item.value, label: item.label }))}
              showLabel
            />
            <Button sm icon="link" label={t("ربط", "Attach")} disabled={!policyId || attach.isPending} onClick={() => attach.mutate()} />
          </div>
        ) : null}
        <ErrorAlert error={attach.error ?? detach.error} />
      </Card>

      <Card
        className="ma-section-gap"
        title={
          <SectionTitle
            title={t("آخر الإجراءات", "Recent actions")}
            hint={t(
              "أحدث ما سجله هذا المستخدم في سجل التدقيق، مع مسار الطلب وحالته.",
              "The latest actions this admin recorded, with request path and status.",
            )}
          />
        }
        actions={
          <Button
            sm
            label={t("كل السجل", "Full audit")}
            onClick={() => navigate(`/access/audit?actor=${user.admin_user_id}`)}
          />
        }
      >
        <div className="ma-stack">
          {(trace.data?.audit_logs ?? []).slice(0, 10).map((row) => (
            <div key={row.audit_log_id} className="ma-row">
              <span>
                <span className="ma-cell-main" dir="ltr">{row.action}</span>
                <span className="ma-cell-sub" dir="ltr">{row.method ?? ""} {row.path ?? row.entity_type}</span>
              </span>
              <span className="ma-cell-sub" dir="ltr">
                {row.created_at ? new Date(row.created_at).toLocaleString() : ""}
              </span>
            </div>
          ))}
          {!trace.data?.audit_logs.length ? <p className="ma-muted">{t("لا إجراءات بعد.", "No actions yet.")}</p> : null}
        </div>
      </Card>
      <ErrorAlert error={toggleStatus.error ?? revoke.error} />
      <ConfirmModal
        open={revoking}
        onOpenChange={setRevoking}
        tone="danger"
        title={t("سحب وصول المستخدم", "Revoke this user's access")}
        message={t(
          "سيتم فك سياساته المباشرة، وإزالته من فرقك، وإيقاف حسابه. يمكن إعادة تفعيله لاحقًا.",
          "Their direct policies are detached, they are removed from your teams, and the account is suspended. You can reactivate it later.",
        )}
        confirmLabel={t("سحب الوصول", "Revoke access")}
        loading={revoke.isPending}
        onConfirm={() => revoke.mutate()}
      />
    </>
  );
}

/** Scopes granted to this user one by one, e.g. only `admin:affiliates:manage`. */
function InlinePermissionsCard({
  adminUserId,
  canEdit,
  onSaved,
}: {
  adminUserId: string;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const t = useT();
  const inline = useQuery(accessQueries.inlinePolicy(adminUserId));
  const catalog = useQuery({ ...accessQueries.scopes(), enabled: canEdit });
  const [draft, setDraft] = useState<{ scopes: string[]; resource_scope: ResourceScope } | null>(null);
  const saved = inline.data ?? { scopes: [], resource_scope: "all" as ResourceScope };
  const current = draft ?? saved;
  const dirty =
    draft !== null &&
    (draft.resource_scope !== saved.resource_scope ||
      [...draft.scopes].sort().join() !== [...saved.scopes].sort().join());

  const save = useMutation({
    mutationFn: () => setInlinePolicy(adminUserId, current),
    onSuccess: () => {
      setDraft(null);
      onSaved();
    },
  });

  return (
    <Card
      className="ma-section-gap"
      title={
        <SectionTitle
          title={t("صلاحيات فردية", "Individual permissions")}
          hint={t(
            "امنح صلاحيات محددة لهذا الشخص وحده دون إنشاء سياسة، مثل admin:affiliates:manage فقط. تُضاف إلى سياساته وفرقه، وتبقى ضمن حدود صلاحياته.",
            "Grant specific scopes to this person only, without creating a policy — e.g. just admin:affiliates:manage. They add to their policies and teams, and stay inside their permission boundary.",
          )}
        />
      }
      actions={
        canEdit ? (
          <span className="ma-row" style={{ gap: 6 }}>
            {draft === null ? (
              <Button sm icon="edit" label={t("تعديل", "Edit")} onClick={() => setDraft(saved)} />
            ) : (
              <>
                <Button sm kind="ghost" label={t("إلغاء", "Cancel")} onClick={() => setDraft(null)} />
                <Button
                  sm
                  kind="primary"
                  icon="check"
                  label={t("حفظ", "Save")}
                  disabled={!dirty || save.isPending}
                  onClick={() => save.mutate()}
                />
              </>
            )}
          </span>
        ) : undefined
      }
    >
      {draft === null ? (
        saved.scopes.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {saved.scopes.map((scope) => (
              <code key={scope} className="ma-badge ma-badge--info" dir="ltr">
                {scope}
                {saved.resource_scope !== "all" ? ` · ${saved.resource_scope}` : ""}
              </code>
            ))}
          </div>
        ) : (
          <p className="ma-muted">{t("لا صلاحيات فردية.", "No individual permissions.")}</p>
        )
      ) : (
        <div className="ma-stack">
          <ScopePicker
            areas={catalog.data?.areas}
            value={draft.scopes}
            onChange={(scopes) => setDraft({ ...draft, scopes })}
          />
          <SelectField
            label={t("نطاق السجلات", "Record scope")}
            value={draft.resource_scope}
            onChange={(value) => setDraft({ ...draft, resource_scope: value as ResourceScope })}
            options={RESOURCE_SCOPES.map((item) => ({ value: item.value, label: item.label }))}
            showLabel
          />
        </div>
      )}
      <ErrorAlert error={inline.error ?? save.error} />
    </Card>
  );
}

function SectionTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <span className="ma-row" style={{ justifyContent: "flex-start", gap: 6 }}>
      {title}
      <InfoHint label={title} title={title}>{hint}</InfoHint>
    </span>
  );
}
