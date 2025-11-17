import ExcelJS from "exceljs";
import { Buffer as NodeBuffer } from "node:buffer";
import { toGregorian } from "jalaali-js";
import { OrderRecord } from "./types";

type CellPrimitive = string | number | boolean | Date | null;
type NormalizedRow = Record<string, CellPrimitive>;

const COLUMN_ALIASES: Record<string, string[]> = {
  orderId: ["order_id", "orderid", "شناسه سفارش", "شماره سفارش", "سفارش"],
  fcName: ["fc_name", "fulfillment_center", "مرکز پردازش", "انبار", "fc"],
  sellerName: ["seller_name", "seller", "فروشنده", "فروشگاه"],
  courierName: ["courier_name", "carrier", "courier", "کوریر", "شرکت پستی"],
  province: ["province", "استان"],
  city: ["city", "شهر"],
  hasCod: ["has_cod", "cod", "پرداخت در محل", "cod_flag"],
  orderValue: ["order_value", "order amount", "ارزش سفارش", "مبلغ سفارش"],
  courierShippingCost: [
    "courier_shipping_cost",
    "shipping_cost",
    "هزینه ارسال",
    "هزینه پست"
  ],
  courierReturnCost: [
    "courier_return_cost",
    "return_cost",
    "هزینه مرجوعی",
    "هزینه عودت کوریر",
    "هزینه بازگشت"
  ],
  orderCreatedDate: [
    "order_created_date",
    "order_date",
    "تاریخ ثبت سفارش",
    "تاریخ سفارش"
  ],
  orderCreatedTime: ["order_created_time", "ساعت ثبت سفارش", "ساعت سفارش"],
  warehouseExitDate: [
    "warehouse_exit_date",
    "تاریخ خروج از انبار",
    "تاریخ خروج"
  ],
  warehouseExitTime: ["warehouse_exit_time", "ساعت خروج از انبار", "ساعت خروج"],
  opsCompletedDate: [
    "ops_completed_date",
    "ops_completed_at",
    "operation_completed_at",
    "processing_completed_at",
    "processing_end_date",
    "operation_end_date",
    "تاریخ پایان کار عملیات",
    "تاریخ پایان عملیات",
    "تاریخ پایان کار",
    "تاریخ پایان پردازش",
    "تاریخ اتمام پردازش",
    "تاریخ پایان آماده سازی"
  ],
  opsCompletedTime: [
    "ops_completed_time",
    "operation_completed_time",
    "processing_end_time",
    "operation_end_time",
    "ساعت پایان کار عملیات",
    "ساعت پایان عملیات",
    "ساعت پایان کار",
    "ساعت پایان پردازش",
    "ساعت پایان آماده سازی"
  ],
  returnDate: ["return_date", "تاریخ عودت", "تاریخ عودت سفارش", "تاریخ مرجوع"],
  returnTime: ["return_time", "ساعت عودت", "ساعت عودت سفارش"],
  orderItemCount: [
    "order_item_count",
    "item_count",
    "تعداد اقلام",
    "تعداد آیتم"
  ],
  lineUnitCount: ["line_unit_count", "unit_count", "تعداد واحد"],
  laborHours: ["labor_hours", "نفرساعت", "ساعت کار"]
};

const REQUIRED_FOR_ROW = ["orderId"];
const REQUIRED_FOR_PROCESSING = [
  "orderCreatedDate",
  "orderCreatedTime",
  "opsCompletedDate",
  "opsCompletedTime"
];

function toNumber(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isNaN(value) ? null : value;
  const s = normalizeString(value).replace(/,/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

function normalizeDigits(input: string): string {
  const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
  return input.replace(/[۰-۹]/g, (d) => String(persianDigits.indexOf(d)));
}

function normalizeString(value: any): string {
  if (value === null || value === undefined) return "";
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeKey(value: any): string {
  const base = normalizeDigits(normalizeString(value))
    .replace(/[ي]/g, "ی")
    .replace(/[ك]/g, "ک");
  return base
    .toLowerCase()
    .replace(/[\s\-_\/\\|,.،]+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

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

function recordHasValue(record: NormalizedRow): boolean {
  return Object.values(record).some((value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    return true;
  });
}

async function extractRows(buffer: NodeBuffer): Promise<NormalizedRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(NodeBuffer.from(buffer) as any);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headers = new Map<number, string>();
  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const header = cellValueToPrimitive(cell.value);
    headers.set(colNumber, header == null ? "" : normalizeKey(header));
  });

  const rows: NormalizedRow[] = [];
  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: NormalizedRow = {};
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

function findValue(row: NormalizedRow, aliases: string[]): CellPrimitive {
  for (const alias of aliases) {
    const key = normalizeKey(alias);
    if (key in row) return row[key];
  }
  return null;
}

function toBoolean(value: any): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1 ? true : value === 0 ? false : null;
  const s = normalizeString(value).toLowerCase();
  if (!s) return null;
  if (["yes", "y", "true", "cod", "پرداخت در محل"].includes(s)) return true;
  if (["no", "n", "false", "غیر cod", "غیرکد"].includes(s)) return false;
  return null;
}

function parseDate(value: any): Date | null {
  if (value instanceof Date) return value;
  const str = normalizeDigits(normalizeString(value));
  if (!str) return null;

  const parts = str.split(" ");
  const [datePart] = parts.length > 1 ? [parts[0]] : [str];

  const dateDelims = datePart.split(/[-/.]/).filter(Boolean);
  if (dateDelims.length === 3) {
    const [a, b, c] = dateDelims.map((p) => Number(p));
    if ([a, b, c].some((n) => Number.isNaN(n))) return null;
    const looksJalali = a > 1200;
    const { gy, gm, gd } = looksJalali ? toGregorian(a, b, c) : { gy: a, gm: b, gd: c };
    const base = new Date(gy, gm - 1, gd);
    if (Number.isNaN(base.getTime())) return null;
    return base;
  }

  const numeric = Number(str);
  if (!Number.isNaN(numeric)) {
    const epoch = Date.parse("1899-12-30T00:00:00Z"); // Excel serial date start
    const date = new Date(epoch + numeric * 24 * 60 * 60 * 1000);
    if (!Number.isNaN(date.getTime())) return date;
  }

  return null;
}

function parseDateTime(
  dateValue: any,
  timeValue: any,
  fallbackDateTime: any = null,
  requireTime = false
): Date | null {
  const date = parseDate(dateValue);
  const timeStr = normalizeString(timeValue);

  if (!date) {
    if (fallbackDateTime) return parseDateTime(fallbackDateTime, null, null, requireTime);
    return null;
  }

  if (requireTime && !timeStr) return null;

  if (timeStr) {
    const [h, m, s] = normalizeDigits(timeStr)
      .split(":")
      .map((p) => Number(p || 0));
    if (![h, m, s].some((n) => Number.isNaN(n))) {
      date.setHours(h, m, s || 0, 0);
    } else if (requireTime) {
      return null;
    }
  }

  return date;
}

function mergeOrders(existing: OrderRecord, incoming: OrderRecord): OrderRecord {
  const sum = (a: number | null, b: number | null) =>
    a == null && b == null ? null : (a || 0) + (b || 0);

  const pick = <T>(a: T, b: T): T => (a == null || a === "" ? b : a);

  return {
    orderId: existing.orderId || incoming.orderId,
    fcName: pick(existing.fcName, incoming.fcName),
    sellerName: pick(existing.sellerName, incoming.sellerName),
    courierName: pick(existing.courierName, incoming.courierName),
    province: pick(existing.province, incoming.province),
    city: pick(existing.city, incoming.city),
    hasCod: existing.hasCod ?? incoming.hasCod,

    orderValue: pick(existing.orderValue, incoming.orderValue),
    courierShippingCost: pick(existing.courierShippingCost, incoming.courierShippingCost),
    courierReturnCost: pick(existing.courierReturnCost, incoming.courierReturnCost),

    orderCreatedAt: existing.orderCreatedAt ?? incoming.orderCreatedAt,
    opsCompletedAt: existing.opsCompletedAt ?? incoming.opsCompletedAt,
    warehouseExitAt: existing.warehouseExitAt ?? incoming.warehouseExitAt,
    returnDate: existing.returnDate ?? incoming.returnDate,

    orderItemCount: sum(existing.orderItemCount, incoming.orderItemCount),
    lineUnitCount: sum(existing.lineUnitCount, incoming.lineUnitCount),
    laborHours: sum(existing.laborHours, incoming.laborHours)
  };
}

function buildOrderFromRow(row: NormalizedRow): OrderRecord | null {
  const get = (key: keyof typeof COLUMN_ALIASES) =>
    findValue(row, COLUMN_ALIASES[key] || []);

  const orderId = normalizeString(get("orderId"));
  if (!orderId) return null;

  const orderCreatedAt = parseDateTime(
    get("orderCreatedDate"),
    get("orderCreatedTime"),
    get("orderCreatedDate"),
    false // missing time defaults to 00:00:00
  );
  const opsCompletedAt = parseDateTime(
    get("opsCompletedDate"),
    get("opsCompletedTime"),
    get("opsCompletedDate"),
    true // require time for processing time KPI
  );
  const warehouseExitAt = parseDateTime(
    get("warehouseExitDate"),
    get("warehouseExitTime"),
    get("warehouseExitDate")
  );
  const returnDate = parseDateTime(
    get("returnDate"),
    get("returnTime"),
    get("returnDate"),
    false
  );

  return {
    orderId,
    fcName: normalizeString(get("fcName")),
    sellerName: normalizeString(get("sellerName")),
    courierName: normalizeString(get("courierName")),
    province: normalizeString(get("province")),
    city: normalizeString(get("city")),
    hasCod: toBoolean(get("hasCod")),

    orderValue: toNumber(get("orderValue")),
    courierShippingCost: toNumber(get("courierShippingCost")),
    courierReturnCost: toNumber(get("courierReturnCost")),

    orderCreatedAt,
    opsCompletedAt,
    warehouseExitAt,
    returnDate,

    orderItemCount: toNumber(get("orderItemCount")),
    lineUnitCount: toNumber(get("lineUnitCount")),
    laborHours: toNumber(get("laborHours"))
  };
}

export async function parseExcel(buffer: NodeBuffer): Promise<OrderRecord[]> {
  const rows = await extractRows(buffer);
  if (rows.length === 0) {
    throw new Error("Sheet is empty یا هیچ داده‌ای خوانده نشد");
  }

  const normalizedColumns = new Set<string>();
  Object.keys(rows[0] || {}).forEach((key) => normalizedColumns.add(key));

  const findMissing = (required: string[]) =>
    required.filter(
      (key) =>
        !COLUMN_ALIASES[key]?.some((alias) => normalizedColumns.has(normalizeKey(alias)))
    );

  const missingRequired = findMissing(REQUIRED_FOR_ROW);
  const missingProcessing = findMissing(REQUIRED_FOR_PROCESSING);

  const missingAll = [...missingRequired, ...missingProcessing];
  if (missingAll.length) {
    throw new Error(
      `ستون‌های اجباری پیدا نشد: ${missingAll
        .map((c) => COLUMN_ALIASES[c]?.[0] || c)
        .join(", ")}`
    );
  }

  const merged = new Map<string, OrderRecord>();
  for (const row of rows) {
    const order = buildOrderFromRow(row);
    if (!order) continue;
    const existing = merged.get(order.orderId);
    if (!existing) {
      merged.set(order.orderId, order);
    } else {
      merged.set(order.orderId, mergeOrders(existing, order));
    }
  }

  return Array.from(merged.values());
}
