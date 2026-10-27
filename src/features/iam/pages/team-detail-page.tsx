import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  accessKeys,
  accessQueries,
  addGroupMember,
  attachGroupPolicy,
  deleteGroup,
  detachGroupPolicy,
  removeGroupMember,
  setGroupBoundary,
  setMemberStatus,
  updateGroup,
  type AdminPolicy,
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
import { AddUserModal } from "../components/add-user-modal";
import { PolicyFormModal } from "../components/policy-modal";

const RESOURCE_SCOPES: { value: ResourceScope; label: string }[] = [
  { value: "all", label: "All records" },
  { value: "team", label: "Team records" },
  { value: "own", label: "Own records" },
];

export default function TeamDetailPage() {
  const t = useT();
  const { groupId = "" } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const admin = useAdminAuth((state) => state.admin);
  const isSuper = Boolean(admin?.scopes.includes("*"));
  const canWrite = canManageAccess(admin?.scopes);

  const group = useQuery(accessQueries.group(groupId));
  const members = useQuery(accessQueries.groupMembers(groupId));
  const bindings = useQuery(accessQueries.groupPolicies(groupId));
  const policies = useQuery(accessQueries.policies({ limit: 200 }));
  const isLeadOf = (lead?: string | null) => Boolean(lead) && lead === admin?.admin_user_id;
  const canManageTeam = isSuper || (canWrite && isLeadOf(group.data?.lead_admin_user_id));
  const directory = useQuery({ ...accessQueries.directory(), enabled: canManageTeam });

  const [memberId, setMemberId] = useState("");
  const [policyId, setPolicyId] = useState("");
  const [resourceScope, setResourceScope] = useState<ResourceScope>("all");
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newPolicyOpen, setNewPolicyOpen] = useState(false);
  const [editPolicy, setEditPolicy] = useState<AdminPolicy | null>(null);
  const [boundaryId, setBoundaryId] = useState("");

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: accessKeys.all });
    queryClient.invalidateQueries({ queryKey: accessKeys.group(groupId) });
    queryClient.invalidateQueries({ queryKey: accessKeys.groupMembers(groupId) });
    queryClient.invalidateQueries({ queryKey: accessKeys.groupPolicies(groupId) });
  };

  const add = useMutation({
    mutationFn: () => addGroupMember(groupId, memberId),
    onSuccess: () => {
      setMemberId("");
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (adminUserId: string) => removeGroupMember(groupId, adminUserId),
    onSuccess: refresh,
  });
  const attach = useMutation({
    mutationFn: () => attachGroupPolicy(groupId, { policy_id: policyId, resource_scope: resourceScope }),
    onSuccess: () => {
      setPolicyId("");
      refresh();
    },
  });
  const detach = useMutation({
    mutationFn: (attachmentId: string) => detachGroupPolicy(groupId, attachmentId),
    onSuccess: refresh,
  });
  const makeLead = useMutation({
    mutationFn: (adminUserId: string) => updateGroup(groupId, { lead_admin_user_id: adminUserId }),
    onSuccess: refresh,
  });
  const memberStatus = useMutation({
    mutationFn: ({ adminUserId, active }: { adminUserId: string; active: boolean }) =>
      setMemberStatus(adminUserId, active ? "suspended" : "active"),
    onSuccess: refresh,
  });
  const boundary = useMutation({
    mutationFn: (policy: string | null) => setGroupBoundary(groupId, policy),
    onSuccess: () => {
      setBoundaryId("");
      refresh();
    },
  });
  const destroy = useMutation({
    mutationFn: () => deleteGroup(groupId),
    onSuccess: () => {
      refresh();
      navigate("/access/teams");
    },
  });

  if (group.isLoading) return <Loading />;
  if (group.error) return <ErrorAlert error={group.error} />;
  const team = group.data;
  if (!team) return null;

  const memberIds = new Set((members.data ?? []).map((member) => member.admin_user_id));
  const candidates = (directory.data ?? []).filter((item) => !memberIds.has(item.admin_user_id));
  const attachedIds = new Set((bindings.data ?? []).map((binding) => binding.policy_id));
  const heldScopes = new Set(admin?.scopes ?? []);
  const canGrant = (policy: { scopes: string[] }) =>
    Boolean(admin?.scopes.includes("*")) || policy.scopes.every((scope) => heldScopes.has(scope));
  const attachable = (policies.data?.items ?? []).filter(
    (policy) => !attachedIds.has(policy.policy_id) && canGrant(policy),
  );
  const boundaryPolicy = (policies.data?.items ?? []).find(
    (policy) => policy.policy_id === team.boundary_policy_id,
  );
  const boundaryChoices = (policies.data?.items ?? []).filter(
    (policy) => policy.policy_id !== team.boundary_policy_id && canGrant(policy),
  );

  return (
    <>
      <PageHead
        back={{ href: "/access/teams", label: t("الفرق", "Teams") }}
        title={
          <span className="ma-row" style={{ justifyContent: "flex-start", gap: 10, flexWrap: "wrap" }}>
            {team.name}
            <Badge def={{ label: { ar: team.code, en: team.code }, tone: "neutral" }} />
          </span>
        }
        sub={team.description || t("لا وصف لهذا الفريق.", "This team has no description.")}
        actions={
          <>
            {canManageTeam ? (
              <Button kind="primary" icon="plus" label={t("إنشاء مشرف للفريق", "Create an admin")} onClick={() => setAddUserOpen(true)} />
            ) : null}
            {isSuper ? (
              <Button
                kind="danger"
                label={t("حذف الفريق", "Delete team")}
                disabled={destroy.isPending}
                onClick={() => {
                  if (window.confirm(t("حذف هذا الفريق وكل ارتباطاته؟", "Delete this team and all its bindings?"))) {
                    destroy.mutate();
                  }
                }}
              />
            ) : null}
          </>
        }
      />

      <div className="ma-cols ma-cols--3 ma-section-gap">
        <Kpi label={t("الأعضاء", "Members")} value={members.data?.length ?? 0} icon="users" field="var(--purple)" />
        <Kpi label={t("السياسات", "Policies")} value={bindings.data?.length ?? 0} icon="shield" field="var(--teal)" />
        <Kpi label={t("القائد", "Lead")} value={team.lead_name || t("بدون", "None")} icon="key" field="var(--yellow)" />
      </div>

      <div className="ma-cols ma-cols--2 ma-section-gap">
        <Card
          title={
            <SectionTitle
              title={t("الأعضاء", "Members")}
              hint={t(
                "قائد الفريق يضيف الأعضاء ويخصصهم، لكنه لا يستطيع منح صلاحيات أوسع من صلاحياته.",
                "A team lead adds and manages members, but cannot grant more access than they hold.",
              )}
            />
          }
        >
          <div className="ma-stack">
            {(members.data ?? []).map((member) => {
              const isLead = team.lead_admin_user_id === member.admin_user_id;
              return (
                <div key={member.admin_user_id} className="ma-row">
                  <button
                    type="button"
                    className="ma-link ma-link--plain"
                    onClick={() => navigate(`/access/users/${member.admin_user_id}`)}
                  >
                    <span className="ma-cell-main">{member.full_name || member.email}</span>
                    <span className="ma-cell-sub" dir="ltr">{member.email}</span>
                  </button>
                  <span className="ma-row" style={{ gap: 6, justifyContent: "flex-end" }}>
                    {isLead ? (
                      <Badge def={{ label: { ar: "قائد", en: "Lead" }, tone: "success" }} />
                    ) : isSuper ? (
                      <Button sm label={t("تعيين قائدًا", "Make lead")} disabled={makeLead.isPending} onClick={() => makeLead.mutate(member.admin_user_id)} />
                    ) : null}
                    {member.status !== "active" ? (
                      <Badge def={{ label: { ar: "موقوف", en: "Suspended" }, tone: "warning" }} />
                    ) : null}
                    {member.boundary_policy_id ? (
                      <Badge def={{ label: { ar: "محدود", en: "Bounded" }, tone: "info" }} />
                    ) : null}
                    {canManageTeam && !isLead && member.admin_user_id !== admin?.admin_user_id ? (
                      <Button
                        sm
                        kind="ghost"
                        label={member.status === "active" ? t("إيقاف", "Suspend") : t("تفعيل", "Activate")}
                        disabled={memberStatus.isPending}
                        onClick={() =>
                          memberStatus.mutate({
                            adminUserId: member.admin_user_id,
                            active: member.status === "active",
                          })
                        }
                      />
                    ) : null}
                    {canManageTeam && !isLead ? (
                      <IconButton icon="x" label={t("إزالة", "Remove")} onClick={() => remove.mutate(member.admin_user_id)} />
                    ) : null}
                  </span>
                </div>
              );
            })}
            {!members.data?.length ? <p className="ma-muted">{t("لا أعضاء.", "No members.")}</p> : null}
          </div>
          {canManageTeam ? (
            <div className="ma-inline-form">
              <SelectField
                label={t("إضافة عضو موجود", "Add existing admin")}
                value={memberId}
                onChange={setMemberId}
                options={[
                  { value: "", label: t("اختر مشرفًا", "Pick an admin") },
                  ...candidates.map((item) => ({ value: item.admin_user_id, label: item.full_name || item.email })),
                ]}
                showLabel
              />
              <Button sm icon="plus" label={t("إضافة", "Add")} disabled={!memberId || add.isPending} onClick={() => add.mutate()} />
            </div>
          ) : null}
          <ErrorAlert error={add.error ?? remove.error ?? makeLead.error ?? memberStatus.error} />
        </Card>

        <Card
          title={
            <SectionTitle
              title={t("السياسات", "Policies")}
              hint={t(
                "كل سياسة مربوطة بالفريق تمنح صلاحياتها لكل عضو. نطاق السجلات يحدد ما يراه الأعضاء. قائد الفريق ينشئ ويعدل سياسات فريقه فقط.",
                "Each policy attached to the team grants its scopes to every member. The record scope narrows what they see. A team lead creates/edits only their team's policies.",
              )}
            />
          }
          actions={
            canManageTeam ? (
              <Button sm icon="plus" label={t("سياسة للفريق", "New team policy")} onClick={() => setNewPolicyOpen(true)} />
            ) : null
          }
        >
          <div className="ma-stack">
            {(bindings.data ?? []).map((binding) => {
              const policy = (policies.data?.items ?? []).find((item) => item.policy_id === binding.policy_id);
              return (
                <div key={binding.attachment_id} className="ma-row">
                  <span>
                    <span className="ma-cell-main">{binding.policy_name}</span>
                    <span className="ma-cell-sub">{binding.policy_code} · {binding.resource_scope}</span>
                  </span>
                  <span className="ma-row" style={{ gap: 6, justifyContent: "flex-end" }}>
                    {canManageTeam && policy?.can_manage ? (
                      <IconButton icon="edit" label={t("تعديل السياسة", "Edit policy")} onClick={() => setEditPolicy(policy)} />
                    ) : null}
                    {canManageTeam ? (
                      <IconButton icon="x" label={t("فك الربط", "Detach")} onClick={() => detach.mutate(binding.attachment_id)} />
                    ) : null}
                  </span>
                </div>
              );
            })}
            {!bindings.data?.length ? <p className="ma-muted">{t("لا سياسات.", "No policies.")}</p> : null}
          </div>
          {canManageTeam ? (
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
      </div>

      <Card
        className="ma-section-gap"
        title={
          <SectionTitle
            title={t("حدود صلاحيات الفريق", "Team permission boundary")}
            hint={t(
              "تُطبق تلقائيًا على كل مشرف يُنشأ داخل الفريق: صلاحياته الفعلية لا تتجاوز هذه السياسة مهما رُبط به. لا يغيّر حدود الأعضاء الحاليين.",
              "Applied to every admin created inside this team: their effective scopes never exceed this policy, whatever is attached. It does not change existing members.",
            )}
          />
        }
        actions={
          isSuper && team.boundary_policy_id ? (
            <Button sm kind="ghost" icon="x" label={t("إزالة الحدود", "Remove boundary")} disabled={boundary.isPending} onClick={() => boundary.mutate(null)} />
          ) : undefined
        }
      >
        {team.boundary_policy_id ? (
          <div className="ma-row">
            <span>
              <span className="ma-cell-main">{boundaryPolicy?.name ?? team.boundary_policy_id}</span>
              <span className="ma-cell-sub" dir="ltr">{(boundaryPolicy?.scopes ?? []).join(" · ")}</span>
            </span>
            <Badge def={{ label: { ar: "حدود مفعّلة", en: "Boundary set" }, tone: "info" }} />
          </div>
        ) : (
          <p className="ma-muted">{t("بلا حدود افتراضية.", "No default boundary.")}</p>
        )}
        {canManageTeam ? (
          <div className="ma-inline-form">
            <SearchSelect
              label={team.boundary_policy_id ? t("تغيير الحدود", "Change boundary") : t("تعيين حدود", "Set boundary")}
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
            <Button sm icon="shield" label={t("تطبيق", "Apply")} disabled={!boundaryId || boundary.isPending} onClick={() => boundary.mutate(boundaryId)} />
          </div>
        ) : null}
        <ErrorAlert error={boundary.error} />
      </Card>
      <ErrorAlert error={destroy.error} />

      <AddUserModal
        open={addUserOpen}
        onOpenChange={setAddUserOpen}
        isSuper={isSuper}
        presetGroup={team}
        onCreated={refresh}
      />
      <PolicyFormModal
        key={newPolicyOpen ? `new-${team.group_id}` : "closed"}
        open={newPolicyOpen}
        onOpenChange={setNewPolicyOpen}
        policy={null}
        isSuper={isSuper}
        attachToGroupId={team.group_id}
        attachToGroupName={team.name}
        onSaved={refresh}
      />
      <PolicyFormModal
        key={editPolicy?.policy_id ?? "no-edit"}
        open={Boolean(editPolicy)}
        onOpenChange={(open) => {
          if (!open) setEditPolicy(null);
        }}
        policy={editPolicy}
        isSuper={isSuper}
        onSaved={refresh}
      />
    </>
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
