import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import {
  issueBulkVouchers,
  issueVoucher,
  listProducts,
  listVoucherAudience,
  vouchersKeys,
  type VoucherAudienceCustomer,
  type VoucherSegment,
} from "@/lib/api";
import { formatMinor, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { AppLink } from "@/components/ui/app-link";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Alert, Button, Card, ErrorAlert, Field, FormActions, PageHead } from "@/components/ui/kit";
import { MultiSelect, type MultiOption } from "@/components/ui/multi-select";
import { Pagination } from "@/components/ui/primitives";

const PAGE = 25;
/** Same cap as the API (`MAX_BULK`): bigger audiences must be narrowed first. */
const MAX_BULK = 5000;
const ENROLLABLE_TYPES = "course,diploma,live_diploma";

const toMinor = (major: string) => Math.round(Number(major || "0") * 100);
const endOfDay = (date: string) => (date ? `${date}T23:59:59Z` : null);

function useDebounced<T>(value: T, ms = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

type Filters = { query: string; minSpend: string; minOrders: string; since: string; enrolled: string[] };
const NO_FILTERS: Filters = { query: "", minSpend: "", minOrders: "", since: "", enrolled: [] };

function toSegment(filters: Filters): VoucherSegment {
  return {
    query: filters.query.trim() || null,
    min_spend_minor: toMinor(filters.minSpend),
    min_orders: Number.parseInt(filters.minOrders || "0", 10) || 0,
    paid_since: filters.since ? `${filters.since}T00:00:00Z` : null,
    enrolled_product_ids: filters.enrolled,
  };
}

/** Only these customers, whatever the filters say. */
const picked = (ids: Set<string>): VoucherSegment => ({ min_spend_minor: 0, min_orders: 0, customer_ids: [...ids] });

const hasFilters = (f: Filters) => Boolean(f.query.trim() || toMinor(f.minSpend) > 0 || Number(f.minOrders) > 0 || f.since || f.enrolled.length);

/** Courses and diplomas, searched on the server (there are more than one page of them). */
function EnrolledInPicker({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const t = useT();
  const [search, setSearch] = useState("");
  const query = useDebounced(search.trim());
  const [known, setKnown] = useState<Record<string, string>>({});
  const products = useQuery({
    queryKey: ["marketing", "vouchers", "enroll-options", query],
    queryFn: () =>
      listProducts({ source: "b2c", product_type: ENROLLABLE_TYPES, query: query || undefined, sort: "paid_orders", order: "desc", limit: 50 }),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
  const typeLabel = (type?: string | null) =>
    type === "course" ? t("دورة", "Course") : type === "live_diploma" ? t("دبلومة مباشرة", "Live diploma") : t("دبلومة", "Diploma");
  const fetched: MultiOption[] = (products.data?.items ?? [])
    .filter((p) => p.product_id)
    .map((p) => ({ value: String(p.product_id), label: `${typeLabel(p.product_type)} · ${p.title ?? p.slug ?? p.product_id}` }));
  // Keep picked products listed (with their label) after the search moves on.
  const options = [
    ...selected.filter((id) => !fetched.some((o) => o.value === id)).map((id) => ({ value: id, label: known[id] ?? id })),
    ...fetched,
  ];

  return (
    <MultiSelect
      label={t("مسجّل في دورة أو دبلومة", "Enrolled in a course or diploma")}
      options={options}
      selected={selected}
      onSearch={setSearch}
      searchPlaceholder={t("ابحث عن دورة أو دبلومة…", "Search courses and diplomas…")}
      onChange={(ids) => {
        setKnown((prev) => ({ ...prev, ...Object.fromEntries(options.filter((o) => ids.includes(o.value)).map((o) => [o.value, o.label])) }));
        onChange(ids);
      }}
    />
  );
}

export default function VoucherIssuePage() {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [amount, setAmount] = useState("");
  const [expires, setExpires] = useState("");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState<"selected" | "matching" | null>(null);

  const setFilter = <K extends keyof Filters>(key: K) => (value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setOffset(0);
    setSelectedOnly(false);
  };

  const settledFilters = useDebounced(filters);
  const segment = toSegment(settledFilters);
  const listed: VoucherSegment = selectedOnly ? picked(selected) : segment;
  const audience = useQuery({
    queryKey: vouchersKeys.audience(listed, offset, PAGE),
    queryFn: () => listVoucherAudience(listed, { limit: PAGE, offset }),
    placeholderData: keepPreviousData,
  });
  const rows = audience.data?.items ?? [];
  const matching = selectedOnly ? 0 : (audience.data?.total ?? 0);
  // While typing (debounce) or refetching, the rows and count still belong to the previous filters.
  const settling = settledFilters !== filters || audience.isFetching;

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const allOnPage = rows.length > 0 && rows.every((row) => selected.has(row.customer_id));

  const voucher = { amount_minor: toMinor(amount), expires_at: endOfDay(expires), note: note.trim() || null };
  const issue = useMutation({
    mutationFn: async (target: "selected" | "matching") => {
      if (target === "selected" && selected.size === 1) {
        const one = await issueVoucher({ customer_id: [...selected][0], ...voucher });
        return { voucherId: one.voucher_id };
      }
      await issueBulkVouchers({ segment: target === "selected" ? picked(selected) : segment, voucher });
      return { voucherId: null };
    },
    onSuccess: ({ voucherId }) => {
      setConfirm(null);
      queryClient.invalidateQueries({ queryKey: vouchersKeys.all });
      navigate(voucherId ? `/sales/vouchers/${voucherId}` : "/sales/vouchers");
    },
  });

  const amountValid = Number(amount) > 0;
  const recipients = confirm === "selected" ? selected.size : matching;
  const tooMany = matching > MAX_BULK;

  const columns: Column<VoucherAudienceCustomer>[] = [
    {
      key: "select",
      header: "",
      width: "36px",
      cell: (row) => (
        <label className="ma-check">
          <input
            type="checkbox"
            aria-label={t(`تحديد ${row.email ?? ""}`, `Select ${row.email ?? ""}`)}
            checked={selected.has(row.customer_id)}
            onChange={(event) => toggle(row.customer_id, event.target.checked)}
          />
        </label>
      ),
    },
    {
      key: "customer",
      header: t("العميل", "Customer"),
      cell: (row) => (
        <AppLink className="ma-link ma-link--plain" to={`/customers/${row.customer_id}`} target="_blank">
          <span className="ma-cell-main">{row.full_name || row.email || "—"}</span>
          <span className="ma-cell-sub"><bdi>{row.email ?? row.customer_id}</bdi></span>
        </AppLink>
      ),
    },
    { key: "spend", header: t("إجمالي المدفوع", "Total paid"), align: "end", cell: (row) => <span className="ma-num">{formatMinor(row.spend_minor)}</span> },
    { key: "orders", header: t("طلبات مدفوعة", "Paid orders"), align: "end", cell: (row) => <span className="ma-num">{formatNumber(row.paid_orders)}</span> },
  ];

  return (
    <>
      <PageHead
        title={t("إصدار قسائم رصيد", "Issue vouchers")}
        sub={t(
          "اختر العملاء بالاسم أو البريد، أو صفِّهم حسب ما دفعوه أو الدورة والدبلومة المسجّلين فيها.",
          "Pick customers by name or email, or filter them by what they paid or the course or diploma they're enrolled in.",
        )}
        back={{ href: "/sales/vouchers", label: t("قسائم الرصيد", "Vouchers") }}
      />

      <Card
        title={t("العملاء", "Customers")}
        actions={
          selected.size ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Button
                sm
                kind={selectedOnly ? "primary" : "soft"}
                label={t(`المحدّدون (${formatNumber(selected.size)})`, `Selected (${formatNumber(selected.size)})`)}
                onClick={() => { setSelectedOnly((on) => !on); setOffset(0); }}
              />
              <Button sm kind="ghost" label={t("مسح التحديد", "Clear selection")} onClick={() => { setSelected(new Set()); setSelectedOnly(false); }} />
            </div>
          ) : null
        }
      >
        <div className="ma-filter-grid mb-4">
          <Field id="aud-query" type="search" label={t("بحث", "Search")} placeholder={t("الاسم أو البريد أو الهاتف", "Name, email or phone")} value={filters.query} onChange={setFilter("query")} />
          <div className="ma-field">
            <span className="ma-label">{t("مسجّل في", "Enrolled in")}</span>
            <EnrolledInPicker selected={filters.enrolled} onChange={setFilter("enrolled")} />
          </div>
          <Field id="aud-spend" type="number" label={t("دفع على الأقل (USD)", "Paid at least (USD)")} min={0} dir="ltr" value={filters.minSpend} onChange={setFilter("minSpend")} />
          <Field id="aud-orders" type="number" label={t("طلبات مدفوعة على الأقل", "Paid orders at least")} min={0} dir="ltr" value={filters.minOrders} onChange={setFilter("minOrders")} />
          <Field id="aud-since" type="date" label={t("احتساب الطلبات منذ (فارغ = دائمًا)", "Count orders since (empty = all time)")} value={filters.since} onChange={setFilter("since")} />
          <div>
            {hasFilters(filters) ? <Button kind="ghost" icon="x" label={t("مسح الفلاتر", "Clear filters")} onClick={() => { setFilters(NO_FILTERS); setOffset(0); }} /> : null}
          </div>
        </div>

        <div aria-busy={settling} style={{ opacity: settling && audience.data ? 0.55 : 1, transition: "opacity 120ms" }}>
        <DataTable<VoucherAudienceCustomer>
          rows={rows}
          columns={columns}
          loading={audience.isLoading}
          error={audience.error}
          exportConfig={false}
          empty={selectedOnly ? t("لم تحدّد أي عميل.", "No customer selected.") : t("لا عملاء يطابقون الفلاتر.", "No customer matches the filters.")}
          footer={
            audience.data ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                {rows.length ? (
                  <label className="ma-check">
                    <input type="checkbox" checked={allOnPage} onChange={(event) => rows.forEach((row) => toggle(row.customer_id, event.target.checked))} />
                    <span>{t("تحديد كل من في هذه الصفحة", "Select everyone on this page")}</span>
                  </label>
                ) : <span />}
                <span className="ma-member__meta">
                  {selectedOnly
                    ? t(`${formatNumber(selected.size)} محدّد`, `${formatNumber(selected.size)} selected`)
                    : t(`${formatNumber(audience.data.total)} عميل يطابق`, `${formatNumber(audience.data.total)} customers match`)}
                </span>
                <Pagination total={audience.data.total} limit={PAGE} offset={offset} onPage={setOffset} />
              </div>
            ) : null
          }
        />
        </div>
      </Card>

      <Card title={t("القسيمة", "Voucher")} className="ma-section-gap">
        <div className="ma-form">
          <div className="ma-form-grid ma-form-grid--2">
            <Field id="voucher-amount" type="number" label={t("قيمة القسيمة (USD)", "Voucher value (USD)")} min={1} step="0.01" dir="ltr" required value={amount} onChange={setAmount} />
            <Field id="voucher-expires" type="date" label={t("تنتهي", "Expires")} hint={t("فارغ = بلا انتهاء.", "Empty = never.")} value={expires} onChange={setExpires} />
          </div>
          <Field id="voucher-note" type="textarea" rows={2} label={t("ملاحظة", "Note")} value={note} onChange={setNote} />
          {tooMany ? (
            <Alert kind="warning" title={t("عدد كبير", "Too many customers")}>
              {t(
                `يطابق ${formatNumber(matching)} عميلًا. ضيّق الفلاتر إلى ${formatNumber(MAX_BULK)} أو أقل للإصدار للجميع.`,
                `${formatNumber(matching)} customers match. Narrow the filters to ${formatNumber(MAX_BULK)} or fewer to issue to all of them.`,
              )}
            </Alert>
          ) : null}
          <ErrorAlert error={issue.error} title={t("تعذّر الإصدار", "Couldn't issue")} />
          <FormActions>
            <Button
              kind="primary"
              icon="send"
              disabled={!amountValid || selected.size === 0 || issue.isPending}
              label={t(`إصدار للمحدّدين (${formatNumber(selected.size)})`, `Issue to selected (${formatNumber(selected.size)})`)}
              onClick={() => setConfirm("selected")}
            />
            <Button
              kind="soft"
              icon="users"
              disabled={!amountValid || !matching || tooMany || settling || !hasFilters(filters) || issue.isPending}
              label={t(`إصدار لكل المطابقين (${formatNumber(matching)})`, `Issue to all matching (${formatNumber(matching)})`)}
              onClick={() => setConfirm("matching")}
            />
          </FormActions>
          {!hasFilters(filters) && !selectedOnly ? (
            <p className="ma-member__meta" style={{ margin: 0 }}>
              {t("للإصدار لكل المطابقين، اختر فلترًا واحدًا على الأقل.", "To issue to everyone matching, set at least one filter.")}
            </p>
          ) : null}
        </div>
      </Card>

      <ConfirmModal
        open={confirm !== null}
        onOpenChange={(open) => { if (!open) setConfirm(null); }}
        tone="primary"
        title={t("إصدار القسائم؟", "Issue the vouchers?")}
        message={t(
          `سيحصل ${formatNumber(recipients)} عميل على قسيمة بقيمة ${formatMinor(toMinor(amount))}.`,
          `${formatNumber(recipients)} customers get a ${formatMinor(toMinor(amount))} voucher each.`,
        )}
        confirmLabel={t("إصدار", "Issue")}
        loading={issue.isPending}
        onConfirm={() => confirm && issue.mutate(confirm)}
      />
    </>
  );
}
