import ExcelJS from "exceljs";
import { Buffer as NodeBuffer } from "node:buffer";
import { OrderRecord } from "./types";
import { toGregorian } from "jalaali-js";

function toNumber(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  const s = String(value).replace(/,/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

function normalize(value: any): string {
  return String(value ?? "").trim();
}

function parseJalaliDate(dateValue: any, timeValue: any): Date | null {
  const dateStr = normalize(dateValue);
  if (!dateStr) return null;
  const parts = dateStr.split("-").map((p) => Number(p));
  if (parts.length !== 3 || parts.some((p) => Number.isNaN(p))) return null;
  const [jy, jm, jd] = parts;
  const { gy, gm, gd } = toGregorian(jy, jm, jd);

  let h = 0,
    m = 0,
    s = 0;
  const timeStr = normalize(timeValue);
  if (timeStr) {
    const tp = timeStr.split(":").map((p) => Number(p));
    h = tp[0] ?? 0;
    m = tp[1] ?? 0;
    s = tp[2] ?? 0;
  }
  return new Date(gy, gm - 1, gd, h, m, s);
}

type CellPrimitive = string | number | boolean | Date | null;

function cellValueToPrimitive(value: ExcelJS.CellValue): CellPrimitive {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    const richTextValue = (value as ExcelJS.CellRichTextValue).richText;
    if (Array.isArray(richTextValue)) {
      return richTextValue.map((part) => part.text).join("");
    }
    const formulaValue = value as ExcelJS.CellFormulaValue;
    if (formulaValue && typeof formulaValue === "object" && "result" in formulaValue) {
      if (formulaValue.result !== undefined) {
        return cellValueToPrimitive(formulaValue.result as ExcelJS.CellValue);
      }
    }
    const hyperlinkValue = value as ExcelJS.CellHyperlinkValue;
    if (hyperlinkValue && typeof hyperlinkValue.text === "string") {
      return hyperlinkValue.text;
    }
  }
  return value as string | number | boolean | Date;
}

function recordHasValue(record: Record<string, any>): boolean {
  return Object.values(record).some((value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    return true;
  });
}

async function extractRows(buffer: NodeBuffer): Promise<Record<string, any>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(NodeBuffer.from(buffer) as any);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headers = new Map<number, string>();
  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const header = cellValueToPrimitive(cell.value);
    headers.set(colNumber, header == null ? "" : String(header));
  });

  const rows: Record<string, any>[] = [];
  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, any> = {};
    for (const [colNumber, header] of headers.entries()) {
      if (!header) continue;
      const cell = row.getCell(colNumber);
      record[header] = cellValueToPrimitive(cell.value);
    }
    if (recordHasValue(record)) {
      rows.push(record);
    }
  });
  return rows;
}

export async function parseExcel(buffer: NodeBuffer): Promise<OrderRecord[]> {
  const rows = await extractRows(buffer);

  const records: OrderRecord[] = rows.map((r) => ({
    orderId: normalize(r["O'U.OO�U� O3U?OO�O'"]),
    fcName: normalize(r["U+OU. U.O�UcO� U_O�O_OO�O'"]),
    sellerName: normalize(r["U?O�U^O'U_OU�"]),
    orderValue: toNumber(r["OO�O�O' O3U?OO�O'"]),
    orderCreatedAt: parseJalaliDate(r["O�OO�UOOr O�O\"O� O3U?OO�O'"], r["O3OO1O� O�O\"O� O3U?OO�O'"]),
    opsCompletedAt: parseJalaliDate(
      r["O�OO�UOOr U_OUOOU+ UcOO� O1U.U,UOOO�"],
      r["O3OO1O� U_OUOOU+ UcOO� O1U.U,UOOO�"]
    ),
    warehouseExitAt: parseJalaliDate(
      r["O�OO�UOOr OrO�U^O� OO� OU+O\"OO�"],
      r["O3OO1O� OrO�U^O� OO� OU+O\"OO�"]
    )
  }));

  const map = new Map<string, OrderRecord>();
  for (const rec of records) {
    if (!rec.orderId) continue;
    const ex = map.get(rec.orderId);
    if (!ex) {
      map.set(rec.orderId, rec);
    } else {
      if (ex.orderValue == null && rec.orderValue != null) ex.orderValue = rec.orderValue;
      if (!ex.orderCreatedAt && rec.orderCreatedAt) ex.orderCreatedAt = rec.orderCreatedAt;
      if (!ex.opsCompletedAt && rec.opsCompletedAt) ex.opsCompletedAt = rec.opsCompletedAt;
      if (!ex.warehouseExitAt && rec.warehouseExitAt) ex.warehouseExitAt = rec.warehouseExitAt;
    }
  }
  return Array.from(map.values());
}
