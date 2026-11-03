import { PageHead } from "@/components/ui/kit";
import { useT } from "@/lib/i18n";

import { LegacyPayoutsList } from "../components/legacy-payouts-list";

/**
 * Payout requests of the legacy affiliate system (`/marketing/payouts`). Marketers on the new
 * programme are paid by Tolt from its partner portal, so there is nothing to review here for them.
 */
export default function PayoutsPage() {
  const t = useT();
  return (
    <>
      <PageHead
        title={t("طلبات الصرف — النظام القديم", "Payout requests — legacy system")}
        sub={t(
          "طلبات صرف المسوقين في النظام القديم فقط. عمولات المسوقين الجدد يعتمدها Tolt ويدفعها من بوابته.",
          "Legacy-system requests only. New marketers' commissions are approved and paid by Tolt from its portal.",
        )}
      />
      <LegacyPayoutsList />
    </>
  );
}
