import { useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { useT } from "@/lib/i18n";
import { Card, IconButton } from "@/components/ui/kit";
import type { ExportColumn } from "@/lib/export/types";
import { fetchAllPages } from "@/lib/export/fetch-all";
import { DataTable, type Column, type SortState } from "@/components/ui/data-table";
import { SearchIcon, type AnimatedIconHandle } from "@/components/icons/animated";
import { SelectField } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { Pagination } from "@/components/ui/primitives";

export type PageResult<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

/** A toolbar filter that maps to one API query parameter (select-based). */
export type ListFilter = {
  /** API query-param name, e.g. `status`, `payment_status`, `published`. */
  key: string;
  label: string;
  options: { value: string; label: string }[];
};

export type PagedListProps<T> = {
  /** Stable query key prefix for this list (e.g. `["iam", "admin-users"]`). */
  queryKeyBase: readonly unknown[];
  fetchPage: (params: {
    query?: string;
    offset: number;
    limit: number;
    /** Selected filter values, keyed by API param name; unset keys are omitted. */
    filters: Record<string, string>;
    /** Selected multi-filter values, keyed by API param name; empty keys are omitted. */
    multi?: Record<string, string[]>;
    /** Present when `sort` is configured. */
    sort?: SortState;
  }) => Promise<PageResult<T>>;
  columns: Column<T>[];
  searchPlaceholder?: string;
  /** Select filters wired straight to API query params. */
  filters?: ListFilter[];
  /** Multi-select facet filters (checkboxes); each maps to one API query param. */
  multiFilters?: ListFilter[];
  /** Extra controls rendered after the filters (e.g. a source switch). */
  toolbar?: ReactNode;
  empty?: string;
  pageSize?: number;
  /** Refresh this list on navigation and when the admin returns to the browser tab. */
  refreshOnFocus?: boolean;
  /**
   * Server-side sort over the whole list: a "Sort by" select plus a direction toggle, and header
   * clicks on columns that declare a matching `sortKey`.
   */
  sort?: { options: { value: string; label: string }[]; initial: SortState };
  /**
   * Adds the Export menu. Excel exports every row matching the active search, filters and sort
   * (fetched page by page, capped); `pdf` adds the branded PDF report.
   */
  exportConfig?: {
    filename: string;
    title: string;
    pdf?: boolean;
    /** Page size for the fetch-all walk; keep within the endpoint's `limit` maximum (default 50). */
    fetchSize?: number;
    /** Extra summary lines for the report/sheet header, e.g. the page's date range. */
    describe?: () => string[];
    /** Export-only columns (not shown on screen), appended after the table columns. */
    extraColumns?: ExportColumn<T>[];
  };
};

/** A searchable, filterable, paginated table backed by a B2C `Page<T>` endpoint. */
export function PagedList<T>({
  queryKeyBase,
  fetchPage,
  columns,
  searchPlaceholder,
  filters,
  multiFilters,
  toolbar,
  empty,
  pageSize = 25,
  refreshOnFocus = false,
  sort,
  exportConfig,
}: PagedListProps<T>) {
  const t = useT();
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [multiValues, setMultiValues] = useState<Record<string, string[]>>({});
  const [order, setOrder] = useState<SortState | undefined>(sort?.initial);

  const changeSort = (next: SortState) => {
    setOrder(next);
    setOffset(0);
  };

  const result = useQuery({
    queryKey: [...queryKeyBase, { search, offset, values, multiValues, order }],
    queryFn: () =>
      fetchPage({ query: search || undefined, offset, limit: pageSize, filters: values, multi: multiValues, sort: order }),
    ...(refreshOnFocus ? { staleTime: 0, refetchOnMount: "always" as const, refetchOnWindowFocus: true } : {}),
  });

  const activeFilters = [
    search ? `${t("بحث", "Search")}: ${search}` : null,
    ...(filters ?? []).map((filter) => {
      const value = values[filter.key];
      const option = filter.options.find((item) => item.value === value);
      return value && option ? `${filter.label}: ${option.label}` : null;
    }),
    ...(multiFilters ?? []).map((filter) => {
      const picked = (multiValues[filter.key] ?? [])
        .map((value) => filter.options.find((item) => item.value === value)?.label ?? value)
        .join(", ");
      return picked ? `${filter.label}: ${picked}` : null;
    }),
  ].filter((line): line is string => Boolean(line));

  const hasToolbar = Boolean(
    searchPlaceholder || (filters && filters.length) || (multiFilters && multiFilters.length) || toolbar || sort,
  );

  return (
    <Card flush>
      <DataTable
        columns={columns}
        rows={result.data?.items ?? []}
        empty={empty}
        loading={result.isLoading}
        error={result.error}
        exportConfig={
          exportConfig
            ? {
                filename: exportConfig.filename,
                title: exportConfig.title,
                pdf: exportConfig.pdf,
                extraColumns: exportConfig.extraColumns,
                meta: { filters: [...(exportConfig.describe?.() ?? []), ...activeFilters] },
                fetchAll: async (max, onProgress) => {
                  const all = await fetchAllPages(
                    (from, limit) =>
                      fetchPage({ query: search || undefined, offset: from, limit, filters: values, multi: multiValues, sort: order }),
                    { pageSize: exportConfig.fetchSize, max, onProgress },
                  );
                  return { items: all.items, truncated: all.truncated };
                },
              }
            : undefined
        }
        toolbar={
          hasToolbar ? (
            <>
              {searchPlaceholder ? (
                <SearchBox
                  placeholder={searchPlaceholder}
                  value={text}
                  onChange={setText}
                  onSubmit={(query) => {
                    setSearch(query);
                    setOffset(0);
                  }}
                />
              ) : null}

              {(filters ?? []).map((filter) => (
                <SelectField
                  key={filter.key}
                  label={filter.label}
                  value={values[filter.key] || "all"}
                  onChange={(value) => {
                    setValues((prev) => ({ ...prev, [filter.key]: value === "all" ? "" : value }));
                    setOffset(0);
                  }}
                  options={[{ value: "all", label: filter.label }, ...filter.options]}
                />
              ))}

              {(multiFilters ?? []).map((filter) => (
                <MultiSelect
                  key={filter.key}
                  label={filter.label}
                  options={filter.options}
                  selected={multiValues[filter.key] ?? []}
                  onChange={(next) => {
                    setMultiValues((prev) => ({ ...prev, [filter.key]: next }));
                    setOffset(0);
                  }}
                />
              ))}

              {sort && order ? (
                <div className="ma-sortby">
                  <SelectField
                    label={t("ترتيب حسب", "Sort by")}
                    value={order.key}
                    onChange={(key) => changeSort({ key, dir: order.dir })}
                    options={sort.options.map((option) => ({ value: option.value, label: `${t("ترتيب:", "Sort:")} ${option.label}` }))}
                  />
                  <IconButton
                    icon={order.dir === "asc" ? "sortAsc" : "sortDesc"}
                    label={order.dir === "asc" ? t("تصاعدي", "Ascending") : t("تنازلي", "Descending")}
                    onClick={() => changeSort({ key: order.key, dir: order.dir === "asc" ? "desc" : "asc" })}
                  />
                </div>
              ) : null}

              {toolbar}
            </>
          ) : undefined
        }
        serverSort={sort ? order : undefined}
        onServerSort={sort ? changeSort : undefined}
        footer={
          result.data ? <Pagination total={result.data.total} limit={result.data.limit} offset={result.data.offset} onPage={setOffset} /> : null
        }
      />
    </Card>
  );
}

/**
 * Search input with the kit icon. Submits on Enter; clearing the box (×) submits the empty query
 * so the list resets without an extra keystroke.
 */
export function SearchBox({
  placeholder,
  value,
  onChange,
  onSubmit,
  label,
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  label?: string;
}) {
  const icon = useRef<AnimatedIconHandle>(null);
  return (
    <form
      className="ma-search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(value);
      }}
    >
      <SearchIcon ref={icon} size={18} className="ma-search__icon" />
      <input
        className="ma-input ma-input--search"
        type="search"
        aria-label={label ?? placeholder}
        placeholder={placeholder}
        value={value}
        onFocus={() => icon.current?.startAnimation()}
        onBlur={() => icon.current?.stopAnimation()}
        onChange={(event) => {
          onChange(event.target.value);
          if (event.target.value === "" && value !== "") onSubmit?.("");
        }}
      />
    </form>
  );
}
