import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  applyBulkPriceChange,
  getProductFacets,
  listPriceBatches,
  listProducts,
  previewBulkPriceChange,
  pricingKeys,
  productKeys,
  revertPriceBatch,
  setProductPrice,
  type BulkPriceFilter,
  type BulkPriceOperation,
  type BulkPricePreview,
  type BulkPriceRequest,
  type Product as CatalogItem,
  type ProductsParams,
} from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { productHref } from "@/lib/refs";
import { productStatusBadge } from "@/lib/status";
import { AppLink } from "@/components/ui/app-link";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge, Button, Card, ErrorAlert, Field, FormActions, PageHead } from "@/components/ui/kit";
import { Modal } from "@/components/ui/modal";
import { SearchBox } from "@/components/ui/paged-list";
import { Pagination } from "@/components/ui/primitives";
import { SelectField } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";

/*
 * Product pricing: filter B2C products (type, status, category with its subcategories, tag, level, language,
 * course hours, current price), edit one price in place, or change many at once. A bulk change is previewed
 * first, applied as one batch, and can be reverted from the history tab.
 */

const PAGE = 50;
/** Radix Select can't hold an empty value: "all" stands for "no filter". */
const ALL = "all";
const fromAll = (value: string) => (value === ALL ? "" : value);

type Filters = {
  query: string;
  product_type: string;
  status: string;
  category: string;
  tag: string;
  level: string;
  language: string;
  hoursMin: string;
  hoursMax: string;
  priceMin: string;
  priceMax: string;
};

const EMPTY: Filters = {
  query: "", product_type: "", status: "", category: "", tag: "", level: "", language: "",
  hoursMin: "", hoursMax: "", priceMin: "", priceMax: "",
};

const num = (value: string) => (value.trim() === "" || !Number.isFinite(Number(value)) ? undefined : Number(value));

function listParams(filters: Filters, offset: number): ProductsParams {
  return {
    source: "b2c",
    limit: PAGE,
    offset,
    query: filters.query.trim() || undefined,
    product_type: filters.product_type || undefined,
    status: (filters.status || undefined) as ProductsParams["status"],
    category: filters.category || undefined,
    tag: filters.tag.trim() || undefined,
    level: (filters.level || undefined) as ProductsParams["level"],
    language: filters.language || undefined,
    duration_hours_min: num(filters.hoursMin),
    duration_hours_max: num(filters.hoursMax),
    price_min: num(filters.priceMin),
    price_max: num(filters.priceMax),
  };
}

function bulkFilter(filters: Filters): BulkPriceFilter {
  const params = listParams(filters, 0);
  return {
    product_type: params.product_type,
    status: params.status,
    query: params.query,
    category: params.category ? [params.category] : [],
    tags: params.tag ? params.tag.split(",").map((tag) => tag.trim()).filter(Boolean) : [],
    level: params.level,
    language: params.language,
    duration_hours_min: params.duration_hours_min,
    duration_hours_max: params.duration_hours_max,
    price_min: params.price_min,
    price_max: params.price_max,
  };
}

const productIdOf = (item: CatalogItem) => item.product_id ?? item.ref?.replace(/^b2c:/, "") ?? null;

export default function PricingPage() {
  const t = useT();
  const [tab, setTab] = useState<"products" | "batches">("products");
  return (
    <>
      <PageHead
        title={t("التسعير", "Pricing")}
        sub={t(
          "عدّل سعر منتج واحد أو مجموعة منتجات حسب النوع أو التصنيف أو عدد الساعات، مع معاينة قبل التطبيق.",
          "Change one product's price or many at once by type, category, course hours and more, with a preview first.",
        )}
        actions={
          <span className="ma-cell-flex" style={{ gap: "6px" }}>
            <Button kind={tab === "products" ? "primary" : "ghost"} label={t("المنتجات", "Products")} onClick={() => setTab("products")} />
            <Button kind={tab === "batches" ? "primary" : "ghost"} icon="history" label={t("التعديلات الجماعية", "Bulk changes")} onClick={() => setTab("batches")} />
          </span>
        }
      />
      {tab === "products" ? <ProductPricing /> : <BatchHistory />}
    </>
  );
}

function ProductPricing() {
  const t = useT();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const set = (patch: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setOffset(0);
  };
  const params = listParams(filters, offset);
  const products = useQuery({ queryKey: productKeys.list(params), queryFn: () => listProducts(params), placeholderData: keepPreviousData });
  const facets = useQuery({ queryKey: [...productKeys.all, "facets", filters.product_type], queryFn: () => getProductFacets(filters.product_type || undefined) });
  const rows = products.data?.items ?? [];
  const pageIds = rows.map(productIdOf).filter((id): id is string => Boolean(id));
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const columns: Column<CatalogItem>[] = [
    {
      key: "select",
      header: t("تحديد", "Select"),
      width: "56px",
      cell: (row) => {
        const id = productIdOf(row);
        return id ? (
          <input type="checkbox" aria-label={t("تحديد المنتج", "Select product")} checked={selected.has(id)} onChange={(event) => toggle(id, event.target.checked)} />
        ) : null;
      },
    },
    {
      key: "product",
      header: t("المنتج", "Product"),
      cell: (row) => (
        <AppLink to={productHref(row.ref ?? `b2c:${row.product_id}`)} className="ma-link ma-link--plain">
          <span className="ma-cell-main">{row.title || row.slug}</span>
          <span className="ma-cell-sub">{row.product_type}{row.category ? ` · ${row.category}` : ""}</span>
        </AppLink>
      ),
    },
    { key: "status", header: t("الحالة", "Status"), cell: (row) => <Badge def={productStatusBadge(row.status)} /> },
    {
      key: "price",
      header: t("السعر", "Price"),
      align: "end",
      cell: (row) => (row.price != null ? <bdi className="ma-num">{row.price} {row.price_currency ?? ""}</bdi> : <span className="ma-cell-sub">{t("بلا سعر", "No price")}</span>),
    },
    {
      key: "compare",
      header: t("قبل الخصم", "Compare-at"),
      align: "end",
      cell: (row) => (row.compare_at_price != null ? <bdi className="ma-num">{row.compare_at_price}</bdi> : "—"),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      cell: (row) => (productIdOf(row) ? <Button sm kind="ghost" icon="edit" label={t("تعديل السعر", "Edit price")} onClick={() => setEditing(row)} /> : null),
    },
  ];

  const typeOptions = [{ value: ALL, label: t("كل الأنواع", "All types") }, ...(facets.data?.product_types ?? []).map((o) => ({ value: o.value, label: `${o.label} (${o.count})` }))];
  const categoryOptions = [{ value: ALL, label: t("كل التصنيفات", "All categories") }, ...(facets.data?.categories ?? []).map((o) => ({ value: o.value, label: `${o.label} (${o.count})` }))];

  return (
    <>
      <Card title={t("تصفية المنتجات", "Filter products")}>
        <div className="ma-cell-flex" style={{ gap: "var(--space-3)", flexWrap: "wrap", alignItems: "flex-end" }}>
          <SearchBox placeholder={t("ابحث بالعنوان أو الرابط…", "Search title or slug…")} value={filters.query} onChange={(query) => set({ query })} />
          <SelectField label={t("النوع", "Type")} value={filters.product_type || ALL} onChange={(product_type) => set({ product_type: fromAll(product_type), category: "" })} options={typeOptions} />
          <SelectField label={t("الحالة", "Status")} value={filters.status || ALL} onChange={(status) => set({ status: fromAll(status) })}
            options={[
              { value: ALL, label: t("كل الحالات", "All statuses") },
              { value: "published", label: t("منشور", "Published") },
              { value: "draft", label: t("مسودة", "Draft") },
              { value: "unpublished", label: t("غير منشور", "Unpublished") },
            ]} />
          <SelectField label={t("التصنيف", "Category")} value={filters.category || ALL} onChange={(category) => set({ category: fromAll(category) })} options={categoryOptions} />
          <SelectField label={t("المستوى", "Level")} value={filters.level || ALL} onChange={(level) => set({ level: fromAll(level) })}
            options={[
              { value: ALL, label: t("كل المستويات", "All levels") },
              { value: "beginner", label: t("مبتدئ", "Beginner") },
              { value: "intermediate", label: t("متوسط", "Intermediate") },
              { value: "advanced", label: t("متقدم", "Advanced") },
            ]} />
          <SelectField label={t("اللغة", "Language")} value={filters.language || ALL} onChange={(language) => set({ language: fromAll(language) })}
            options={[{ value: ALL, label: t("كل اللغات", "All languages") }, { value: "ar", label: "العربية" }, { value: "en", label: "English" }]} />
          <Field id="pf-tag" label={t("وسم", "Tag")} value={filters.tag} onChange={(tag) => set({ tag })} />
          <Field id="pf-hmin" type="number" dir="ltr" label={t("ساعات من", "Hours from")} value={filters.hoursMin} onChange={(hoursMin) => set({ hoursMin })} />
          <Field id="pf-hmax" type="number" dir="ltr" label={t("ساعات إلى", "Hours to")} value={filters.hoursMax} onChange={(hoursMax) => set({ hoursMax })} />
          <Field id="pf-pmin" type="number" dir="ltr" label={t("سعر من", "Price from")} value={filters.priceMin} onChange={(priceMin) => set({ priceMin })} />
          <Field id="pf-pmax" type="number" dir="ltr" label={t("سعر إلى", "Price to")} value={filters.priceMax} onChange={(priceMax) => set({ priceMax })} />
          <Button kind="ghost" icon="x" label={t("مسح", "Clear")} onClick={() => { set(EMPTY); setSelected(new Set()); }} />
        </div>
      </Card>

      <BulkPanel filters={filters} selectedIds={[...selected]} matching={products.data?.total ?? 0} onApplied={() => setSelected(new Set())} />

      <Card className="ma-section-gap" title={t(`المنتجات (${formatNumber(products.data?.total ?? 0)})`, `Products (${formatNumber(products.data?.total ?? 0)})`)}
        actions={
          <span className="ma-cell-flex" style={{ gap: "6px" }}>
            <Button sm kind="ghost" label={allOnPage ? t("إلغاء تحديد الصفحة", "Unselect page") : t("تحديد الصفحة", "Select page")}
              onClick={() => pageIds.forEach((id) => toggle(id, !allOnPage))} disabled={pageIds.length === 0} />
            {selected.size > 0 ? <Button sm kind="ghost" label={t(`مسح التحديد (${selected.size})`, `Clear selection (${selected.size})`)} onClick={() => setSelected(new Set())} /> : null}
          </span>
        }>
        <DataTable rows={rows} columns={columns} loading={products.isLoading} error={products.error} exportConfig={false}
          empty={t("لا منتجات مطابقة.", "No matching products.")}
          footer={products.data ? <Pagination total={products.data.total} limit={PAGE} offset={offset} onPage={setOffset} /> : null} />
      </Card>
      {editing ? <EditPriceModal item={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function EditPriceModal({ item, onClose }: { item: CatalogItem; onClose: () => void }) {
  const t = useT();
  const queryClient = useQueryClient();
  const productId = productIdOf(item)!;
  const [amount, setAmount] = useState(item.price != null ? String(item.price) : "");
  const [compareAt, setCompareAt] = useState(item.compare_at_price != null ? String(item.compare_at_price) : "");
  const amountValue = num(amount);
  const compareValue = num(compareAt);
  const valid = amountValue !== undefined && amountValue >= 0 && (compareValue === undefined || compareValue > amountValue);
  const save = useMutation({
    mutationFn: () =>
      setProductPrice(productId, { amount: amountValue!, currency_code: item.price_currency ?? "USD", compare_at_amount: compareValue ?? null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      queryClient.invalidateQueries({ queryKey: pricingKeys.history(productId) });
      toast.success(t("تم حفظ السعر", "Price saved"));
      onClose();
    },
  });
  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title={t("تعديل السعر", "Edit price")} description={item.title ?? item.slug}
      footer={
        <FormActions>
          <Button kind="primary" icon="check" disabled={!valid || save.isPending} label={t("حفظ", "Save")} onClick={() => save.mutate()} />
          <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={onClose} />
        </FormActions>
      }>
      <div className="grid gap-3">
        <Field id="edit-amount" type="number" dir="ltr" required label={t(`السعر (${item.price_currency ?? "USD"})`, `Price (${item.price_currency ?? "USD"})`)} value={amount} onChange={setAmount} />
        <Field id="edit-compare" type="number" dir="ltr" label={t("السعر قبل الخصم (اختياري)", "Compare-at price (optional)")} value={compareAt} onChange={setCompareAt}
          hint={t("يجب أن يكون أعلى من السعر.", "Must be higher than the price.")} />
        <ErrorAlert error={save.error} />
      </div>
    </Modal>
  );
}

const WARNING_LABELS: Record<string, { ar: string; en: string }> = {
  no_price: { ar: "بلا سعر حالي", en: "No current price" },
  no_compare_at: { ar: "بلا سعر قبل الخصم", en: "No compare-at price" },
  negative: { ar: "سعر سالب", en: "Negative price" },
  compare_at_not_above_price: { ar: "سعر قبل الخصم ليس أعلى", en: "Compare-at not above price" },
  unchanged: { ar: "بلا تغيير", en: "Unchanged" },
};

function BulkPanel({ filters, selectedIds, matching, onApplied }: { filters: Filters; selectedIds: string[]; matching: number; onApplied: () => void }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<"selected" | "filter">("selected");
  const [field, setField] = useState<BulkPriceOperation["field"]>("amount");
  const [type, setType] = useState<BulkPriceOperation["type"]>("percent");
  const [value, setValue] = useState("");
  const [rounding, setRounding] = useState<NonNullable<BulkPriceOperation["rounding"]>>("none");
  const [preview, setPreview] = useState<{ request: BulkPriceRequest; result: BulkPricePreview } | null>(null);
  const effectiveScope = scope === "selected" && selectedIds.length === 0 ? "filter" : scope;
  const needsValue = type !== "clear";
  const ready = !needsValue || (value.trim() !== "" && Number.isFinite(Number(value)));

  const request = (): BulkPriceRequest => ({
    selector: effectiveScope === "selected" ? { product_ids: selectedIds } : { filter: bulkFilter(filters) },
    operation: { field, type, value: needsValue ? Number(value) : null, rounding },
    currency_code: "USD",
  });
  const run = useMutation({
    mutationFn: async () => {
      const body = request();
      return { request: body, result: await previewBulkPriceChange(body) };
    },
    onSuccess: setPreview,
  });
  const apply = useMutation({
    mutationFn: () => applyBulkPriceChange({ ...preview!.request, expected_count: preview!.result.applicable_count }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      queryClient.invalidateQueries({ queryKey: pricingKeys.all });
      toast.success(t(`تم تحديث ${result.batch.product_count} منتجاً`, `${result.batch.product_count} products updated`));
      setPreview(null);
      onApplied();
    },
  });

  return (
    <Card className="ma-section-gap" title={t("تعديل جماعي للأسعار", "Bulk price change")}>
      <div className="ma-cell-flex" style={{ gap: "var(--space-3)", flexWrap: "wrap", alignItems: "flex-end" }}>
        <SelectField label={t("المنتجات", "Products")} value={effectiveScope} onChange={(next) => setScope(next)}
          options={[
            ...(selectedIds.length ? [{ value: "selected" as const, label: t(`المحددة (${selectedIds.length})`, `Selected (${selectedIds.length})`) }] : []),
            { value: "filter" as const, label: t(`كل المطابقة للتصفية (${formatNumber(matching)})`, `All matching the filters (${formatNumber(matching)})`) },
          ]} />
        <SelectField label={t("الحقل", "Field")} value={field} onChange={(next) => { setField(next); if (next === "amount" && type === "clear") setType("percent"); }}
          options={[{ value: "amount", label: t("السعر", "Price") }, { value: "compare_at_amount", label: t("السعر قبل الخصم", "Compare-at price") }]} />
        <SelectField label={t("العملية", "Operation")} value={type} onChange={setType}
          options={[
            { value: "percent", label: t("نسبة مئوية ±", "Percent ±") },
            { value: "fixed_delta", label: t("مبلغ ثابت ±", "Fixed amount ±") },
            { value: "set", label: t("تعيين قيمة", "Set to") },
            ...(field === "compare_at_amount" ? [{ value: "clear" as const, label: t("إزالة", "Remove") }] : []),
          ]} />
        {needsValue ? (
          <Field id="bulk-value" type="number" dir="ltr" required label={type === "percent" ? t("النسبة %", "Percent %") : t("القيمة", "Value")} value={value} onChange={setValue}
            hint={type === "set" ? undefined : t("استخدم قيمة سالبة للتخفيض.", "Use a negative value to lower.")} />
        ) : null}
        <SelectField label={t("التقريب", "Rounding")} value={rounding} onChange={setRounding}
          options={[
            { value: "none", label: t("بدون", "None") },
            { value: "integer", label: t("لأقرب رقم صحيح", "Whole number") },
            { value: "x99", label: t("ينتهي بـ .99", "Ends in .99") },
          ]} />
        <Button kind="primary" icon="eye" label={run.isPending ? t("جارٍ الحساب…", "Calculating…") : t("معاينة", "Preview")} disabled={!ready || run.isPending} onClick={() => run.mutate()} />
      </div>
      <ErrorAlert error={run.error} />
      {preview ? (
        <PreviewModal preview={preview.result} applying={apply.isPending} error={apply.error} onApply={() => apply.mutate()} onClose={() => { setPreview(null); apply.reset(); }} />
      ) : null}
    </Card>
  );
}

function PreviewModal({ preview, applying, error, onApply, onClose }: {
  preview: BulkPricePreview; applying: boolean; error: unknown; onApply: () => void; onClose: () => void;
}) {
  const t = useT();
  const warningCounts = preview.rows.flatMap((row) => row.warnings ?? []).reduce<Record<string, number>>((acc, warning) => ({ ...acc, [warning]: (acc[warning] ?? 0) + 1 }), {});
  return (
    <Modal open onOpenChange={(open) => !open && onClose()} size="lg"
      title={t(`معاينة: ${preview.applicable_count} من ${preview.total} سيتغير`, `Preview: ${preview.applicable_count} of ${preview.total} will change`)}
      footer={
        <FormActions>
          <Button kind="primary" icon="check" disabled={preview.applicable_count === 0 || applying}
            label={applying ? t("جارٍ التطبيق…", "Applying…") : t(`تطبيق على ${preview.applicable_count}`, `Apply to ${preview.applicable_count}`)} onClick={onApply} />
          <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={onClose} />
        </FormActions>
      }>
      <div className="grid gap-3">
        {Object.keys(warningCounts).length ? (
          <div className="ma-cell-flex" style={{ gap: "6px", flexWrap: "wrap" }}>
            {Object.entries(warningCounts).map(([warning, count]) => (
              <Badge key={warning} def={{ label: { ar: `${WARNING_LABELS[warning]?.ar ?? warning}: ${count}`, en: `${WARNING_LABELS[warning]?.en ?? warning}: ${count}` }, tone: warning === "negative" ? "danger" : "warning" }} />
            ))}
          </div>
        ) : null}
        <ErrorAlert error={error} />
        <DataTable
          rows={preview.rows}
          exportConfig={false}
          columns={[
            { key: "product", header: t("المنتج", "Product"), cell: (row) => <span className="ma-cell-main">{row.title || row.slug}</span> },
            { key: "price", header: t("السعر", "Price"), align: "end", cell: (row) => <bdi className="ma-num">{row.current_amount ?? "—"} → {row.new_amount ?? "—"} {row.currency_code}</bdi> },
            { key: "compare", header: t("قبل الخصم", "Compare-at"), align: "end", cell: (row) => <bdi className="ma-num">{row.current_compare_at ?? "—"} → {row.new_compare_at ?? "—"}</bdi> },
            {
              key: "state",
              header: "",
              cell: (row) =>
                row.applicable ? (
                  <Badge def={{ label: { ar: "سيتغير", en: "Will change" }, tone: "success" }} />
                ) : (
                  <span className="ma-cell-sub">{(row.warnings ?? []).map((w) => t(WARNING_LABELS[w]?.ar ?? w, WARNING_LABELS[w]?.en ?? w)).join("، ")}</span>
                ),
            },
          ]}
        />
      </div>
    </Modal>
  );
}

function BatchHistory() {
  const t = useT();
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [reverting, setReverting] = useState<string | null>(null);
  const params = { limit: 25, offset };
  const batches = useQuery({ queryKey: pricingKeys.batches(params), queryFn: () => listPriceBatches(params), placeholderData: keepPreviousData });
  const revert = useMutation({
    mutationFn: (batchId: string) => revertPriceBatch(batchId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: pricingKeys.all });
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success(
        result.skipped.length
          ? t(`أُعيد ${result.reverted.length}، وتُرك ${result.skipped.length} سُعّر بعد التعديل`, `${result.reverted.length} restored, ${result.skipped.length} kept (priced again since)`)
          : t(`أُعيد ${result.reverted.length} سعراً`, `${result.reverted.length} prices restored`),
      );
      setReverting(null);
    },
  });
  const describe = (operation: Record<string, unknown>) =>
    `${operation.field === "compare_at_amount" ? t("قبل الخصم", "compare-at") : t("السعر", "price")} · ${String(operation.type)}${operation.value != null ? ` ${String(operation.value)}` : ""}${operation.rounding && operation.rounding !== "none" ? ` · ${String(operation.rounding)}` : ""}`;

  return (
    <Card title={t("التعديلات الجماعية", "Bulk changes")}>
      <ErrorAlert error={batches.error ?? revert.error} />
      <DataTable
        rows={batches.data?.items ?? []}
        loading={batches.isLoading}
        exportConfig={false}
        empty={t("لا تعديلات جماعية بعد.", "No bulk changes yet.")}
        footer={batches.data ? <Pagination total={batches.data.total} limit={25} offset={offset} onPage={setOffset} /> : null}
        columns={[
          { key: "at", header: t("التاريخ", "Date"), cell: (row) => formatDateTime(row.created_at) },
          { key: "op", header: t("العملية", "Operation"), cell: (row) => <bdi>{describe(row.operation)}</bdi> },
          { key: "count", header: t("المنتجات", "Products"), align: "end", cell: (row) => <span className="ma-num">{formatNumber(row.product_count)}</span> },
          {
            key: "state",
            header: t("الحالة", "Status"),
            cell: (row) => (row.reverted_at
              ? <Badge def={{ label: { ar: "أُلغي", en: "Reverted" }, tone: "neutral" }} />
              : <Badge def={{ label: { ar: "مطبّق", en: "Applied" }, tone: "success" }} />),
          },
          {
            key: "actions",
            header: "",
            align: "end",
            cell: (row) => (row.reverted_at ? null : <Button sm kind="ghost" icon="refresh" label={t("تراجع", "Revert")} onClick={() => setReverting(row.batch_id)} />),
          },
        ]}
      />
      <ConfirmModal
        open={reverting !== null}
        onOpenChange={(open) => !open && setReverting(null)}
        title={t("التراجع عن هذا التعديل؟", "Revert this bulk change?")}
        message={t("تعود الأسعار السابقة للمنتجات التي لم يتغير سعرها منذ ذلك الحين.", "Earlier prices come back for products not priced again since.")}
        confirmLabel={t("تراجع", "Revert")}
        loading={revert.isPending}
        onConfirm={() => reverting && revert.mutate(reverting)}
      />
    </Card>
  );
}
