import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { certificateQueries, type CertificateStatus, type IssuedCertificate } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { AppLink } from "@/components/ui/app-link";
import { DataTable } from "@/components/ui/data-table";
import { Badge, Button, Card, ErrorAlert, PageHead } from "@/components/ui/kit";
import { Pagination } from "@/components/ui/primitives";
import { SelectField } from "@/components/ui/select";
import { CertificateActions, CertificateStatusBadge } from "@/features/certificates/components/certificate-actions";
import { CertificatesPage as LegacyCertificateTemplates } from "@/pages/panels";

const PAGE = 50;

/**
 * Every B2C certificate across products (search by code, email, name or title), with the same row actions as
 * a product's Certificate tab. Legacy-platform certificate templates stay available on their own tab.
 */
export function CertificatesPage() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "legacy" ? "legacy" : "issued";
  const setTab = (next: "issued" | "legacy") =>
    setParams((prev) => {
      const copy = new URLSearchParams(prev);
      if (next === "issued") copy.delete("tab");
      else copy.set("tab", next);
      return copy;
    });

  return (
    <>
      <PageHead
        title={t("الشهادات", "Certificates")}
        sub={t(
          "الشهادات الصادرة للعملاء. إعدادات كل شهادة وإصدارها من تبويب «الشهادة» في صفحة المنتج.",
          "Certificates issued to customers. Each product's certificate is set up and issued from its Certificate tab.",
        )}
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <Button sm kind={tab === "issued" ? "primary" : "soft"} label={t("الصادرة", "Issued")} onClick={() => setTab("issued")} />
            <Button
              sm
              kind={tab === "legacy" ? "primary" : "soft"}
              label={t("قوالب النظام القديم", "Legacy templates")}
              onClick={() => setTab("legacy")}
            />
          </div>
        }
      />
      {tab === "issued" ? <IssuedCertificates /> : <LegacyCertificateTemplates />}
    </>
  );
}

function IssuedCertificates() {
  const t = useT();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<CertificateStatus | "">("");
  const [offset, setOffset] = useState(0);
  const query = useQuery(
    certificateQueries.list({ q: q.trim() || undefined, status: status || undefined, limit: PAGE, offset }),
  );

  return (
    <Card flush>
      <ErrorAlert error={query.error} />
      <DataTable<IssuedCertificate>
        rows={query.data?.items ?? []}
        loading={query.isLoading}
        empty={t("لا توجد شهادات.", "No certificates.")}
        toolbar={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              className="ma-input"
              type="search"
              placeholder={t("الرمز أو البريد أو الاسم أو العنوان", "Code, email, name or title")}
              value={q}
              onChange={(event) => {
                setQ(event.target.value);
                setOffset(0);
              }}
              style={{ maxWidth: 300 }}
            />
            <SelectField
              label={t("الحالة", "Status")}
              size="md"
              value={status}
              onChange={(next) => {
                setStatus(next as CertificateStatus | "");
                setOffset(0);
              }}
              options={[
                { value: "", label: t("كل الحالات", "All statuses") },
                { value: "issued", label: t("صادرة", "Issued") },
                { value: "pending_name", label: t("بانتظار الاسم", "Waiting for name") },
                { value: "revoked", label: t("ملغاة", "Revoked") },
              ]}
            />
          </div>
        }
        columns={[
          {
            key: "recipient",
            header: t("المستلم", "Recipient"),
            cell: (row) => (
              <div>
                <bdi dir="ltr">{row.recipient_name ?? "—"}</bdi>
                <div className="ma-member__meta">
                  <bdi>{row.customer_email}</bdi>
                </div>
              </div>
            ),
            exportValue: (row) => row.recipient_name,
          },
          {
            key: "title",
            header: t("الدورة / الدبلوم", "Course / diploma"),
            cell: (row) => (
              <AppLink to={`/learning/catalog/b2c:${row.product_id}?tab=certificate`}>
                <bdi dir="ltr">{row.title}</bdi>
              </AppLink>
            ),
            exportValue: (row) => row.title,
          },
          { key: "code", header: t("الرمز", "Code"), cell: (row) => <bdi className="ma-num">{row.public_code}</bdi>, exportValue: (row) => row.public_code },
          {
            key: "status",
            header: t("الحالة", "Status"),
            cell: (row) => (
              <span style={{ display: "inline-flex", gap: 6 }}>
                <CertificateStatusBadge status={row.status} />
                {row.cpd ? <Badge def={{ label: { ar: "CPD", en: "CPD" }, tone: "info" }} /> : null}
              </span>
            ),
            exportValue: (row) => row.status,
          },
          {
            key: "source",
            header: t("المصدر", "Source"),
            cell: (row) => (row.source === "auto" ? t("تلقائي", "Automatic") : t("يدوي", "Admin")),
          },
          { key: "issued", header: t("تاريخ الإصدار", "Issued"), cell: (row) => formatDate(row.issued_at), exportValue: (row) => row.issued_at },
          {
            key: "actions",
            header: "",
            align: "end",
            exportable: false,
            cell: (row) => (
              <CertificateActions
                certificateId={row.certificate_id}
                status={row.status}
                publicCode={row.public_code}
                verifyUrl={row.verify_url}
                recipientName={row.recipient_name}
              />
            ),
          },
        ]}
        footer={
          query.data ? <Pagination total={query.data.total} limit={PAGE} offset={offset} onPage={setOffset} /> : null
        }
      />
    </Card>
  );
}
