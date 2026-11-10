import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { affiliatesKeys, listPartners, type Partner } from "@/lib/api";
import { formatDate, formatMinor, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { AppLink } from "@/components/ui/app-link";
import { Badge, Button, PageHead } from "@/components/ui/kit";
import { type Column } from "@/components/ui/data-table";
import { PagedList, type ListFilter } from "@/components/ui/paged-list";

import LegacyAffiliatesPage from "./affiliates-page";
import { connectStatusBadge, partnerStatusBadge } from "../lib/affiliates";
import { AffiliateProgramSettingsModal } from "../components/affiliate-program-settings-modal";

type View = "marketer" | "student" | "legacy";

function PartnerList({ kind }: { kind: "marketer" | "student" }) {
  const t = useT();
  const columns: Column<Partner>[] = [
    {
      key: "name", header: kind === "marketer" ? t("المسوّق", "Affiliate") : t("الطالب", "Student"), exportValue: (r) => r.email,
      cell: (r) => (
        <AppLink className="ma-link ma-link--plain" to={`/marketing/affiliates/${r.partner_id}`}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
            <span className="ma-cell-main">{r.full_name || r.email}</span>
            {r.source === "application" ? (
              <span className="ma-badge ma-badge--info" style={{ fontSize: "10px", padding: "1px 6px" }}>
                {t("من نموذج الانضمام", "Application form")}
              </span>
            ) : null}
          </div>
          <span className="ma-cell-sub"><bdi>{r.email}</bdi></span>
        </AppLink>
      ),
    },
    { key: "code", header: t("الكود", "Code"), exportValue: (r) => r.referral_code, cell: (r) => <span className="ma-num" style={{ whiteSpace: "nowrap" }}>{r.referral_code}</span> },
    { key: "customers", header: t("عملاء", "Customers"), align: "end", exportKind: "number", exportValue: (r) => r.stats.customers, cell: (r) => <span className="ma-num">{formatNumber(r.stats.customers)}</span> },
    { key: "paying", header: t("مشترون", "Buyers"), align: "end", exportKind: "number", exportValue: (r) => r.stats.paying_customers, cell: (r) => <span className="ma-num">{formatNumber(r.stats.paying_customers)}</span> },
    { key: "revenue", header: t("المبيعات", "Revenue"), align: "end", exportKind: "number", exportValue: (r) => r.stats.revenue_minor / 100, cell: (r) => <span className="ma-num">{formatMinor(r.stats.revenue_minor)}</span> },
    { key: "commission", header: t("العمولات", "Commissions"), align: "end", exportKind: "number", exportValue: (r) => (r.stats.commission_pending_minor + r.stats.commission_approved_minor + r.stats.commission_paid_minor) / 100, cell: (r) => <span className="ma-num">{formatMinor(r.stats.commission_pending_minor + r.stats.commission_approved_minor + r.stats.commission_paid_minor)}</span> },
    { key: "status", header: t("الحالة", "Status"), exportValue: (r) => r.status, cell: (r) => <Badge def={partnerStatusBadge(r.status)} /> },
    { key: "connect", header: t("التحويل", "Payouts"), exportValue: (r) => r.connect_status, cell: (r) => (r.kind === "marketer" ? <Badge def={r.payout_hold ? { label: { ar: "موقوفة", en: "On hold" }, tone: "danger" } : connectStatusBadge(r.connect_status)} /> : "—") },
    { key: "created", header: t("انضم", "Joined"), exportKind: "datetime", exportValue: (r) => r.created_at ?? null, cell: (r) => formatDate(r.created_at) },
  ];
  const filters: ListFilter[] = [
    {
      key: "status",
      label: t("كل الحالات", "All states"),
      options: [
        { value: "active", label: t("نشط", "Active") },
        { value: "pending", label: t("بانتظار التفعيل", "Pending") },
        { value: "suspended", label: t("موقوف", "Suspended") },
        { value: "rejected", label: t("مرفوض", "Rejected") },
      ],
    },
  ];
  return (
    <PagedList
      queryKeyBase={[...affiliatesKeys.all, "partners", kind]}
      fetchPage={({ query, offset, limit, filters: selected }) =>
        listPartners({ query, kind, status: (selected.status || undefined) as never, limit, offset })
      }
      columns={columns}
      searchPlaceholder={t("ابحث بالاسم أو البريد أو الكود…", "Search name, email or code…")}
      filters={filters}
      empty={kind === "marketer" ? t("لا مسوقين بعد.", "No affiliates yet.") : t("لم ينضم طلاب بعد.", "No students joined yet.")}
      exportConfig={{ filename: `affiliates-${kind}`, title: t("المسوقون", "Affiliates"), fetchSize: 200 }}
    />
  );
}

export default function PartnersPage() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const view = (params.get("view") as View | null) ?? "marketer";
  const select = (next: View) => setParams((prev) => { const n = new URLSearchParams(prev); n.set("view", next); return n; }, { replace: true });
  const canWrite = can("affiliatesWrite.manage");

  return (
    <>
      <PageHead
        title={t("المسوقون بالعمولة", "Affiliates")}
        sub={t(
          "المسوقون وطلاب برنامج الإحالة. يُفعَّل المسوّق فور تقديمه، وتُعتمد العمولات تلقائيًا بعد فترة الاسترداد وتُحوَّل عبر Stripe في أول كل شهر.",
          "Marketers and referral students. Applicants are activated at once; commissions are approved after the refund hold and paid through Stripe on the 1st of every month.",
        )}
        actions={canWrite ? (
          <>
            <Button icon="settings" label={t("إعدادات البرنامج", "Program terms")} onClick={() => setSettingsOpen(true)} />
            <Button icon="upload" label={t("استيراد من النظام القديم", "Import legacy")} href="/marketing/affiliates/import" />
            <Button kind="primary" icon="plus" label={t("إضافة مسوّق", "Add affiliate")} href="/marketing/affiliates/new" />
          </>
        ) : null}
      />
      <nav className="ma-tabs mb-4" aria-label={t("نوع الشريك", "Partner type")}>
        <button type="button" aria-selected={view === "marketer"} onClick={() => select("marketer")}>{t("المسوقون", "Marketers")}</button>
        <button type="button" aria-selected={view === "student"} onClick={() => select("student")}>{t("إحالات الطلاب", "Student referrers")}</button>
        <button type="button" aria-selected={view === "legacy"} onClick={() => select("legacy")}>{t("النظام القديم", "Legacy system")}</button>
      </nav>
      {view === "legacy" ? <LegacyAffiliatesPage embedded /> : <PartnerList key={view} kind={view} />}
      <AffiliateProgramSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
