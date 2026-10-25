import { createElement } from "react";

import { PrintReport, type PrintFigure } from "@/components/reports/print-report";
import { localeOf, translate, useLangStore } from "@/lib/i18n";
import { applyLightReportStyles } from "./legacy";
import { renderReportToPdf, withProbeFix } from "./pdf";
import type { ExportColumn } from "./types";

type Cell = string | number | null | undefined;

const text = (el: Element | null) => el?.textContent?.replace(/\s+/g, " ").trim() ?? "";

/** Rasterises one chart panel on the light palette so it can sit inside the report as an image. */
async function captureFigure(el: HTMLElement): Promise<PrintFigure> {
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await withProbeFix(() =>
    html2canvas(el, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      onclone: (clonedDoc, clonedEl) => {
        applyLightReportStyles(clonedDoc, clonedEl);
        clonedEl.querySelectorAll("[data-no-print]").forEach((node) => ((node as HTMLElement).style.display = "none"));
      },
    }),
  );
  return { src: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
}

/**
 * Builds a branded report PDF for an analytics/sales page: KPI tiles and chart panels are read from the page's
 * `*-content` wrapper, the table is the same `headers` + `rows` the CSV/Excel export uses. The period is taken
 * from the `YYYY-MM-DD-to-YYYY-MM-DD` suffix of the file name when present.
 */
export async function exportReportPdf(filename: string, headers: string[], rows: Cell[][]): Promise<void> {
  const lang = useLangStore.getState().lang;
  const t = (ar: string, en: string) => translate(lang, ar, en);
  const root = document.querySelector<HTMLElement>('main [id$="-content"]');

  const summary = Array.from(root?.querySelectorAll(".ma-kpi") ?? [])
    .map((kpi) => ({ label: text(kpi.querySelector(".ma-kpi__label")), value: text(kpi.querySelector(".ma-kpi__value")) }))
    .filter((tile) => tile.label && tile.value);

  const panels = Array.from(root?.querySelectorAll<HTMLElement>(".ma-panel") ?? []).filter((panel) => panel.querySelector("svg.recharts-surface"));
  const figures: PrintFigure[] = [];
  for (const panel of panels) figures.push(await captureFigure(panel));

  const period = /(\d{4}-\d{2}-\d{2})-to-(\d{4}-\d{2}-\d{2})/.exec(filename);
  const columns: ExportColumn<Cell[]>[] = headers.map((header, index) => {
    const numeric = rows.length > 0 && rows.every((row) => row[index] == null || typeof row[index] === "number");
    return { key: `c${index}`, header, kind: numeric ? "number" : "text", value: (row) => row[index] ?? null };
  });

  const generatedAt = `${t("تاريخ التصدير", "Generated")}: ${new Intl.DateTimeFormat(localeOf(lang), { dateStyle: "medium", timeStyle: "short" }).format(new Date())}`;
  await renderReportToPdf(
    createElement(PrintReport<Cell[]>, {
      lang,
      title: document.querySelector("main h1")?.textContent?.trim() || filename,
      generatedAt,
      columns,
      rows,
      figures,
      meta: { summary, filters: period ? [`${t("الفترة", "Period")}: ${period[1]} → ${period[2]}`] : [] },
    }),
    filename.replace(/\.(csv|xlsx|pdf)$/, ""),
  );
}
