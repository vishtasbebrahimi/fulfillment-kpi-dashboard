import express from "express";
import cors from "cors";
import multer from "multer";
import { parseExcel } from "./excelParser";
import { setOrders, getOrders } from "./dataStore";
import { computeKpis } from "./kpiService";

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
    res.json({ success: true, kpis });
  } catch (e: any) {
    console.error(e);
    res.status(500).send(e?.message || "Failed to parse Excel");
  }
});

app.get("/api/kpis", (req, res) => {
  try {
    const all = getOrders();
    let result = all;
    const search = req.query.search ? String(req.query.search).trim() : "";
    if (search) {
      const s = search.toLowerCase();
      result = all.filter(
        (o) =>
          o.orderId.toLowerCase().includes(s) ||
          o.sellerName.toLowerCase().includes(s)
      );
    }
    const kpis = computeKpis(result);
    res.json({ kpis });
  } catch (e: any) {
    console.error(e);
    res.status(500).send(e?.message || "Failed to compute KPIs");
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
