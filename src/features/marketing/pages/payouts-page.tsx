import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { affiliatesQueries } from "@/lib/api";
import { formatMinor, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { Kpi, PageHead } from "@/components/ui/kit";

import { LegacyPayoutsList } from "../components/legacy-payouts-list";
import { PayoutsList } from "../components/payouts-list";

type Source = "b2c" | "legacy";

/** Marketer payout requests: review, reject, or record a full or partial payment (`/marketing/payouts`). */
export default function PayoutsPage() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const source = (params.get("source") as Source | null) ?? "b2c";
  const select = (next: Source) =>
    setParams((prev) => { const n = new URLSearchParams(prev); n.set("source", next); return n; }, { replace: true });
  const summary = useQuery({ ...affiliatesQueries.payoutsSummary(), enabled: source === "b2c" });
  const s = summary.data;

  return (
    <>
      <PageHead
        title={t("طلبات الصرف", "Payout requests")}
        sub={t(
          "يطلب المسوّق صرف رصيده المعتمد، فتراجع الطلب وتحوّل المبلغ كاملاً أو جزءاً منه — والباقي يعود لرصيده.",
          "Marketers request their approved balance; review it and pay all or part — the rest returns to their balance.",
        )}
      />
      <nav className="ma-tabs mb-4" aria-label={t("مصدر الطلبات", "Source")}>
        <button type="button" aria-selected={source === "b2c"} onClick={() => select("b2c")}>{t("طلبات المسوقين", "Marketer requests")}</button>
        <button type="button" aria-selected={source === "legacy"} onClick={() => select("legacy")}>{t("النظام القديم", "Legacy system")}</button>
      </nav>
      {source === "legacy" ? (
        <LegacyPayoutsList />
      ) : (
        <>
          <div className="ma-kpis">
            <Kpi label={t("بانتظار المراجعة", "To review")} value={s ? formatNumber(s.requested_count) : "—"} icon="clock" />
            <Kpi label={t("معتمدة بانتظار الدفع", "Approved, to pay")} value={s ? formatNumber(s.approved_count) : "—"} icon="check" />
            <Kpi label={t("قيمة الطلبات المفتوحة", "Open requests value")} value={s ? formatMinor(s.open_minor) : "—"} icon="receipt" />
            <Kpi label={t("صُرف آخر 30 يوماً", "Paid, last 30 days")} value={s ? formatMinor(s.paid_30d_minor) : "—"} icon="card" />
          </div>
          <PayoutsList />
        </>
      )}
    </>
  );
}
