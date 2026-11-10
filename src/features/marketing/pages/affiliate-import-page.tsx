import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { affiliatesKeys, importLegacyAffiliates, previewLegacyAffiliates } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { Alert, Button, Card, ErrorAlert, FormActions, PageHead } from "@/components/ui/kit";

/** Legacy affiliates → B2C (keeps their codes so their links keep working). */
export default function AffiliateImportPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const [onlyApproved, setOnlyApproved] = useState(true);
  const preview = useMutation({ mutationFn: () => previewLegacyAffiliates(onlyApproved) });
  const run = useMutation({ mutationFn: () => importLegacyAffiliates(onlyApproved), onSuccess: () => { preview.mutate(); queryClient.invalidateQueries({ queryKey: affiliatesKeys.all }); } });
  return (
    <>
      <PageHead
        title={t("استيراد المسوقين القدامى", "Import legacy affiliates")}
        sub={t("ينسخهم إلى قاعدة B2C مع أكوادهم القديمة لتبقى روابطهم تعمل.", "Copies them into B2C with their old codes so their links keep working.")}
        back={{ href: "/marketing/affiliates", label: t("المسوقون", "Affiliates") }}
      />
      <Card title={t("المعاينة والاستيراد", "Preview & import")}>
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
    </>
  );
}
