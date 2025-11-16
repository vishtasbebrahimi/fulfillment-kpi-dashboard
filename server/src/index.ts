import express from "express";
import cors from "cors";
import multer from "multer";
import { parseExcel } from "./excelParser";
import { setOrders, getOrders } from "./dataStore";
import { computeKpis, computeOrderMetrics } from "./kpiService";
import { OrderResponse } from "./types";

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

app.post("/api/upload-excel", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }
    const orders = await parseExcel(req.file.buffer);
    setOrders(orders);
    const kpis = computeKpis(orders);
    res.json({ success: true, kpis, total: orders.length });
  } catch (e: any) {
    console.error(e);
    res.status(500).send(e?.message || "Failed to parse Excel");
  }
});

type FilterParams = {
  startDate?: Date | null;
  endDate?: Date | null;
  exitStart?: Date | null;
  exitEnd?: Date | null;
  fcName?: string;
  sellerName?: string;
  courierName?: string;
  province?: string;
  city?: string;
  hasCod?: boolean | null;
  search?: string;
};

function parseDateParam(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeStr(v: string | undefined): string {
  return (v || "").trim().toLowerCase();
}

function applyFilters(orders: ReturnType<typeof getOrders>, params: FilterParams) {
  const {
    startDate,
    endDate,
    exitStart,
    exitEnd,
    fcName,
    sellerName,
    courierName,
    province,
    city,
    hasCod,
    search
  } = params;

  return orders.filter((o) => {
    if (startDate && o.orderCreatedAt && o.orderCreatedAt < startDate) return false;
    if (endDate && o.orderCreatedAt && o.orderCreatedAt > endDate) return false;

    if (exitStart && o.warehouseExitAt && o.warehouseExitAt < exitStart) return false;
    if (exitEnd && o.warehouseExitAt && o.warehouseExitAt > exitEnd) return false;

    if (fcName && !o.fcName?.toLowerCase().includes(fcName)) return false;
    if (sellerName && !o.sellerName?.toLowerCase().includes(sellerName)) return false;
    if (courierName && !o.courierName?.toLowerCase().includes(courierName)) return false;
    if (province && !o.province?.toLowerCase().includes(province)) return false;
    if (city && !o.city?.toLowerCase().includes(city)) return false;

    if (hasCod !== null && hasCod !== undefined) {
      const orderCod = o.hasCod;
      if (orderCod === null) return false;
      if (orderCod !== hasCod) return false;
    }

    if (search) {
      const s = search.toLowerCase();
      const candidate =
        o.orderId.toLowerCase().includes(s) ||
        o.sellerName.toLowerCase().includes(s) ||
        o.fcName.toLowerCase().includes(s);
      if (!candidate) return false;
    }

    return true;
  });
}

app.get("/api/kpis", (req, res) => {
  try {
    const params: FilterParams = {
      startDate: parseDateParam(req.query.startDate),
      endDate: parseDateParam(req.query.endDate),
      exitStart: parseDateParam(req.query.exitStart),
      exitEnd: parseDateParam(req.query.exitEnd),
      fcName: normalizeStr(req.query.fcName as string | undefined),
      sellerName: normalizeStr(req.query.sellerName as string | undefined),
      courierName: normalizeStr(req.query.courierName as string | undefined),
      province: normalizeStr(req.query.province as string | undefined),
      city: normalizeStr(req.query.city as string | undefined),
      hasCod:
        req.query.hasCod === undefined
          ? null
          : ["true", "1", "yes"].includes(String(req.query.hasCod).toLowerCase())
            ? true
            : ["false", "0", "no"].includes(String(req.query.hasCod).toLowerCase())
              ? false
              : null,
      search: normalizeStr(req.query.search as string | undefined)
    };

    const filtered = applyFilters(getOrders(), params);
    const kpis = computeKpis(filtered);
    res.json({ kpis, total: filtered.length });
  } catch (e: any) {
    console.error(e);
    res.status(500).send(e?.message || "Failed to compute KPIs");
  }
});

app.get("/api/orders", (req, res) => {
  try {
    const params: FilterParams = {
      startDate: parseDateParam(req.query.startDate),
      endDate: parseDateParam(req.query.endDate),
      exitStart: parseDateParam(req.query.exitStart),
      exitEnd: parseDateParam(req.query.exitEnd),
      fcName: normalizeStr(req.query.fcName as string | undefined),
      sellerName: normalizeStr(req.query.sellerName as string | undefined),
      courierName: normalizeStr(req.query.courierName as string | undefined),
      province: normalizeStr(req.query.province as string | undefined),
      city: normalizeStr(req.query.city as string | undefined),
      hasCod:
        req.query.hasCod === undefined
          ? null
          : ["true", "1", "yes"].includes(String(req.query.hasCod).toLowerCase())
            ? true
            : ["false", "0", "no"].includes(String(req.query.hasCod).toLowerCase())
              ? false
              : null,
      search: normalizeStr(req.query.search as string | undefined)
    };

    const sortField = normalizeStr(req.query.sort as string | undefined);
    const sortDir = normalizeStr(req.query.dir as string | undefined) === "desc" ? -1 : 1;
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);

    const filtered = applyFilters(getOrders(), params);
    const decorated: OrderResponse[] = filtered.map((o) => computeOrderMetrics(o));

    const sorted = sortField
      ? [...decorated].sort((a, b) => {
          const av = (a as any)[sortField];
          const bv = (b as any)[sortField];
          if (av == null && bv == null) return 0;
          if (av == null) return -1 * sortDir;
          if (bv == null) return 1 * sortDir;
          if (typeof av === "number" && typeof bv === "number") {
            return av > bv ? sortDir : av < bv ? -sortDir : 0;
          }
          const as = String(av).toLowerCase();
          const bs = String(bv).toLowerCase();
          return as > bs ? sortDir : as < bs ? -sortDir : 0;
        })
      : decorated;

    const start = (page - 1) * pageSize;
    const sliced = sorted.slice(start, start + pageSize);

    const toJsonSafe = (o: OrderResponse) => ({
      ...o,
      orderCreatedAt: o.orderCreatedAt ? o.orderCreatedAt.toISOString() : null,
      opsCompletedAt: o.opsCompletedAt ? o.opsCompletedAt.toISOString() : null,
      warehouseExitAt: o.warehouseExitAt ? o.warehouseExitAt.toISOString() : null,
      returnDate: o.returnDate ? o.returnDate.toISOString() : null
    });

    res.json({
      total: decorated.length,
      page,
      pageSize,
      orders: sliced.map(toJsonSafe)
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).send(e?.message || "Failed to fetch orders");
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
