# EFA Fulfillment KPI Dashboard

Dashboard فول‌استک برای تحلیل KPIهای عملیات فولفیلمنت روی داده سفارش‌ها (ورودی فایل Excel). شامل آپلود اکسل، محاسبه ۹ KPI کلیدی، فیلترها، کارت‌ها، نمودارهای ترند/توزیع و جدول سفارش با جزئیات.

## اجرا
```bash
npm install
npm run dev
```
- سرور: http://localhost:3001
- وب: http://localhost:5173

## مسیرهای API
- `POST /api/upload-excel` : فایل اکسل (`file`) را می‌گیرد، پارس می‌کند، سفارش‌ها را در حافظه می‌ریزد و KPIها را برمی‌گرداند.
- `GET /api/kpis` : KPIهای فیلترشده را برمی‌گرداند. پارامترها (اختیاری):
  - `startDate`, `endDate` (بر اساس `order_created_at`)
  - `exitStart`, `exitEnd` (بر اساس `warehouse_exit_at`)
  - `fcName`, `sellerName`, `courierName`, `province`, `city`
  - `hasCod` (true/false)
  - `search` (روی orderId/seller/fc)
- `GET /api/orders` : لیست سفارش‌ها با متریک‌های سطح سفارش + صفحه‌بندی و مرتب‌سازی.
  - پارامترهای فیلتر مثل `/api/kpis`
  - `page`, `pageSize` (پیش‌فرض 1 و 20)، `sort`, `dir` (asc/desc)

## ستون‌های ورودی اکسل (aliasهای پذیرفته‌شده)
- اشتراک سفارش: `order_id`, `orderid`, `شناسه سفارش`, `شماره سفارش`
- مرکز پردازش: `fc_name`, `مرکز پردازش`, `انبار`, `fc`
- فروشنده: `seller_name`, `فروشنده`, `فروشگاه`
- کوریر: `courier_name`, `courier`, `کوریر`, `شرکت پستی`
- استان/شهر: `province`, `استان` / `city`, `شهر`
- COD: `has_cod`, `cod`, `پرداخت در محل`
- ارزش سفارش: `order_value`, `ارزش سفارش`, `مبلغ سفارش`
- هزینه ارسال: `courier_shipping_cost`, `shipping_cost`, `هزینه ارسال`
- هزینه مرجوعی: `courier_return_cost`, `return_cost`, `هزینه مرجوعی`
- زمان‌ها (تاریخ + ساعت): `order_created_date`/`time`, `ops_completed_date`/`time`, `warehouse_exit_date`/`time`, `return_date`
  - تاریخ شمسی/میلادی با جداکننده `-`/`/`/`.` و اعداد فارسی/انگلیسی پشتیبانی می‌شود.
- اقلام/نفرساعت: `order_item_count`, `line_unit_count`, `labor_hours`

## KPIهای محاسبه‌شده
- Warehouse Order Cycle Time (WOCT): آمار (میانگین/میانه/min/max/count) بر حسب ساعت
- Processing Time (Internal Ops): آمار بر حسب ساعت
- Staging Time: آمار بر حسب ساعت
- Same-day Shipment Rate: % خروج همان‌روز ثبت
- Return Rate: % سفارش‌های مرجوع
- Average Order Value (AOV)
- Average Shipping Cost
- Shipping Cost as % of Order Value: آمار نسبت هزینه ارسال به ارزش سفارش
- Items per Labor Hour (و Units per Labor Hour اگر داده units موجود باشد)
- توزیع‌ها و ترندها:
  - Trend روزانه WOCT/Processing
  - Return Rate by FC
  - Productivity by FC (Orders/LaborHr, Items/LaborHr)
  - COD vs Non-COD و توزیع کوریر

## فیلترها در داشبورد
- بازه تاریخ ثبت و خروج از انبار
- fc_name، seller_name، courier_name
- استان، شهر
- COD / غیر COD
- جستجو (orderId / فروشنده / مرکز)

## فرانت (web)
- Layout سه‌تکه: Sidebar ثابت، TopBar با Date Range و آپلود اکسل، کارت فیلترها، کارت‌های KPI، نمودارها، جدول سفارش + Drawer جزئیات.
- جدول سفارش: سورت، جستجو، صفحه‌بندی، کلیک روی ردیف → جزئیات سفارش و تایم‌لاین رویدادها.
- Empty state: قبل از آپلود، پیام و دکمه آپلود نمایش داده می‌شود.

## بک‌اند (server)
- Express + multer (memory) برای آپلود اکسل، ExcelJS برای پارس با نرمال‌سازی هدرها (فارسی/انگلیسی/اعداد فارسی)، تجمیع رکوردهای تکراری روی order_id و محاسبه KPIها.

## توسعه
- اجرای همزمان سرور و وب: `npm run dev`
- Type-check: `npm exec tsc --noEmit --pretty false`
