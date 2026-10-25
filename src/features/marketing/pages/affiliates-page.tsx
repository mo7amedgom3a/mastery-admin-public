import { useMutation, useQueryClient } from "@tanstack/react-query";

import { listReferralPartners, referralsKeys, setReferralPartnerStatus, type ReferralPartner } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { badgeLabel, dateValue } from "@/lib/export/columns";
import { Badge, Button, ErrorAlert, PageHead } from "@/components/ui/kit";
import { type Column } from "@/components/ui/data-table";
import { PagedList, type ListFilter } from "@/components/ui/paged-list";
import { affiliateStatusBadge } from "@/lib/status";

/** Legacy-platform affiliates (read-mostly). `embedded` drops the page header when shown as a tab. */
export default function AffiliatesPage({ embedded = false }: { embedded?: boolean }) {
  const t = useT();
  const lang = useLang();
  const queryClient = useQueryClient();

  const approve = useMutation({
    mutationFn: (partner: ReferralPartner) => setReferralPartnerStatus(partner.legacy_affiliate_id, { status: "approved" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: referralsKeys.all }),
  });

  const columns: Column<ReferralPartner>[] = [
    { key: "name", header: t("المسوّق", "Partner"), sortable: true, exportValue: (row) => row.name, cell: (row) => (
      <span>
        <span className="ma-cell-main">{row.name}</span>
        <span className="ma-cell-sub"><bdi>{row.email}</bdi></span>
      </span>
    ) },
    { key: "code", header: t("كود الإحالة", "Referral code"), exportValue: (row) => row.referral_code || "", cell: (row) => <span className="ma-num">{row.referral_code || "—"}</span> },
    { key: "status", header: t("الحالة", "Status"), sortable: true, exportValue: (row) => badgeLabel(affiliateStatusBadge(row.status), lang), cell: (row) => <Badge def={affiliateStatusBadge(row.status)} /> },
    { key: "joined", header: t("الانضمام", "Joined"), sortable: true, sortValue: (row) => row.joined_at, exportKind: "datetime", exportValue: (row) => dateValue(row.joined_at), cell: (row) => formatDateTime(row.joined_at) },
    {
      key: "actions",
      header: "",
      exportable: false,
      align: "end",
      cell: (row) =>
        row.status === "approved" ? null : (
          <Button sm icon="check" disabled={approve.isPending} label={t("اعتماد", "Approve")} onClick={() => approve.mutate(row)} />
        ),
    },
  ];

  const filters: ListFilter[] = [
    {
      key: "status",
      label: t("كل الحالات", "All states"),
      options: [
        { value: "pending", label: t("قيد المراجعة", "Pending") },
        { value: "approved", label: t("معتمد", "Approved") },
      ],
    },
  ];

  return (
    <>
      {embedded ? null : <PageHead title={t("المسوقون بالعمولة", "Affiliates")} sub={t("شركاء الإحالة وأحوالهم.", "Referral partners and their states.")} />}
      <ErrorAlert error={approve.error} title={t("تعذّر اعتماد المسوّق", "Couldn't approve the partner")} />
      <PagedList
        queryKeyBase={["marketing", "referrals", "partners"]}
        fetchPage={({ query, offset, limit, filters: selected }) =>
          listReferralPartners({ query, status: (selected.status || undefined) as "pending" | "approved" | undefined, limit, offset })
        }
        columns={columns}
        searchPlaceholder={t("ابحث بالاسم أو البريد…", "Search name or email…")}
        filters={filters}
        empty={t("لا مسوقين.", "No partners.")}
        exportConfig={{
          filename: "affiliates",
          title: t("المسوّقون", "Affiliates"),
          pdf: true,
          fetchSize: 200,
          extraColumns: [{ key: "email", header: t("البريد", "Email"), value: (row) => row.email }],
        }}
      />
    </>
  );
}
