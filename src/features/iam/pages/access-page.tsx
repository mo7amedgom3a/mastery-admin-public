import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  accessKeys,
  accessQueries,
  listGroups,
  listIamUsers,
  listPolicies,
  type AdminGroup,
  type AdminPolicy,
  type IamAdminUser,
} from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useAdminAuth } from "@/lib/auth/store";
import { canManageAccess } from "@/lib/permissions";
import { Badge, Button, Kpi, PageHead, PageTabs } from "@/components/ui/kit";
import { type Column } from "@/components/ui/data-table";
import { PagedList } from "@/components/ui/paged-list";
import { SelectField } from "@/components/ui/select";
import { InfoHint } from "@/components/ui/info-hint";

import { AddUserModal } from "../components/add-user-modal";
import { TeamFormModal } from "../components/team-modals";
import { AttachPolicyModal, PolicyFormModal } from "../components/policy-modal";
import { AuditTab } from "../components/audit-tab";

type Tab = "users" | "teams" | "policies" | "audit";

export default function AccessPage() {
  const t = useT();
  const location = useLocation();
  const admin = useAdminAuth((state) => state.admin);
  const isSuper = Boolean(admin?.scopes.includes("*"));
  const canWrite = canManageAccess(admin?.scopes);

  const tab = (location.pathname.split("/")[2] as Tab | undefined) ?? "users";

  const [addUserOpen, setAddUserOpen] = useState(false);
  const [teamFormOpen, setTeamFormOpen] = useState(false);
  const [policyForm, setPolicyForm] = useState<{ open: boolean; policy: AdminPolicy | null }>({
    open: false,
    policy: null,
  });
  const [attachPolicy, setAttachPolicy] = useState<AdminPolicy | null>(null);
  const navigate = useNavigate();

  const groups = useQuery(accessQueries.groups({ limit: 200 }));
  const policies = useQuery(accessQueries.policies({ limit: 200 }));
  const templates = useQuery(accessQueries.templates());
  const users = useQuery(accessQueries.users({ limit: 1 }));

  const actions =
    tab === "users" && canWrite ? (
      <Button kind="primary" icon="plus" label={t("إضافة مستخدم", "Add user")} onClick={() => setAddUserOpen(true)} />
    ) : tab === "teams" && isSuper ? (
      <Button kind="primary" icon="plus" label={t("فريق جديد", "New team")} onClick={() => setTeamFormOpen(true)} />
    ) : tab === "policies" && isSuper ? (
      <Button
        kind="primary"
        icon="plus"
        label={t("سياسة جديدة", "New policy")}
        onClick={() => setPolicyForm({ open: true, policy: null })}
      />
    ) : null;

  return (
    <>
      <PageHead
        title={t("إدارة الوصول", "Access management")}
        sub={t(
          "أنشئ المستخدمين، وزّعهم على الفرق، واربط السياسات — بصلاحيات ونطاق سجلات واضحين.",
          "Create users, group them into teams, and bind policies with clear scopes and record visibility.",
        )}
        actions={actions}
      />

      {!isSuper && admin?.groups?.length ? (
        <p className="ma-muted ma-section-gap">
          {t("نطاق الإدارة: فرقك فقط", "Management scope: your teams only")} —{" "}
          {admin.groups.map((group) => (
            <Badge key={group} def={{ label: { ar: group, en: group }, tone: "info" }} />
          ))}
        </p>
      ) : null}

      {tab !== "audit" ? (
        <div className="ma-cols ma-cols--4 ma-section-gap">
          <Kpi label={isSuper ? t("المستخدمون", "Users") : t("مستخدمو فرقك", "Users in your teams")} value={users.data?.total ?? 0} icon="users" field="var(--purple)" />
          <Kpi label={isSuper ? t("الفرق", "Teams") : t("فرقك", "Your teams")} value={groups.data?.total ?? 0} icon="shield" field="var(--teal)" />
          <Kpi label={t("السياسات", "Policies")} value={policies.data?.total ?? 0} icon="key" field="var(--yellow)" />
          <Kpi label={t("القوالب", "Templates")} value={templates.data?.length ?? 0} icon="book" field="var(--coral)" />
        </div>
      ) : null}

      <PageTabs
        base="/access"
        active={tab}
        list={[
          ["users", t("المستخدمون", "Users")],
          ["teams", t("الفرق", "Teams")],
          ["policies", t("السياسات والقوالب", "Policies & templates")],
          ["audit", t("التدقيق والتتبع", "Audit & tracing")],
        ]}
      />

      <PageHint
        text={
          tab === "users"
            ? t(
                "كل صف حساب مشرف. اضغط الاسم لفتح صفحة إدارة المستخدم: الفرق، الصلاحيات الفعلية والسياسات المباشرة.",
                "Each row is an admin account. Click a name to open the user page: teams, effective scopes and direct policies.",
              )
            : tab === "teams"
              ? t(
                  "الفريق يمنح سياساته لكل أعضائه. قائد الفريق يدير أعضاءه وسياساته داخل حدود صلاحياته.",
                  "A team grants its policies to every member. Its lead manages members and policies inside their own boundary.",
                )
              : tab === "policies"
                ? t(
                    "السياسة مجموعة صلاحيات مسماة. القوالب جاهزة للربط، والمخصصة تنشئها أنت أو قائد الفريق.",
                    "A policy is a named scope set. Templates are ready to bind; custom policies are created by you or a team lead.",
                  )
                : t(
                    "كل إجراء إداري يُسجل مع الفاعل، الحمولة، النتيجة وسياق الطلب. اضغط التفاصيل لعرضها كاملة.",
                    "Every admin action is recorded with its actor, payload, result and request context. Open Details to inspect it.",
                  )
        }
      />

      {tab === "users" ? (
        <UsersTab onSelect={(user) => navigate(`/access/users/${user.admin_user_id}`)} />
      ) : tab === "teams" ? (
        <TeamsTab onSelect={(team) => navigate(`/access/teams/${team.group_id}`)} />
      ) : tab === "policies" ? (
        <PoliciesTab
          canWrite={canWrite}
          onEdit={(policy) => setPolicyForm({ open: true, policy })}
          onAttach={setAttachPolicy}
        />
      ) : (
        <AuditTab />
      )}

      <AddUserModal open={addUserOpen} onOpenChange={setAddUserOpen} isSuper={isSuper} />
      <TeamFormModal open={teamFormOpen} onOpenChange={setTeamFormOpen} />
      <PolicyFormModal
        key={policyForm.open ? (policyForm.policy?.policy_id ?? "new-policy") : "closed"}
        open={policyForm.open}
        policy={policyForm.policy}
        isSuper={isSuper}
        onOpenChange={(open) => setPolicyForm({ open, policy: open ? policyForm.policy : null })}
      />
      <AttachPolicyModal
        open={Boolean(attachPolicy)}
        policy={attachPolicy}
        teams={groups.data?.items ?? []}
        canWrite={canWrite}
        onOpenChange={(open) => {
          if (!open) setAttachPolicy(null);
        }}
      />
    </>
  );
}

function UsersTab({ onSelect }: { onSelect: (user: IamAdminUser) => void }) {
  const t = useT();
  const columns: Column<IamAdminUser>[] = [
    {
      key: "admin",
      header: t("المستخدم", "User"),
      cell: (row) => (
        <button type="button" className="ma-link ma-link--plain" onClick={() => onSelect(row)}>
          <span className="ma-cell-main">{row.full_name || row.email}</span>
          <span className="ma-cell-sub" dir="ltr">{row.email}</span>
        </button>
      ),
    },
    {
      key: "teams",
      header: t("الفرق", "Teams"),
      cell: (row) =>
        row.groups.length ? (
          <span style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {row.groups.map((group) => (
              <Badge key={group} def={{ label: { ar: group, en: group }, tone: "info" }} />
            ))}
          </span>
        ) : (
          <span className="ma-muted">—</span>
        ),
    },
    {
      key: "scopes",
      header: t("الصلاحيات", "Scopes"),
      align: "end",
      cell: (row) => (
        <span className="ma-num">
          {row.scopes.includes("*") ? t("كل الصلاحيات", "All (*)") : row.scopes.length}
        </span>
      ),
    },
    {
      key: "boundary",
      header: t("الحدود", "Boundary"),
      cell: (row) =>
        row.boundary_policy_id ? (
          <Badge def={{ label: { ar: "محدود", en: "Bounded" }, tone: "info" }} />
        ) : (
          <span className="ma-muted">—</span>
        ),
    },
    {
      key: "status",
      header: t("الحالة", "Status"),
      cell: (row) => (
        <Badge
          def={
            row.status === "active"
              ? { label: { ar: "نشط", en: "Active" }, tone: "success" }
              : { label: { ar: "موقوف", en: "Suspended" }, tone: "warning" }
          }
        />
      ),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      cell: (row) => <Button sm label={t("إدارة", "Manage")} onClick={() => onSelect(row)} />,
    },
  ];

  return (
    <PagedList<IamAdminUser>
      queryKeyBase={[...accessKeys.all, "users"]}
      fetchPage={({ query, offset, limit }) =>
        listIamUsers({ search: query || undefined, offset, limit })
      }
      columns={columns}
      searchPlaceholder={t("ابحث بالاسم أو البريد…", "Search name or email…")}
      empty={t("لا مستخدمين مطابقين.", "No matching users.")}
    />
  );
}

function TeamsTab({ onSelect }: { onSelect: (team: AdminGroup) => void }) {
  const t = useT();
  const columns: Column<AdminGroup>[] = [
    {
      key: "team",
      header: t("الفريق", "Team"),
      cell: (row) => (
        <button type="button" className="ma-link ma-link--plain" onClick={() => onSelect(row)}>
          <span className="ma-cell-main">{row.name}</span>
          <span className="ma-cell-sub" dir="ltr">{row.code}</span>
        </button>
      ),
    },
    {
      key: "lead",
      header: t("القائد", "Lead"),
      cell: (row) => row.lead_name || <span className="ma-muted">{t("بدون قائد", "No lead")}</span>,
    },
    {
      key: "members",
      header: t("الأعضاء", "Members"),
      align: "end",
      cell: (row) => <span className="ma-num">{row.member_count}</span>,
    },
    {
      key: "policies",
      header: t("السياسات", "Policies"),
      align: "end",
      cell: (row) => <span className="ma-num">{row.policy_count}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "end",
      cell: (row) => <Button sm label={t("إدارة", "Manage")} onClick={() => onSelect(row)} />,
    },
  ];

  return (
    <PagedList<AdminGroup>
      queryKeyBase={[...accessKeys.all, "teams"]}
      fetchPage={({ query, offset, limit }) =>
        listGroups({ search: query || undefined, offset, limit })
      }
      columns={columns}
      searchPlaceholder={t("ابحث في الفرق…", "Search teams…")}
      empty={t("لا فرق بعد.", "No teams yet.")}
    />
  );
}

function PoliciesTab({
  canWrite,
  onEdit,
  onAttach,
}: {
  canWrite: boolean;
  onEdit: (policy: AdminPolicy) => void;
  onAttach: (policy: AdminPolicy) => void;
}) {
  const t = useT();
  const admin = useAdminAuth((state) => state.admin);
  const [kind, setKind] = useState<"all" | "templates" | "custom">("all");
  const heldScopes = new Set(admin?.scopes ?? []);
  const canGrant = (policy: AdminPolicy) =>
    Boolean(admin?.scopes.includes("*")) || policy.scopes.every((scope) => heldScopes.has(scope));

  const columns: Column<AdminPolicy>[] = [
    {
      key: "policy",
      header: t("السياسة", "Policy"),
      cell: (row) => (
        <span>
          <span className="ma-row" style={{ justifyContent: "flex-start", gap: 6 }}>
            <span className="ma-cell-main">{row.name}</span>
            <InfoHint label={row.name} title={row.name}>
              {row.description ? <span style={{ display: "block" }}>{row.description}</span> : null}
              <span className="ma-cell-sub" dir="ltr">{row.scopes.join(" · ")}</span>
            </InfoHint>
            {row.is_template ? (
              <Badge def={{ label: { ar: "قالب", en: "Template" }, tone: "info" }} />
            ) : null}
            {row.is_system ? (
              <Badge def={{ label: { ar: "نظام", en: "System" }, tone: "neutral" }} />
            ) : null}
          </span>
          <span className="ma-cell-sub" dir="ltr">{row.code}</span>
        </span>
      ),
    },
    {
      key: "scopes",
      header: t("الصلاحيات", "Scopes"),
      align: "end",
      cell: (row) => <span className="ma-num">{row.scopes.length}</span>,
    },
    {
      key: "attachments",
      header: t("مرات الربط", "Bindings"),
      align: "end",
      cell: (row) => <span className="ma-num">{row.attachment_count}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "end",
      cell: (row) => (
        <span className="ma-row" style={{ gap: 6, justifyContent: "flex-end" }}>
          {canWrite && row.can_manage ? (
            <Button sm label={t("تعديل", "Edit")} onClick={() => onEdit(row)} />
          ) : null}
          {canWrite ? (
            <Button
              sm
              kind="primary"
              icon="link"
              label={t("ربط", "Attach")}
              disabled={!canGrant(row)}
              title={!canGrant(row) ? t("خارج حدود صلاحياتك", "Outside your scope boundary") : undefined}
              onClick={() => onAttach(row)}
            />
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <PagedList<AdminPolicy>
      queryKeyBase={[...accessKeys.all, "policies", kind]}
      fetchPage={({ query, offset, limit }) =>
        listPolicies({
          search: query || undefined,
          offset,
          limit,
          template_only: kind === "all" ? undefined : kind === "templates",
        })
      }
      columns={columns}
      searchPlaceholder={t("ابحث في السياسات…", "Search policies…")}
      empty={t("لا سياسات مطابقة.", "No matching policies.")}
      toolbar={
        <SelectField
          label={t("النوع", "Type")}
          value={kind}
          onChange={(value) => setKind(value as typeof kind)}
          options={[
            { value: "all", label: t("الكل", "All") },
            { value: "templates", label: t("القوالب", "Templates") },
            { value: "custom", label: t("المخصصة", "Custom") },
          ]}
        />
      }
    />
  );
}


function PageHint({ text }: { text: string }) {
  const t = useT();
  return (
    <div className="ma-hintline ma-section-gap">
      <InfoHint label={t("شرح الصفحة", "About this page")} title={t("شرح الصفحة", "About this page")}>
        {text}
      </InfoHint>
      <span className="ma-muted">{t("كيف تعمل هذه الصفحة؟", "How does this page work?")}</span>
    </div>
  );
}
