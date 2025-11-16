import { OrderRecord } from "./types";

function diffHours(a: Date | null, b: Date | null): number | null {
  if (!a || !b) return null;
  const diffMs = b.getTime() - a.getTime();
  return diffMs / (1000 * 60 * 60);
}

export function computeKpis(orders: OrderRecord[]) {
  const woctList: number[] = [];
  const processingList: number[] = [];

  for (const o of orders) {
    const woct = diffHours(o.orderCreatedAt, o.warehouseExitAt);
    if (woct != null && !Number.isNaN(woct)) woctList.push(woct);
    const proc = diffHours(o.orderCreatedAt, o.opsCompletedAt);
    if (proc != null && !Number.isNaN(proc)) processingList.push(proc);
  }

  const avg = (arr: number[]) =>
    arr.length === 0 ? null : arr.reduce((a, b) => a + b, 0) / arr.length;

  return {
    woctHoursAvg: avg(woctList),
    processingHoursAvg: avg(processingList),
    ordersCount: orders.length
  };
}
