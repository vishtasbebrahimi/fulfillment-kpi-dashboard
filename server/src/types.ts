export interface OrderRecord {
  orderId: string;
  fcName: string;
  sellerName: string;
  courierName: string;
  province: string;
  city: string;
  hasCod: boolean | null;

  orderValue: number | null;
  courierShippingCost: number | null;
  courierReturnCost: number | null;

  orderCreatedAt: Date | null;
  opsCompletedAt: Date | null;
  warehouseExitAt: Date | null;
  returnDate: Date | null;

  orderItemCount: number | null;
  lineUnitCount: number | null;
  laborHours: number | null;
}

export interface OrderResponse extends OrderRecord {
  woctHours: number | null;
  processingHours: number | null;
  stagingHours: number | null;
  shipCostRatio: number | null;
}
