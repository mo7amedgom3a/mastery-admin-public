import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  customersKeys,
  customersQueries,
  setCustomerStatus,
  updateCustomer,
  type AdminCustomerUpdateRequest,
  type AdminEntitlementRef,
  type AdminOrderRef,
} from "@/lib/api";
import { formatDateTime, formatMinor, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { customerStatusBadge, entitlementStatusBadge, orderStatusBadge, paymentStatusBadge } from "@/lib/status";
import { AppLink } from "@/components/ui/app-link";
import { Badge, Button, Card, Dl, Empty, ErrorAlert, Field, FormActions, Kpi, Loading, PageHead } from "@/components/ui/kit";
import { DataTable, type Column } from "@/components/ui/data-table";
import { PageState } from "@/components/ui/primitives";
import { SearchBox } from "@/components/ui/paged-list";
import { SelectField } from "@/components/ui/select";
import { SourceBadge } from "@/components/ui/source-badge";
import { can } from "@/lib/permissions";
import { isLegacy, productHref } from "@/lib/refs";
import { CustomerEntitlementsCard } from "@/features/entitlements/components/entitlement-lists";
import { CustomerSubscriptionsCard } from "@/features/subscriptions/components/customer-subscriptions-card";
import {
  CustomerAvatarCard,
  CustomerGrantsCard,
  CustomerHistoryCard,
  CustomerNotesCard,
} from "@/features/customers/components/customer-management";
import { CustomerReferralsCard } from "@/features/customers/components/customer-referrals-card";

const STATUS_OPTIONS: { value: string; ar: string; en: string }[] = [
  { value: "active", ar: "تفعيل", en: "Activate" },
  { value: "suspended", ar: "إيقاف", en: "Suspend" },
  { value: "blocked", ar: "حظر", en: "Block" },
];

export default function CustomerDetailPage() {
  const t = useT();
  // A customer ref: `b2c:<uuid>` (or a bare UUID) or `legacy:user:<id>`.
  const { id: rawId = "" } = useParams<{ id: string }>();
  const id = decodeURIComponent(rawId);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const detail = useQuery(customersQueries.detail(id));
  const profile = detail.data;
  const customer360 = useQuery({ ...customersQueries.customer360(id), enabled: Boolean(id) });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: customersKeys.detail(id) });
    queryClient.invalidateQueries({ queryKey: customersKeys.customer360(id) });
    queryClient.invalidateQueries({ queryKey: customersKeys.all });
  };

  const statusMutation = useMutation({
    mutationFn: (status: string) => setCustomerStatus(id, { status }),
    onSuccess: invalidate,
  });

  const saveMutation = useMutation({
    mutationFn: (body: AdminCustomerUpdateRequest) => updateCustomer(id, body),
    onSuccess: () => {
      setEditing(false);
      invalidate();
    },
  });

  const error = statusMutation.error ?? saveMutation.error;
  // Legacy accounts not imported yet are read-only: import them to edit (B2C customers only).
  const readOnly = !profile || isLegacy(profile);
  const name = profile?.full_name || profile?.email || id;

  return (
    <>
      <PageHead
        back={{ href: "/customers", label: t("العملاء", "Customers") }}
        title={name}
        status={
          profile ? (
            <>
              <Badge def={customerStatusBadge(profile.status)} />
              <SourceBadge source={profile.source} />
            </>
          ) : null
        }
        sub={profile?.email}
        actions={
          <>
            <Button kind="secondary" icon="edit" label={t("تعديل", "Edit")} disabled={readOnly} onClick={() => setEditing((value) => !value)} />
            {STATUS_OPTIONS.map((option) => (
              <Button
                key={option.value}
                sm
                label={t(option.ar, option.en)}
                disabled={readOnly || profile?.status === option.value || statusMutation.isPending}
                onClick={() => statusMutation.mutate(option.value)}
              />
            ))}
          </>
        }
      />

      <ErrorAlert error={error} />

      {editing && profile ? (
        <EditCustomerForm
          initial={profile}
          pending={saveMutation.isPending}
          onCancel={() => setEditing(false)}
          onSave={(body) => saveMutation.mutate(body)}
        />
      ) : null}

      <PageState error={detail.error}>
        {profile ? (
          <>
            <OrderStatus360
              lifetimeMinor={customer360.data?.lifetime_paid_minor ?? 0}
              currency={customer360.data?.currency_code ?? profile.preferred_currency ?? "USD"}
              paidOrders={customer360.data?.paid_orders_count ?? 0}
              orders={customer360.data?.orders_count ?? 0}
              invoices={customer360.data?.invoice_count ?? 0}
              rewardPoints={customer360.data?.reward_points_balance ?? 0}
            />

            <div className="ma-cols ma-cols--2 ma-section-gap">
              <Card title={t("الملف الشخصي", "Profile")}>
                <Dl
                  rows={[
                    [t("الاسم", "Name"), profile.full_name || "—"],
                    [t("البريد", "Email"), <bdi key="e">{profile.email}</bdi>],
                    [t("الهاتف", "Phone"), <bdi key="p">{profile.phone || "—"}</bdi>],
                    [t("الدولة", "Country"), profile.country_code || "—"],
                    [t("العملة المفضلة", "Preferred currency"), profile.preferred_currency || "—"],
                    [t("اللغة المفضلة", "Preferred locale"), profile.preferred_locale || "—"],
                  ]}
                />
              </Card>

              <Card title={t("الحساب والتعلم", "Account & learning")}>
                <Dl
                  rows={[
                    [t("الحالة", "Status"), <Badge key="s" def={customerStatusBadge(profile.status)} />],
                    [t("النظام", "System"), <SourceBadge key="src" source={profile.source} />],
                    [t("معرّف العميل", "Customer id"), <bdi key="id" className="ma-num">{profile.customer_id ?? "—"}</bdi>],
                    [t("رقم المستخدم القديم", "Legacy user id"), profile.legacy_user_id ?? "—"],
                    [
                      t("طلبات النظام القديم", "Legacy orders"),
                      customer360.data?.legacy_orders_count
                        ? `${formatNumber(customer360.data.legacy_orders_count)} · ${formatMinor(customer360.data.legacy_paid_minor ?? 0, customer360.data.legacy_currency_code ?? "SAR")}`
                        : "—",
                    ],
                    [t("معرّف LMS", "LMS id"), profile.lms_user_id || "—"],
                    [t("معرّف LMS الرقمي", "LMS numeric id"), profile.lms_numeric_user_id ?? "—"],
                    [t("أُنشئ", "Created"), formatDateTime(profile.created_at)],
                    [t("آخر تحديث", "Updated"), formatDateTime(profile.updated_at)],
                  ]}
                />
              </Card>
            </div>

            {!readOnly ? (
              <div className="ma-cols ma-cols--2 ma-section-gap">
                <CustomerAvatarCard customerRef={profile.ref} name={name} />
                <CustomerNotesCard customerRef={profile.ref} />
              </div>
            ) : null}

            {!readOnly ? <CustomerGrantsCard customerRef={profile.ref} /> : null}
            <RecentOrders orders={customer360.data?.recent_orders} loading={customer360.isLoading} />
            {!readOnly && profile.customer_id && can("subscribers.read") ? (
              <CustomerSubscriptionsCard customerId={profile.customer_id} />
            ) : null}
            {!readOnly && can("subscribers.read") ? (
              <CustomerEntitlementsCard customerRef={profile.ref} />
            ) : (
              <Entitlements entitlements={customer360.data?.entitlements} loading={customer360.isLoading} />
            )}
            {!readOnly && profile.customer_id && can("affiliates.read") ? (
              <div className="ma-section-gap">
                <CustomerReferralsCard customerId={profile.customer_id} />
              </div>
            ) : null}
            {!readOnly ? (
              <div className="ma-section-gap">
                <CustomerHistoryCard customerRef={profile.ref} />
              </div>
            ) : null}
          </>
        ) : detail.isLoading ? (
          <Loading />
        ) : (
          <Empty icon="user" text={t("لم يُعثر على العميل.", "Customer not found.")} />
        )}
      </PageState>
    </>
  );
}

function OrderStatus360({
  lifetimeMinor,
  currency,
  paidOrders,
  orders,
  invoices,
  rewardPoints,
}: {
  lifetimeMinor: number;
  currency: string;
  paidOrders: number;
  orders: number;
  invoices: number;
  rewardPoints: number;
}) {
  const t = useT();
  return (
    <div className="ma-kpis ma-section-gap">
      <Kpi label={t("إجمالي المدفوع", "Lifetime paid")} value={<span className="ma-num">{formatMinor(lifetimeMinor, currency)}</span>} icon="card" field="var(--coral)" />
      <Kpi label={t("طلبات مدفوعة", "Paid orders")} value={<span className="ma-num">{formatNumber(paidOrders)}</span>} icon="check" field="var(--yellow)" />
      <Kpi label={t("إجمالي الطلبات", "Orders")} value={<span className="ma-num">{formatNumber(orders)}</span>} icon="cart" field="var(--purple)" />
      <Kpi label={t("الفواتير", "Invoices")} value={<span className="ma-num">{formatNumber(invoices)}</span>} icon="receipt" field="var(--sky)" />
      <Kpi label={t("نقاط المكافآت", "Reward points")} value={<span className="ma-num">{formatNumber(rewardPoints)}</span>} icon="star" field="var(--teal)" />
    </div>
  );
}

function RecentOrders({ orders, loading }: { orders?: AdminOrderRef[]; loading: boolean }) {
  const t = useT();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const raw = orders ?? [];
  const filtered = useMemo(() => {
    return raw.filter((row) => {
      const q = search.toLowerCase();
      const matchSearch = !search || row.ref.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || row.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [raw, search, statusFilter]);

  const columns: Column<AdminOrderRef>[] = [
    {
      key: "order",
      header: t("الطلب", "Order"),
      cell: (row) => (
        <AppLink to={`/sales/orders/${encodeURIComponent(row.ref)}`} className="ma-link ma-link--plain">
          <bdi>#{row.legacy_order_id ?? row.order_id?.slice(0, 8)}</bdi>
        </AppLink>
      ),
    },
    { key: "source", header: t("النظام", "System"), cell: (row) => <SourceBadge source={row.source} /> },
    { key: "status", header: t("الحالة", "Status"), cell: (row) => <Badge def={orderStatusBadge(row.status)} /> },
    { key: "payment", header: t("الدفع", "Payment"), cell: (row) => <Badge def={paymentStatusBadge(row.payment_status)} /> },
    { key: "total", header: t("الإجمالي", "Total"), align: "end", cell: (row) => <span className="ma-num">{formatMinor(row.amount_minor, row.currency_code)}</span> },
    { key: "when", header: t("التاريخ", "When"), cell: (row) => formatDateTime(row.created_at) },
  ];

  const toolbar = (
    <>
      <SearchBox placeholder={t("ابحث برقم الطلب…", "Search order id…")} value={search} onChange={setSearch} />
      <SelectField
        label={t("الحالة", "Status")}
        value={statusFilter}
        onChange={setStatusFilter}
        options={[
          { value: "all", label: t("كل الحالات", "All states") },
          { value: "completed", label: t("مكتمل", "Completed") },
          { value: "pending", label: t("قيد الانتظار", "Pending") },
          { value: "cancelled", label: t("ملغي", "Cancelled") },
        ]}
      />
    </>
  );

  return (
    <Card title={t("أحدث الطلبات", "Recent orders")} className="ma-section-gap">
      <DataTable rows={filtered} columns={columns} toolbar={toolbar} loading={loading} empty={t("لا طلبات مطابقة.", "No matching orders.")} />
    </Card>
  );
}

function Entitlements({ entitlements, loading }: { entitlements?: AdminEntitlementRef[]; loading: boolean }) {
  const t = useT();
  const [search, setSearch] = useState("");

  const raw = entitlements ?? [];
  const filtered = useMemo(() => {
    return raw.filter((row) => {
      const q = search.toLowerCase();
      return !search || (row.product_title?.toLowerCase().includes(q) ?? false) || row.product_id.toLowerCase().includes(q);
    });
  }, [raw, search]);

  const columns: Column<AdminEntitlementRef>[] = [
    {
      key: "product",
      header: t("المنتج", "Product"),
      cell: (row) => (
        <AppLink to={productHref(`b2c:${row.product_id}`)} className="ma-link ma-link--plain">
          {row.product_title || <bdi>{row.product_id.slice(0, 8)}</bdi>}
        </AppLink>
      ),
    },
    { key: "source", header: t("المصدر", "Source"), cell: (row) => row.source_type },
    { key: "status", header: t("الحالة", "Status"), cell: (row) => <Badge def={entitlementStatusBadge(row.status)} /> },
    { key: "starts", header: t("البداية", "Starts"), cell: (row) => formatDateTime(row.starts_at) },
    { key: "expires", header: t("الانتهاء", "Expires"), cell: (row) => formatDateTime(row.expires_at) },
  ];

  const toolbar = (
    <SearchBox placeholder={t("ابحث باسم المنتج…", "Search product title…")} value={search} onChange={setSearch} />
  );

  return (
    <Card title={t("الاستحقاقات والدورات المشترك بها", "Entitlements & enrolled products")} className="ma-section-gap">
      <DataTable rows={filtered} columns={columns} toolbar={toolbar} loading={loading} empty={t("لا استحقاقات مطابقة.", "No matching entitlements.")} />
    </Card>
  );
}

function EditCustomerForm({
  initial,
  pending,
  onCancel,
  onSave,
}: {
  initial: AdminCustomerUpdateRequest;
  pending: boolean;
  onCancel: () => void;
  onSave: (body: AdminCustomerUpdateRequest) => void;
}) {
  const t = useT();
  const [fullName, setFullName] = useState(initial.full_name || "");
  const [phone, setPhone] = useState(initial.phone || "");
  const [countryCode, setCountryCode] = useState(initial.country_code || "");
  const [locale, setLocale] = useState(initial.preferred_locale || "ar");
  const [currency, setCurrency] = useState(initial.preferred_currency || "USD");

  return (
    <Card title={t("تعديل بيانات العميل", "Edit customer")}>
      <form
        className="ma-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({
            full_name: fullName,
            phone: phone || null,
            country_code: countryCode || null,
            preferred_locale: locale || null,
            preferred_currency: currency || null,
          });
        }}
      >
        <div className="ma-cols ma-cols--2">
          <Field id="customer-name" label={t("الاسم الكامل", "Full name")} value={fullName} onChange={setFullName} />
          <Field id="customer-phone" dir="ltr" label={t("الهاتف", "Phone")} value={phone} onChange={setPhone} />
          <Field id="customer-country" dir="ltr" label={t("رمز الدولة", "Country code")} value={countryCode} onChange={setCountryCode} />
          <Field id="customer-currency" dir="ltr" label={t("العملة المفضلة", "Preferred currency")} value={currency} onChange={setCurrency} />
          <Field
            id="customer-locale"
            label={t("اللغة المفضلة", "Preferred locale")}
            options={[
              ["ar", "العربية"],
              ["en", "English"],
            ]}
            value={locale}
            onChange={setLocale}
          />
        </div>
        <FormActions>
          <Button type="submit" kind="primary" label={pending ? t("جارٍ الحفظ…", "Saving…") : t("حفظ التغييرات", "Save changes")} disabled={pending} />
          <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={onCancel} />
        </FormActions>
      </form>
    </Card>
  );
}
