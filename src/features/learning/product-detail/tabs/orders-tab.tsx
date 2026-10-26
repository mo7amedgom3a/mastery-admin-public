import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ordersQueries,
  type OrderStatus,
} from "@/lib/api/sales/orders";
import { productQueries, type ProductTransactionRow } from "@/lib/api/learning/catalog";
import { formatAmount, formatDateTime, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { orderHref, customerHref, paymentHref, shortRef } from "@/lib/refs";
import { AppLink } from "@/components/ui/app-link";
import { SourceBadge } from "@/components/ui/source-badge";
import { Icon } from "@/components/ui/icon";
import { ProductStatsPanels } from "../components/product-stats-panels";

interface OrdersTabProps {
  productRef: string;
}

export function OrdersTab({ productRef }: OrdersTabProps) {
  const t = useT();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [txPage, setTxPage] = useState(1);
  const limit = 20;
  const txLimit = 10;

  // Transactions (payment attempts) on orders that contain this product
  const transactionsQuery = useQuery(
    productQueries.transactions(productRef, {
      bucket: "month",
      limit: txLimit,
      offset: (txPage - 1) * txLimit,
    }),
  );
  const transactions = transactionsQuery.data;
  const txTotal = transactions?.total ?? 0;
  const txPages = Math.max(1, Math.ceil(txTotal / txLimit));

  // Fetch orders filtered by product_ref!
  const ordersQuery = useQuery(
    ordersQueries.list({
      product_ref: productRef,
      status: statusFilter === "all" ? undefined : (statusFilter as OrderStatus),
      source: sourceFilter === "all" ? undefined : (sourceFilter as "b2c" | "legacy"),
      limit,
      offset: (page - 1) * limit,
    })
  );

  const orders = ordersQuery.data?.items ?? [];
  const totalCount = ordersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  const statusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case "paid":
      case "succeeded":
      case "fulfilled":
        return "cd-chip--ok";
      case "pending":
      case "pending_payment":
      case "created":
        return "cd-chip--warn";
      case "cancelled":
      case "failed":
      case "refunded":
        return "cd-chip--off";
      default:
        return "cd-chip--plain";
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Behaviour, orders, sales & transaction charts */}
      <ProductStatsPanels productRef={productRef} />

      {/* Orders List Card */}
      <section className="cd-card">
        <div className="cd-card__h" style={{ flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 32 }}>
            <Icon name="cart" />
            <h2 style={{ margin: 0 }}>{t("طلبات الشراء لهذا المنتج", "Purchased Orders")}</h2>
            <span className="cd-chip cd-chip--plain cd-num">{formatNumber(totalCount)}</span>
          </div>

          {/* Filters */}
          <div className="cd-toolbar">
            {/* Status Filter */}
            <select
              className="cd-input"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">{t("كل الحالات", "All statuses")}</option>
              <option value="paid">{t("مدفوع", "Paid")}</option>
              <option value="pending_payment">{t("قيد الدفع", "Pending payment")}</option>
              <option value="created">{t("تم الإنشاء", "Created")}</option>
              <option value="fulfilled">{t("مكتمل", "Fulfilled")}</option>
              <option value="cancelled">{t("ملغي", "Cancelled")}</option>
            </select>

            {/* Source Filter */}
            <select
              className="cd-input"
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">{t("كل المنصات", "All platforms")}</option>
              <option value="b2c">{t("B2C المنصة الجديدة", "B2C Modern")}</option>
              <option value="legacy">{t("Legacy القديم", "Legacy Platform")}</option>
            </select>
          </div>
        </div>

        <div className="cd-card__b cd-card__b--flush">
          {ordersQuery.isLoading ? (
            <div className="cd-empty" style={{ padding: 40 }}>
              <Icon name="clock" />
              <span>{t("جاري تحميل الطلبات...", "Loading orders...")}</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="cd-empty" style={{ padding: 40 }}>
              <Icon name="cart" />
              <strong>{t("لا توجد طلبات مطابقة", "No orders found")}</strong>
              <span>
                {t(
                  "لم يتم العثور على طلبات شراء لهذا المنتج وفقاً للفلاتر الحالية",
                  "No purchase orders found for this product matching the selected filters"
                )}
              </span>
            </div>
          ) : (
            <div className="cd-tablewrap">
              <table className="cd-table">
                <thead>
                  <tr>
                    <th>{t("رقم الطلب", "Order")}</th>
                    <th>{t("العميل / الطالب", "Customer")}</th>
                    <th>{t("تاريخ الشراء", "Date")}</th>
                    <th>{t("الحالة", "Status")}</th>
                    <th className="cd-num-col">{t("المبلغ", "Amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const amountMajor = (order.amount_minor || 0) / 100;
                    return (
                      <tr key={order.ref}>
                        <td>
                          <div className="cd-cell-stack">
                            <AppLink
                              to={orderHref(order.ref)}
                              className="cd-link cd-ltr cd-num"
                              style={{ fontWeight: 600 }}
                            >
                              {shortRef(order.ref)}
                            </AppLink>
                            <SourceBadge source={order.source} />
                          </div>
                        </td>
                        <td className="cd-wrap" title={order.customer_email ?? undefined}>
                          {order.customer_ref ? (
                            <AppLink to={customerHref(order.customer_ref)} className="cd-link">
                              {order.customer_email || shortRef(order.customer_ref)}
                            </AppLink>
                          ) : (
                            <span className="cd-muted">{order.customer_email || "—"}</span>
                          )}
                        </td>
                        <td>
                          <span className="cd-muted" style={{ fontSize: 13 }}>
                            {order.placed_at || order.created_at
                              ? formatDateTime(order.placed_at || order.created_at)
                              : "—"}
                          </span>
                        </td>
                        <td>
                          <span className={`cd-chip ${statusBadgeClass(order.status || "")}`}>
                            {order.status || "—"}
                          </span>
                        </td>
                        <td className="cd-num cd-num-col" style={{ fontWeight: 600 }}>
                          {formatAmount(amountMajor, order.currency_code || "USD")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="cd-pager">
              <span className="cd-muted" style={{ fontSize: 13 }}>
                {t(
                  `صفحة ${page} من ${totalPages}`,
                  `Page ${page} of ${totalPages}`
                )}
              </span>
              <div className="cd-pager__btns">
                <button
                  type="button"
                  className="ma-btn ma-btn--sm ma-btn--soft"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t("السابق", "Previous")}
                </button>
                <button
                  type="button"
                  className="ma-btn ma-btn--sm ma-btn--soft"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  {t("التالي", "Next")}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Transactions (payment attempts) */}
      <section className="cd-card">
        <div className="cd-card__h" style={{ flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 32 }}>
            <Icon name="card" />
            <h2 style={{ margin: 0 }}>{t("حركات الدفع لهذا المنتج", "Payment Transactions")}</h2>
            <span className="cd-chip cd-chip--plain cd-num">{formatNumber(txTotal)}</span>
          </div>
          {transactions && Object.keys(transactions.amount ?? {}).length > 0 && (
            <span className="cd-muted cd-num" style={{ fontSize: 13, marginInlineStart: "auto" }}>
              {t("الإجمالي", "Total")}:{" "}
              {Object.entries(transactions.amount)
                .map(([currency, amount]) => formatAmount(amount as number, currency))
                .join(" · ")}
            </span>
          )}
        </div>

        <div className="cd-card__b cd-card__b--flush">
          {transactionsQuery.isLoading ? (
            <div className="cd-empty" style={{ padding: 40 }}>
              <Icon name="clock" />
              <span>{t("جاري تحميل الحركات...", "Loading transactions...")}</span>
            </div>
          ) : !transactions || !transactions.items || transactions.items.length === 0 ? (
            <div className="cd-empty" style={{ padding: 40 }}>
              <Icon name="card" />
              <strong>{t("لا توجد حركات دفع", "No transactions")}</strong>
              <span>
                {t(
                  "حركات الدفع متاحة للمنتجات على منصة B2C فقط.",
                  "Payment transactions are available for B2C products only."
                )}
              </span>
            </div>
          ) : (
            <div className="cd-tablewrap">
              <table className="cd-table">
                <thead>
                  <tr>
                    <th>{t("التاريخ", "Date")}</th>
                    <th>{t("الحركة", "Transaction")}</th>
                    <th>{t("العميل", "Customer")}</th>
                    <th>{t("الحالة", "Status")}</th>
                    <th className="cd-num-col">{t("المبلغ", "Amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.items.map((tx: ProductTransactionRow) => {
                    const ref = `b2c:${tx.payment_intent_id}`;
                    return (
                      <tr key={tx.payment_attempt_id}>
                        <td>
                          <span className="cd-muted" style={{ fontSize: 13 }}>
                            {formatDateTime(tx.created_at)}
                          </span>
                        </td>
                        <td>
                          <div className="cd-cell-stack">
                            <AppLink to={paymentHref(ref)} className="cd-link cd-ltr cd-num" style={{ fontWeight: 600 }}>
                              {shortRef(ref)}
                            </AppLink>
                            <span className="cd-cell-sub">
                              {t("طلب", "Order")}
                              <AppLink to={orderHref(`b2c:${tx.order_id}`)} className="cd-link cd-ltr cd-num">
                                {shortRef(`b2c:${tx.order_id}`)}
                              </AppLink>
                              <span>
                                · {tx.provider}
                                {tx.method ? ` · ${tx.method}` : ""}
                              </span>
                            </span>
                            {tx.failure_code && <span className="cd-cell-sub">{tx.failure_code}</span>}
                          </div>
                        </td>
                        <td className="cd-wrap" title={tx.customer_email ?? undefined}>
                          {tx.customer_email ? (
                            <span className="cd-muted">{tx.customer_email}</span>
                          ) : (
                            <span className="cd-muted">—</span>
                          )}
                        </td>
                        <td>
                          <span className={`cd-chip ${statusBadgeClass(tx.status || "")}`}>
                            {tx.order_status || tx.status || "—"}
                          </span>
                        </td>
                        <td className="cd-num cd-num-col" style={{ fontWeight: 600 }}>
                          {formatAmount(tx.amount_minor / 100, tx.currency_code || "USD")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {txPages > 1 && (
            <div className="cd-pager">
              <span className="cd-muted" style={{ fontSize: 13 }}>
                {t(`صفحة ${txPage} من ${txPages}`, `Page ${txPage} of ${txPages}`)}
              </span>
              <div className="cd-pager__btns">
                <button
                  type="button"
                  className="ma-btn ma-btn--sm ma-btn--soft"
                  disabled={txPage <= 1}
                  onClick={() => setTxPage((p) => Math.max(1, p - 1))}
                >
                  {t("السابق", "Previous")}
                </button>
                <button
                  type="button"
                  className="ma-btn ma-btn--sm ma-btn--soft"
                  disabled={txPage >= txPages}
                  onClick={() => setTxPage((p) => Math.min(txPages, p + 1))}
                >
                  {t("التالي", "Next")}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
