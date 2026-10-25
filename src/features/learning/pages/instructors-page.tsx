import { useMemo, useState } from "react";
import { expertProfilesKeys, listExpertProfiles, type ExpertProfileRow } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { initialsOf } from "@/lib/status";
import { AppLink } from "@/components/ui/app-link";
import { Avatar, Badge, Button, PageHead } from "@/components/ui/kit";
import { type Column } from "@/components/ui/data-table";
import { PagedList, type ListFilter } from "@/components/ui/paged-list";
import { DuplicatesModal } from "@/features/learning/expert-profile/duplicates-modal";

/** Experts on B2C (`/admin/catalog/instructors`): trainers, consultants, or both under one profile. */
export default function InstructorsPage() {
  const t = useT();
  const [duplicates, setDuplicates] = useState(false);

  const columns: Column<ExpertProfileRow>[] = [
    {
      key: "name",
      header: t("المدرب / الخبير", "Expert"),
      exportValue: (row) => [row.name, row.headline].filter(Boolean).join(" · "),
      sortable: true,
      sortValue: (row) => row.name ?? "",
      cell: (row) => (
        <AppLink className="ma-cell-flex ma-link ma-link--plain" to={`/learning/instructors/${encodeURIComponent(row.key)}`}>
          <Avatar initials={initialsOf(row.name)} src={row.avatar_url} color="var(--sky)" alt={row.name} />
          <span>
            <span className="ma-cell-main">{row.name || "—"}</span>
            <span className="ma-cell-sub">{row.headline || row.specialized || "—"}</span>
          </span>
        </AppLink>
      ),
    },
    {
      key: "roles",
      header: t("الصفة", "Role"),
      exportValue: (row) =>
        [row.product_count > 0 ? t("مدرّب", "Trainer") : null, row.is_consultant ? t("خبير استشارات", "Consultant") : null]
          .filter(Boolean)
          .join(" · "),
      cell: (row) => (
        <span className="ma-cell-flex" style={{ gap: "4px", flexWrap: "wrap" }}>
          {row.product_count > 0 ? <Badge def={{ label: { ar: "مدرّب", en: "Trainer" }, tone: "info" }} /> : null}
          {row.is_consultant ? <Badge def={{ label: { ar: "خبير استشارات", en: "Consultant" }, tone: "info" }} /> : null}
          {row.product_count === 0 && !row.is_consultant ? "—" : null}
        </span>
      ),
    },
    {
      key: "products",
      header: t("المنتجات", "Products"),
      exportKind: "number",
      align: "end",
      sortable: true,
      sortValue: (row) => row.product_count,
      cell: (row) => <span className="ma-num">{formatNumber(row.product_count)}</span>,
    },
    {
      key: "consultations",
      header: t("الاستشارات", "Consultations"),
      exportKind: "number",
      align: "end",
      sortable: true,
      sortValue: (row) => row.consultation_count,
      cell: (row) => <span className="ma-num">{formatNumber(row.consultation_count)}</span>,
    },
    {
      key: "readme",
      header: t("محتوى الصفحة", "Page content"),
      exportValue: (row) => (row.has_page ? t("صفحة الاستوديو", "Studio page") : row.has_readme ? "README" : t("نبذة قديمة", "Legacy bio")),
      cell: (row) =>
        row.has_page ? t("صفحة الاستوديو", "Studio page") : row.has_readme ? "README" : <span className="ma-muted">{t("نبذة قديمة", "Legacy bio")}</span>,
    },
    {
      key: "status",
      header: t("الحالة", "Status"),
      exportValue: (row) => (row.status === "active" ? t("نشط", "Active") : t("موقوف", "Inactive")),
      sortable: true,
      sortValue: (row) => (row.status === "active" ? 1 : 0),
      cell: (row) => (
        <span className="ma-cell-flex" style={{ gap: "4px" }}>
          <Badge
            def={{
              label: row.status === "active" ? { ar: "نشط", en: "Active" } : { ar: "موقوف", en: "Inactive" },
              tone: row.status === "active" ? "success" : "warning",
            }}
          />
          {row.is_featured ? <Badge def={{ label: { ar: "مميّز", en: "Featured" }, tone: "neutral" }} /> : null}
        </span>
      ),
    },
    {
      key: "key",
      header: t("المفتاح", "Key"),
      align: "end",
      exportValue: (row) => row.key,
      cell: (row) => <span className="ma-num"><bdi>{row.key.length > 12 ? `${row.key.slice(0, 8)}…` : row.key}</bdi></span>,
    },
  ];

  const filters: ListFilter[] = useMemo(
    () => [
      {
        key: "status",
        label: t("كل الحالات", "All states"),
        options: [
          { value: "active", label: t("نشط", "Active") },
          { value: "inactive", label: t("موقوف", "Inactive") },
        ],
      },
      {
        key: "consultant",
        label: t("الكل (مدربون وخبراء)", "Everyone"),
        options: [
          { value: "true", label: t("يقدّمون استشارات", "Give consultations") },
          { value: "false", label: t("بدون استشارات", "No consultations") },
        ],
      },
      {
        key: "featured",
        label: t("كل الظهور", "Any placement"),
        options: [{ value: "true", label: t("في الصفحة الرئيسية", "On the landing page") }],
      },
    ],
    [t],
  );

  const flag = (value: string | undefined) => (value ? value === "true" : undefined);

  return (
    <>
      <PageHead
        title={t("المدربون والخبراء", "Instructors & experts")}
        sub={t(
          "ملفات المدربين وخبراء الاستشارات كما تظهر في الموقع: البيانات والصور ومحتوى الصفحة والمنتجات المسندة.",
          "Trainer and consultant profiles as the site shows them: details, images, page content and assigned products.",
        )}
        actions={
          <>
            <Button kind="ghost" icon="copy" label={t("ملفات مكررة", "Duplicates")} onClick={() => setDuplicates(true)} />
            <Button kind="ghost" icon="calendar" label={t("إدارة الاستشارات", "Consultations")} href="/consultations/experts" />
          </>
        }
      />
      <PagedList
        queryKeyBase={expertProfilesKeys.list()}
        refreshOnFocus
        fetchPage={({ query, offset, limit, filters: selected }) =>
          listExpertProfiles({
            query: query || undefined,
            status: (selected.status || undefined) as "active" | "inactive" | undefined,
            consultant: flag(selected.consultant),
            featured: flag(selected.featured),
            limit,
            offset,
          })
        }
        columns={columns}
        searchPlaceholder={t("ابحث بالاسم أو اللقب أو التخصص أو المفتاح…", "Search name, title, specialty or key…")}
        filters={filters}
        empty={t("لا مدربين.", "No experts.")}
        exportConfig={{ filename: "experts", title: t("المدربون والخبراء", "Instructors & experts"), pdf: true, fetchSize: 200 }}
      />
      {duplicates ? <DuplicatesModal onClose={() => setDuplicates(false)} /> : null}
    </>
  );
}
