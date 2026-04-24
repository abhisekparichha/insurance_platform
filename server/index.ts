import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

import { scoreProduct } from "../src/score.js";
import { scoreTermProduct } from "../src/score.js";
import { scoreMotorProduct } from "../src/score.js";
import { validateHealthProduct } from "../models/health_types.js";
import type { TermProduct } from "../models/term_types.js";
import type { MotorProduct } from "../models/motor_types.js";
import { getDataSource, getSourceLabel, type ProductDetail, type ProductSummary } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3001);
const FRONTEND_DIST = path.join(__dirname, "../frontend/dist");

// ── Frontend types (mirrors frontend/src/types/index.ts) ──────────────────────

type Category    = import("./db.js").Category;
type PolicyScore = import("./db.js").PolicyScore;

type ProductQuery = {
  categoryId?: string; search?: string;
  insurers?: string[]; coverageTypes?: string[]; tags?: string[];
  sort?: "relevance" | "price_low" | "price_high" | "rating";
  page?: number; pageSize?: number;
};

// ── Score → PolicyScore bridge ────────────────────────────────────────────────

function ratingToStatus(rating: string, score: number): PolicyScore["status"] {
  if (rating === "Good")  return score >= 90 ? "excellent" : "good";
  if (rating === "OK")    return "warning";
  return "critical";
}

function parameterLabel(param: string): string {
  const labels: Record<string, string> = {
    room_rent: "Room Rent", disease_sublimits: "Disease Sublimits", copay: "Copay",
    waiting_periods: "Waiting Periods", recharge: "Recharge/Restore", pre_post: "Pre/Post Hospitalisation",
    ncb: "No Claim Bonus", reasonable_customary: "R&C Clause", daycare: "Daycare",
    ayush: "AYUSH", domiciliary: "Domiciliary", sublimits: "Sublimits",
    topup_friendliness: "Top-up Structure", claim_settlement_ratio: "Claim Settlement Ratio",
    amount_settlement_ratio: "Amount Settlement Ratio", solvency_ratio: "Solvency Ratio",
    complaint_volume: "Complaint Volume", riders_quality: "Riders", plan_flexibility: "Plan Flexibility",
    premium_competitiveness: "Premium", zero_depreciation: "Zero Depreciation",
    idv_adequacy: "IDV Adequacy", engine_protection: "Engine Protection",
    consumables_cover: "Consumables", insurer_reliability: "Insurer Reliability",
    ncb_protection: "NCB Protection", return_to_invoice: "Return to Invoice",
    roadside_assistance: "Roadside Assistance", personal_accident: "Personal Accident"
  };
  return labels[param] ?? param.replace(/_/g, " ");
}

// ── Product filtering + sorting ───────────────────────────────────────────────

function filterProducts(products: ProductDetail[], q: ProductQuery): ProductDetail[] {
  return products.filter((p) => {
    if (q.categoryId && p.categoryId !== q.categoryId) return false;
    if (q.insurers?.length && !q.insurers.includes(p.insurer)) return false;
    if (q.coverageTypes?.length && !q.coverageTypes.includes(p.coverageType)) return false;
    if (q.tags?.length && !q.tags.some((t) => p.tags.includes(t))) return false;
    if (q.search) {
      const hay = [p.name, p.insurer, p.policyExcerpt, ...p.tags].join(" ").toLowerCase();
      if (!hay.includes(q.search.toLowerCase())) return false;
    }
    return true;
  });
}

function sortProducts(products: ProductDetail[], sort?: ProductQuery["sort"]): ProductDetail[] {
  if (!sort || sort === "relevance") return products;
  const copy = [...products];
  if (sort === "price_low")  copy.sort((a, b) => a.priceFrom - b.priceFrom);
  if (sort === "price_high") copy.sort((a, b) => b.priceFrom - a.priceFrom);
  if (sort === "rating")     copy.sort((a, b) => b.rating - a.rating);
  return copy;
}

function toSummary(p: ProductDetail): ProductSummary {
  const { description: _d, benefits: _b, policyWording: _pw, policySections: _ps,
          documents: _do, reviews, scorecard: _sc, ...summary } = p;
  return { ...summary, lastReview: reviews[0] };
}

// ── Express setup ─────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ── GET /categories ────────────────────────────────────────────────────────────

app.get("/categories", async (_req: Request, res: Response) => {
  const seed = await getDataSource();
  const categories = seed.categories.map((cat) => ({
    ...cat,
    productCount: seed.products.filter((p) => p.categoryId === cat.id).length
  }));
  res.json(categories);
});

// ── GET /insurers ─────────────────────────────────────────────────────────────

app.get("/insurers", async (_req: Request, res: Response) => {
  const seed = await getDataSource();
  res.json(seed.insurers);
});

// ── GET /products ─────────────────────────────────────────────────────────────

app.get("/products", async (req: Request, res: Response) => {
  const seed = await getDataSource();

  const q: ProductQuery = {
    categoryId:    req.query.categoryId as string | undefined,
    search:        req.query.search     as string | undefined,
    insurers:      toArray(req.query.insurers),
    coverageTypes: toArray(req.query.coverageTypes),
    tags:          toArray(req.query.tags),
    sort:          req.query.sort       as ProductQuery["sort"],
    page:          req.query.page     ? Number(req.query.page)     : 1,
    pageSize:      req.query.pageSize ? Number(req.query.pageSize) : 8
  };

  const filtered = sortProducts(filterProducts(seed.products, q), q.sort);
  const page     = q.page!;
  const pageSize = q.pageSize!;
  const start    = (page - 1) * pageSize;

  res.json({
    items:    filtered.slice(start, start + pageSize).map(toSummary),
    total:    filtered.length,
    page,
    pageSize
  });
});

// ── GET /products/:id ─────────────────────────────────────────────────────────

app.get("/products/:id", async (req: Request, res: Response) => {
  const seed = await getDataSource();
  const product = seed.products.find((p) => p.id === req.params.id);
  if (!product) return void res.status(404).json({ error: "Product not found" });
  res.json(product);
});

// ── GET /search/suggestions ────────────────────────────────────────────────────

app.get("/search/suggestions", async (req: Request, res: Response) => {
  const term = (req.query.search as string ?? "").toLowerCase();
  if (!term) return void res.json([]);

  const seed = await getDataSource();
  const suggestions = seed.products
    .filter((p) => p.name.toLowerCase().includes(term) || p.insurer.toLowerCase().includes(term))
    .slice(0, 6)
    .map((p) => ({
      id:            p.id,
      name:          p.name,
      categoryLabel: seed.categories.find((c: Category) => c.id === p.categoryId)?.label ?? "All",
      rating:        p.rating
    }));

  res.json(suggestions);
});

// ── POST /api/score/health ─────────────────────────────────────────────────────

app.post("/api/score/health", (req: Request, res: Response) => {
  const validation = validateHealthProduct(req.body);
  if (!validation.valid) return void res.status(400).json({ errors: validation.errors });

  const evaluation = scoreProduct(req.body);
  const scorecard: PolicyScore[] = evaluation.scores.map((s) => ({
    id:      s.parameter,
    label:   parameterLabel(s.parameter),
    status:  ratingToStatus(s.rating, s.score),
    summary: s.rationale,
    weight:  s.score / 100
  }));

  res.json({ evaluation, scorecard });
});

// ── POST /api/score/term ───────────────────────────────────────────────────────

app.post("/api/score/term", (req: Request, res: Response) => {
  const product = req.body as TermProduct;
  if (!product?.product?.insurer) return void res.status(400).json({ error: "Invalid term product payload" });

  const evaluation = scoreTermProduct(product);
  const scorecard: PolicyScore[] = evaluation.scores.map((s) => ({
    id:      s.parameter,
    label:   parameterLabel(s.parameter),
    status:  ratingToStatus(s.rating, s.score),
    summary: s.rationale,
    weight:  s.score / 100
  }));

  res.json({ evaluation, scorecard });
});

// ── POST /api/score/motor ──────────────────────────────────────────────────────

app.post("/api/score/motor", (req: Request, res: Response) => {
  const product = req.body as MotorProduct;
  if (!product?.product?.insurer) return void res.status(400).json({ error: "Invalid motor product payload" });

  const evaluation = scoreMotorProduct(product);
  const scorecard: PolicyScore[] = evaluation.scores.map((s) => ({
    id:      s.parameter,
    label:   parameterLabel(s.parameter),
    status:  ratingToStatus(s.rating, s.score),
    summary: s.rationale,
    weight:  s.score / 100
  }));

  res.json({ evaluation, scorecard });
});

// ── GET /api/health ────────────────────────────────────────────────────────────

app.get("/api/health", async (_req: Request, res: Response) => {
  const seed = await getDataSource();
  res.json({
    status:     "ok",
    products:   seed.products.length,
    dataSource: getSourceLabel(),
    ts:         new Date().toISOString()
  });
});

// ── Serve built frontend (production) ─────────────────────────────────────────

if (existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get(/.*/, (_req: Request, res: Response) => {
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
} else {
  app.get("/", (_req: Request, res: Response) => {
    res.json({
      message: "API is running. Frontend not built yet.",
      hint:    "Run: cd frontend && pnpm build",
      api:     [
        "GET  /categories",
        "GET  /insurers",
        "GET  /products",
        "GET  /products/:id",
        "GET  /search/suggestions?search=<term>",
        "POST /api/score/health",
        "POST /api/score/term",
        "POST /api/score/motor",
        "GET  /api/health"
      ]
    });
  });
}

// ── Error handler ──────────────────────────────────────────────────────────────

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

// ── Start ──────────────────────────────────────────────────────────────────────

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n  API  →  http://localhost:${PORT}/api/health`);
  if (existsSync(FRONTEND_DIST)) {
    console.log(`  App  →  http://localhost:${PORT}\n`);
  } else {
    console.log(`  Frontend not built. Run: cd frontend && pnpm build\n`);
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function toArray(val: unknown): string[] | undefined {
  if (!val) return undefined;
  return Array.isArray(val) ? val as string[] : [val as string];
}
