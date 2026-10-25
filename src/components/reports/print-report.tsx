import { dirOf, translate, type Lang } from "@/lib/i18n";
import { formatExportCell } from "@/lib/export/columns";
import type { ExportColumn, ExportMeta } from "@/lib/export/types";
import logoSvg from "@/assets/brand/ma-logo-coral-ink.svg?raw";

/** A pre-rendered chart image placed between the summary tiles and the table. */
export type PrintFigure = { src: string; width: number; height: number };

export type PrintReportProps<T> = {
  lang: Lang;
  title: string;
  generatedAt: string;
  columns: ExportColumn<T>[];
  rows: T[];
  meta?: ExportMeta;
  figures?: PrintFigure[];
};

const isNumeric = (column: ExportColumn<never>) => column.align === "end" || column.kind === "money" || column.kind === "number";
const cellClass = (column: ExportColumn<never>) =>
  [isNumeric(column) ? "is-num" : "", column.kind && column.kind !== "text" ? "is-nowrap" : ""].filter(Boolean).join(" ") || undefined;

/**
 * The branded A4 report that `lib/export/pdf.ts` rasterises: kit logo, title with the coral rule,
 * meta lines, summary tiles and the table. Styled by `styles/print.css` (always the light palette).
 * `data-pdf-*` attributes mark the page-break candidates the paginator measures.
 */
export function PrintReport<T>({ lang, title, generatedAt, columns, rows, meta, figures }: PrintReportProps<T>) {
  const t = (ar: string, en: string) => translate(lang, ar, en);
  return (
    <div className="pdf-report" dir={dirOf(lang)} lang={lang}>
      <div data-pdf-block>
        <div className="pdf-report__brand">
          <span role="img" aria-label="Mastery Academy" dangerouslySetInnerHTML={{ __html: logoSvg }} />
          <span className="pdf-report__brand-note">{t("لوحة الإدارة", "Admin dashboard")}</span>
        </div>
        <h1 className="pdf-report__title">{title}</h1>
        <div className="pdf-report__rule" />
        <div className="pdf-report__meta">
          <span>{generatedAt}</span>
          {(meta?.filters ?? []).map((line) => (
            <span key={line}>{line}</span>
          ))}
          <span>
            {t("عدد السجلات", "Records")}: {rows.length}
          </span>
        </div>
      </div>

      {meta?.summary?.length ? (
        <div className="pdf-report__summary" data-pdf-block>
          {meta.summary.map((tile) => (
            <div className="pdf-report__tile" key={tile.label}>
              <div className="pdf-report__tile-label">{tile.label}</div>
              <div className="pdf-report__tile-value">{tile.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      {(figures ?? []).map((figure, index) => (
        <div className="pdf-report__figure" data-pdf-block key={index}>
          <img src={figure.src} width={figure.width / 2} height={figure.height / 2} alt="" />
        </div>
      ))}

      {rows.length === 0 ? (
        <div className="pdf-report__empty" data-pdf-block>
          {t("لا توجد بيانات.", "No data.")}
        </div>
      ) : (
        <table className="pdf-report__table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={isNumeric(column) ? "is-num" : undefined}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {columns.map((column) => (
                  <td key={column.key} className={cellClass(column)}>
                    <bdi>{formatExportCell(column, row)}</bdi>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {meta?.truncated ? (
        <div className="pdf-report__note" data-pdf-block>
          {t("تم اقتطاع النتيجة عند الحد الأقصى لعدد الصفوف. قم بتضييق الفلاتر لتصدير الباقي.", "The result was cut at the row limit. Narrow the filters to export the rest.")}
        </div>
      ) : null}
    </div>
  );
}
