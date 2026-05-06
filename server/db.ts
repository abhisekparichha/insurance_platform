/**
 * Data source bridge for the Express API.
 *
 * Priority:
 *   1. SQLite database at DB_PATH (written by the Python crawl pipeline)
 *      — used when the DB exists and contains at least one active product.
 *   2. server/data/seed.json — curated demo data, always available as fallback.
 *
 * Both paths return the same SeedData shape so server/index.ts is unaware of
 * which source is active.
 */

import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { createRequire } from "module";

const _require = createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_PATH  = process.env.DB_PATH  ?? path.join(__dirname, "../data/insurance.db");
const SEED_PATH = path.join(__dirname, "data/seed.json");

// ── Shared frontend types (mirrors frontend/src/types/index.ts) ───────────────

export type Category = {
  id: string; label: string; icon: string; productCount: number;
};

export type Insurer = {
  id: string; name: string; logoUrl?: string; rating: number; totalProducts: number;
};

export type Review = {
  id: string; rating: number; title: string; content: string;
  author: string; createdAt: string;
};

export type PolicySection = {
  id: string; title: string; content: string;
  anchors?: Array<{ id: string; label: string }>;
};

export type PolicyDocument = {
  id: string; label: string; url: string; type: "wording" | "brochure" | "faq";
};

export type PolicyScore = {
  id: string; label: string;
  status: "excellent" | "good" | "warning" | "critical";
  summary: string; weight: number;
};

export type ProductSummary = {
  id: string; name: string; insurer: string; rating: number; priceFrom: number;
  coverageType: string; coverageAmount: string; tags: string[]; categoryId: string;
  policyExcerpt: string; policyDocumentUrl: string; highlights: string[];
  lastReview?: Review;
  // Extra fields surfaced from the DB
  dataStatus?: "live" | "pending" | "stale" | "missing";
  qcStatus?:   "unverified" | "verified" | "failed";
};

export type ProductDetail = ProductSummary & {
  description: string; benefits: string[]; policyWording: string;
  policySections: PolicySection[]; documents: PolicyDocument[];
  reviews: Review[]; scorecard: PolicyScore[];
};

export type SeedData = {
  categories: Category[];
  insurers:   Insurer[];
  products:   ProductDetail[];
};

// ── Category label / icon lookup ──────────────────────────────────────────────

const CATEGORY_META: Record<string, { label: string; icon: string; coverageType: string }> = {
  health:            { label: "Health Insurance",         icon: "🏥", coverageType: "Indemnity"     },
  health_base:       { label: "Health Insurance",         icon: "🏥", coverageType: "Indemnity"     },
  health_topup:      { label: "Health Top-up",            icon: "⬆️", coverageType: "Top-up"        },
  motor:             { label: "Motor Insurance",          icon: "🚗", coverageType: "Comprehensive"  },
  motor_pvt_car:     { label: "Motor — Private Car",      icon: "🚗", coverageType: "Comprehensive"  },
  motor_two_wheeler: { label: "Motor — Two Wheeler",      icon: "🏍️", coverageType: "Comprehensive"  },
  life_term:         { label: "Term Life",                icon: "🛡️", coverageType: "Pure term"     },
  life_savings:      { label: "Life Savings",             icon: "💰", coverageType: "Endowment"     },
};

// ── SQLite reader ─────────────────────────────────────────────────────────────

// Use a lazy require so the server still starts even when better-sqlite3 is
// not installed (seed.json fallback is used in that case).
function tryOpenDb(): import("better-sqlite3").Database | null {
  if (!existsSync(DB_PATH)) return null;
  try {
    const Database = _require("better-sqlite3") as typeof import("better-sqlite3");
    const db = new Database(DB_PATH, { readonly: true });
    return db;
  } catch {
    return null;
  }
}

function dbHasActiveProducts(db: import("better-sqlite3").Database): boolean {
  const row = db.prepare(
    "SELECT COUNT(*) AS n FROM products"
  ).get() as { n: number };
  return row.n > 0;
}

function safeJson<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; }
  catch { return fallback; }
}

function truncate(s: string | null | undefined, max: number): string {
  if (!s) return "";
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function toDisplayName(insurer_id: string): string {
  return insurer_id
    .split("-")
    .slice(1)                              // strip category prefix
    .join(" ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function mapDbRow(row: Record<string, unknown>): ProductDetail {
  const rawCategory = (row.category as string | null) ?? "other";
  const meta = CATEGORY_META[rawCategory] ?? { label: rawCategory, icon: "📋", coverageType: "Unknown" };
  const tags = safeJson<string[]>(row.tags_json as string, []);
  const qcStatus = (row.qc_status as string | undefined) ?? "unverified";
  const status   = "active";

  return {
    id:              row.product_id as string,
    name:            row.name as string,
    insurer:         (row.insurer_name as string | null) ?? toDisplayName(row.insurer_id as string),
    rating:          0,
    priceFrom:       0,
    coverageType:    meta.coverageType,
    coverageAmount:  "Varies — see policy",
    tags,
    categoryId:      rawCategory,
    policyExcerpt:   truncate(row.description as string, 200),
    policyDocumentUrl: (row.product_url as string | null) ?? "",
    highlights:      [],
    description:     (row.description as string | null) ?? "",
    benefits:        [],
    policyWording:   "",
    policySections:  [],
    documents:       [],
    reviews:         [],
    scorecard:       [],
    dataStatus:      status as ProductSummary["dataStatus"],
    qcStatus:        qcStatus as ProductSummary["qcStatus"],
  };
}

function buildFromDb(db: import("better-sqlite3").Database): SeedData {
  const rows = db
    .prepare(
      `SELECT p.*, i.name AS insurer_name, i.website_url AS insurer_website
       FROM products p
       JOIN insurers i ON p.insurer_id = i.insurer_id
       ORDER BY p.updated_at DESC`
    )
    .all() as Record<string, unknown>[];

  const products = rows.map(mapDbRow);

  // Derive categories from actual product data
  const catCounts = new Map<string, number>();
  for (const p of products) catCounts.set(p.categoryId, (catCounts.get(p.categoryId) ?? 0) + 1);

  const categories: Category[] = Array.from(catCounts.entries()).map(([id, count]) => ({
    id,
    label:        CATEGORY_META[id]?.label ?? id,
    icon:         CATEGORY_META[id]?.icon  ?? "📋",
    productCount: count,
  }));

  // Derive insurer list from actual product data
  const insurerCounts = new Map<string, number>();
  for (const p of products) insurerCounts.set(p.insurer, (insurerCounts.get(p.insurer) ?? 0) + 1);

  const insurers: Insurer[] = Array.from(insurerCounts.entries()).map(([name, count]) => ({
    id:            name.toLowerCase().replace(/\s+/g, "-"),
    name,
    rating:        0,
    totalProducts: count,
  }));

  return { categories, insurers, products };
}

// ── Seed.json reader (fallback) ───────────────────────────────────────────────

let _seedCache: SeedData | null = null;

async function loadSeed(): Promise<SeedData> {
  if (_seedCache) return _seedCache;
  _seedCache = JSON.parse(await readFile(SEED_PATH, "utf-8")) as SeedData;
  return _seedCache;
}

// ── Public API ────────────────────────────────────────────────────────────────

let _source: "db" | "seed" | null = null;

export async function getDataSource(): Promise<SeedData> {
  const db = tryOpenDb();
  if (db && dbHasActiveProducts(db)) {
    if (_source !== "db") {
      console.log("  Data source: SQLite DB →", DB_PATH);
      _source = "db";
    }
    return buildFromDb(db);
  }
  if (_source !== "seed") {
    console.log("  Data source: seed.json (DB not ready or empty)");
    _source = "seed";
  }
  return loadSeed();
}

export function getSourceLabel(): string {
  return _source === "db" ? `SQLite (${DB_PATH})` : "seed.json";
}
