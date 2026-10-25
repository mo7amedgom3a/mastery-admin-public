import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  assignExpertProduct,
  expertProfilesKeys,
  expertProfilesQueries,
  listExpertProductOptions,
  unassignExpertProduct,
  type ExpertProduct,
} from "@/lib/api";
import { useT } from "@/lib/i18n";
import { productHref } from "@/lib/refs";
import { initialsOf } from "@/lib/status";
import { AppLink } from "@/components/ui/app-link";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Avatar, Badge, Button, Card, Empty, ErrorAlert, Loading } from "@/components/ui/kit";
import { Modal } from "@/components/ui/modal";
import { SearchBox } from "@/components/ui/paged-list";
import { SelectField } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";

/*
 * What the expert teaches: courses, diplomas, live diplomas, packages and bundles (`b2c.product_instructors`),
 * plus the consultations they give (managed with their consultant profile). Assigning or removing refreshes
 * the product pages and the expert's storefront profile.
 */

type Kind = "course" | "diploma" | "live_diploma" | "package" | "bundle" | "consultation";
const KINDS: Kind[] = ["course", "diploma", "live_diploma", "package", "bundle", "consultation"];

function useKindLabel() {
  const t = useT();
  return (kind: string) =>
    ({
      course: t("الدورات", "Courses"),
      diploma: t("الدبلومات", "Diplomas"),
      live_diploma: t("الدبلومات المباشرة", "Live diplomas"),
      package: t("الباقات", "Packages"),
      bundle: t("الحزم", "Bundles"),
      consultation: t("الاستشارات", "Consultations"),
    })[kind] ?? kind;
}

function statusBadge(status: string) {
  const tone: "success" | "danger" | "warning" = status === "published" ? "success" : status === "archived" ? "danger" : "warning";
  const label =
    status === "published" ? { ar: "منشور", en: "Published" } : status === "archived" ? { ar: "مؤرشف", en: "Archived" } : { ar: "مسودة", en: "Draft" };
  return <Badge def={{ label, tone }} />;
}

function ProductCell({ row }: { row: ExpertProduct }) {
  return (
    <AppLink className="ma-cell-flex ma-link ma-link--plain" to={productHref(`b2c:${row.product_id}`)}>
      <Avatar initials={initialsOf(row.title ?? row.slug)} src={row.image} color="var(--teal)" alt={row.title ?? row.slug} square />
      <span>
        <span className="ma-cell-main">{row.title || row.slug}</span>
        <span className="ma-cell-sub"><bdi>{row.slug}</bdi></span>
      </span>
    </AppLink>
  );
}

export function ExpertProductsCard({ expertKey, consultantHref }: { expertKey: string; consultantHref: string | null }) {
  const t = useT();
  const kindLabel = useKindLabel();
  const queryClient = useQueryClient();
  const products = useQuery(expertProfilesQueries.products(expertKey));
  const [assigning, setAssigning] = useState(false);
  const [removing, setRemoving] = useState<ExpertProduct | null>(null);

  const settle = (rows: ExpertProduct[]) => {
    queryClient.setQueryData(expertProfilesKeys.products(expertKey), rows);
    queryClient.invalidateQueries({ queryKey: expertProfilesKeys.all });
  };
  const unassign = useMutation({
    mutationFn: (row: ExpertProduct) => unassignExpertProduct(expertKey, row.product_id),
    onSuccess: (rows) => {
      toast.success(t("تمت إزالة المدرّب من المنتج", "Removed from the product"));
      setRemoving(null);
      settle(rows);
    },
  });

  if (products.isLoading) return <Loading />;
  const rows = products.data ?? [];
  const columns = (kind: Kind): Column<ExpertProduct>[] => [
    { key: "product", header: kindLabel(kind), cell: (row) => <ProductCell row={row} /> },
    { key: "status", header: t("الحالة", "Status"), cell: (row) => statusBadge(row.status) },
    {
      key: "role",
      header: t("الدور", "Role"),
      cell: (row) =>
        row.via_consultant ? t("مقدّم الاستشارة", "Gives it") : row.is_primary ? t("المدرّب الرئيسي", "Lead instructor") : t("مدرّب مشارك", "Co-instructor"),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      cell: (row) =>
        row.via_consultant ? (
          consultantHref ? <Button sm kind="ghost" label={t("إدارة الاستشارات", "Manage")} href={consultantHref} /> : null
        ) : (
          <Button sm kind="ghost" icon="trash" label={t("إزالة", "Remove")} onClick={() => setRemoving(row)} />
        ),
    },
  ];

  return (
    <Card
      title={t("المنتجات والموارد", "Products & resources")}
      actions={<Button kind="primary" icon="plus" label={t("إسناد منتج", "Assign a product")} onClick={() => setAssigning(true)} />}
    >
      <ErrorAlert error={products.error} title={t("تعذّر تحميل المنتجات", "Couldn't load products")} />
      {products.isError ? <Button sm kind="ghost" icon="refresh" label={t("إعادة المحاولة", "Retry")} onClick={() => { void products.refetch(); }} /> : null}
      <ErrorAlert error={unassign.error} />
      {rows.length === 0 && !products.isError ? (
        <Empty text={t("لم يُسند أي منتج لهذا المدرّب بعد.", "Nothing assigned to this expert yet.")} />
      ) : rows.length > 0 ? (
        <div className="grid gap-6">
          {KINDS.map((kind) => {
            const ofKind = rows.filter((row) => row.product_type === kind);
            return ofKind.length ? (
              <section key={kind} className="grid gap-2">
                <h3 style={{ margin: 0, fontSize: "15px" }}>
                  {kindLabel(kind)} <span className="ma-muted">({ofKind.length})</span>
                </h3>
                <DataTable rows={ofKind} columns={columns(kind)} empty="—" />
              </section>
            ) : null;
          })}
        </div>
      ) : null}
      {assigning ? (
        <AssignProductModal expertKey={expertKey} onClose={() => setAssigning(false)} onAssigned={settle} />
      ) : null}
      <ConfirmModal
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t("إزالة المدرّب من المنتج؟", "Remove from this product?")}
        message={removing?.title ?? removing?.slug ?? ""}
        description={
          removing?.is_primary
            ? t("هو المدرّب الرئيسي؛ سيصبح المدرّب التالي رئيسيًا.", "They are the lead instructor; the next instructor becomes the lead.")
            : undefined
        }
        confirmLabel={t("إزالة", "Remove")}
        loading={unassign.isPending}
        onConfirm={() => removing && unassign.mutate(removing)}
      />
    </Card>
  );
}

function AssignProductModal({
  expertKey,
  onClose,
  onAssigned,
}: {
  expertKey: string;
  onClose: () => void;
  onAssigned: (rows: ExpertProduct[]) => void;
}) {
  const t = useT();
  const kindLabel = useKindLabel();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const params = { query: query.trim() || undefined, product_type: (type || undefined) as Exclude<Kind, "consultation"> | undefined };
  const options = useQuery({
    queryKey: expertProfilesKeys.options(expertKey, params),
    queryFn: () => listExpertProductOptions(expertKey, params),
  });
  const assign = useMutation({
    mutationFn: (row: ExpertProduct) => assignExpertProduct(expertKey, row.product_id),
    onSuccess: (rows, row) => {
      toast.success(t(`تم إسناد «${row.title ?? row.slug}»`, `Assigned “${row.title ?? row.slug}”`));
      onAssigned(rows);
      options.refetch();
    },
  });

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} size="lg" title={t("إسناد منتج للمدرّب", "Assign a product")}>
      <div className="grid gap-3">
        <div className="ma-cell-flex" style={{ gap: "var(--space-3)", flexWrap: "wrap" }}>
          <SearchBox placeholder={t("ابحث بالعنوان أو الرابط…", "Search title or slug…")} value={query} onChange={setQuery} />
          <SelectField
            label={t("النوع", "Type")}
            value={type}
            onChange={setType}
            options={[
              { value: "", label: t("كل الأنواع", "All types") },
              ...KINDS.filter((kind) => kind !== "consultation").map((kind) => ({ value: kind, label: kindLabel(kind) })),
            ]}
          />
        </div>
        <ErrorAlert error={options.error ?? assign.error} />
        <DataTable
          rows={options.data ?? []}
          loading={options.isLoading}
          empty={t("لا منتجات مطابقة.", "No matching products.")}
          columns={[
            { key: "product", header: t("المنتج", "Product"), cell: (row) => <ProductCell row={row} /> },
            { key: "type", header: t("النوع", "Type"), cell: (row) => kindLabel(row.product_type) },
            { key: "status", header: t("الحالة", "Status"), cell: (row) => statusBadge(row.status) },
            {
              key: "assign",
              header: "",
              align: "end",
              cell: (row) => (
                <Button
                  sm
                  kind="primary"
                  icon="plus"
                  disabled={assign.isPending}
                  label={t("إسناد", "Assign")}
                  onClick={() => assign.mutate(row)}
                />
              ),
            },
          ]}
        />
      </div>
    </Modal>
  );
}
