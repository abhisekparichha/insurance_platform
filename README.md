# insurance_platform

Tools for crawling, parsing, and organizing IRDAI insurer listings, insurer product catalogs, and policy documents.  
The repository also ships a Node.js module that provides a standardized schema, normalization helpers, and a scoring engine for **retail health insurance (base + top-up)** products.

## Prerequisites

- Python 3.10+ (for the legacy crawling pipeline)
- Node.js 18+ and `pnpm` (for the health insurance schema toolkit)
- `pip` for dependency management

Install Python dependencies:

```
pip install -r requirements.txt
```

Install Node dependencies:

```
pnpm install
```

### One-command setup

The repo ships with `scripts/install_and_run.sh`, which creates a virtual environment, installs Node dependencies, runs the Python ingestion pipeline, and executes the TypeScript lint/typecheck/test suite:

```
./scripts/install_and_run.sh
```

Add `--` followed by any pipeline flags to forward them to `python -m src.pipeline`. For example, to skip document downloads and limit the run to three insurers:

```
./scripts/install_and_run.sh -- --max-insurers 3 --no-download-documents
```

Use `--skip-pipeline`, `--skip-node-tasks`, etc., if you only need part of the workflow.

## Usage

Run the IRDAI directory crawler to fetch and organize the data for general, life, and health insurers:

```
python3 -m src.insurer_crawler
```

To execute the full pipeline (insurers → products → documents → normalized schemas → SQLite database):

```
python3 -m src.pipeline
```

Key options:

- `--max-insurers N` limits how many insurers to process (useful for debugging).
- `--max-pages-per-insurer N` controls the crawl breadth per insurer site.
- `--no-download-documents` skips downloading policy PDFs while still cataloging links.

Results are written to the `data/` directory:

- `data/raw/` contains the unmodified tables from each page (`*.json`, `*.csv`).
- `data/*_normalized.*` files contain cleaned data per category.
- `data/insurers.json` and `data/insurers.csv` aggregate all categories, including crawl metadata.
- `data/product_document_mappings.*` map insurer products to policy wording and brochure documents.
- `data/documents/` stores downloaded brochures and policy wordings (if enabled).
- `data/insurance.db` is an SQLite database populated with insurers, products, documents, and normalized policy sections.
- `data/document_download_queue.json` lists every document that still needs to be fetched when downloads are skipped.

### Two-phase document downloads

If you want the relational data immediately but prefer to download PDFs later (or from a different machine/network), run the pipeline without downloads and use the asynchronous downloader when ready:

1. **Ingest without documents (records every download URL):**
   ```bash
   python -m src.pipeline --no-download-documents
   ```
   This still inserts document metadata into `data/insurance.db` and writes a manifest of pending URLs to `data/document_download_queue.json`.

2. **Download outstanding files with backoff + retries:**
   ```bash
   python scripts/download_documents.py \
     --queue data/document_download_queue.json \
     --db data/insurance.db \
     --min-delay 1.5 \
     --max-delay 4.0 \
     --max-parallel-insurers 2 \
     --retries 2
   ```
   The downloader:
   - Sleeps for a random duration between `min-delay`/`max-delay` before each request to avoid hammering a server.
   - Processes insurers in parallel (bounded by `--max-parallel-insurers`) but only retries failures after it has looped through every other insurer.
   - Updates `product_documents.local_path` in `data/insurance.db` and rewrites `data/document_download_queue.json` to reflect any remaining failures (so you can re-run the same command later).

Each normalized insurer record includes a `website_url` field when a URL can be inferred from the source content. Product records are tagged with inferred categories (health, motor, life_term, life_savings) and any extracted documents are parsed and mapped to canonical policy schemas where possible.

### Reprocess existing data (no crawl/download)

If the crawl has already populated `data/insurance.db` and `data/documents/`, but the frontend is missing parsed sections, rerun the parsing/normalization phases without touching the network:

```bash
python -m src.reprocess_local_documents \
  --db data/insurance.db \
  --data-dir data \
  --documents-dir data/documents \
  --only-missing-text
```

This script:

- Loads all `product_documents` rows (optionally scoped with `--insurer <id or name>`)
- Reads the existing local files, recomputes hashes, extracts text, and updates `product_documents`
- Regenerates `policy_sections` via the canonical schemas (skip with `--skip-policy-sections`)
- Rebuilds `data/product_document_mappings.{json,csv}` and a fresh `data/document_download_queue.json`

Pass `--max-documents N` to dry-run a small sample, or drop `--only-missing-text` to force a full refresh.

#### Frontend troubleshooting checklist

When uploaded/parsed documents fail to appear in the UI:

1. Run the reprocess script above (add `--insurer <slug>` to limit scope).  
2. Restart or rebuild your API so it re-reads `data/insurance.db` after the refresh.  
3. Bounce the frontend dev server (`pnpm dev`) so it picks up the updated responses.  
4. Inspect the browser network tab to ensure `/products/:id` now returns `documents` entries pointing to your refreshed PDFs.  
5. If a document is still missing, check the regenerated `data/document_download_queue.json` for the entry—if it’s there, the file is absent locally and must be copied into `data/documents/<insurer_id>/`.

---

## Health Insurance Schema & Evaluation Engine

### Project structure

- `models/health_schema.json` — Draft 2020-12 JSON Schema with custom error messages.
- `models/health_types.ts` — TypeScript interfaces + `validateHealthProduct`.
- `models/evaluation_schema.json` — Output contract for scoring results.
- `src/normalize.ts` — Pure mappers from loosely extracted facts.
- `src/score.ts` — Rule-based evaluation engine (Bad/OK/Good).
- `src/constants.ts` — Canonical enums, thresholds, and weights.
- `src/examples/` — Sample base-plan and top-up JSONs.
- `tests/` — Vitest suites for normalization and scoring.

### Running the toolkit

```
pnpm lint
pnpm typecheck
pnpm test
```

All commands are deterministic and run locally without network access.

### Extending the schema

1. **Add constants** – introduce enumerations or thresholds in `src/constants.ts`.
2. **Update schemas** – mirror the new fields in `models/health_schema.json` (product data) and, if applicable, `models/evaluation_schema.json`.
3. **Regenerate types** – edit `models/health_types.ts` to expose the new fields and keep `validateHealthProduct` aligned.
4. **Normalization** – map raw facts inside `src/normalize.ts`, ensuring unknown values stay `null` and provenance captures confidence.
5. **Scoring** – add or adjust parameter scorers in `src/score.ts`, keeping rules pure and unit-tested.
6. **Tests & samples** – update `src/examples/*.json` and extend Vitest cases to cover success/failure paths.

Country-specific quirks can be handled via optional fields (e.g., region-specific copay types) without breaking the core schema; keep ISO codes and monetary fields currency-aware so localization remains portable.

## Frontend experience (React + Tailwind)

A new `frontend/` workspace ships a Vite-powered React app that implements the product-browse/search experience described in the brief:

- Global search bar with 300 ms debounce, recent-search memory, and live suggestions.
- Category rail + filterable product grid (insurer, coverage type, tags, sorting, pagination).
- Product detail panel with overview, policy-wording viewer (expand/collapse + anchor hints), live reviews, and document links.
- Policy score view wired to the backend scoring contract.
- Mock data layer that mirrors the REST payloads so the UI runs even without an API server.

### Getting started

```bash
cd frontend
pnpm install
pnpm dev             # starts Vite on http://localhost:5173
pnpm build           # production build
pnpm test            # Vitest + Testing Library integration tests
pnpm test:e2e        # Playwright (requires the dev server)
```

Set `VITE_API_BASE_URL` to point at the real backend. If it is omitted (default) or if `VITE_USE_MOCKS=true`, the UI serves data from `src/lib/mockData.ts`.

### Thinking process & architecture

- **Experience-first**: start with the three critical flows—browse by category, global search, and deep policy review. Every component maps directly to one of these flows (header = intent capture, grid = exploration, detail = decision support).
- **State isolation**: React Query handles server data (categories/products/insurers), while a lightweight `SearchContext` stores only UI state that must survive navigation (current term + recents).
- **Mock parity**: mock data mirrors the REST schema so frontend work can proceed before APIs stabilize; flipping `VITE_USE_MOCKS` swaps data sources without touching UI code.
- **Performance guardrails**: search input uses a debounced controlled value; list interactions prefetch detail queries to keep the policy viewer snappy; pagination is server-driven for scale.
- **Accessibility + trust**: aria labels, keyboardable chips, and focus states aim for Lighthouse >90, while policy excerpts, scorecards, and reviews stay visible simultaneously to reinforce transparency.

### Installation steps

Front-to-back setup (first-time contributors):

1. **Clone & prerequisites**
   ```bash
   git clone <repo>
   cd insurance_platform
   ```
   Ensure Node 18+ / pnpm ≥8 and Python 3.10+ are available.

2. **Legacy toolchain (optional)** – to run the crawler + schema engine:
   ```bash
   pip install -r requirements.txt
   pnpm install          # root dependencies for schema/tests
   pnpm test             # run TypeScript tests if needed
   ```

3. **One-command pipeline (optional)**
   ```bash
   ./scripts/install_and_run.sh -- --max-insurers 3
   ```

4. **Frontend workspace**
   ```bash
   cd frontend
   pnpm install
   pnpm dev
   ```
   Visit http://localhost:5173 and, if required, set `VITE_API_BASE_URL` in `.env.local`.

### Expected REST surface

| Endpoint | Purpose |
| --- | --- |
| `GET /categories` | Returns category metadata (`id`, label, icon name, product counts). |
| `GET /insurers` | Insurer directory used for filters/badges. |
| `GET /products?categoryId&search&insurers[]&coverageTypes[]&tags[]&sort&page&pageSize` | Cursor/page-based product summaries for the grid. |
| `GET /products/:id` | Full product detail (policy wording, scorecard, documents, reviews). |
| `GET /search/suggestions?search=term` | Up to 6 suggestion rows for the header typeahead. |

All endpoints should be CORS-enabled for the Vite dev server origin. The UI expects JSON responses that align with the TypeScript interfaces under `frontend/src/types`.

### Deployment methods

- **Static hosting (recommended)**: run `pnpm build` inside `frontend/`. The Vite build outputs `dist/`, which can be deployed to any static host (Netlify, Vercel, S3 + CloudFront, Nginx). Serve with SPA rewrites so `/product/:id` routes resolve to `index.html`.
- **Container approach**: wrap the frontend in a lightweight image:

  ```dockerfile
  FROM node:20-alpine AS build
  WORKDIR /app
  COPY frontend/package.json frontend/pnpm-lock.yaml ./
  RUN corepack enable && pnpm install --frozen-lockfile
  COPY frontend .
  RUN pnpm build

  FROM nginx:alpine
  COPY --from=build /app/dist /usr/share/nginx/html
  ```

  Expose port 80/443 via your orchestrator.

- **SSR / Reverse proxy**: If you already operate a backend service, place the static assets behind the same domain and proxy `/api/*` to your REST services to avoid CORS and simplify cookies.

Remember to provide `VITE_API_BASE_URL` (and any auth tokens) as build-time environment variables or runtime-config scripts, depending on your platform.


### 
Read 5 files, updated todo list 3 times, replaced text 3 times, and ran 2 terminal commands and thought for 8s
Summary

    Added scripts/install_and_run.sh, a single entry-point that wires up venv creation, Python deps, pnpm install, the ingestion pipeline, and TypeScript quality gates, plus skip flags and pipeline arg pass-through so you can tailor the workflow per run.

Usage: scripts/install_and_run.sh [options] [-- <pipeline args>]
…
if [[ $SKIP_PIPELINE -eq 0 ]]; then
  log "Running insurance data pipeline ${PIPELINE_ARGS[*]:-}"
  "$PYTHON_RUNNER" -m src.pipeline "${PIPELINE_ARGS[@]}"
else
  log "Skipping pipeline execution"
fi
…
log "All steps completed successfully."

    Documented the new “one-command setup” flow in README.md, including examples for forwarding custom pipeline flags or skipping expensive stages so newcomers can reproduce the end-to-end run quickly.

### One-command setup
…
./scripts/install_and_run.sh -- --max-insurers 3 --no-download-documents

Tests

    ./scripts/install_and_run.sh --skip-python-install --skip-node-install --skip-node-tasks --skip-pipeline
###


### Future integration

The normalization layer accepts a `RawExtract` interface designed for future PDF/OCR or LLM-based extractors. Pipe their outputs into `normalize(raw)` → `validateHealthProduct` → `scoreProduct` to obtain audit-ready evaluations with machine-readable rationales.
