import { useSearchParams } from "react-router-dom";

import { useT } from "@/lib/i18n";
import { PageHead } from "@/components/ui/kit";

import { CommissionsList, SalesList } from "./partner-detail-page";

/** Sales attributed to affiliates and the commissions they earned (computed here, paid monthly by Stripe). */
export default function AffiliateCommissionsPage() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "sales" ? "sales" : "commissions";
  const select = (next: string) => setParams((prev) => { const n = new URLSearchParams(prev); n.set("view", next); return n; }, { replace: true });
  return (
    <>
      <PageHead
        title={t("العمولات والمبيعات", "Commissions & sales")}
        sub={t(
          "تُحسب العمولة عند الدفع، وتُعتمد تلقائيًا بعد فترة الاسترداد، وتُحوَّل ضمن دفعة Stripe الشهرية. الاسترداد يلغيها أو يخصمها من التحويل التالي.",
          "A commission is computed at payment, approved automatically after the refund hold and paid in the monthly Stripe batch. A refund reverses it or takes it off the next payout.",
        )}
      />
      <nav className="ma-tabs mb-4" aria-label={t("القسم", "Section")}>
        <button type="button" aria-selected={view === "commissions"} onClick={() => select("commissions")}>{t("العمولات", "Commissions")}</button>
        <button type="button" aria-selected={view === "sales"} onClick={() => select("sales")}>{t("المبيعات", "Sales")}</button>
      </nav>
      {view === "sales" ? <SalesList /> : <CommissionsList />}
    </>
  );
}
