import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  indexProducts,
  removeProductsFromIndex,
  searchIndexKeys,
  searchIndexQueries,
  type IndexProductsParams,
  type IndexState,
} from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useCan } from "@/lib/permissions";
import { Button, Card, Empty, ErrorAlert, Loading } from "@/components/ui/kit";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { SelectField } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";

import { StateBadge } from "./badges";

const PAGE = 25;
type StateFilter = "all" | IndexState;
type TypeFilter = "all" | "course" | "diploma" | "live_diploma" | "package" | "bundle" | "consultation";
type Pending = { action: "index" | "force" | "remove"; ids: string[] } | null;

/** Every product with its index state; select products to embed, re-embed or remove from the index. */
export function ProductsCard({ onStarted }: { onStarted: (workflowId: string) => void }) {
  const t = useT();
  const queryClient = useQueryClient();
  const canWrite = useCan("searchIndex.write");
  const [q, setQ] = useState("");
  const [state, setState] = useState<StateFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Pending>(null);

  const params: IndexProductsParams = {
    q: q.trim() || undefined,
    state: state === "all" ? undefined : state,
    product_type: type === "all" ? undefined : type,
    limit: PAGE,
    offset,
  };
  const products = useQuery(searchIndexQueries.products(params));
  const items = products.data?.items ?? [];
  const total = products.data?.total ?? 0;

  const start = useMutation({
    mutationFn: async ({ action, ids }: NonNullable<Pending>) =>
      action === "remove" ? removeProductsFromIndex(ids, "removed in the admin indexing console") : indexProducts(ids, action === "force"),
    onSuccess: async (run, variables) => {
      setPending(null);
      setSelected(new Set());
      toast.success(variables.action === "remove"
        ? t("بدأ الحذف من الفهرس", "Removal from the index started")
        : t("بدأت الفهرسة — تظهر النتائج في البحث خلال دقيقة أو دقيقتين", "Indexing started. Search picks it up within a minute or two"));
      onStarted(run.workflow_id);
      await queryClient.invalidateQueries({ queryKey: searchIndexKeys.runs() });
    },
    onError: (error) => {
      setPending(null);
      toast.error(error instanceof Error ? error.message : t("تعذّر بدء العملية", "Couldn't start the run"));
    },
  });

  const toggle = (id: string, on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const allOnPage = items.length > 0 && items.every((item) => selected.has(item.product_id));
  const ids = [...selected];

  return (
    <Card flush title={t("المنتجات في الفهرس", "Products in the index")}
      actions={<span className="ma-cell-sub">{t(`${formatNumber(total)} منتج`, `${formatNumber(total)} products`)}</span>}>
      <div className="ma-toolbar">
        <input className="ma-input" aria-label={t("بحث", "Search")} placeholder={t("ابحث بالاسم أو الرابط…", "Search by name or slug…")}
          value={q} onChange={(event) => { setQ(event.target.value); setOffset(0); }} style={{ flex: "1 1 220px", maxWidth: 360 }} />
        <SelectField label={t("الحالة", "State")} value={state} onChange={(value) => { setState(value); setOffset(0); }} options={[
          { value: "all", label: t("كل الحالات", "All states") },
          { value: "stale", label: t("تغيّر بعد الفهرسة", "Changed since indexing") },
          { value: "not_indexed", label: t("غير مفهرس", "Not indexed") },
          { value: "indexed", label: t("مفهرس", "Indexed") },
          { value: "deleted", label: t("محذوف من الفهرس", "Removed") },
        ]} />
        <SelectField label={t("النوع", "Type")} value={type} onChange={(value) => { setType(value); setOffset(0); }} options={[
          { value: "all", label: t("كل الأنواع", "All types") },
          { value: "course", label: t("دورة", "Course") },
          { value: "diploma", label: t("دبلومة", "Diploma") },
          { value: "live_diploma", label: t("دبلومة مباشرة", "Live diploma") },
          { value: "package", label: t("باقة", "Package") },
          { value: "bundle", label: t("حزمة", "Bundle") },
          { value: "consultation", label: t("استشارة", "Consultation") },
        ]} />
        {canWrite ? (
          <>
            <Button sm kind="primary" icon="refresh" label={t(`فهرسة المحدد (${ids.length})`, `Index selected (${ids.length})`)}
              disabled={!ids.length || start.isPending} onClick={() => setPending({ action: "index", ids })} />
            <Button sm kind="secondary" icon="zap" label={t("إعادة تضمين كاملة", "Force re-embed")}
              disabled={!ids.length || start.isPending} onClick={() => setPending({ action: "force", ids })} />
            <Button sm kind="ghost" icon="trash" label={t("حذف من الفهرس", "Remove from index")}
              disabled={!ids.length || start.isPending} onClick={() => setPending({ action: "remove", ids })} />
          </>
        ) : null}
      </div>

      {products.isLoading ? <Loading /> : null}
      <ErrorAlert error={products.error} />
      {products.data && items.length === 0 ? <Empty text={t("لا منتجات بهذه الفلاتر.", "No products match these filters.")} icon="search" /> : null}
      {items.length ? (
        <Table data-testid="index-products">
          <TableHeader>
            <TableRow>
              {canWrite ? (
                <TableHead>
                  <Checkbox aria-label={t("تحديد الصفحة", "Select page")} checked={allOnPage}
                    onCheckedChange={(on) => items.forEach((item) => toggle(item.product_id, Boolean(on)))} />
                </TableHead>
              ) : null}
              <TableHead>{t("المنتج", "Product")}</TableHead>
              <TableHead>{t("حالة الفهرسة", "Index state")}</TableHead>
              <TableHead>{t("الأجزاء", "Chunks")}</TableHead>
              <TableHead>{t("آخر فهرسة", "Last indexed")}</TableHead>
              <TableHead>{t("آخر تعديل", "Last edited")}</TableHead>
              {canWrite ? <TableHead>{t("إجراء", "Action")}</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.product_id}>
                {canWrite ? (
                  <TableCell>
                    <Checkbox aria-label={t(`تحديد ${item.title ?? ""}`, `Select ${item.title ?? ""}`)} checked={selected.has(item.product_id)}
                      onCheckedChange={(on) => toggle(item.product_id, Boolean(on))} />
                  </TableCell>
                ) : null}
                <TableCell>
                  {item.title ?? item.slug ?? item.product_id}
                  <span className="ma-cell-sub">{[item.product_type, item.status, item.slug].filter(Boolean).join(" · ")}</span>
                </TableCell>
                <TableCell>
                  <StateBadge state={item.state} />
                  {item.deleted_reason && item.state === "deleted" ? <span className="ma-cell-sub">{item.deleted_reason}</span> : null}
                </TableCell>
                <TableCell className="ma-num">{formatNumber(item.indexed_chunks)}</TableCell>
                <TableCell>{formatDateTime(item.indexed_at)}</TableCell>
                <TableCell>{formatDateTime(item.updated_at)}</TableCell>
                {canWrite ? (
                  <TableCell>
                    <Button sm kind="ghost" icon="refresh" label={item.state === "indexed" ? t("إعادة", "Re-index") : t("فهرسة", "Index")}
                      disabled={start.isPending} onClick={() => start.mutate({ action: "index", ids: [item.product_id] })} />
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
      {total > PAGE ? (
        <div className="ma-row" style={{ padding: "var(--space-3)" }}>
          <Button sm kind="ghost" label={t("السابق", "Previous")} disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))} />
          <span className="ma-cell-sub">{t(`${offset + 1}–${Math.min(offset + PAGE, total)} من ${total}`, `${offset + 1}–${Math.min(offset + PAGE, total)} of ${total}`)}</span>
          <Button sm kind="ghost" label={t("التالي", "Next")} disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)} />
        </div>
      ) : null}

      <ConfirmModal
        open={pending !== null}
        onOpenChange={(open) => (!open ? setPending(null) : undefined)}
        tone={pending?.action === "remove" ? "danger" : "primary"}
        title={pending?.action === "remove"
          ? t(`حذف ${pending.ids.length} منتج من الفهرس؟`, `Remove ${pending.ids.length} products from the index?`)
          : pending?.action === "force"
            ? t(`إعادة تضمين ${pending.ids.length} منتج بالكامل؟`, `Re-embed ${pending.ids.length} products from scratch?`)
            : t(`فهرسة ${pending?.ids.length ?? 0} منتج؟`, `Index ${pending?.ids.length ?? 0} products?`)}
        message={pending?.action === "remove"
          ? t("لن تظهر في البحث الذكي ولا في المستشار حتى تُفهرس من جديد. يبقى المنتج نفسه كما هو.",
              "They stop appearing in smart search and the advisor until indexed again. The products themselves don't change.")
          : pending?.action === "force"
            ? t("يُعاد تضمين كل نصوصها حتى غير المتغيّرة. استخدمه بعد تغيير نموذج التضمين أو عند الشك.",
                "Every chunk is embedded again, even unchanged ones. Use after an embedding change or when in doubt.")
            : t("يُعاد تضمين النصوص التي تغيّرت فقط.", "Only text that changed is embedded again.")}
        confirmLabel={pending?.action === "remove" ? t("حذف من الفهرس", "Remove") : t("بدء", "Start")}
        loading={start.isPending}
        onConfirm={() => pending && start.mutate(pending)}
      />
    </Card>
  );
}
