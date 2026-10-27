import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import {
  accessKeys,
  accessQueries,
  provisionIamUser,
  type AdminGroup,
  type IamAdminUser,
  type ResourceScope,
} from "@/lib/api";
import { useAdminAuth } from "@/lib/auth/store";
import { useT } from "@/lib/i18n";
import { Alert, Button, ErrorAlert, Field } from "@/components/ui/kit";
import { Modal } from "@/components/ui/modal";
import { SelectField } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { PasswordField } from "@/components/ui/password-field";
import { InfoHint } from "@/components/ui/info-hint";

const RESOURCE_SCOPES: { value: ResourceScope; label: string }[] = [
  { value: "all", label: "All records" },
  { value: "team", label: "Team records" },
  { value: "own", label: "Own records" },
];

function generatePassword(): string {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${random}Aa1!`;
}

export function AddUserModal({
  open,
  onOpenChange,
  isSuper,
  presetGroup,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSuper: boolean;
  /** When opened from a team, lock the membership to that team. */
  presetGroup?: AdminGroup | null;
  onCreated?: (user: IamAdminUser) => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const admin = useAdminAuth((state) => state.admin);
  const templates = useQuery(accessQueries.templates());
  const policies = useQuery(accessQueries.policies({ limit: 200 }));
  const teams = useQuery(accessQueries.groups({ limit: 200 }));

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [policyIds, setPolicyIds] = useState<string[]>([]);
  const [policyQuery, setPolicyQuery] = useState("");
  const [showAllPolicies, setShowAllPolicies] = useState(false);
  const [groupIds, setGroupIds] = useState<string[]>(presetGroup ? [presetGroup.group_id] : []);
  const [leadGroupIds, setLeadGroupIds] = useState<string[]>([]);
  const [resourceScope, setResourceScope] = useState<ResourceScope>("all");
  // "" = the first selected team's default boundary (or none).
  const [boundaryId, setBoundaryId] = useState("");
  const [created, setCreated] = useState<IamAdminUser | null>(null);

  const allPolicies = useMemo(() => {
    const merged = [...(templates.data ?? []), ...(policies.data?.items ?? [])];
    const unique = Array.from(new Map(merged.map((policy) => [policy.policy_id, policy])).values());
    // A team lead only sees policies inside their own scope boundary (the API enforces it too).
    if (isSuper) return unique;
    const held = new Set(admin?.scopes ?? []);
    return unique.filter((policy) => policy.scopes.every((scope) => held.has(scope)));
  }, [templates.data, policies.data, isSuper, admin?.scopes]);

  const selectedScopes = useMemo(
    () =>
      Array.from(
        new Set(
          allPolicies
            .filter((policy) => policyIds.includes(policy.policy_id))
            .flatMap((policy) => policy.scopes),
        ),
      ).sort(),
    [allPolicies, policyIds],
  );

  const teamPolicyQueries = useQueries({
    queries: groupIds.map((groupId) => accessQueries.groupPolicies(groupId)),
  });
  const inheritedPolicies = useMemo(() => {
    const map = new Map<string, { policy_id: string; policy_name: string | null }>();
    for (const query of teamPolicyQueries) {
      for (const binding of query.data ?? []) {
        map.set(binding.policy_id, {
          policy_id: binding.policy_id,
          policy_name: binding.policy_name ?? binding.policy_code ?? null,
        });
      }
    }
    return [...map.values()];
  }, [teamPolicyQueries]);

  const teamPolicyIds = useMemo(
    () => new Set(inheritedPolicies.map((policy) => policy.policy_id)),
    [inheritedPolicies],
  );
  const policyChoices = useMemo(
    () =>
      allPolicies.filter(
        (policy) =>
          showAllPolicies || policy.is_template || teamPolicyIds.has(policy.policy_id),
      ),
    [allPolicies, showAllPolicies, teamPolicyIds],
  );
  const visiblePolicies = useMemo(() => {
    const needle = policyQuery.trim().toLowerCase();
    if (!needle) return policyChoices;
    return policyChoices.filter(
      (policy) =>
        policy.name.toLowerCase().includes(needle) ||
        policy.code.toLowerCase().includes(needle),
    );
  }, [policyChoices, policyQuery]);

  const availableTeams: AdminGroup[] = presetGroup
    ? [presetGroup]
    : (teams.data?.items ?? []).filter(
        (group) => isSuper || group.lead_admin_user_id === admin?.admin_user_id,
      );

  const reset = () => {
    setEmail("");
    setFullName("");
    setPassword("");
    setPolicyIds([]);
    setPolicyQuery("");
    setShowAllPolicies(false);
    setGroupIds(presetGroup ? [presetGroup.group_id] : []);
    setLeadGroupIds([]);
    setResourceScope("all");
    setBoundaryId("");
    setCreated(null);
  };

  const create = useMutation({
    mutationFn: () =>
      provisionIamUser({
        email,
        full_name: fullName || null,
        password,
        policy_ids: policyIds,
        group_ids: groupIds,
        lead_of_group_ids: isSuper ? leadGroupIds : [],
        resource_scope: resourceScope,
        boundary_policy_id: boundaryId || null,
      }),
    onSuccess: (user) => {
      setCreated(user);
      queryClient.invalidateQueries({ queryKey: accessKeys.all });
      onCreated?.(user);
    },
  });

  const valid = email.includes("@") && password.length >= 10;

  const teamBoundaryId = availableTeams.find(
    (group) => groupIds.includes(group.group_id) && group.boundary_policy_id,
  )?.boundary_policy_id;
  const boundaryPolicy = allPolicies.find(
    (policy) => policy.policy_id === (boundaryId || teamBoundaryId),
  );
  const effectiveScopes =
    boundaryPolicy && !boundaryPolicy.scopes.includes("*")
      ? selectedScopes.filter((scope) => boundaryPolicy.scopes.includes(scope))
      : selectedScopes;

  const togglePolicy = (id: string) =>
    setPolicyIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      size="lg"
      title={created ? t("تم إنشاء المستخدم", "User created") : t("إضافة مستخدم", "Add user")}
      description={
        created
          ? t(
              "شارك بيانات الدخول مع العضو. الصلاحيات سارية فورًا.",
              "Share these credentials with the member. Access applies immediately.",
            )
          : t(
              "أنشئ حساب مشرف وامنحه صلاحيات مباشرة أو عضوية فريق — ويمكن تعيينه قائدًا للفريق.",
              "Create an admin account, grant direct policies or team membership, and optionally make them a team lead.",
            )
      }
      footer={
        created ? (
          <>
            <Button kind="primary" icon="check" label={t("تم", "Done")} onClick={() => { reset(); onOpenChange(false); }} />
          </>
        ) : (
          <>
            <Button label={t("إلغاء", "Cancel")} onClick={() => onOpenChange(false)} />
            <Button
              type="submit"
              form="add-user-form"
              kind="primary"
              icon="plus"
              label={create.isPending ? t("جارٍ الإنشاء…", "Creating…") : t("إنشاء المستخدم", "Create user")}
              disabled={!valid || create.isPending}
            />
          </>
        )
      }
    >
      {created ? (
        <div className="ma-stack">
          <Alert kind="success" title={t("بيانات الدخول", "Sign-in details")}>
            <dl className="ma-dl">
              <dt>{t("البريد", "Email")}</dt>
              <dd dir="ltr">{created.email}</dd>
              <dt>{t("كلمة المرور", "Password")}</dt>
              <dd dir="ltr">{password}</dd>
            </dl>
          </Alert>
          <div>
            <h3 className="ma-subhead">{t("الصلاحيات الفعلية", "Effective scopes")}</h3>
            {created.scopes.length ? (
              <div className="ma-wrap" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {created.scopes.sort().map((scope) => (
                  <code key={scope} className="ma-badge ma-badge--neutral" dir="ltr">{scope}</code>
                ))}
              </div>
            ) : (
              <p className="ma-muted">{t("لا صلاحيات بعد.", "No scopes yet.")}</p>
            )}
            {created.groups.length ? (
              <p className="ma-muted">
                {t("الفرق", "Teams")}: {created.groups.join(", ")}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <form
          id="add-user-form"
          className="ma-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) create.mutate();
          }}
        >
          <div className="ma-cols ma-cols--2">
            <Field id="add-user-email" type="email" dir="ltr" label={t("البريد الإلكتروني", "Email")} value={email} onChange={setEmail} required autoComplete="off" />
            <Field id="add-user-name" label={t("الاسم الكامل", "Full name")} value={fullName} onChange={setFullName} />
          </div>
          <div className="ma-field-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <PasswordField
                id="add-user-password"
                label={t("كلمة المرور", "Password")}
                hint={t("10 أحرف على الأقل.", "At least 10 characters.")}
                value={password}
                onChange={setPassword}
                required
              />
            </div>
            <Button icon="refresh" label={t("توليد", "Generate")} onClick={() => setPassword(generatePassword())} />
          </div>

          <fieldset>
            <legend className="ma-label">
              <span className="ma-row" style={{ justifyContent: "flex-start", gap: 6 }}>
                {t("الفرق", "Teams")}
                <InfoHint label={t("الفرق", "Teams")} title={t("الفرق", "Teams")}>
                  {t(
                    "عضوية الفريق تمنح سياسات الفريق. قائد الفريق يمكنه إدارة فريقه فقط.",
                    "Team membership grants the team's policies. A team lead manages only their own team.",
                  )}
                </InfoHint>
              </span>
            </legend>
            {presetGroup ? (
              <p className="ma-muted">
                {t("سيُضاف إلى", "Will be added to")}: <strong>{presetGroup.name}</strong>
              </p>
            ) : (
              <MultiSelect
                label={t("اختر الفرق", "Select teams")}
                options={availableTeams.map((group) => ({ value: group.group_id, label: group.name }))}
                selected={groupIds}
                onChange={(next) => {
                  setGroupIds(next);
                  setLeadGroupIds((current) => current.filter((id) => next.includes(id)));
                }}
                searchPlaceholder={t("ابحث في الفرق…", "Search teams…")}
              />
            )}
          </fieldset>

          {groupIds.length ? (
            <div className="ma-field">
              <span className="ma-label">{t("سياسات الفريق الموروثة", "Inherited team policies")}</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {inheritedPolicies.length ? (
                  inheritedPolicies.map((policy) => (
                    <code key={policy.policy_id} className="ma-badge ma-badge--neutral">
                      {policy.policy_name}
                    </code>
                  ))
                ) : (
                  <span className="ma-muted">{t("لا سياسات على هذه الفرق بعد.", "These teams have no policies yet.")}</span>
                )}
              </div>
              <div className="ma-hintline">
                <InfoHint label={t("سياسات الفريق", "Team policies")} title={t("سياسات الفريق", "Team policies")}>
                  {t(
                    "أي سياسة مربوطة بالفريق تُمنح تلقائيًا لكل أعضائه. أضف سياسات مباشرة أدناه إذا احتاج الشخص صلاحيات إضافية.",
                    "Every policy attached to the team is granted to all members automatically. Add direct policies below if this person needs extra access.",
                  )}
                </InfoHint>
                <span className="ma-muted">{t("كيف تُمنح صلاحيات الفريق؟", "How are team policies granted?")}</span>
              </div>
            </div>
          ) : null}

          {isSuper && groupIds.length ? (
            <>
            <SelectField
              label={t("تعيين قائد فريق", "Make team lead")}
              value={leadGroupIds[0] ?? ""}
              onChange={(value) => setLeadGroupIds(value ? [value] : [])}
              options={[
                { value: "", label: t("ليس قائد فريق", "Not a team lead") },
                ...groupIds
                  .map((id) => availableTeams.find((group) => group.group_id === id))
                  .filter((group): group is AdminGroup => Boolean(group))
                  .map((group) => ({ value: group.group_id, label: group.name })),
              ]}
              showLabel
            />
            <div className="ma-hintline">
              <InfoHint label={t("قائد الفريق", "Team lead")} title={t("قائد الفريق", "Team lead")}>
                {t(
                  "القائد يدير أعضاء فريقه وسياساته، لكنه لا يمنح صلاحيات أوسع من صلاحياته.",
                  "A lead manages their team's members and policies, but cannot grant more access than they hold.",
                )}
              </InfoHint>
              <span className="ma-muted">{t("ما دور قائد الفريق؟", "What can a team lead do?")}</span>
            </div>
            </>
          ) : null}

          <fieldset>
            <legend className="ma-label">
              <span className="ma-row" style={{ justifyContent: "flex-start", gap: 6 }}>
                {t("السياسات المباشرة", "Direct policies")}
                <InfoHint label={t("السياسات المباشرة", "Direct policies")} title={t("السياسات المباشرة", "Direct policies")}>
                  {t(
                    "تُعرض القوالب وسياسات الفرق المختارة فقط. عند اختيار أكثر من فريق تُدمج سياساتها. السياسات المباشرة تُمنح للشخص وحده.",
                    "Only templates and the selected teams' policies are listed. Multiple teams are combined. Direct policies apply to this person alone.",
                  )}
                </InfoHint>
              </span>
            </legend>
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
            <input
              className="ma-input"
              type="search"
              value={policyQuery}
              placeholder={t("ابحث في السياسات بالاسم أو الرمز…", "Search policies by name or code…")}
              aria-label={t("بحث في السياسات", "Search policies")}
              onChange={(event) => setPolicyQuery(event.target.value)}
            />
            {visiblePolicies.length ? (
              <div className="ma-stack" style={{ maxHeight: 240, overflow: "auto", paddingInlineEnd: 4 }}>
                {visiblePolicies.map((policy) => (
                  <div key={policy.policy_id} className="ma-row" style={{ justifyContent: "flex-start", gap: 8 }}>
                    <label className="ma-check" style={{ flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={policyIds.includes(policy.policy_id)}
                        onChange={() => togglePolicy(policy.policy_id)}
                      />
                      <span>
                        {policy.name}
                        {policy.is_template ? (
                          <span className="ma-badge ma-badge--info" style={{ marginInlineStart: 6 }}>
                            {t("قالب", "Template")}
                          </span>
                        ) : null}
                        <span className="ma-cell-sub">
                          {policy.scopes.length} {t("صلاحية", "scopes")} · {policy.code}
                        </span>
                      </span>
                    </label>
                    <InfoHint label={policy.name} title={policy.name}>
                      {policy.description ? <span style={{ display: "block" }}>{policy.description}</span> : null}
                      <span className="ma-cell-sub" dir="ltr">{policy.scopes.join(" · ")}</span>
                    </InfoHint>
                  </div>
                ))}
              </div>
            ) : (
              <p className="ma-muted">
                {allPolicies.length
                  ? t("لا سياسات مطابقة.", "No matching policies.")
                  : t("لا سياسات متاحة.", "No policies available.")}
              </p>
            )}
          </fieldset>

          <div>
            <SelectField
              label={t("نطاق السجلات لهذه الصلاحيات", "Record scope for these policies")}
              value={resourceScope}
              onChange={(value) => setResourceScope(value as ResourceScope)}
              options={RESOURCE_SCOPES.map((item) => ({ value: item.value, label: item.label }))}
              showLabel
            />
            <div className="ma-hintline">
              <InfoHint label={t("نطاق السجلات", "Record scope")} title={t("نطاق السجلات", "Record scope")}>
                {t(
                  "all: كل السجلات، team: سجلات أعضاء فرق المستخدم، own: السجلات التي أنشأها هو فقط.",
                  "all: every record; team: records owned by the user's team members; own: only records the user created.",
                )}
              </InfoHint>
              <span className="ma-muted">{t("ماذا يعني نطاق السجلات؟", "What does record scope mean?")}</span>
            </div>
          </div>

          <div>
            <SelectField
              label={t("حدود الصلاحيات", "Permission boundary")}
              value={boundaryId}
              onChange={setBoundaryId}
              options={[
                {
                  value: "",
                  label: teamBoundaryId
                    ? t("حدود الفريق الافتراضية", "Team default boundary")
                    : t("بدون حدود", "No boundary"),
                },
                ...allPolicies.map((policy) => ({ value: policy.policy_id, label: policy.name })),
              ]}
              showLabel
            />
            <div className="ma-hintline">
              <InfoHint label={t("حدود الصلاحيات", "Permission boundary")} title={t("حدود الصلاحيات", "Permission boundary")}>
                {t(
                  "سقف لصلاحيات المستخدم: لا يحصل إلا على ما يقع داخل سياسة الحدود، مهما رُبط به لاحقًا من سياسات أو فرق.",
                  "A ceiling on the user's access: they only get what lies inside the boundary policy, whatever policies or teams are attached later.",
                )}
              </InfoHint>
              <span className="ma-muted">
                {boundaryPolicy
                  ? t(`محدود بـ ${boundaryPolicy.name}`, `Capped by ${boundaryPolicy.name}`)
                  : t("ما هي حدود الصلاحيات؟", "What is a permission boundary?")}
              </span>
            </div>
          </div>

          <p className="ma-muted">
            {t("الصلاحيات الفعلية", "Effective scopes")}: <strong>{effectiveScopes.length}</strong>
            {effectiveScopes.length < selectedScopes.length
              ? ` (${t("تحجب الحدود", "boundary blocks")} ${selectedScopes.length - effectiveScopes.length})`
              : ""}
          </p>

          <ErrorAlert error={create.error} title={t("تعذّر إنشاء المستخدم", "Couldn't create the user")} />
        </form>
      )}
    </Modal>
  );
}
