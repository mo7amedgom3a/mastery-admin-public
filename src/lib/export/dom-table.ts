import type { ExportColumn } from "./types";

/** Text of a table cell as shown on screen: skips avatars/icons (`aria-hidden`, svg) and joins stacked lines with a space. */
function cellText(cell: Element): string {
  const parts: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
      if (text) parts.push(text);
    } else if (node instanceof Element) {
      if (node.getAttribute("aria-hidden") === "true" || node.tagName === "svg" || node.tagName === "SVG") return;
      node.childNodes.forEach(walk);
    }
  };
  cell.childNodes.forEach(walk);
  return parts.join(" ");
}

const NUMBER = /^[-−]?\s*(?:[A-Z]{3}\s*)?[$€£]?\s*(\d{1,3}(?:,\d{3})*|\d+)(\.\d+)?\s*(?:[A-Z]{3}|%)?$/;

function asNumber(text: string): number | null {
  if (!NUMBER.test(text)) return null;
  const negative = /^[-−]/.test(text);
  const value = Number(text.replace(/[^\d.]/g, ""));
  return Number.isFinite(value) ? (negative ? -value : value) : null;
}

/**
 * Reads the table that is on screen (visible columns, current rows, current sort) into export columns.
 * Used when a `DataTable` has no explicit `exportConfig`: values are the displayed text, with plain numbers
 * and amounts typed as numbers so Excel can sum them. Columns without a header (action buttons) are skipped.
 */
export function readDomTable(root: HTMLElement): { columns: ExportColumn<string[]>[]; rows: string[][] } {
  const heads = Array.from(root.querySelectorAll("thead th"));
  const bodyRows = Array.from(root.querySelectorAll("tbody tr"));
  const grid = bodyRows.map((row) => Array.from(row.querySelectorAll("td")).map(cellText));

  const columns: ExportColumn<string[]>[] = [];
  heads.forEach((head, index) => {
    const sortLabel = head.querySelector(".ma-sort > span");
    const header = (sortLabel?.textContent ?? cellText(head)).trim();
    if (!header) return;
    const texts = grid.map((row) => row[index] ?? "").filter((text) => text && text !== "—");
    const numeric = texts.length > 0 && texts.every((text) => asNumber(text) !== null);
    columns.push({
      key: `c${index}`,
      header,
      kind: numeric ? (texts.some((text) => /[.$€£]|[A-Z]{3}/.test(text)) ? "money" : "number") : "text",
      align: head.classList.contains("is-num") ? "end" : undefined,
      value: numeric ? (row) => (row[index] && row[index] !== "—" ? asNumber(row[index]) : null) : (row) => row[index] ?? "",
      // Amounts keep their currency code in the PDF.
      currency: numeric ? (row) => /\b([A-Z]{3})\b/.exec(row[index] ?? "")?.[1] ?? (/^\s*[-−]?\s*\$/.test(row[index] ?? "") ? "USD" : null) : undefined,
    });
  });
  return { columns, rows: grid };
}
