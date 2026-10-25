import { useQuery } from "@tanstack/react-query";

import { TEAM_LEAD_STATUSES, listTeamLeads, subscriptionKeys, subscriptionQueries, type TeamLeadRow } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { AppLink } from "@/components/ui/app-link";
import { PageHead } from "@/components/ui/kit";
import type { Column } from "@/components/ui/data-table";
import { PagedList } from "@/components/ui/paged-list";

import { TEAM_LEAD_STATUS, planTitle } from "../lib";
import { TeamLeadStatusBadge } from "../components/team-lead-status";

/**
 * Companies that filled in the first step of a team checkout (`GET /admin/subscriptions/team-leads`), whether
 * or not they paid: the business team's follow-up list.
 */
export default function TeamLeadsPage() {
  const t = useT();
  const lang = useLang();
  const plans = useQuery(subscriptionQueries.plans({ lang, audience_type: "company" }));

  const columns: Column<TeamLeadRow>[] = [
    {
      key: "company",
      header: t("الشركة", "Company"),
      exportValue: (r) => r.company_name,
      cell: (r) => (
        <AppLink className="ma-link ma-link--plain" to={`/companies/leads/${r.lead_id}`}>
          <span className="ma-cell-main">{r.company_name}</span>
          <span className="ma-cell-sub">{r.contact_name}{r.job_title ? ` · ${r.job_title}` : ""}</span>
        </AppLink>
      ),
    },
    {
      key: "contact",
      header: t("التواصل", "Contact"),
      exportValue: (r) => [r.email, r.phone].filter(Boolean).join(" / "),
      cell: (r) => (
        <span>
          <a className="ma-link ma-cell-main" href={`mailto:${r.email}`}><bdi>{r.email}</bdi></a>
          {r.phone ? <a className="ma-link ma-cell-sub" href={`tel:${r.phone}`}><bdi>{r.phone}</bdi></a> : null}
        </span>
      ),
    },
    {
      key: "plan",
      header: t("الباقة", "Plan"),
      exportValue: (r) => r.plan_title ?? r.plan_slug ?? "",
      cell: (r) => (
        <AppLink className="ma-link ma-link--plain" to={`/subscriptions/plans/${r.plan_id}`}>
          <span className="ma-cell-main">{r.plan_title ?? r.plan_slug}</span>
        </AppLink>
      ),
    },
    {
      key: "seats", header: t("الموظفون", "Employees"), align: "end", exportKind: "number",
      exportValue: (r) => r.seat_count ?? "",
      cell: (r) => <span className="ma-num">{r.seat_count ?? "—"}</span>,
    },
    {
      key: "status", header: t("الحالة", "Status"), exportValue: (r) => r.status,
      cell: (r) => {
        return r.subscription_id ? (
          <AppLink to={`/subscriptions/subscribers/${r.subscription_id}`}><TeamLeadStatusBadge status={r.status} /></AppLink>
        ) : (
          <TeamLeadStatusBadge status={r.status} />
        );
      },
    },
    {
      key: "created", header: t("التاريخ", "Date"), exportValue: (r) => r.created_at ?? "",
      cell: (r) => <span className="ma-cell-sub">{r.created_at ? formatDateTime(r.created_at) : "—"}</span>,
    },
    {
      key: "details", header: "",
      cell: (r) => (
        <AppLink className="ma-link" to={`/companies/leads/${r.lead_id}`}>
          {t("التفاصيل", "Details")}
        </AppLink>
      ),
    },
  ];

  return (
    <>
      <PageHead
        title={t("طلبات الشركات", "Company leads")}
        sub={t(
          "الشركات التي أدخلت بياناتها في خطوة الاشتراك الأولى، اشتركت أم لا. تواصل مع من لم يكمل الدفع.",
          "Companies that filled in the first step of a team checkout, whether or not they paid. Follow up with those who didn't finish.",
        )}
        actions={<AppLink className="ma-btn ma-btn--soft ma-btn--sm" to="/companies/insights">{t("مؤشرات الشركات", "Company insights")}</AppLink>}
      />
      <PagedList
        queryKeyBase={subscriptionKeys.teamLeads()}
        fetchPage={({ query, offset, limit, filters }) =>
          listTeamLeads({
            query,
            offset,
            limit,
            status: (filters.status || undefined) as TeamLeadRow["status"] | undefined,
            plan_id: filters.plan_id || undefined,
          })
        }
        columns={columns}
        searchPlaceholder={t("ابحث بالشركة أو الاسم أو البريد أو الجوال…", "Search company, name, email or phone…")}
        filters={[
          {
            key: "status",
            label: t("كل الحالات", "All statuses"),
            options: TEAM_LEAD_STATUSES.map((s) => ({ value: s, label: t(TEAM_LEAD_STATUS[s].label.ar, TEAM_LEAD_STATUS[s].label.en) })),
          },
          {
            key: "plan_id",
            label: t("كل الباقات", "All plans"),
            options: (plans.data ?? []).map((p) => ({ value: p.plan_id, label: planTitle(p, lang) })),
          },
        ]}
        empty={t("لا توجد طلبات بعد.", "No leads yet.")}
        exportConfig={{ filename: "company-leads", title: t("طلبات الشركات", "Company leads"), pdf: true, fetchSize: 200 }}
      />
    </>
  );
}
