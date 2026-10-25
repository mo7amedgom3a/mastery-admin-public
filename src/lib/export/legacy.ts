import { withProbeFix } from "./pdf";
import type { ExportColumn } from "./types";
import { localeOf, translate, useLangStore } from "@/lib/i18n";
import logoSvg from "@/assets/brand/ma-logo-coral-ink.svg?raw";

/**
 * Exports data rows to a clean UTF-8 encoded CSV file with BOM so Excel (Windows & Mac)
 * opens Arabic and numbers properly without character corruption.
 */
export function exportToCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
): void {
  const escapeCell = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  };

  const lines = [
    headers.map(escapeCell).join(","),
    ...rows.map((row) => row.map(escapeCell).join(",")),
  ];

  const csvContent = lines.join("\r\n");
  // \uFEFF is the UTF-8 Byte Order Mark
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const isTextEl = (el: Element) => el.tagName === "text" || el.tagName === "tspan";

/**
 * Chart colours can be resolved from the dark theme at render time (e.g. white axis text, white 16% grid lines).
 * Report pages are always light, so near-white values become the light-palette ink at the given alpha.
 */
function lightInk(color: string, alpha: number): string {
  const match = /^rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(color);
  if (!match) return color;
  const [r, g, b] = [Number(match[1]), Number(match[2]), Number(match[3])];
  return r > 215 && g > 215 && b > 215 ? `rgba(23, 22, 27, ${alpha})` : color;
}

/**
 * Prepares an html2canvas clone for a printed report: forces the light palette and fixes Recharts SVG colours
 * that were resolved from the dark theme (axis text, grid lines).
 */
export function applyLightReportStyles(clonedDoc: Document, clonedEl: HTMLElement): void {
  // Reports are always printed on the light palette, whatever theme the admin is using.
  clonedDoc.documentElement.setAttribute("data-theme", "light");
  clonedDoc.documentElement.style.colorScheme = "light";

  // 1. Resolve computed styles for all SVG elements (Recharts charts) so CSS variables are preserved
  const svgs = clonedEl.querySelectorAll("svg");
  svgs.forEach((svg) => {
    const svgChildren = svg.querySelectorAll("*");
    svgChildren.forEach((child) => {
      if (child instanceof SVGElement) {
        const computed = window.getComputedStyle(child);
        const fill = computed.fill;
        const stroke = computed.stroke;
        if (fill && fill !== "none" && fill !== "rgba(0, 0, 0, 0)") {
          child.setAttribute("fill", isTextEl(child) ? lightInk(fill, 0.64) : fill);
        }
        if (stroke && stroke !== "none" && stroke !== "rgba(0, 0, 0, 0)") {
          child.setAttribute("stroke", lightInk(stroke, 0.16));
        }
      }
    });
  });

  // 1b. Chart axis/label text: recompute in the clone's own window and force dark ink when the dark theme leaked in.
  const view = clonedDoc.defaultView;
  if (view) {
    clonedEl.querySelectorAll("svg text, svg tspan").forEach((node) => {
      const el = node as SVGElement;
      const ink = lightInk(view.getComputedStyle(el).fill, 0.64);
      el.setAttribute("fill", ink);
      el.style.fill = ink;
    });
    clonedEl.querySelectorAll("svg line, svg path").forEach((node) => {
      const el = node as SVGElement;
      const stroke = view.getComputedStyle(el).stroke;
      const next = lightInk(stroke, 0.16);
      if (next !== stroke) {
        el.setAttribute("stroke", next);
        el.style.stroke = next;
      }
    });
  }
}

export type PdfExportOptions = {
  title?: string;
  filename?: string;
  margin?: number;
};

/**
 * Captures a report element into a multi-page high-resolution PDF document.
 * Inlines SVG styles and handles RTL/Arabic text rendering flawlessly.
 */
export async function exportElementToPdf(
  target: HTMLElement | string,
  filename: string,
  options?: PdfExportOptions
): Promise<void> {
  const el = typeof target === "string" ? document.getElementById(target) : target;
  if (!el) {
    throw new Error(`Target element "${target}" not found for PDF export`);
  }

  // Capture with 2x retina scale for crisp typography and charts
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([import("jspdf"), import("html2canvas")]);
  const canvas = await withProbeFix(() => html2canvas(el, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    onclone: (clonedDoc, clonedEl) => {
      applyLightReportStyles(clonedDoc, clonedEl);

      // 2. Hide any interactive toolbar elements marked with data-no-print
      const noPrintElements = clonedEl.querySelectorAll("[data-no-print]");
      noPrintElements.forEach((node) => {
        (node as HTMLElement).style.display = "none";
      });

      // 3. Brand header (kit logo, title, coral rule, date) on top of the captured page
      const heading = options?.title ?? document.querySelector("main h1")?.textContent?.trim() ?? "";
      const brand = clonedEl.ownerDocument.createElement("div");
      brand.setAttribute("style", "padding:0 0 16px;margin:0 0 16px;border-bottom:1px solid #17161b;background:#fff;color:#17161b");
      brand.innerHTML = `<div style="width:176px">${logoSvg.replace("<svg ", '<svg style="width:176px;height:auto;display:block" ')}</div>` +
        (heading ? `<div style="margin-top:16px;font-size:28px;line-height:40px;font-weight:700">${heading.replace(/</g, "&lt;")}</div>` : "") +
        `<div style="width:54px;height:3px;margin:6px 0 8px;background:#ff6555"></div>` +
        `<div style="font-size:11px;color:rgba(23,22,27,.64)">${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</div>`;
      clonedEl.insertBefore(brand, clonedEl.firstChild);

      // 4. Show any print-only headers
      const printOnlyElements = clonedEl.querySelectorAll("[data-print-only]");
      printOnlyElements.forEach((node) => {
        (node as HTMLElement).style.display = "block";
      });
    },
  }));

  const imgData = canvas.toDataURL("image/png");

  // A4 dimensions in mm
  const pdfWidth = 210;
  const pdfHeight = 297;
  const margin = options?.margin ?? 10;
  const contentWidth = pdfWidth - 2 * margin; // 190mm
  const scale = contentWidth / canvas.width;
  const contentHeight = canvas.height * scale;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  let heightLeft = contentHeight;
  let position = margin;
  const pageUsableHeight = pdfHeight - 2 * margin;

  // First page
  pdf.addImage(imgData, "PNG", margin, position, contentWidth, contentHeight);
  heightLeft -= pageUsableHeight;

  // Next pages if the content extends beyond a single page
  while (heightLeft > 0) {
    position -= pageUsableHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", margin, position, contentWidth, contentHeight);
    heightLeft -= pageUsableHeight;
  }

  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

/**
 * Same data as `exportToCsv`, in either format. Used by report pages that already build `headers` + `rows`:
 * Excel gets a branded sheet (title from the page heading) with numeric cells typed as numbers.
 */
export async function exportTabular(
  format: "csv" | "xlsx" | "pdf",
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): Promise<void> {
  const base = filename.replace(/\.(csv|xlsx)$/, "");
  if (format === "csv") return exportToCsv(base, headers, rows);
  if (format === "pdf") {
    const { exportReportPdf } = await import("./report-pdf");
    return exportReportPdf(base, headers, rows);
  }

  const { exportTableToExcel } = await import("./excel");
  const lang = useLangStore.getState().lang;
  const columns: ExportColumn<(string | number | null | undefined)[]>[] = headers.map((header, index) => {
    const numeric = rows.length > 0 && rows.every((row) => row[index] == null || typeof row[index] === "number");
    return { key: `c${index}`, header, kind: numeric ? "number" : "text", value: (row) => row[index] ?? null };
  });
  await exportTableToExcel({
    filename: base,
    title: document.querySelector("main h1")?.textContent?.trim() || base,
    columns,
    rows,
    rtl: lang === "ar",
    generatedAtLabel: `${translate(lang, "تاريخ التصدير", "Generated")}: ${new Intl.DateTimeFormat(localeOf(lang), { dateStyle: "medium", timeStyle: "short" }).format(new Date())}`,
  });
}
