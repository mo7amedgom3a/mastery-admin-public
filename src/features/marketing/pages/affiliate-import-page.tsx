import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { affiliatesKeys, importLegacyAffiliates, previewLegacyAffiliates, pushLegacyAffiliates } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { Alert, Button, Card, ErrorAlert, FormActions, PageHead } from "@/components/ui/kit";
import { ConfirmModal } from "@/components/ui/confirm-modal";

/** Legacy affiliates → B2C (keeps their codes), then an explicit, batched push to Tolt. */
export default function AffiliateImportPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const [onlyApproved, setOnlyApproved] = useState(true);
  const [confirmPush, setConfirmPush] = useState(false);
  const preview = useMutation({ mutationFn: () => previewLegacyAffiliates(onlyApproved) });
  const run = useMutation({ mutationFn: () => importLegacyAffiliates(onlyApproved), onSuccess: () => { preview.mutate(); queryClient.invalidateQueries({ queryKey: affiliatesKeys.all }); } });
  const push = useMutation({ mutationFn: () => pushLegacyAffiliates(50), onSuccess: () => { setConfirmPush(false); queryClient.invalidateQueries({ queryKey: affiliatesKeys.all }); } });
  return (
    <>
      <PageHead
        title={t("استيراد المسوقين القدامى", "Import legacy affiliates")}
        sub={t("ينسخهم إلى قاعدة B2C مع أكوادهم القديمة لتبقى روابطهم تعمل. الإرسال إلى Tolt خطوة منفصلة.", "Copies them into B2C with their old codes so their links keep working. Pushing to Tolt is a separate step.")}
        back={{ href: "/marketing/affiliates", label: t("المسوقون", "Affiliates") }}
      />
      <Card title={t("١. المعاينة والاستيراد", "1. Preview & import")}>
        <label className="ma-check" htmlFor="only-approved">
          <input id="only-approved" type="checkbox" checked={onlyApproved} onChange={(e) => { setOnlyApproved(e.target.checked); preview.reset(); }} />
          <span>{t("المعتمدون فقط", "Approved only")}</span>
        </label>
        <FormActions>
          <Button icon="eye" label={t("معاينة", "Preview")} disabled={preview.isPending} onClick={() => preview.mutate()} />
          {preview.data && preview.data.to_import > 0 ? (
            <Button kind="primary" icon="download" label={t(`استيراد ${formatNumber(preview.data.to_import)}`, `Import ${formatNumber(preview.data.to_import)}`)} disabled={run.isPending} onClick={() => run.mutate()} />
          ) : null}
        </FormActions>
        <ErrorAlert error={preview.error ?? run.error} title={t("تعذّر الاستيراد", "Import failed")} />
        {preview.data ? (
          <Alert kind="info" title={t(`${formatNumber(preview.data.total)} في النظام القديم · ${formatNumber(preview.data.already_imported)} مستورد · ${formatNumber(preview.data.to_import)} جديد`, `${formatNumber(preview.data.total)} legacy · ${formatNumber(preview.data.already_imported)} imported · ${formatNumber(preview.data.to_import)} new`)} />
        ) : null}
        {run.data ? <Alert kind="success" title={t(`استُورد ${run.data.imported}، تُخطي ${run.data.skipped} (بريد مكرر)`, `Imported ${run.data.imported}, skipped ${run.data.skipped} (duplicate email)`)} /> : null}
      </Card>
      <Card title={t("٢. الإرسال إلى Tolt", "2. Push to Tolt")}>
        <p className="ma-help">{t("ينشئ دفعة من 50 مسوّقًا نشطًا في Tolt بدون إرسال بريد ترحيبي. كررها حتى تنتهي.", "Creates the next 50 active imported affiliates in Tolt without a welcome email. Repeat until done.")}</p>
        <FormActions>
          <Button kind="primary" icon="send" label={t("إرسال الدفعة التالية", "Push next batch")} disabled={push.isPending} onClick={() => setConfirmPush(true)} />
        </FormActions>
        <ErrorAlert error={push.error} title={t("تعذّر الإرسال", "Push failed")} />
        {push.data ? <Alert kind={push.data.attempted ? "success" : "info"} title={push.data.attempted ? t(`أُرسل ${push.data.pushed} من ${push.data.attempted}`, `Pushed ${push.data.pushed} of ${push.data.attempted}`) : t("لا يوجد ما يُرسل.", "Nothing left to push.")} /> : null}
      </Card>
      <ConfirmModal
        open={confirmPush}
        onOpenChange={setConfirmPush}
        tone="primary"
        title={t("إرسال إلى Tolt؟", "Push to Tolt?")}
        message={t("سيُنشأ حتى 50 شريكًا في برنامج Tolt الحي.", "Up to 50 partners will be created in the live Tolt program.")}
        confirmLabel={t("إرسال", "Push")}
        loading={push.isPending}
        onConfirm={() => push.mutate()}
      />
    </>
  );
}
