export interface OrderRecord {
  orderId: string;
  fcName: string;
  sellerName: string;
  orderValue: number | null;
  orderCreatedAt: Date | null;
  opsCompletedAt: Date | null;
  warehouseExitAt: Date | null;
}
