import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { affiliatesKeys, syncAffiliates } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { Alert, Button, ErrorAlert, PageHead } from "@/components/ui/kit";

import { CommissionsList, SalesList } from "./partner-detail-page";

/** Sales attributed to affiliates and the Tolt commissions they earned (approve/decline here). */
export default function AffiliateCommissionsPage() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "sales" ? "sales" : "commissions";
  const select = (next: string) => setParams((prev) => { const n = new URLSearchParams(prev); n.set("view", next); return n; }, { replace: true });
  const queryClient = useQueryClient();
  const sync = useMutation({ mutationFn: syncAffiliates, onSuccess: () => queryClient.invalidateQueries({ queryKey: affiliatesKeys.all }) });
  return (
    <>
      <PageHead
        title={t("العمولات والمبيعات", "Commissions & sales")}
        sub={t("المبيعات تُرسل لـ Tolt تلقائيًا بعد الدفع، والعمولات تُحسب هناك وتُعرض هنا.", "Sales are sent to Tolt after payment; commissions are computed there and mirrored here.")}
        actions={can("affiliatesWrite.manage") ? <Button icon="refresh" label={sync.isPending ? t("جارٍ المزامنة…", "Syncing…") : t("مزامنة الآن", "Sync now")} disabled={sync.isPending} onClick={() => sync.mutate()} /> : null}
      />
      <ErrorAlert error={sync.error} title={t("تعذّرت المزامنة", "Sync failed")} />
      {sync.data ? (
        <Alert kind="success" title={t("تمت المزامنة", "Synced")}>
          {Object.entries(sync.data).map(([k, v]) => `${k}: ${v}`).join(" · ")}
        </Alert>
      ) : null}
      <nav className="ma-tabs mb-4" aria-label={t("القسم", "Section")}>
        <button type="button" aria-selected={view === "commissions"} onClick={() => select("commissions")}>{t("العمولات", "Commissions")}</button>
        <button type="button" aria-selected={view === "sales"} onClick={() => select("sales")}>{t("المبيعات", "Sales")}</button>
      </nav>
      {view === "sales" ? <SalesList /> : <CommissionsList />}
    </>
  );
}
