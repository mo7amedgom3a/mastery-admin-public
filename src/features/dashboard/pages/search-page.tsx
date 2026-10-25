import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { listInstructors, search, searchKeys, searchOptions, type SearchParams, type SearchResult } from "@/lib/api";
import { formatAmount, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { initialsOf } from "@/lib/status";
import { AppLink } from "@/components/ui/app-link";
import { Avatar, Card, Empty, ErrorAlert, Loading, PageHead } from "@/components/ui/kit";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SelectField } from "@/components/ui/select";
import { Pagination } from "@/components/ui/primitives";
import { SearchBox } from "@/components/ui/paged-list";

const PAGE_SIZE = 25;

type Filters = {
  product_type: string;
  category: string;
  skill: string;
  tag: string;
  min_rating: string;
  sort: string;
};

const EMPTY: Filters = { product_type: "", category: "", skill: "", tag: "", min_rating: "", sort: "relevance" };

export default function SearchPage() {
  const t = useT();
  const [searchParams] = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQ);
  const [submitted, setSubmitted] = useState(initialQ);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const nextQ = searchParams.get("q") ?? "";
    if (nextQ && nextQ !== submitted) {
      setQuery(nextQ);
      setSubmitted(nextQ);
      setOffset(0);
    }
  }, [searchParams]);

  const params: SearchParams = {
    q: submitted || undefined,
    product_type: filters.product_type ? [filters.product_type] : undefined,
    category: filters.category ? [filters.category] : undefined,
    skill: filters.skill ? [filters.skill] : undefined,
    tag: filters.tag ? [filters.tag] : undefined,
    min_rating: filters.min_rating ? Number(filters.min_rating) : undefined,
    sort: filters.sort || undefined,
    limit: PAGE_SIZE,
    offset,
  };

  const results = useQuery({ queryKey: searchKeys.results(params), queryFn: () => search(params) });
  const options = useQuery({ queryKey: searchKeys.options(), queryFn: () => searchOptions() });
  const instructors = useQuery({ queryKey: ["search", "instructors"], queryFn: () => listInstructors({ limit: 200 }), enabled: submitted.length >= 2 });

  const matchedInstructors = (instructors.data ?? []).filter((row) =>
    submitted ? row.display_name.toLowerCase().includes(submitted.toLowerCase()) : false,
  );

  const columns: Column<SearchResult>[] = [
    {
      key: "title",
      header: t("النتيجة", "Result"),
      cell: (row) => {
        const itemImage =
          row.course?.square_image ??
          (row.course as unknown as { squareImage?: string })?.squareImage ??
          row.course?.image ??
          (row.package as unknown as { square_image?: string })?.square_image ??
          (row.package as unknown as { squareImage?: string })?.squareImage ??
          row.package?.image ??
          (row.consultation as unknown as { square_image?: string })?.square_image ??
          (row.consultation as unknown as { squareImage?: string })?.squareImage ??
          row.consultation?.image;

        return (
          <AppLink className="ma-cell-flex ma-link ma-link--plain" to={`/learning/catalog/${row.id}`}>
            <Avatar
              initials={initialsOf(row.title ?? row.slug ?? "?")}
              src={itemImage}
              color="var(--teal)"
              alt={row.title ?? ""}
              square
            />
            <span>
              <span className="ma-cell-main">{row.title ?? row.slug ?? row.id.slice(0, 8)}</span>
              <span className="ma-cell-sub">{[row.product_type, row.status].filter(Boolean).join(" · ") || row.result_type}</span>
            </span>
          </AppLink>
        );
      },
    },
    {
      key: "terms",
      header: t("تصنيفات ومهارات", "Categories & skills"),
      cell: (row) => <span className="ma-cell-sub">{[...row.categories, ...row.skills, ...row.tags].slice(0, 4).join(" · ") || "—"}</span>,
    },
    { key: "instructors", header: t("المدربون", "Instructors"), cell: (row) => <span className="ma-cell-sub">{(row.instructors ?? []).join(" · ") || "—"}</span> },
    {
      key: "price",
      header: t("السعر", "Price"),
      align: "end",
      cell: (row) => (row.price_amount != null ? <span className="ma-num">{formatAmount(Number(row.price_amount), row.currency_code ?? "USD")}</span> : "—"),
    },
    { key: "rating", header: t("التقييم", "Rating"), align: "end", cell: (row) => (row.rating != null ? <span className="ma-num">{row.rating}</span> : "—") },
  ];

  const data = results.data;

  return (
    <>
      <PageHead title={t("البحث", "Search")} sub={t("ابحث عن المنتجات والدورات والمدرّبين حسب النوع والتصنيف والمهارة والوسم.", "Search products, courses and instructors by type, category, skill and tag.")} />

      <Card>
        <div className="ma-toolbar">
          <SearchBox
            placeholder={t("ابحث بالعنوان أو الوسم أو المهارة…", "Search title, tag or skill…")}
            value={query}
            onChange={setQuery}
            onSubmit={(value) => {
              setSubmitted(value);
              setOffset(0);
            }}
          />
          <SelectField
            label={t("النوع", "Type")}
            value={filters.product_type || "all"}
            onChange={(value) => { setFilters((f) => ({ ...f, product_type: value === "all" ? "" : value })); setOffset(0); }}
            options={[{ value: "all", label: t("كل الأنواع", "All types") }, ...(options.data?.product_types ?? []).map((item) => ({ value: item.code, label: item.name }))]}
          />
          <SelectField
            label={t("التصنيف", "Category")}
            value={filters.category || "all"}
            onChange={(value) => { setFilters((f) => ({ ...f, category: value === "all" ? "" : value })); setOffset(0); }}
            options={[{ value: "all", label: t("كل التصنيفات", "All categories") }, ...(options.data?.categories ?? []).map((item) => ({ value: item.code, label: item.name }))]}
          />
          <SelectField
            label={t("المهارة", "Skill")}
            value={filters.skill || "all"}
            onChange={(value) => { setFilters((f) => ({ ...f, skill: value === "all" ? "" : value })); setOffset(0); }}
            options={[{ value: "all", label: t("كل المهارات", "All skills") }, ...(options.data?.skills ?? []).map((item) => ({ value: item.code, label: item.name }))]}
          />
          <SelectField
            label={t("الترتيب", "Sort")}
            value={filters.sort}
            onChange={(value) => { setFilters((f) => ({ ...f, sort: value })); setOffset(0); }}
            options={[
              { value: "relevance", label: t("الأكثر صلة", "Relevance") },
              { value: "rating", label: t("الأعلى تقييمًا", "Top rated") },
              { value: "price_asc", label: t("السعر تصاعديًا", "Price ↑") },
              { value: "price_desc", label: t("السعر تنازليًا", "Price ↓") },
            ]}
          />
        </div>
      </Card>

      <ErrorAlert error={results.error} />

      <Card title={t("المنتجات", "Products")} className="ma-section-gap">
        {results.isLoading ? (
          <Loading />
        ) : (
          <DataTable
            rows={data?.items ?? []}
            columns={columns}
            empty={t("لا نتائج.", "No results.")}
            footer={data ? <Pagination total={data.total} limit={data.limit} offset={data.offset} onPage={setOffset} /> : null}
          />
        )}
      </Card>

      {submitted.length >= 2 ? (
        <Card title={t("المدربون", "Instructors")} className="ma-section-gap">
          {matchedInstructors.length ? (
            <div className="ma-kpis">
              {matchedInstructors.map((row) => (
                <AppLink key={row.instructor_id} className="ma-link ma-link--plain" to={`/learning/instructors/${row.legacy_trainer_id}`}>
                  <span className="ma-cell-flex">
                    <Avatar initials={initialsOf(row.display_name)} src={row.avatar_url} color="var(--sky)" alt={row.display_name} />
                    <span>
                      <span className="ma-cell-main">{row.display_name}</span>
                      <span className="ma-cell-sub">{row.specialized || row.city || `${formatNumber(row.product_count)} ${t("منتج", "products")}`}</span>
                    </span>
                  </span>
                </AppLink>
              ))}
            </div>
          ) : (
            <Empty icon="users" text={t("لا مدرّبين مطابقين.", "No matching instructors.")} />
          )}
        </Card>
      ) : null}
    </>
  );
}
