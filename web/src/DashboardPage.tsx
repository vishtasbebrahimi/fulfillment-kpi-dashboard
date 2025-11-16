import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";

type Stats = {
  avg: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  count: number;
};

type KpisResponse = {
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

type OrderResponse = {
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
  orderCreatedAt: string | null;
  opsCompletedAt: string | null;
  warehouseExitAt: string | null;
  returnDate: string | null;
  orderItemCount: number | null;
  lineUnitCount: number | null;
  laborHours: number | null;
  woctHours: number | null;
  processingHours: number | null;
  stagingHours: number | null;
  shipCostRatio: number | null;
};

type OrdersResponse = {
  total: number;
  page: number;
  pageSize: number;
  orders: OrderResponse[];
};

type HasCodFilter = "all" | "cod" | "non_cod";

type Filters = {
  fcName: string;
  sellerName: string;
  courierName: string;
  province: string;
  city: string;
  hasCod: HasCodFilter;
  startDate: string;
  endDate: string;
  exitStart: string;
  exitEnd: string;
};

type SortState = { field: string; direction: "asc" | "desc" };

const KPI_CARDS = [
  { key: "woctHours", label: "WOCT (ساعت)", path: ["woctHours", "avg"], unit: "h" },
  {
    key: "processingHours",
    label: "Processing Time (ساعت)",
    path: ["processingHours", "avg"],
    unit: "h"
  },
  { key: "stagingHours", label: "Staging (ساعت)", path: ["stagingHours", "avg"], unit: "h" },
  { key: "sameDayRate", label: "Same-day Shipment", path: ["sameDayRate"], unit: "%" },
  { key: "returnRate", label: "Return Rate", path: ["returnRate"], unit: "%" },
  { key: "averageOrderValue", label: "AOV", path: ["averageOrderValue"], unit: "" },
  { key: "averageShippingCost", label: "Avg Shipping", path: ["averageShippingCost"], unit: "" },
  {
    key: "shippingCostRatio",
    label: "Ship Cost % of Value",
    path: ["shippingCostRatio", "avg"],
    unit: "%"
  },
  {
    key: "itemsPerLaborHour",
    label: "Items per Labor Hour",
    path: ["itemsPerLaborHour"],
    unit: ""
  }
];

const COLORS = ["#2563eb", "#f97316", "#10b981", "#a855f7", "#0ea5e9", "#f43f5e"];

function formatNumber(v: number | null | undefined, suffix = "") {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function buildQuery(filters: Filters, search: string, sort?: SortState, page = 1, pageSize = 20) {
  const params = new URLSearchParams();
  if (filters.fcName) params.set("fcName", filters.fcName);
  if (filters.sellerName) params.set("sellerName", filters.sellerName);
  if (filters.courierName) params.set("courierName", filters.courierName);
  if (filters.province) params.set("province", filters.province);
  if (filters.city) params.set("city", filters.city);
  if (filters.hasCod === "cod") params.set("hasCod", "true");
  if (filters.hasCod === "non_cod") params.set("hasCod", "false");
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.exitStart) params.set("exitStart", filters.exitStart);
  if (filters.exitEnd) params.set("exitEnd", filters.exitEnd);
  if (search) params.set("search", search);
  if (sort) {
    params.set("sort", sort.field);
    params.set("dir", sort.direction);
  }
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  return params.toString();
}

export function DashboardPage() {
  const [fileUploading, setFileUploading] = useState(false);
  const [hasData, setHasData] = useState(false);

  const [filters, setFilters] = useState<Filters>({
    fcName: "",
    sellerName: "",
    courierName: "",
    province: "",
    city: "",
    hasCod: "all",
    startDate: "",
    endDate: "",
    exitStart: "",
    exitEnd: ""
  });

  const [kpis, setKpis] = useState<KpisResponse | null>(null);
  const [kpisLoading, setKpisLoading] = useState(false);
  const [kpisError, setKpisError] = useState<string | null>(null);

  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPageSize, setOrdersPageSize] = useState(10);
  const [ordersSort, setOrdersSort] = useState<SortState>({ field: "orderCreatedAt", direction: "desc" });
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [orderSearch, setOrderSearch] = useState("");

  const [selectedOrder, setSelectedOrder] = useState<OrderResponse | null>(null);

  const [filterOptions, setFilterOptions] = useState<{
    fcNames: string[];
    sellerNames: string[];
    courierNames: string[];
    provinces: string[];
    cities: string[];
  }>({ fcNames: [], sellerNames: [], courierNames: [], provinces: [], cities: [] });

  const fetchKpis = async () => {
    try {
      setKpisLoading(true);
      setKpisError(null);
      const query = buildQuery(filters, orderSearch, undefined, 1, 10);
      const res = await fetch(`/api/kpis?${query}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setKpis(data.kpis);
      setHasData(true);
    } catch (err: any) {
      console.error(err);
      setKpisError(err?.message || "Failed to fetch KPIs");
    } finally {
      setKpisLoading(false);
    }
  };

  const fetchOrders = async (page = ordersPage, pageSize = ordersPageSize, sort = ordersSort) => {
    try {
      setOrdersLoading(true);
      setOrdersError(null);
      const query = buildQuery(filters, orderSearch, sort, page, pageSize);
      const res = await fetch(`/api/orders?${query}`);
      if (!res.ok) throw new Error(await res.text());
      const data: OrdersResponse = await res.json();
      setOrders(data.orders);
      setOrdersTotal(data.total);
      setOrdersPage(page);
      setOrdersPageSize(pageSize);
      setOrdersSort(sort);
      setHasData(data.total > 0 || hasData);

      // derive filter options
      const uniques = <T extends keyof OrderResponse>(key: T) =>
        Array.from(new Set(data.orders.map((o) => (o[key] || "") as string).filter(Boolean)));
      setFilterOptions({
        fcNames: uniques("fcName"),
        sellerNames: uniques("sellerName"),
        courierNames: uniques("courierName"),
        provinces: uniques("province"),
        cities: uniques("city")
      });
    } catch (err: any) {
      console.error(err);
      setOrdersError(err?.message || "Failed to fetch orders");
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    setFileUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload-excel", {
        method: "POST",
        body: formData
      });
      if (!res.ok) throw new Error(await res.text());
      await res.json();
      setHasData(true);
      await fetchKpis();
      await fetchOrders(1, ordersPageSize, ordersSort);
    } catch (err: any) {
      alert(err?.message || "Upload failed");
    } finally {
      setFileUploading(false);
    }
  };

  useEffect(() => {
    if (hasData) {
      fetchKpis();
      fetchOrders(ordersPage, ordersPageSize, ordersSort);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  const resetFilters = () => {
    setFilters({
      fcName: "",
      sellerName: "",
      courierName: "",
      province: "",
      city: "",
      hasCod: "all",
      startDate: "",
      endDate: "",
      exitStart: "",
      exitEnd: ""
    });
    setOrderSearch("");
  };

  const handleSort = (field: string) => {
    const direction =
      ordersSort.field === field && ordersSort.direction === "asc" ? "desc" : "asc";
    fetchOrders(1, ordersPageSize, { field, direction });
  };

  const codPieMode = useMemo(
    () => (kpis ? kpis.codDistribution.reduce((a, b) => a + b.value, 0) > 0 : false),
    [kpis]
  );

  const emptyState = !hasData;

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <aside className="hidden md:flex w-64 flex-col border-r border-slate-200 bg-white">
        <div className="px-4 py-5 border-b">
          <h1 className="text-lg font-semibold">EFA Fulfillment Analytics</h1>
          <p className="text-xs text-slate-500">Dashboard</p>
        </div>
        <nav className="flex-1 overflow-auto px-2 py-3 space-y-1 text-sm">
          {["Overview", "Performance", "Returns", "Productivity", "Settings"].map((item) => (
            <button
              key={item}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 font-medium"
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="px-4 py-3 border-t text-sm text-slate-500">Light / Dark (soon)</div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">ایفا - تحلیلی روی سفارش‌ها</p>
            <h2 className="text-lg font-semibold">Order Fulfillment Dashboard</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <label className="text-slate-500">از</label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
                className="h-8 text-xs"
              />
              <label className="text-slate-500">تا</label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="cursor-pointer text-xs px-3 py-2 rounded-md border border-slate-200 bg-white shadow-sm">
                {fileUploading ? "در حال آپلود..." : "آپلود اکسل"}
                <input
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => handleUpload(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 md:px-6 py-4 space-y-4 max-w-7xl w-full mx-auto">
          {emptyState ? (
            <Card className="border-dashed border-2 border-slate-200 py-16 text-center">
              <CardContent>
                <div className="text-3xl mb-2">☁️</div>
                <h3 className="text-lg font-semibold">هنوز دیتایی لود نشده</h3>
                <p className="text-sm text-slate-500">
                  فایل اکسل سفارش‌ها را آپلود کن تا داشبورد ساخته شود.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">فیلترها</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Select
                      label="مرکز پردازش"
                      value={filters.fcName}
                      onChange={(v) => setFilters((f) => ({ ...f, fcName: v }))}
                      options={filterOptions.fcNames}
                    />
                    <Select
                      label="فروشنده"
                      value={filters.sellerName}
                      onChange={(v) => setFilters((f) => ({ ...f, sellerName: v }))}
                      options={filterOptions.sellerNames}
                    />
                    <Select
                      label="کوریر"
                      value={filters.courierName}
                      onChange={(v) => setFilters((f) => ({ ...f, courierName: v }))}
                      options={filterOptions.courierNames}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <Select
                      label="COD"
                      value={filters.hasCod}
                      onChange={(v) =>
                        setFilters((f) => ({ ...f, hasCod: v as HasCodFilter }))
                      }
                      options={["all", "cod", "non_cod"]}
                      renderLabel={(v) =>
                        v === "cod" ? "COD" : v === "non_cod" ? "غیر COD" : "همه"
                      }
                    />
                    <Select
                      label="استان"
                      value={filters.province}
                      onChange={(v) => setFilters((f) => ({ ...f, province: v }))}
                      options={filterOptions.provinces}
                    />
                    <Select
                      label="شهر"
                      value={filters.city}
                      onChange={(v) => setFilters((f) => ({ ...f, city: v }))}
                      options={filterOptions.cities}
                    />
                    <div className="flex items-end gap-2">
                      <Button onClick={() => fetchKpis()}>اعمال فیلتر</Button>
                      <Button variant="outline" onClick={resetFilters}>
                        ریست
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <KpiGrid kpis={kpis} loading={kpisLoading} />
              {kpisError && <p className="text-xs text-red-500">{kpisError}</p>}

              <ChartsSection kpis={kpis} loading={kpisLoading} />

              <OrdersSection
                orders={orders}
                total={ordersTotal}
                page={ordersPage}
                pageSize={ordersPageSize}
                loading={ordersLoading}
                error={ordersError}
                search={orderSearch}
                onSearchChange={(v) => setOrderSearch(v)}
                onSearchSubmit={() => fetchOrders(1, ordersPageSize, ordersSort)}
                onPageChange={(p) => fetchOrders(p, ordersPageSize, ordersSort)}
                onPageSizeChange={(s) => fetchOrders(1, s, ordersSort)}
                sort={ordersSort}
                onSortChange={(s) => fetchOrders(1, ordersPageSize, s)}
                onRowClick={setSelectedOrder}
              />

              <OrderDrawer order={selectedOrder} onClose={() => setSelectedOrder(null)} />
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  renderLabel
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: string[];
  renderLabel?: (val: string) => string;
}) {
  return (
    <label className="text-xs text-slate-600 space-y-1">
      <span className="block">{label}</span>
      <select
        className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">همه</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {renderLabel ? renderLabel(opt) : opt}
          </option>
        ))}
      </select>
    </label>
  );
}

function KpiGrid({ kpis, loading }: { kpis: KpisResponse | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {Array.from({ length: KPI_CARDS.length }).map((_, idx) => (
          <Card key={idx} className="h-28 animate-pulse bg-slate-100" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {KPI_CARDS.map((kpi) => (
        <Card key={kpi.key} className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-600">{kpi.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {formatNumber(getValue(kpis, kpi.path), kpi.unit ? ` ${kpi.unit}` : "")}
            </div>
            <p className="text-xs text-slate-500">count: {getCount(kpis, kpi.path)}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function getValue(obj: any, path: (string | number)[]) {
  return path.reduce((acc: any, key) => (acc ? acc[key] : undefined), obj);
}
function getCount(kpis: any, path: (string | number)[]) {
  const label = path[0];
  if (!kpis || typeof kpis !== "object") return "—";
  const bucket = (kpis as any)[label];
  if (bucket && typeof bucket === "object" && "count" in bucket) {
    return (bucket as any).count ?? "—";
  }
  if (label === "itemsPerLaborHour" || label === "sameDayRate") {
    return kpis.ordersCount ?? "—";
  }
  return "—";
}

function ChartsSection({ kpis, loading }: { kpis: KpisResponse | null; loading: boolean }) {
  if (!kpis) return null;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard title="Trend: WOCT vs Processing" loading={loading}>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={kpis.trend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="woctHours" name="WOCT" stroke={COLORS[0]} />
            <Line type="monotone" dataKey="processingHours" name="Processing" stroke={COLORS[1]} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Return Rate by FC" loading={loading}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={kpis.returnRateByFc}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="fcName" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="returnRate" fill={COLORS[1]} name="% Return" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Productivity (per FC)" loading={loading}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={kpis.productivityByFc}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="fcName" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="ordersPerLaborHour" fill={COLORS[0]} name="Orders/LaborHr" />
            <Bar dataKey="itemsPerLaborHour" fill={COLORS[2]} name="Items/LaborHr" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="COD / Courier Distribution" loading={loading}>
        <div className="grid grid-cols-1 md:grid-cols-2 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={kpis.codDistribution}
                dataKey="value"
                nameKey="label"
                outerRadius={90}
                fill={COLORS[0]}
                label
              >
                {kpis.codDistribution.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={kpis.courierDistribution}
                dataKey="value"
                nameKey="label"
                outerRadius={90}
                fill={COLORS[3]}
                label
              >
                {kpis.courierDistribution.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[(idx + 2) % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  );
}

function ChartCard({
  title,
  loading,
  children
}: {
  title: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-slate-700">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        {loading ? <div className="animate-pulse h-full bg-slate-100 rounded-md" /> : children}
      </CardContent>
    </Card>
  );
}

function OrdersSection({
  orders,
  total,
  page,
  pageSize,
  loading,
  error,
  search,
  onSearchChange,
  onSearchSubmit,
  onPageChange,
  onPageSizeChange,
  sort,
  onSortChange,
  onRowClick
}: {
  orders: OrderResponse[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: string | null;
  search: string;
  onSearchChange: (v: string) => void;
  onSearchSubmit: () => void;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  sort: SortState;
  onSortChange: (s: SortState) => void;
  onRowClick: (o: OrderResponse) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Orders</CardTitle>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <Input
            placeholder="جستجو سفارش / فروشنده / مرکز"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="max-w-xs"
          />
          <Button onClick={onSearchSubmit} size="sm">
            جستجو
          </Button>
          <select
            className="h-9 text-sm border border-slate-200 rounded-md px-2"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {[10, 20, 50].map((s) => (
              <option key={s} value={s}>
                {s} در صفحه
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500">مجموع: {total}</span>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
        <table className="w-full text-sm border border-slate-100 min-w-max">
          <thead className="bg-slate-50">
            <tr>
              {[
                { key: "orderId", label: "Order ID" },
                { key: "sellerName", label: "Seller" },
                { key: "fcName", label: "FC" },
                { key: "courierName", label: "Courier" },
                { key: "orderValue", label: "Value" },
                { key: "woctHours", label: "WOCT (h)" },
                { key: "processingHours", label: "Processing (h)" },
                { key: "stagingHours", label: "Staging (h)" },
                { key: "city", label: "City" },
                { key: "province", label: "Province" },
                { key: "hasCod", label: "COD" }
              ].map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-2 text-left cursor-pointer"
                  onClick={() => onSortChange({ field: col.key, direction: sort.direction === "asc" && sort.field === col.key ? "desc" : "asc" })}
                >
                  <div className="flex items-center gap-1">
                    <span>{col.label}</span>
                    {sort.field === col.key && (sort.direction === "asc" ? "▲" : "▼")}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} className="text-center py-6 text-slate-500">
                  در حال بارگذاری...
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr
                  key={o.orderId}
                  className="hover:bg-slate-50 cursor-pointer border-t"
                  onClick={() => onRowClick(o)}
                >
                  <td className="px-3 py-2">{o.orderId}</td>
                  <td className="px-3 py-2">{o.sellerName || "—"}</td>
                  <td className="px-3 py-2">{o.fcName || "—"}</td>
                  <td className="px-3 py-2">{o.courierName || "—"}</td>
                  <td className="px-3 py-2">{formatNumber(o.orderValue)}</td>
                  <td className="px-3 py-2">{formatNumber(o.woctHours)}</td>
                  <td className="px-3 py-2">{formatNumber(o.processingHours)}</td>
                  <td className="px-3 py-2">{formatNumber(o.stagingHours)}</td>
                  <td className="px-3 py-2">{o.city || "—"}</td>
                  <td className="px-3 py-2">{o.province || "—"}</td>
                  <td className="px-3 py-2">{o.hasCod === null ? "—" : o.hasCod ? "COD" : "غیر COD"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className="flex items-center justify-between py-3 text-xs">
          <div>
            صفحه {page} از {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              قبلی
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              بعدی
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OrderDrawer({ order, onClose }: { order: OrderResponse | null; onClose: () => void }) {
  return (
    <div
      className={`fixed inset-0 z-40 transition ${order ? "pointer-events-auto" : "pointer-events-none"}`}
    >
      <div
        className={`absolute inset-0 bg-black/30 transition-opacity ${order ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        className={`absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-xl transform transition-transform ${
          order ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <p className="text-xs text-slate-500">Order Details</p>
            <h3 className="text-lg font-semibold">{order?.orderId || "—"}</h3>
          </div>
          <Button variant="ghost" onClick={onClose}>
            بستن
          </Button>
        </div>
        <div className="p-4 space-y-3 overflow-auto h-full">
          {!order && <p className="text-sm text-slate-500">سفارشی انتخاب نشده است.</p>}
          {order && (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Seller" value={order.sellerName} />
                <Info label="FC" value={order.fcName} />
                <Info label="Courier" value={order.courierName} />
                <Info label="COD" value={order.hasCod === null ? "—" : order.hasCod ? "COD" : "غیر COD"} />
                <Info label="Order Value" value={formatNumber(order.orderValue)} />
                <Info label="Shipping Cost" value={formatNumber(order.courierShippingCost)} />
                <Info label="Return Cost" value={formatNumber(order.courierReturnCost)} />
                <Info label="Ship Cost %" value={formatNumber(order.shipCostRatio, "%")} />
              </div>
              <div className="grid grid-cols-1 gap-2 text-sm">
                <Info label="WOCT (h)" value={formatNumber(order.woctHours)} />
                <Info label="Processing (h)" value={formatNumber(order.processingHours)} />
                <Info label="Staging (h)" value={formatNumber(order.stagingHours)} />
              </div>
              <div className="space-y-1 text-sm">
                <Info label="Order Created" value={formatDate(order.orderCreatedAt)} />
                <Info label="Ops Completed" value={formatDate(order.opsCompletedAt)} />
                <Info label="Warehouse Exit" value={formatDate(order.warehouseExitAt)} />
                <Info label="Return Date" value={formatDate(order.returnDate)} />
              </div>
              <div className="space-y-1 text-sm">
                <Info label="استان" value={order.province || "—"} />
                <Info label="شهر" value={order.city || "—"} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-medium">{value ?? "—"}</p>
    </div>
  );
}
