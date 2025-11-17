import { OrderRecord } from "./types";

type Stats = {
  avg: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  count: number;
};

export type KpiResult = {
  woctHours: Stats;
  processingHours: Stats;
  stagingHours: Stats;
  sameDayRate: number | null;
  returnRate: number | null;
  averageOrderValue: number | null;
  averageShippingCost: number | null;
  shippingCostRatio: Stats;
  itemsPerLaborHour: number | null;
  unitsPerLaborHour: number | null;
  ordersCount: number;
  trend: { date: string; woctHours?: number | null; processingHours?: number | null }[];
  returnRateByFc: { fcName: string; returnRate: number; orders: number }[];
  productivityByFc: {
    fcName: string;
    ordersPerLaborHour: number | null;
    itemsPerLaborHour: number | null;
  }[];
  codDistribution: { label: string; value: number }[];
  courierDistribution: { label: string; value: number }[];
};

type OrderMetrics = {
  woctHours: number | null;
  processingHours: number | null;
  stagingHours: number | null;
  shipCostRatio: number | null;
  shippingCostPerOrder: number | null;
  isReturned: boolean;
  sameDay: boolean;
};

function diffHours(a: Date | null, b: Date | null): number | null {
  if (!a || !b) return null;
  const diffMs = b.getTime() - a.getTime();
  return diffMs / (1000 * 60 * 60);
}

function summarize(nums: number[]): Stats {
  if (!nums.length) {
    return { avg: null, median: null, min: null, max: null, count: 0 };
  }
  const sorted = [...nums].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return {
    avg: sum / sorted.length,
    median,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    count: sorted.length
  };
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function metricsForOrder(o: OrderRecord): OrderMetrics {
  const woctHours = diffHours(o.orderCreatedAt, o.warehouseExitAt);
  const processingHours = diffHours(o.orderCreatedAt, o.opsCompletedAt);
  const stagingHours = diffHours(o.opsCompletedAt, o.warehouseExitAt);
  const shippingCostPerOrder =
    o.courierShippingCost != null && o.courierShippingCost >= 0 ? o.courierShippingCost : null;
  const shipCostRatio =
    o.orderValue &&
    o.orderValue > 0 &&
    shippingCostPerOrder != null &&
    shippingCostPerOrder >= 0
      ? (shippingCostPerOrder / o.orderValue) * 100
      : null;
  const isReturned = (o.courierReturnCost ?? 0) > 0 || Boolean(o.returnDate);
  const sameDay =
    o.orderCreatedAt && o.warehouseExitAt
      ? isSameDay(o.orderCreatedAt, o.warehouseExitAt)
      : false;
  return {
    woctHours: woctHours != null && woctHours >= 0 ? woctHours : null,
    processingHours:
      processingHours != null && processingHours >= 0 ? processingHours : null,
    stagingHours: stagingHours != null && stagingHours >= 0 ? stagingHours : null,
    shipCostRatio: shipCostRatio != null && shipCostRatio >= 0 ? shipCostRatio : null,
    shippingCostPerOrder,
    isReturned,
    sameDay
  };
}

export function computeOrderMetrics(o: OrderRecord) {
  const m = metricsForOrder(o);
  return {
    ...o,
    woctHours: m.woctHours,
    processingHours: m.processingHours,
    stagingHours: m.stagingHours,
    shipCostRatio: m.shipCostRatio
  };
}

export function computeKpis(orders: OrderRecord[]): KpiResult {
  // اطمینان از محاسبه در سطح سفارش (نه لاین): اگر به هر دلیلی orderId تکراری باشد
  // فقط اولین رکورد برای KPIها لحاظ می‌شود.
  const uniqueOrders: OrderRecord[] = [];
  const seen = new Set<string>();
  for (const o of orders) {
    const key = (o.orderId || "").trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueOrders.push(o);
  }

  const woctList: number[] = [];
  const processingList: number[] = [];
  const stagingList: number[] = [];
  const shipRatioList: number[] = [];
  let shipRatioEligibleSumCost = 0;
  let shipRatioEligibleSumValue = 0;

  let sameDayEligible = 0;
  let sameDayCount = 0;
  let ordersReturned = 0;
  let orderValueSum = 0;
  let orderValueCount = 0;
  let shippingCostSum = 0;
  let shippingCostCount = 0;

  let totalItems = 0;
  let totalLaborHours = 0;
  let totalUnits = 0;

  const trendMap = new Map<string, { woct: number[]; proc: number[] }>();
  const returnByFc = new Map<string, { returned: number; total: number }>();
  const productivityByFc = new Map<
    string,
    { laborHours: number; orders: number; items: number }
  >();
  let codCount = 0;
  let nonCodCount = 0;
  const courierDist = new Map<string, number>();

  for (const o of uniqueOrders) {
    const m = metricsForOrder(o);

    if (m.woctHours != null && !Number.isNaN(m.woctHours)) woctList.push(m.woctHours);
    if (m.processingHours != null && !Number.isNaN(m.processingHours))
      processingList.push(m.processingHours);
    if (m.stagingHours != null && !Number.isNaN(m.stagingHours)) stagingList.push(m.stagingHours);
    if (m.shipCostRatio != null && !Number.isNaN(m.shipCostRatio)) {
      shipRatioList.push(m.shipCostRatio);
      shipRatioEligibleSumCost += m.shippingCostPerOrder ?? 0;
      shipRatioEligibleSumValue += o.orderValue ?? 0;
    }

    if (o.orderCreatedAt && o.warehouseExitAt) {
      sameDayEligible += 1;
      if (m.sameDay) sameDayCount += 1;
    }

    if (m.isReturned) ordersReturned += 1;

    if (o.orderValue != null) {
      orderValueSum += o.orderValue;
      orderValueCount += 1;
    }

    if (m.shippingCostPerOrder != null) {
      shippingCostSum += m.shippingCostPerOrder;
      shippingCostCount += 1;
    }

    totalItems += o.orderItemCount ?? 0;
    totalUnits += o.lineUnitCount ?? 0;
    totalLaborHours += o.laborHours ?? 0;

    const dayKey =
      o.orderCreatedAt != null
        ? o.orderCreatedAt.toISOString().slice(0, 10)
        : o.warehouseExitAt != null
          ? o.warehouseExitAt.toISOString().slice(0, 10)
          : null;
    if (dayKey) {
      const cur = trendMap.get(dayKey) || { woct: [], proc: [] };
      if (m.woctHours != null) cur.woct.push(m.woctHours);
      if (m.processingHours != null) cur.proc.push(m.processingHours);
      trendMap.set(dayKey, cur);
    }

    const fcKey = o.fcName || "نامشخص";
    const fcReturn = returnByFc.get(fcKey) || { returned: 0, total: 0 };
    fcReturn.total += 1;
    if (m.isReturned) fcReturn.returned += 1;
    returnByFc.set(fcKey, fcReturn);

    const prod = productivityByFc.get(fcKey) || { laborHours: 0, orders: 0, items: 0 };
    prod.orders += 1;
    prod.laborHours += o.laborHours ?? 0;
    prod.items += o.orderItemCount ?? 0;
    productivityByFc.set(fcKey, prod);

    if (o.hasCod === true) codCount += 1;
    if (o.hasCod === false) nonCodCount += 1;

    const courierKey = o.courierName || "نامشخص";
    courierDist.set(courierKey, (courierDist.get(courierKey) || 0) + 1);
  }

  const itemsPerLaborHour = totalLaborHours > 0 ? totalItems / totalLaborHours : null;
  const unitsPerLaborHour =
    totalLaborHours > 0 && totalUnits > 0 ? totalUnits / totalLaborHours : null;

  const averageOrderValue =
    orderValueCount === 0 ? null : orderValueSum / orderValueCount;
  const averageShippingCost =
    shippingCostCount === 0 ? null : shippingCostSum / shippingCostCount;

  const trend = Array.from(trendMap.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, v]) => ({
      date,
      woctHours: v.woct.length ? v.woct.reduce((a, b) => a + b, 0) / v.woct.length : null,
      processingHours: v.proc.length ? v.proc.reduce((a, b) => a + b, 0) / v.proc.length : null
    }));

  const ratioStats = summarize(shipRatioList);
  const ratioTotalsAvg =
    shipRatioEligibleSumValue > 0
      ? (shipRatioEligibleSumCost / shipRatioEligibleSumValue) * 100
      : null;

  const ratioFromAverages =
    averageOrderValue != null &&
    averageOrderValue > 0 &&
    averageShippingCost != null
      ? (averageShippingCost / averageOrderValue) * 100
      : null;

  const shippingCostRatioAvg =
    ratioFromAverages != null
      ? ratioFromAverages
      : ratioTotalsAvg != null
        ? ratioTotalsAvg
        : ratioStats.avg;

  const shippingCostRatio: Stats = {
    ...ratioStats,
    avg: shippingCostRatioAvg
  };

  const returnRateByFc = Array.from(returnByFc.entries()).map(([fcName, v]) => ({
    fcName,
    orders: v.total,
    returnRate: v.total === 0 ? 0 : (v.returned / v.total) * 100
  }));

  const productivityByFcArr = Array.from(productivityByFc.entries()).map(
    ([fcName, v]) => ({
      fcName,
      ordersPerLaborHour: v.laborHours > 0 ? v.orders / v.laborHours : null,
      itemsPerLaborHour: v.laborHours > 0 ? v.items / v.laborHours : null
    })
  );

  return {
    woctHours: summarize(woctList),
    processingHours: summarize(processingList),
    stagingHours: summarize(stagingList),
    sameDayRate: sameDayEligible === 0 ? null : (sameDayCount / sameDayEligible) * 100,
    returnRate: orders.length === 0 ? null : (ordersReturned / orders.length) * 100,
    averageOrderValue,
    averageShippingCost,
    shippingCostRatio,
    itemsPerLaborHour,
    unitsPerLaborHour,
    ordersCount: orders.length,
    trend,
    returnRateByFc,
    productivityByFc: productivityByFcArr,
    codDistribution: [
      { label: "COD", value: codCount },
      { label: "Non-COD", value: nonCodCount }
    ],
    courierDistribution: Array.from(courierDist.entries()).map(([label, value]) => ({
      label,
      value
    }))
  };
}
