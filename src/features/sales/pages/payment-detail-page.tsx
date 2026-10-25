import { useParams } from "react-router-dom";

import { useT } from "@/lib/i18n";
import { refParam } from "@/lib/refs";
import { Card, PageHead } from "@/components/ui/kit";
import { PaymentIntentDetail } from "@/components/payments/payment-intent-detail";

export default function PaymentDetailPage() {
  const t = useT();
  const { id: rawId } = useParams<{ id: string }>();
  const id = refParam(rawId);

  return (
    <>
      <PageHead
        back={{ href: "/sales/payments", label: t("المدفوعات", "Payments") }}
        title={t("تفاصيل الدفع", "Payment details")}
        sub={<bdi className="ma-num">{id}</bdi>}
      />
      <Card>
        <PaymentIntentDetail paymentIntentId={id} />
      </Card>
    </>
  );
}
