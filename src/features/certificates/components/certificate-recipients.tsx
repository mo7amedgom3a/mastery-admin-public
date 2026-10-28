import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  certificateKeys,
  certificateQueries,
  issueCertificates,
  type CertificateRecipient,
  type IssueCertificatesResult,
} from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useCan } from "@/lib/permissions";
import { toast } from "@/components/ui/toast";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { DataTable } from "@/components/ui/data-table";
import { Badge, Button, Card, ErrorAlert } from "@/components/ui/kit";
import { Pagination } from "@/components/ui/primitives";
import { CertificateActions, CertificateStatusBadge } from "@/features/certificates/components/certificate-actions";

const PAGE = 50;

/**
 * Enrolled customers of a product (active entitlement, or a paid seat in a live-diploma cohort) and their
 * certificate. Admins issue to the selected customers or to everyone who doesn't have one yet.
 */
export function CertificateRecipients({
  productRef,
  productId,
  isLiveDiploma,
}: {
  productRef: string;
  productId: string;
  isLiveDiploma: boolean;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const canIssue = useCan("certificates.issue");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmAll, setConfirmAll] = useState(false);
  const params = { q: q.trim() || undefined, limit: PAGE, offset };
  const recipients = useQuery(certificateQueries.recipients(productRef, params));
  const rows = recipients.data?.items ?? [];
  const selectable = rows.filter((row) => !row.certificate_id);

  const issue = useMutation({
    mutationFn: (customerIds: string[] | null) =>
      issueCertificates(
        customerIds
          ? { product_id: productId, customer_ids: customerIds, all_eligible: false }
          : { product_id: productId, all_eligible: true },
      ),
    onSuccess: (result) => {
      setSelected(new Set());
      setConfirmAll(false);
      announce(result);
      queryClient.invalidateQueries({ queryKey: certificateKeys.all });
    },
  });

  function announce(result: IssueCertificatesResult) {
    const parts = [
      t(`صدرت ${result.issued}`, `${result.issued} issued`),
      result.pending_name ? t(`${result.pending_name} بانتظار الاسم بالإنجليزية`, `${result.pending_name} waiting for an English name`) : null,
      result.skipped ? t(`${result.skipped} تم تخطيها`, `${result.skipped} skipped`) : null,
      result.errors ? t(`${result.errors} فشلت`, `${result.errors} failed`) : null,
    ].filter(Boolean);
    (result.errors ? toast.error : toast.success)(t("نتيجة الإصدار", "Issue result"), parts.join(" · "));
  }

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const allOnPage = selectable.length > 0 && selectable.every((row) => selected.has(row.customer_id));

  return (
    <Card
      title={t("المستلمون", "Recipients")}
      className="ma-section-gap"
      actions={
        canIssue ? (
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              sm
              kind="primary"
              icon="award"
              label={t(`إصدار للمحدد (${selected.size})`, `Issue to selected (${selected.size})`)}
              disabled={selected.size === 0 || issue.isPending}
              onClick={() => issue.mutate([...selected])}
            />
            <Button
              sm
              kind="soft"
              label={t("إصدار للجميع المؤهلين", "Issue to all eligible")}
              disabled={issue.isPending}
              onClick={() => setConfirmAll(true)}
            />
          </div>
        ) : null
      }
    >
      <ErrorAlert error={recipients.error ?? issue.error} />
      <DataTable<CertificateRecipient>
        rows={rows}
        loading={recipients.isLoading}
        exportConfig={false}
        empty={t("لا يوجد عملاء لديهم وصول نشط.", "No customers with active access.")}
        toolbar={
          <input
            className="ma-input"
            type="search"
            placeholder={t("ابحث بالبريد أو الاسم", "Search email or name")}
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              setOffset(0);
            }}
            style={{ maxWidth: 280 }}
          />
        }
        columns={[
          ...(canIssue
            ? [
                {
                  key: "select",
                  header: "",
                  width: "36px",
                  cell: (row: CertificateRecipient) =>
                    row.certificate_id ? null : (
                      <Checkbox
                        aria-label={t("تحديد", "Select")}
                        checked={selected.has(row.customer_id)}
                        onCheckedChange={(on) => toggle(row.customer_id, on === true)}
                      />
                    ),
                },
              ]
            : []),
          {
            key: "customer",
            header: t("العميل", "Customer"),
            cell: (row) => (
              <div>
                <div>{row.full_name ?? "—"}</div>
                <bdi className="ma-member__meta">{row.email}</bdi>
              </div>
            ),
          },
          {
            key: "name",
            header: t("الاسم على الشهادة", "Name on certificate"),
            cell: (row) =>
              row.certificate_name ? (
                <bdi dir="ltr">{row.certificate_name}</bdi>
              ) : (
                <span className="ma-member__meta">{t("غير محدد", "Not set")}</span>
              ),
          },
          ...(isLiveDiploma
            ? [
                {
                  key: "access",
                  header: t("الوصول", "Access"),
                  cell: (row: CertificateRecipient) =>
                    row.cohort_id ? t("مقعد في دفعة", "Cohort seat") : t("اشتراك", "Entitlement"),
                },
              ]
            : []),
          {
            key: "status",
            header: t("الشهادة", "Certificate"),
            cell: (row) =>
              row.certificate_status ? (
                <CertificateStatusBadge status={row.certificate_status} />
              ) : (
                <Badge def={{ label: { ar: "لم تصدر", en: "Not issued" }, tone: "neutral" }} />
              ),
          },
          {
            key: "code",
            header: t("الرمز", "Code"),
            cell: (row) => (row.public_code ? <bdi className="ma-num">{row.public_code}</bdi> : "—"),
          },
          {
            key: "actions",
            header: "",
            align: "end",
            cell: (row) =>
              row.certificate_id ? (
                <CertificateActions
                  certificateId={row.certificate_id}
                  status={row.certificate_status ?? ""}
                  publicCode={row.public_code}
                  recipientName={row.certificate_name ?? row.full_name}
                />
              ) : canIssue ? (
                <Button sm kind="ghost" label={t("إصدار", "Issue")} disabled={issue.isPending} onClick={() => issue.mutate([row.customer_id])} />
              ) : null,
          },
        ]}
        footer={
          recipients.data ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              {canIssue && selectable.length ? (
                <label className="ma-check">
                  <Checkbox
                    checked={allOnPage}
                    onCheckedChange={(on) => selectable.forEach((row) => toggle(row.customer_id, on === true))}
                  />
                  <span>{t("تحديد كل من لم تصدر له شهادة في هذه الصفحة", "Select everyone on this page without a certificate")}</span>
                </label>
              ) : (
                <span />
              )}
              <Pagination total={recipients.data.total} limit={PAGE} offset={offset} onPage={setOffset} />
            </div>
          ) : null
        }
      />
      <ConfirmModal
        open={confirmAll}
        onOpenChange={setConfirmAll}
        tone="warning"
        title={t("إصدار للجميع المؤهلين", "Issue to all eligible")}
        message={t(
          "ستصدر شهادة لكل عميل لديه وصول نشط ولم تصدر له شهادة بعد، وسيصله بريد بالشهادة.",
          "Every customer with active access and no certificate yet gets one, and an email with the PDF.",
        )}
        confirmLabel={t("إصدار", "Issue")}
        loading={issue.isPending}
        onConfirm={() => issue.mutate(null)}
      />
    </Card>
  );
}
