import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { accessKeys, accessQueries, createGroup } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Button, ErrorAlert, Field } from "@/components/ui/kit";
import { Modal } from "@/components/ui/modal";
import { SelectField } from "@/components/ui/select";
import { InfoHint } from "@/components/ui/info-hint";

/** Create-team action. Team management itself lives on `/access/teams/:groupId`. */
export function TeamFormModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const directory = useQuery({ ...accessQueries.directory(), enabled: open });
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [leadId, setLeadId] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createGroup({
        code,
        name,
        description: description || null,
        lead_admin_user_id: leadId || null,
      }),
    onSuccess: () => {
      setCode("");
      setName("");
      setDescription("");
      setLeadId("");
      queryClient.invalidateQueries({ queryKey: accessKeys.all });
      onCreated?.();
      onOpenChange(false);
    },
  });

  const valid = code.trim().length >= 2 && name.trim().length >= 2;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={t("فريق جديد", "New team")}
      description={t(
        "الفريق يجمع المشرفين والسياسات. قائد الفريق يدير أعضاءه وسياساته.",
        "A team groups admins and policies. Its lead manages members and bindings.",
      )}
      footer={
        <>
          <Button label={t("إلغاء", "Cancel")} onClick={() => onOpenChange(false)} />
          <Button
            type="submit"
            form="team-form"
            kind="primary"
            icon="plus"
            label={create.isPending ? t("جارٍ الإنشاء…", "Creating…") : t("إنشاء فريق", "Create team")}
            disabled={!valid || create.isPending}
          />
        </>
      }
    >
      <form
        id="team-form"
        className="ma-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) create.mutate();
        }}
      >
        <Field id="team-code" dir="ltr" label={t("الرمز", "Code")} value={code} onChange={setCode} hint={t("مثال: sales", "e.g. sales")} required />
        <Field id="team-name" label={t("الاسم", "Name")} value={name} onChange={setName} required />
        <Field id="team-description" label={t("الوصف", "Description")} value={description} onChange={setDescription} />
        <SelectField
          label={t("قائد الفريق (اختياري)", "Team lead (optional)")}
          value={leadId}
          onChange={setLeadId}
          options={[
            { value: "", label: t("بدون قائد", "No lead") },
            ...(directory.data ?? []).map((admin) => ({
              value: admin.admin_user_id,
              label: admin.full_name || admin.email,
            })),
          ]}
          showLabel
        />
        <div className="ma-hintline">
          <InfoHint label={t("قائد الفريق", "Team lead")} title={t("قائد الفريق", "Team lead")}>
            {t(
              "القائد يستطيع إضافة أعضاء وربط السياسات داخل حدود صلاحياته فقط. تعيين القائد نفسه يحتاج مديرًا أعلى.",
              "A lead can add members and bind policies only inside their own boundary. Appointing a lead needs a super admin.",
            )}
          </InfoHint>
          <span className="ma-muted">{t("ما دور قائد الفريق؟", "What can a team lead do?")}</span>
        </div>
        <ErrorAlert error={create.error} title={t("تعذّر إنشاء الفريق", "Couldn't create the team")} />
      </form>
    </Modal>
  );
}
