import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";

type Kpis = {
  woctHoursAvg: number | null;
  processingHoursAvg: number | null;
  ordersCount: number;
};

export function DashboardPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload-excel", {
        method: "POST",
        body: formData
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Upload failed");
      }
      const data = await res.json();
      setKpis({
        woctHoursAvg: data.kpis.woctHoursAvg,
        processingHoursAvg: data.kpis.processingHoursAvg,
        ordersCount: data.kpis.ordersCount
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "خطا در آپلود فایل");
      setKpis(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRecalc = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/kpis?${params.toString()}`);
      if (!res.ok) throw new Error("خطا در دریافت KPI");
      const data = await res.json();
      setKpis({
        woctHoursAvg: data.kpis.woctHoursAvg,
        processingHoursAvg: data.kpis.processingHoursAvg,
        ordersCount: data.kpis.ordersCount
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "خطا در دریافت KPI");
    } finally {
      setLoading(false);
    }
  };

  const format = (v: number | null) =>
    v == null || Number.isNaN(v)
      ? "–"
      : v.toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">EFA Fulfillment KPIs</h1>
          <p className="text-xs text-slate-500">
            داشبورد ساده برای تست منطق WOCT و Processing Time
          </p>
        </div>
        <label className="text-xs cursor-pointer">
          <span className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white shadow-sm">
            انتخاب فایل اکسل
          </span>
          <input
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>
      </header>

      <main className="flex-1 px-4 py-4 max-w-4xl mx-auto w-full space-y-4">
        {fileName && (
          <p className="text-xs text-slate-500">فایل لود شده: {fileName}</p>
        )}

        <section className="flex items-end gap-3">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-slate-500">
              فیلتر ساده بر اساس شماره سفارش / فروشگاه
            </label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="شماره سفارش یا نام فروشگاه..."
            />
          </div>
          <Button onClick={handleRecalc} disabled={loading}>
            بروزرسانی KPI
          </Button>
        </section>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card>
            <CardHeader>
              <CardTitle>WOCT متوسط (ساعت)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {loading ? "..." : format(kpis?.woctHoursAvg ?? null)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Processing متوسط (ساعت)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {loading ? "..." : format(kpis?.processingHoursAvg ?? null)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>تعداد سفارش‌ها</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {loading ? "..." : kpis?.ordersCount?.toLocaleString() ?? "–"}
              </p>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
