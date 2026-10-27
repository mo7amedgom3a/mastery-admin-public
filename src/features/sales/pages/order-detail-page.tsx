import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  cancelOrder,
  ordersKeys,
  ordersQueries,
  type AdminOrderInvoice,
  type AdminOrderLine,
  type AdminOrderTransaction,
} from "@/lib/api";
import { formatDateTime, formatMinor } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { badgeLabel } from "@/lib/export/columns";
import { useTableExport } from "@/lib/export/use-table-export";
import type { ExportColumn } from "@/lib/export/types";
import { ExportActions } from "@/components/reports/export-actions";
import { initialsOf, orderStatusBadge, paymentStatusBadge, refundReasonLabel } from "@/lib/status";
import { AppLink } from "@/components/ui/app-link";
import { Alert, Avatar, Badge, Button, Card, Dl, Empty, ErrorAlert, Field, FormActions, Loading, PageHead } from "@/components/ui/kit";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageState } from "@/components/ui/primitives";
import { SearchBox } from "@/components/ui/paged-list";
import { SourceBadge } from "@/components/ui/source-badge";
import { customerHref, isLegacy, paymentHref, productHref, refParam, refundCaseHref, shortRef } from "@/lib/refs";
import { createRefundCase, refundCasesQueries } from "@/lib/api/sales/refund-cases";
import { useCan } from "@/lib/permissions";

export default function OrderDetailPage() {
  const t = useT();
  const lang = useLang();
  // An order ref: `b2c:<order_id>` (or a bare UUID) or `legacy:order:<id>`.
  const { id: rawId } = useParams<{ id: string }>();
  const id = refParam(rawId);
  const queryClient = useQueryClient();
  const order = useQuery(ordersQueries.detail(id));
  const canCancel = useCan("orders.write");
  const canRefund = useCan("payments.refund");

  const cancel = useMutation({
    mutationFn: () => cancelOrder(id),
    onSuccess: (data) => {
      queryClient.setQueryData(ordersKeys.detail(id), data);
      queryClient.invalidateQueries({ queryKey: ordersKeys.all });
    },
  });

  const data = order.data;
  // Legacy orders are read-only; only B2C orders can be cancelled.
  const cancellable = data && !isLegacy(data) && (data.status === "created" || data.status === "pending_payment" || data.status === "payment_failed");

  // Invoice-style document: order summary tiles + the order lines.
  const lineColumns: ExportColumn<AdminOrderLine>[] = [
    { key: "title", header: t("المنتج", "Product"), value: (row) => row.title ?? row.slug ?? shortRef(row.product_ref) },
    { key: "type", header: t("النوع", "Type"), value: (row) => row.product_type ?? "" },
    { key: "qty", header: t("الكمية", "Qty"), kind: "number", value: (row) => row.quantity },
    { key: "unit", header: t("سعر الوحدة", "Unit"), kind: "money", value: (row) => row.unit_amount_minor / 100, currency: (row) => row.currency_code },
    { key: "total", header: t("الإجمالي", "Total"), kind: "money", value: (row) => row.total_amount_minor / 100, currency: (row) => row.currency_code },
  ];
  const orderRef = shortRef(id.includes(":") ? id : `b2c:${id}`);
  const exporter = useTableExport<AdminOrderLine>(
    data
      ? {
          filename: `order-${orderRef.replace("#", "")}`,
          title: `${t("الطلب", "Order")} \u2066${orderRef}\u2069`,
          pdf: true,
          columns: lineColumns,
          getRows: async () => ({ items: data.lines ?? [], truncated: false }),
          meta: {
            filters: [data.customer_email ?? data.customer_ref ?? ""].filter(Boolean),
            summary: [
              { label: t("الحالة", "Status"), value: badgeLabel(orderStatusBadge(data.status), lang) },
              { label: t("التاريخ", "Date"), value: formatDateTime(data.created_at) },
              { label: t("الإجمالي", "Total"), value: formatMinor(data.amount_minor, data.currency_code) },
            ],
          },
        }
      : undefined,
  );

  return (
    <>
      <PageHead
        back={{ href: "/sales/orders", label: t("الطلبات", "Orders") }}
        title={<bdi>{shortRef(id.includes(":") ? id : `b2c:${id}`)}</bdi>}
        status={
          data ? (
            <>
              <Badge def={orderStatusBadge(data.status)} />
              <SourceBadge source={data.source} />
            </>
          ) : null
        }
        sub={data ? <bdi>{data.customer_email ?? data.customer_ref ?? "—"}</bdi> : undefined}
        actions={
          <>
            {data ? (
              <ExportActions onExportExcel={exporter.exportExcel} onExportPdf={exporter.exportPdf} isExportingExcel={exporter.busy === "xlsx"} isExportingPdf={exporter.busy === "pdf"} />
            ) : null}
            {cancellable && canCancel ? (
            <Button
              kind="secondary"
              icon="x"
              label={cancel.isPending ? t("جارٍ الإلغاء…", "Cancelling…") : t("إلغاء الطلب", "Cancel order")}
              disabled={cancel.isPending}
              onClick={() => cancel.mutate()}
            />
            ) : null}
          </>
        }
      />

      <ErrorAlert error={cancel.error} />

      <PageState error={order.error}>
        {data ? (
          <>
            <div className="ma-cols ma-cols--2">
              <Card title={t("ملخص الطلب", "Order summary")}>
                <Dl
                  rows={[
                    [t("الحالة", "Status"), <Badge key="s" def={orderStatusBadge(data.status)} />],
                    [t("الإجمالي", "Total"), <span className="ma-num" key="t">{formatMinor(data.amount_minor, data.currency_code)}</span>],
                    [t("حالة الدفع", "Payment status"), <Badge key="p" def={paymentStatusBadge(data.payment_status)} />],
                    [t("البوابة", "Gateway"), data.payment_provider || "—"],
                    [t("حالة التنفيذ", "Fulfilment"), data.fulfillment_status || "—"],
                    [t("الفواتير", "Invoices"), data.invoice_count],
                  ]}
                />
              </Card>
              <Card title={t("التواريخ والأطراف", "Timeline & parties")}>
                <Dl
                  rows={[
                    [
                      t("العميل", "Customer"),
                      data.customer_ref ? (
                        <AppLink key="c" className="ma-link" to={customerHref(data.customer_ref)}>
                          {data.customer_email ?? data.customer_ref}
                        </AppLink>
                      ) : (
                        "—"
                      ),
                    ],
                    [
                      t("الدفع", "Payment"),
                      data.payment_ref ? (
                        <AppLink key="pi" className="ma-link ma-num" to={paymentHref(data.payment_ref)}>
                          {t("تفاصيل الدفع", "Payment detail")}
                        </AppLink>
                      ) : (
                        "—"
                      ),
                    ],
                    [t("أُنشئ", "Created"), formatDateTime(data.created_at)],
                    [t("تاريخ الطلب", "Placed"), formatDateTime(data.placed_at)],
                    [t("معرّف الطلب", "Order id"), <bdi key="id" className="ma-num">{data.order_id ?? data.legacy_order_id ?? "—"}</bdi>],
                    ...(data.subtotal_minor != null
                      ? ([[t("قبل الضريبة", "Subtotal"), formatMinor(data.subtotal_minor, data.currency_code)]] as [string, string][])
                      : []),
                    ...(data.notes ? ([[t("ملاحظات", "Notes"), data.notes]] as [string, string][]) : []),
                  ]}
                />
              </Card>
            </div>

            <Lines lines={data.lines ?? []} />
            {canRefund && !isLegacy(data) && ["paid", "partially_refunded"].includes(data.status) ? <RefundCreator lines={data.lines ?? []} /> : null}
            {isLegacy(data) ? null : (
              <>
                <Invoices invoices={data.invoices ?? []} />
                <Transactions transactions={data.transactions ?? []} />
              </>
            )}
          </>
        ) : order.isLoading ? (
          <Loading />
        ) : (
          <Empty icon="cart" text={t("لم يُعثر على الطلب.", "Order not found.")} />
        )}
      </PageState>
    </>
  );
}

function RefundCreator({ lines }: { lines: AdminOrderLine[] }) {
  const t = useT();
  const lang = useLang();
  const [itemId, setItemId] = useState("");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [created, setCreated] = useState("");
  const selected = lines.find((line) => line.order_item_id === itemId);
  const check = useQuery({ ...refundCasesQueries.itemPreview(itemId), enabled: Boolean(itemId) });
  const remaining = check.data?.remaining_minor ?? 0;
  const amountMinor = amount === "" ? remaining : Math.round(Number(amount) * 100);
  const amountInvalid = amount !== "" && (!(amountMinor > 0) || amountMinor > remaining);
  const create = useMutation({
    mutationFn: () => createRefundCase(itemId, amountMinor, reason.trim()),
    onSuccess: (result) => {
      setCreated(result.case_id);
      setReason("");
      setAmount("");
    },
  });
  const options: [string, string][] = [
    ["", t("اختر المنتج", "Choose product")],
    ...lines
      .filter((line) => line.order_item_id)
      .map((line): [string, string] => [line.order_item_id!, `${line.title ?? line.slug ?? line.product_type} · ${formatMinor(line.total_amount_minor, line.currency_code)}`]),
  ];
  return (
    <Card title={t("بدء استرداد", "Start a refund")} className="ma-section-gap">
      <p className="ma-note">{t("اختر بندًا مدفوعًا، راجع الأهلية، ثم أنشئ طلبًا يراجعه مسؤول الاسترداد.", "Choose a paid item, review eligibility, then create a request for the refund approver.")}</p>
      <form
        className="ma-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (check.data?.eligible && reason.trim().length >= 10 && !amountInvalid) create.mutate();
        }}
      >
        <Field id="refund-item" label={t("المنتج", "Product")} value={itemId} options={options} onChange={(value) => { setItemId(value); setCreated(""); }} />
        {check.data ? (
          check.data.eligible ? (
            <Alert kind="success" title={t("مؤهل للاسترداد", "Eligible for a refund")}>
              {t("المتبقي القابل للاسترداد:", "Refundable remaining:")} <span className="ma-num">{formatMinor(remaining, selected?.currency_code ?? "USD")}</span>
            </Alert>
          ) : (
            <Alert kind="warning" title={t("غير مؤهل", "Not eligible")}>
              {check.data.reasons.map((code) => { const label = refundReasonLabel(code); return lang === "ar" ? label.ar : label.en; }).join(" · ")}
            </Alert>
          )
        ) : null}
        <ErrorAlert error={check.error} />
        {check.data?.eligible ? (
          <>
            <Field
              id="refund-amount"
              type="number"
              label={t("المبلغ", "Amount")}
              hint={amountInvalid ? t(`أدخل مبلغًا بين 0.01 و ${remaining / 100}.`, `Enter an amount between 0.01 and ${remaining / 100}.`) : t("اتركه فارغًا لاسترداد كامل المتبقي.", "Leave blank to refund everything remaining.")}
              value={amount}
              onChange={setAmount}
              min="0.01"
              max={remaining / 100}
              step="0.01"
              dir="ltr"
              aria-invalid={amountInvalid || undefined}
            />
            <Field
              id="refund-reason"
              type="textarea"
              label={t("سبب الطلب", "Reason")}
              hint={t("10 أحرف على الأقل.", "At least 10 characters.")}
              value={reason}
              onChange={setReason}
              required
              rows={3}
              maxLength={2000}
            />
            <ErrorAlert error={create.error} />
            <FormActions>
              <Button type="submit" kind="primary" label={t("إنشاء طلب", "Create request")} disabled={create.isPending || reason.trim().length < 10 || amountInvalid} />
            </FormActions>
          </>
        ) : null}
      </form>
      {created ? (
        <Alert kind="success" title={t("أُنشئ طلب الاسترداد", "Refund request created")}>
          <AppLink className="ma-link" to={refundCaseHref(created)}>{t("افتح الطلب لمراجعته", "Open the request to review it")}</AppLink>
        </Alert>
      ) : null}
    </Card>
  );
}

function Lines({ lines }: { lines: AdminOrderLine[] }) {
  const t = useT();
  const [search, setSearch] = useState("");

  const raw = lines ?? [];
  const filtered = useMemo(() => {
    if (!search) return raw;
    const q = search.toLowerCase();
    return raw.filter((r) => r.title?.toLowerCase().includes(q) || r.slug?.toLowerCase().includes(q));
  }, [raw, search]);

  const columns: Column<AdminOrderLine>[] = [
    {
      key: "title",
      header: t("المنتج", "Product"),
      cell: (row) => (
        <AppLink className="ma-cell-flex ma-link ma-link--plain" to={row.product_ref ? productHref(row.product_ref) : "/learning/courses"}>
          <Avatar
            initials={initialsOf(row.title ?? row.slug ?? "")}
            color="var(--teal)"
            square
            alt={row.title ?? ""}
          />
          <div>
            <span className="ma-cell-main">{row.title ?? row.slug ?? shortRef(row.product_ref)}</span>
            <span className="ma-cell-sub">{row.product_type}</span>
          </div>
        </AppLink>
      ),
    },
    { key: "type", header: t("النوع", "Type"), cell: (row) => row.product_type || "—" },
    { key: "qty", header: t("الكمية", "Qty"), align: "end", cell: (row) => <span className="ma-num">{row.quantity}</span> },
    { key: "unit", header: t("سعر الوحدة", "Unit"), align: "end", cell: (row) => <span className="ma-num">{formatMinor(row.unit_amount_minor, row.currency_code)}</span> },
    { key: "total", header: t("الإجمالي", "Total"), align: "end", cell: (row) => <span className="ma-num">{formatMinor(row.total_amount_minor, row.currency_code)}</span> },
  ];

  const toolbar = lines?.length > 3 ? (
    <SearchBox placeholder={t("ابحث في بنود الطلب…", "Search order lines…")} value={search} onChange={setSearch} />
  ) : undefined;

  return (
    <Card title={t("بنود الطلب", "Order lines")} className="ma-section-gap">
      <DataTable rows={filtered} columns={columns} toolbar={toolbar} exportConfig={false} empty={t("لا بنود.", "No lines.")} />
    </Card>
  );
}

function Invoices({ invoices }: { invoices: AdminOrderInvoice[] }) {
  const t = useT();
  const columns: Column<AdminOrderInvoice>[] = [
    { key: "number", header: t("الفاتورة", "Invoice"), cell: (row) => row.invoice_number || <bdi className="ma-num">{row.invoice_id.slice(0, 8)}</bdi> },
    { key: "provider", header: t("البوابة", "Provider"), cell: (row) => row.provider },
    { key: "issued", header: t("أُصدرت", "Issued"), cell: (row) => formatDateTime(row.issued_at) },
    {
      key: "file",
      header: t("الملف", "File"),
      align: "end",
      cell: (row) =>
        row.download_url || row.pdf_url ? (
          <a className="ma-link" href={(row.download_url ?? row.pdf_url) as string} target="_blank" rel="noreferrer">
            {t("تنزيل", "Download")}
          </a>
        ) : (
          "—"
        ),
    },
  ];
  return (
    <Card title={t("الفواتير", "Invoices")} className="ma-section-gap">
      <DataTable rows={invoices} columns={columns} empty={t("لا فواتير.", "No invoices.")} />
    </Card>
  );
}

function Transactions({ transactions }: { transactions: AdminOrderTransaction[] }) {
  const t = useT();
  const columns: Column<AdminOrderTransaction>[] = [
    { key: "when", header: t("الوقت", "When"), cell: (row) => formatDateTime(row.created_at) },
    { key: "event", header: t("الحدث", "Event"), cell: (row) => row.event_type },
    { key: "status", header: t("الحالة", "Status"), cell: (row) => <Badge def={paymentStatusBadge(row.status)} /> },
    { key: "provider", header: t("البوابة", "Provider"), cell: (row) => row.provider },
    { key: "amount", header: t("المبلغ", "Amount"), align: "end", cell: (row) => <span className="ma-num">{formatMinor(row.amount_minor, row.currency_code)}</span> },
    { key: "failure", header: t("ملاحظة", "Note"), cell: (row) => <span className="ma-cell-sub">{row.failure_message || row.failure_code || "—"}</span> },
  ];
  return (
    <Card title={t("حركات الدفع", "Transactions")} className="ma-section-gap">
      <DataTable rows={transactions} columns={columns} empty={t("لا حركات.", "No transactions.")} />
    </Card>
  );
}
