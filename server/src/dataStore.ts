import { OrderRecord } from "./types";

let orders: OrderRecord[] = [];

export function setOrders(newOrders: OrderRecord[]) {
  orders = newOrders;
}

export function getOrders(): OrderRecord[] {
  return orders;
}
