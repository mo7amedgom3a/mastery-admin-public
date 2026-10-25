import { createElement, useCallback, useState } from "react";

import { toast } from "@/components/ui/toast";
import { PrintReport } from "@/components/reports/print-report";
import { localeOf, translate, useLang } from "@/lib/i18n";
import { EXCEL_ROW_LIMIT, PDF_ROW_LIMIT } from "./fetch-all";
import type { ExportColumn, ExportMeta } from "./types";

export type TableExportConfig<T> = {
  /** File name without extension; a date stamp is appended. */
  filename: string;
  title: string;
  columns: ExportColumn<T>[];
  /** Rows to export. Paged lists pass a fetcher so the whole filtered result is exported, not just the loaded page. */
  getRows: (max: number, onProgress?: (done: number, total: number) => void) => Promise<{ items: T[]; truncated: boolean; columns?: ExportColumn<T>[]; title?: string }>;
  meta?: ExportMeta;
  /** Show the PDF entry (report-style pages only). */
  pdf?: boolean;
};

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

/** Busy state, row fetching, toasts and error handling shared by every Export menu. */
export function useTableExport<T>(config: TableExportConfig<T> | undefined) {
  const lang = useLang();
  const [busy, setBusy] = useState<"xlsx" | "pdf" | null>(null);
  const t = useCallback((ar: string, en: string) => translate(lang, ar, en), [lang]);

  const run = useCallback(
    async (kind: "xlsx" | "pdf") => {
      if (!config || busy) return;
      setBusy(kind);
      try {
        const max = kind === "pdf" ? PDF_ROW_LIMIT : EXCEL_ROW_LIMIT;
        const { items, truncated, columns = config.columns, title = config.title } = await config.getRows(max);
        const generatedAt = `${t("تاريخ التصدير", "Generated")}: ${new Intl.DateTimeFormat(localeOf(lang), { dateStyle: "medium", timeStyle: "short" }).format(new Date())}`;
        const meta = { ...config.meta, truncated };
        const file = `${config.filename}-${stamp()}`;
        if (kind === "xlsx") {
          const { exportTableToExcel } = await import("./excel");
          await exportTableToExcel({ filename: file, title, columns, rows: items, rtl: lang === "ar", generatedAtLabel: generatedAt, meta: { ...meta, filters: [...(meta.filters ?? []), ...(truncated ? [t(`تم اقتطاع النتيجة عند ${max} صف`, `Result cut at ${max} rows`)] : [])] } });
        } else {
          const { renderReportToPdf } = await import("./pdf");
          await renderReportToPdf(createElement(PrintReport<T>, { lang, title, generatedAt, columns, rows: items, meta }), file);
        }
        if (truncated) toast.warning(t("تم التصدير جزئيًا", "Exported partially"), t(`تجاوزت النتيجة ${max} صف؛ ضيّق الفلاتر لتصدير الباقي.`, `The result exceeds ${max} rows; narrow the filters to export the rest.`));
        else toast.success(t("تم التصدير", "Export ready"), `${items.length} ${t("سجل", "rows")}`);
      } catch (error) {
        toast.error(t("تعذّر التصدير", "Export failed"), error instanceof Error ? error.message : undefined);
      } finally {
        setBusy(null);
      }
    },
    [config, busy, lang, t],
  );

  return {
    busy,
    exportExcel: () => run("xlsx"),
    exportPdf: () => run("pdf"),
  };
}
