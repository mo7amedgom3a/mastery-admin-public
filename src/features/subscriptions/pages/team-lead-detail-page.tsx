import { useQuery } from "@tanstack/react-query";
import { Mail, Phone } from "lucide-react";
import { useParams } from "react-router-dom";

import { subscriptionQueries } from "@/lib/api";
import { formatAmount, formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { shortRef, customerHref, orderHref } from "@/lib/refs";
import { orderStatusBadge } from "@/lib/status";
import { AppLink } from "@/components/ui/app-link";
import { Alert, Badge, Card, Dl, Empty, Loading, PageHead } from "@/components/ui/kit";
import { PageState } from "@/components/ui/primitives";

import { TeamLeadStatusBadge } from "../components/team-lead-status";
import { toNumber } from "../lib";

/**
 * One company request saved before payment (`GET /admin/subscriptions/team-leads/{id}`): everything the
 * company submitted, plus the unfinished order or the subscription it became — the business team's
 * follow-up sheet for companies that never completed checkout.
 */
export default function TeamLeadDetailPage() {
  const t = useT();
  const { id = "" } = useParams<{ id: string }>();
  const detail = useQuery(subscriptionQueries.teamLead(id));
  const lead = detail.data;
  const incomplete = lead?.status === "details" || lead?.status === "checkout_started";

  return (
    <>
      <PageHead
        back={{ href: "/companies/leads", label: t("طلبات الشركات", "Company requests") }}
        title={lead?.company_name ?? t("طلب شركة", "Company request")}
        status={lead ? <TeamLeadStatusBadge status={lead.status} /> : null}
        sub={
          lead
            ? incomplete
              ? t("أدخلت الشركة بياناتها ولم تكمل الاشتراك بعد", "The company submitted its details but has not completed the subscription yet")
              : t("أكملت الشركة الاشتراك", "The company completed the subscription")
            : undefined
        }
        actions={
          lead ? (
            <>
              <a className="ma-btn ma-btn--soft ma-btn--sm" href={`mailto:${lead.email}`}>
                <Mail aria-hidden="true" className="size-4 fill-none" />
                {t("مراسلة", "Email")}
              </a>
              {lead.phone ? (
                <a className="ma-btn ma-btn--soft ma-btn--sm" href={`tel:${lead.phone}`} dir="ltr">
                  <Phone aria-hidden="true" className="size-4 fill-none" />
                  {lead.phone}
                </a>
              ) : null}
            </>
          ) : null
        }
      />

      <PageState error={detail.error}>
        {detail.isLoading ? <Loading /> : null}
        {lead ? (
          <>
            {incomplete ? (
              <Alert kind="warning" title={t("طلب لم يكتمل", "Request not completed")}>
                {lead.status === "checkout_started"
                  ? t("وصلت الشركة إلى صفحة الدفع ولم تُكمل الدفع. تواصل معها لإتمام الاشتراك.", "The company reached checkout but did not pay. Follow up to complete the subscription.")
                  : t("أدخلت الشركة بياناتها فقط ولم تبدأ الدفع. تواصل معها قبل أن تفقد الاهتمام.", "The company submitted its details only and did not start checkout. Follow up before it goes cold.")}
              </Alert>
            ) : null}

            <div className="ma-cols ma-cols--2">
              <Card title={t("الشركة والتواصل", "Company & contact")}>
                <Dl
                  rows={[
                    [t("الشركة", "Company"), lead.company_name],
                    [t("المسؤول", "Contact"), lead.contact_name],
                    [t("المسمى الوظيفي", "Job title"), lead.job_title ?? "—"],
                    [
                      t("البريد", "Email"),
                      <a key="email" className="ma-link" href={`mailto:${lead.email}`}>
                        <bdi>{lead.email}</bdi>
                      </a>,
                    ],
                    [
                      t("الجوال", "Phone"),
                      lead.phone ? (
                        <a key="phone" className="ma-link" href={`tel:${lead.phone}`} dir="ltr">
                          {lead.phone}
                        </a>
                      ) : (
                        "—"
                      ),
                    ],
                    [
                      t("حساب العميل", "Customer account"),
                      <AppLink key="customer" className="ma-link" to={customerHref(`b2c:${lead.customer_id}`)}>
                        <bdi>{lead.customer_email ?? lead.customer_id}</bdi>
                      </AppLink>,
                    ],
                  ]}
                />
              </Card>

              <Card title={t("الطلب", "Request")}>
                <Dl
                  rows={[
                    [
                      t("الباقة", "Plan"),
                      <AppLink key="plan" className="ma-link" to={`/subscriptions/plans/${lead.plan_id}`}>
                        {lead.plan_title ?? lead.plan_slug ?? "—"}
                      </AppLink>,
                    ],
                    [t("حجم الفريق المطلوب", "Requested team size"), lead.seat_count != null ? `${lead.seat_count}` : "—"],
                    [t("الحالة", "Status"), <TeamLeadStatusBadge key="status" status={lead.status} />],
                    [t("أُنشئ", "Created"), formatDateTime(lead.created_at)],
                    [t("آخر تحديث", "Last update"), formatDateTime(lead.updated_at)],
                  ]}
                />
              </Card>
            </div>

            <Card title={t("الدفع والاشتراك", "Payment & subscription")}>
              {lead.order_id ? (
                <Dl
                  rows={[
                    [
                      t("الطلب", "Order"),
                      <AppLink key="order" className="ma-link" to={orderHref(`b2c:${lead.order_id}`)}>
                        <bdi>{shortRef(`b2c:${lead.order_id}`)}</bdi>
                      </AppLink>,
                    ],
                    [t("حالة الطلب", "Order status"), <Badge key="order-status" def={orderStatusBadge(lead.order_status)} />],
                    [
                      t("الإجمالي", "Total"),
                      lead.order_total != null
                        ? formatAmount(toNumber(lead.order_total), lead.order_currency_code ?? "USD")
                        : "—",
                    ],
                    [t("بدأ الدفع", "Checkout started"), formatDateTime(lead.order_created_at)],
                    [
                      t("الاشتراك", "Subscription"),
                      lead.subscription_id ? (
                        <AppLink key="subscription" className="ma-link" to={`/subscriptions/subscribers/${lead.subscription_id}`}>
                          {lead.subscription_status ?? t("فتح الاشتراك", "Open subscription")}
                        </AppLink>
                      ) : (
                        t("لم يُنشأ بعد", "Not created yet")
                      ),
                    ],
                  ]}
                />
              ) : (
                <Empty
                  text={t(
                    "لم تبدأ الشركة الدفع بعد، لذلك لا يوجد طلب أو اشتراك مرتبط.",
                    "The company has not started checkout, so no order or subscription is linked yet.",
                  )}
                />
              )}
            </Card>
          </>
        ) : null}
      </PageState>
    </>
  );
}
