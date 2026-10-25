import { createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";

const A4_W_MM = 210;
const A4_H_MM = 297;
const MARGIN_MM = 10;
const FOOTER_MM = 8;
const SCALE = 2;

type Band = { top: number; bottom: number };

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/**
 * html2canvas measures each font's baseline with a hidden probe `<img>` appended to `<body>`. Tailwind's
 * preflight makes every `img` `display: block`, which breaks the probe and pushes all text ~10px low.
 * This override is scoped to the probe container only and removed once the capture is done.
 */
const PROBE_FIX = 'body > div[style*="visibility: hidden"] > img { display: inline !important; vertical-align: baseline !important; }';

export function withProbeFix<R>(run: () => Promise<R>): Promise<R> {
  const style = document.createElement("style");
  style.textContent = PROBE_FIX;
  document.head.appendChild(style);
  return run().finally(() => style.remove());
}

/** Re-pins the off-screen report to the clone's origin so the crop rectangles are plain element coordinates. */
function pinClone(cloned: HTMLElement) {
  cloned.style.insetInlineStart = "0";
  cloned.style.left = "0";
  cloned.style.top = "0";
  cloned.style.position = "absolute";
}

/**
 * Paginates a `.pdf-report` element into A4 pages. Pages break only on row / block boundaries, the table
 * header repeats on each page, and each page is rasterised separately (keeps canvases under browser size limits).
 */
async function paginateToPdf(el: HTMLElement, filename: string): Promise<void> {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([import("jspdf"), import("html2canvas")]);

  const box = el.getBoundingClientRect();
  const width = Math.ceil(box.width);
  const total = Math.ceil(box.height);
  const rel = (node: Element): Band => {
    const r = node.getBoundingClientRect();
    return { top: r.top - box.top, bottom: r.bottom - box.top };
  };

  const thead = el.querySelector("thead");
  const head = thead ? rel(thead) : undefined;
  const headH = head ? Math.ceil(head.bottom - head.top) : 0;
  const breaks = [
    ...Array.from(el.querySelectorAll("tbody tr")).map((row) => rel(row).bottom),
    ...Array.from(el.querySelectorAll("[data-pdf-block]")).map((block) => rel(block).bottom),
  ]
    .filter((y) => y < total)
    .sort((a, b) => a - b);

  const mmPerPx = (A4_W_MM - 2 * MARGIN_MM) / width;
  const pageH = ((A4_H_MM - 2 * MARGIN_MM - FOOTER_MM) / mmPerPx) | 0;

  // Cut points in CSS px, each page after the first reserves room for the repeated header.
  const pages: { from: number; to: number }[] = [];
  let from = 0;
  while (from < total) {
    const room = pageH - (pages.length > 0 ? headH : 0);
    let to = from + room;
    if (to >= total) to = total;
    else {
      const fit = breaks.filter((y) => y > from + 1 && y <= to).pop();
      if (fit) to = fit;
    }
    pages.push({ from, to });
    from = to;
  }

  const capture = (y: number, height: number) =>
    html2canvas(el, {
      scale: SCALE,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      x: 0,
      y,
      width,
      height,
      scrollX: 0,
      scrollY: 0,
      windowWidth: width,
      onclone: (_doc, cloned) => pinClone(cloned),
    });

  const headCanvas = head && pages.length > 1 ? await capture(head.top, headH) : undefined;

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const contentW = A4_W_MM - 2 * MARGIN_MM;

  for (let i = 0; i < pages.length; i++) {
    const { from: y0, to: y1 } = pages[i];
    const body = await capture(y0, y1 - y0);
    const repeat = i > 0 && headCanvas;

    const out = document.createElement("canvas");
    out.width = body.width;
    out.height = body.height + (repeat ? headCanvas.height : 0);
    const ctx = out.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, out.width, out.height);
    let offset = 0;
    if (repeat) {
      ctx.drawImage(headCanvas, 0, 0);
      offset = headCanvas.height;
    }
    ctx.drawImage(body, 0, offset);

    if (i > 0) pdf.addPage();
    pdf.addImage(out.toDataURL("image/jpeg", 0.95), "JPEG", MARGIN_MM, MARGIN_MM, contentW, out.height / SCALE * mmPerPx);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(110, 110, 114);
    pdf.text(`${i + 1} / ${pages.length}`, A4_W_MM / 2, A4_H_MM - MARGIN_MM + 2, { align: "center" });
    pdf.text("Mastery Academy", MARGIN_MM, A4_H_MM - MARGIN_MM + 2);
  }

  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

/** Mounts a `PrintReport` off-screen, waits for fonts/layout, paginates it to a PDF download, then unmounts. */
export async function renderReportToPdf(report: ReactElement, filename: string): Promise<void> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    root.render(createElement("div", null, report));
    let el: HTMLElement | null = null;
    for (let i = 0; i < 60 && !el; i++) {
      await frame();
      el = host.querySelector<HTMLElement>(".pdf-report");
    }
    await document.fonts?.ready;
    await frame();
    if (!el) throw new Error("PDF report failed to render");
    await withProbeFix(() => paginateToPdf(el, filename));
  } finally {
    root.unmount();
    host.remove();
  }
}
