import { saveAs } from "file-saver";

import type { ExportColumn, ExportMeta, ExportValue } from "./types";

// Brand tokens as Excel ARGB (tokens.css: ink, coral, cream, line).
const INK = "FF17161B";
const CORAL = "FFFF6555";
const CREAM = "FFFFFEEB";
const LINE = "FFD1D0D2";
const MUTED = "FF6F6E72";

const MONEY_FORMAT = "#,##0.00";
const DATE_FORMAT = "yyyy-mm-dd";
const DATETIME_FORMAT = "yyyy-mm-dd hh:mm";

export type ExcelExportOptions<T> = {
  filename: string;
  sheetName?: string;
  title: string;
  columns: ExportColumn<T>[];
  rows: T[];
  rtl: boolean;
  generatedAtLabel: string;
  meta?: ExportMeta;
};

function cellValue(value: ExportValue): string | number | boolean | Date | null {
  return value === undefined ? null : value;
}

/** Writes a branded `.xlsx` (title band, filter lines, ink header row, frozen header, autofilter) and downloads it. */
export async function exportTableToExcel<T>({ filename, sheetName, title, columns, rows, rtl, generatedAtLabel, meta }: ExcelExportOptions<T>): Promise<void> {
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  workbook.creator = "Mastery Academy";
  workbook.created = new Date();

  // Sheet names: max 31 chars, none of : \ / ? * [ ]
  const sheet = workbook.addWorksheet((sheetName ?? title).replace(/[:\\/?*[\]]/g, " ").slice(0, 31) || "Sheet1");
  const lastCol = Math.max(columns.length, 1);
  const textAlign = rtl ? "right" : "left";

  // Title band
  const titleRow = sheet.addRow([title]);
  sheet.mergeCells(titleRow.number, 1, titleRow.number, lastCol);
  titleRow.height = 28;
  titleRow.getCell(1).font = { name: "Calibri", size: 16, bold: true, color: { argb: INK } };
  titleRow.getCell(1).alignment = { vertical: "middle", horizontal: textAlign };
  for (let c = 1; c <= lastCol; c++) titleRow.getCell(c).border = { bottom: { style: "thick", color: { argb: CORAL } } };

  // Meta lines: generated-at, filters, truncation notice
  const lines = [generatedAtLabel, ...(meta?.filters ?? [])];
  for (const line of lines) {
    const row = sheet.addRow([line]);
    sheet.mergeCells(row.number, 1, row.number, lastCol);
    row.getCell(1).font = { name: "Calibri", size: 10, color: { argb: MUTED } };
    row.getCell(1).alignment = { horizontal: textAlign };
  }
  sheet.addRow([]);

  // Header row
  const header = sheet.addRow(columns.map((column) => column.header));
  header.height = 22;
  header.eachCell((cell) => {
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INK } };
    cell.alignment = { vertical: "middle", horizontal: textAlign, wrapText: true };
  });
  const headerRowNumber = header.number;
  sheet.views = [{ rightToLeft: rtl, state: "frozen", ySplit: headerRowNumber }];

  // Body
  rows.forEach((item, index) => {
    const row = sheet.addRow(columns.map((column) => cellValue(column.value(item))));
    columns.forEach((column, columnIndex) => {
      const cell = row.getCell(columnIndex + 1);
      const kind = column.kind ?? "text";
      if (kind === "money") cell.numFmt = MONEY_FORMAT;
      else if (kind === "number") cell.numFmt = "#,##0.##";
      else if (kind === "date") cell.numFmt = DATE_FORMAT;
      else if (kind === "datetime") cell.numFmt = DATETIME_FORMAT;
      const numeric = kind === "money" || kind === "number";
      cell.alignment = { vertical: "middle", horizontal: numeric ? (rtl ? "left" : "right") : textAlign };
      cell.font = { name: "Calibri", size: 11, color: { argb: INK } };
      cell.border = { bottom: { style: "thin", color: { argb: LINE } } };
      if (index % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CREAM } };
    });
  });

  // Column widths from the longest rendered value (sampled, capped).
  columns.forEach((column, index) => {
    let max = column.header.length;
    for (const item of rows.slice(0, 500)) {
      const value = column.value(item);
      const length = value instanceof Date ? 16 : String(value ?? "").length;
      if (length > max) max = length;
    }
    sheet.getColumn(index + 1).width = Math.min(Math.max(max + 3, 10), 48);
  });

  if (rows.length > 0) {
    sheet.autoFilter = { from: { row: headerRowNumber, column: 1 }, to: { row: headerRowNumber, column: lastCol } };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`,
  );
}
