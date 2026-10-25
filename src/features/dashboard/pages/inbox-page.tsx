import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { affiliatesQueries, listPaymentFailures, listReferralPayouts, listSupportTickets } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { Card, PageHead } from "@/components/ui/kit";
import { Icon } from "@/components/ui/icon";

export default function InboxPage() {
  const t = useT();

  const tickets = useQuery({ queryKey: ["dashboard", "inbox", "tickets"], queryFn: () => listSupportTickets({ limit: 1 }) });
  const payouts = useQuery({ queryKey: ["dashboard", "inbox", "payouts"], queryFn: () => listReferralPayouts({ limit: 100 }) });
  const affiliatePayouts = useQuery(affiliatesQueries.payoutsSummary());
  const failures = useQuery({ queryKey: ["dashboard", "inbox", "failures"], queryFn: () => listPaymentFailures({ limit: 1 }) });

  const pendingPayouts =
    (payouts.data?.items ?? []).filter((row) => row.status === 1).length +
    (affiliatePayouts.data ? affiliatePayouts.data.requested_count + affiliatePayouts.data.approved_count : 0);

  const items = [
    { n: tickets.data?.total ?? 0, icon: "ticket", label: t("تذاكر دعم", "Support tickets"), href: "/customers/tickets" },
    { n: pendingPayouts, icon: "card", label: t("طلبات صرف عمولات", "Payout requests"), href: "/marketing/payouts" },
    { n: failures.data?.total ?? 0, icon: "alert", label: t("مدفوعات فاشلة", "Failed payments"), href: "/sales/payments" },
  ];

  return (
    <>
      <PageHead title={t("صندوق المهام", "Ops inbox")} sub={t("ما ينتظر فريق التشغيل الآن.", "What the operations team needs to handle now.")} />
      <Card>
        <ul className="ma-list">
          {items.map((item) => (
            <li key={item.href}>
              <Icon name={item.icon} />
              <div className="ma-list__main">
                <Link className="ma-list__title" to={item.href}>
                  {item.label}
                </Link>
              </div>
              <strong className="ma-num">{formatNumber(item.n)}</strong>
              <Icon name="chevronEnd" className="ma-icon-dir" />
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
