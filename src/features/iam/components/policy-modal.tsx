import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  accessKeys,
  accessQueries,
  attachAdminPolicy,
  attachGroupPolicy,
  createPolicy,
  updatePolicy,
  type AdminGroup,
  type AdminPolicy,
  type ResourceScope,
} from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Button, ErrorAlert, Field } from "@/components/ui/kit";
import { Modal } from "@/components/ui/modal";
import { SelectField } from "@/components/ui/select";
import { SearchSelect } from "@/components/ui/search-select";
import { ScopePicker } from "./scope-picker";
import { InfoHint } from "@/components/ui/info-hint";

const RESOURCE_SCOPES: { value: ResourceScope; label: string }[] = [
  { value: "all", label: "All records" },
  { value: "team", label: "Team records" },
  { value: "own", label: "Own records" },
];

export function PolicyFormModal({
  open,
  onOpenChange,
  policy,
  isSuper,
  attachToGroupId,
  attachToGroupName,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policy?: AdminPolicy | null;
  isSuper: boolean;
  /** When set, a newly created policy is attached to this team immediately. */
  attachToGroupId?: string;
  attachToGroupName?: string;
  onSaved?: () => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const catalog = useQuery({ ...accessQueries.scopes(), enabled: open });
  const [code, setCode] = useState(policy?.code ?? "");
  const [name, setName] = useState(policy?.name ?? "");
  const [description, setDescription] = useState(policy?.description ?? "");
  const [scopes, setScopes] = useState<string[]>(policy?.scopes ?? []);
  const [isTemplate, setIsTemplate] = useState(policy?.is_template ?? false);

  const save = useMutation({
    mutationFn: async () => {
      const saved = policy
        ? await updatePolicy(policy.policy_id, {
            name,
            description: description || null,
            scopes,
          })
        : await createPolicy({
            code,
            name,
            description: description || null,
            scopes,
            is_template: isSuper && isTemplate,
          });
      if (!policy && attachToGroupId) {
        await attachGroupPolicy(attachToGroupId, {
          policy_id: saved.policy_id,
          resource_scope: "all",
        });
      }
      return saved;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accessKeys.all });
      onSaved?.();
      onOpenChange(false);
    },
  });

  const valid = name.trim().length >= 2 && scopes.length > 0 && (policy || code.trim().length >= 2);
  const readOnly = Boolean(policy && !policy.can_manage);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={policy ? t("تعديل السياسة", "Edit policy") : t("سياسة جديدة", "New policy")}
      description={
        readOnly
          ? t("هذه السياسة للقراءة فقط.", "This policy is read-only.")
          : attachToGroupId && !policy
            ? t(
                `سيتم إنشاء السياسة وربطها بفريق ${attachToGroupName ?? ""} تلقائيًا.`,
                `The policy will be created and attached to ${attachToGroupName ?? "the team"} automatically.`,
              )
            : t("اختر الصلاحيات التي تمنحها السياسة.", "Choose the scopes this policy grants.")
      }
      footer={
        <>
          <Button label={t("إغلاق", "Close")} onClick={() => onOpenChange(false)} />
          {!readOnly ? (
            <Button
              type="submit"
              form="policy-form"
              kind="primary"
              icon="check"
              label={
                save.isPending
                  ? t("جارٍ الحفظ…", "Saving…")
                  : attachToGroupId && !policy
                    ? t("إنشاء وربط بالفريق", "Create & attach")
                    : t("حفظ", "Save")
              }
              disabled={!valid || save.isPending}
            />
          ) : null}
        </>
      }
    >
      <form
        id="policy-form"
        className="ma-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid && !readOnly) save.mutate();
        }}
      >
        <div className="ma-cols ma-cols--2">
          <Field
            id="policy-code"
            dir="ltr"
            label={t("الرمز", "Code")}
            value={code}
            onChange={setCode}
            required
            disabled={Boolean(policy)}
          />
          <Field id="policy-name" label={t("الاسم", "Name")} value={name} onChange={setName} required disabled={readOnly} />
        </div>
        <Field id="policy-description" label={t("الوصف", "Description")} value={description} onChange={setDescription} disabled={readOnly} />
        {isSuper && !policy ? (
          <label className="ma-check">
            <input type="checkbox" checked={isTemplate} onChange={(event) => setIsTemplate(event.target.checked)} />
            <span>{t("حفظ كقالب في المكتبة", "Save as a library template")}</span>
          </label>
        ) : null}
        <ScopePicker areas={catalog.data?.areas} value={scopes} onChange={setScopes} />
        <ErrorAlert error={save.error} title={t("تعذّر حفظ السياسة", "Couldn't save the policy")} />
      </form>
    </Modal>
  );
}

export function AttachPolicyModal({
  open,
  onOpenChange,
  policy,
  teams,
  canWrite,
  onAttached,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policy: AdminPolicy | null;
  teams: AdminGroup[];
  canWrite: boolean;
  onAttached?: () => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const directory = useQuery({ ...accessQueries.directory(), enabled: open && canWrite });
  const [targetType, setTargetType] = useState<"group" | "user">("group");
  const [targetId, setTargetId] = useState("");
  const [resourceScope, setResourceScope] = useState<ResourceScope>("all");

  const attach = useMutation({
    mutationFn: () => {
      if (!policy) throw new Error("No policy selected");
      const body = { policy_id: policy.policy_id, resource_scope: resourceScope };
      return targetType === "group"
        ? attachGroupPolicy(targetId, body)
        : attachAdminPolicy(targetId, body);
    },
    onSuccess: () => {
      setTargetId("");
      queryClient.invalidateQueries({ queryKey: accessKeys.all });
      onAttached?.();
      onOpenChange(false);
    },
  });

  const options =
    targetType === "group"
      ? [
          { value: "", label: t("اختر فريقًا", "Pick a team") },
          ...teams.map((group) => ({ value: group.group_id, label: group.name })),
        ]
      : [
          { value: "", label: t("اختر مشرفًا", "Pick an admin") },
          ...(directory.data ?? []).map((admin) => ({
            value: admin.admin_user_id,
            label: admin.full_name || admin.email,
          })),
        ];

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={t("ربط السياسة", "Attach policy")}
      description={policy ? `${policy.name} · ${policy.scopes.length} ${t("صلاحية", "scopes")}` : undefined}
      footer={
        <>
          <Button label={t("إلغاء", "Cancel")} onClick={() => onOpenChange(false)} />
          <Button
            kind="primary"
            icon="link"
            label={attach.isPending ? t("جارٍ الربط…", "Attaching…") : t("ربط", "Attach")}
            disabled={!targetId || attach.isPending || !policy}
            onClick={() => attach.mutate()}
          />
        </>
      }
    >
      <div className="ma-form">
        <div className="ma-hintline">
          <InfoHint label={t("ربط السياسة", "Attach policy")} title={t("ربط السياسة", "Attach policy")}>
            {t(
              "اربط السياسة بفريق لتمنح كل أعضائه، أو بشخص لتمنحه وحده. نطاق السجلات يحدد ما يراه من سجلات (كل السجلات / الفريق / الخاصة به).",
              "Bind a policy to a team to grant every member, or to a person to grant them alone. The record scope narrows which records they see (all / team / own).",
            )}
          </InfoHint>
          <span className="ma-muted">{t("كيف يعمل الربط؟", "How does binding work?")}</span>
        </div>
        <SelectField
          label={t("النوع", "Target type")}
          value={targetType}
          onChange={(value) => {
            setTargetType(value as "group" | "user");
            setTargetId("");
          }}
          options={[
            { value: "group", label: t("فريق", "Team") },
            { value: "user", label: t("شخص", "Person") },
          ]}
          showLabel
        />
        <SearchSelect
          label={t("الهدف", "Target")}
          value={targetId}
          onChange={setTargetId}
          options={options}
          placeholder={targetType === "group" ? t("اختر فريقًا", "Pick a team") : t("اختر مشرفًا", "Pick an admin")}
          searchPlaceholder={targetType === "group" ? t("ابحث في الفرق…", "Search teams…") : t("ابحث في المشرفين…", "Search admins…")}
          showLabel
        />
        <SelectField
          label={t("نطاق السجلات", "Record scope")}
          value={resourceScope}
          onChange={(value) => setResourceScope(value as ResourceScope)}
          options={RESOURCE_SCOPES.map((item) => ({ value: item.value, label: item.label }))}
          showLabel
        />
        <ErrorAlert error={attach.error} />
      </div>
    </Modal>
  );
}
