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

Each normalized insurer record includes a `website_url` field when a URL can be inferred from the source content. Product records are tagged with inferred categories (health, motor, life_term, life_savings) and any extracted documents are parsed and mapped to canonical policy schemas where possible.

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
