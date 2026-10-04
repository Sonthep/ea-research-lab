# EA Research Lab

A local research workspace for MetaTrader 5 optimization results. MT5 executes optimization and backtests; this application imports, normalizes, filters and organizes their evidence. Candidate selection is not a prediction of profitability.

Phase 1 includes secure SpreadsheetML XML import, complete SHA-256 parameter identities, optimization runs and metadata, a server-paginated Explorer, combined filters, multi-sort, column visibility/resizing/reordering, saved filters, selected-row CSV export, candidate promotion, notes and tags. Later-phase validation and analytics are deliberately deferred.

**Stage 1 Candidate Discovery** is available at [/discovery](http://localhost:3000/discovery). Review the MT5 setup, apply DD ≤ 10% / PF ≥ 2 / Trades ≥ 100 / Profit > 0, preview 10–30 unique top configurations and promote the shortlist with saved selection evidence. Ranking uses PF, Recovery, DD, Trades and criterion Result before Profit. Existing candidates retain their baseline. See [the discovery guide](docs/CANDIDATE_DISCOVERY.md) for configuration, API and status boundaries; later validation stages start as NOT_TESTED.

**Validation pipeline:** each Candidate Set has a detail page at `/candidates/{id}` with the 11-stage pipeline, baseline comparisons, robustness charts and forms for importing MT5 results. Thresholds and the stages required for LIVE CANDIDATE are configurable in Settings. See [the validation guide](docs/VALIDATION_PIPELINE.md).

## Prerequisites

- Docker Desktop with Linux containers and Compose v2, **or** Python 3.11+, Node.js 24 and pnpm 10.26.2 for native development.
- PostgreSQL 17 for the production database. SQLite is available for a lightweight local demo.
- On Windows, use `corepack.cmd` and `pnpm.cmd` if PowerShell blocks `.ps1` launchers.

## Docker Compose

From the repository root:

```sh
cp .env.example .env
docker compose up --build -d --wait
docker compose exec api python -m app.seed
```

PowerShell: use `Copy-Item .env.example .env` instead of `cp` if needed. Open [the application](http://localhost:3000) and [API documentation](http://localhost:8000/docs). PostgreSQL, API and web ports bind to localhost. The API runs Alembic migrations before starting. PostgreSQL persists in the `postgres_data` volume; seed is explicit and idempotent. For a new empty workspace, omit the seed command.

```sh
docker compose logs -f
docker compose down
```

`down` keeps database data. Configure the environment before rebuilding; `NEXT_PUBLIC_API_URL` is compiled into the frontend. Default example credentials are for a local workspace.

## Native installation

From the root, create a Python environment and install both sets of dependencies:

```sh
python -m venv .venv
# Windows:
.venv\Scripts\python.exe -m pip install -r apps/api/requirements.txt
corepack.cmd pnpm@10.26.2 install --frozen-lockfile
# macOS/Linux: .venv/bin/python -m pip install -r apps/api/requirements.txt
# corepack pnpm@10.26.2 install --frozen-lockfile
```

Backend, in a first terminal:

```powershell
cd apps/api
# Omit DATABASE_URL for the SQLite demo, or use a real native PostgreSQL URL:
# $env:DATABASE_URL = 'postgresql+psycopg://ea_lab:password@localhost:5432/ea_research_lab'
..\..\.venv\Scripts\python.exe -m alembic upgrade head
..\..\.venv\Scripts\python.exe -m app.seed
..\..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend, from the root in another terminal:

```powershell
corepack.cmd pnpm@10.26.2 dev
```

Alternatively, `python scripts/dev.py --seed` applies migrations, seeds data and runs both services together. Ctrl+C stops the application processes. If using the portable PostgreSQL instance created during development, start it first with `powershell -ExecutionPolicy Bypass -File scripts/start-local-postgres.ps1`; it listens only on localhost:5433. Native API configuration lives in `apps/api/.env` (gitignored). A fresh checkout uses SQLite unless you supply `DATABASE_URL`.

On macOS/Linux, use `.venv/bin/python`, `export DATABASE_URL=...` and `corepack pnpm@10.26.2`. Backend commands run from `apps/api`. The backend reads `.env` in its current directory or environment variables. The root `.env` is for Compose; its Docker hostname `db` is not a native hostname. Set frontend environment variables in `apps/web/.env.local` when running natively.

Production frontend:

```powershell
corepack.cmd pnpm@10.26.2 build
# Standalone build includes server-side dependencies:
Copy-Item apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static -Recurse -Force
$env:HOSTNAME = '127.0.0.1'
node apps/web/.next/standalone/apps/web/server.js
```

The Dockerfile handles the standalone asset copy automatically.

## Import MT5 XML

1. Export optimization results from MT5 as XML.
2. Open **Imports** and select the file. Supply missing run context, especially EA name, symbol, timeframe, test dates and initial deposit.
3. Import and review any warnings. Open the run to inspect metadata and source hash.
4. Open **Optimization Explorer**. Add combined filters, click metric headers to sort, Shift-click for additional sort columns, and inspect dynamic `Inp*` inputs. Headers can be reordered and resized. Page size is bounded at 200; the whole run is never loaded into the browser.
5. Select rows and **Promote to candidate**. The selected result becomes the candidate baseline. Save research notes and tags in **Candidate Sets**.

Example combined filter: Profit > 0 AND Equity DD ≤ 10 AND Profit Factor ≥ 2 AND Trades ≥ 100. The **Research preset** adds these conditions. Saved filters persist in this browser’s local storage. Selection is scoped to the current page and resets when the query changes.

Sample files in `sample-data/` are **synthetic**, not observed MT5 executions. `mt5-optimization.xml` has 12 rows; `mt5-optimization-5000.xml` has 5,000. Regenerate them with `python scripts/generate_sample.py`. The first row matches the specification’s reference optimization metrics (deposit 3,000, profit 1,388.66, DD 2.92%, PF 6, recovery 12.13, Sharpe 25.87, 111 trades). Real tick and latency data belong to Phase 2.

## Stable Set IDs

All `Inp*` inputs are sorted and normalized: booleans to `true`/`false`, finite numbers to normalized decimal strings, known timeframe names or enum values to canonical labels. Canonical JSON is hashed with SHA-256. The display label is `SET-` plus eight uppercase hex characters; the **full 64-character hash** is unique in the database. Internal numeric keys and full hashes distinguish any short-prefix collisions. Categorical values retain case.

Identical inputs across runs reuse a parameter set. The full input configuration must be present in the XML; the app cannot infer fixed inputs omitted by MT5. Identical file hashes are rejected with a linkable run ID. Different source files may attach new results to existing parameter sets.

## Environment

- `DATABASE_URL`: SQLAlchemy PostgreSQL URL; defaults to `sqlite:///./ea_lab.db` for native demo.
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`: Compose PostgreSQL initialization.
- `NEXT_PUBLIC_API_URL`: browser-accessible API URL, default `http://localhost:8000`.
- `API_CORS_ORIGINS`: comma-separated allowed browser origins, default `http://localhost:3000`.
- `MAX_UPLOAD_MB`: positive upload size limit, default 100.
- `TEST_DATABASE_URL`: optional dedicated PostgreSQL database for integration tests; each API test creates and removes an isolated test schema.

## Tests and verification

```powershell
cd apps/api
..\..\.venv\Scripts\python.exe -m pytest -q
..\..\.venv\Scripts\python.exe -m alembic check
cd ../..
corepack.cmd pnpm@10.26.2 typecheck
corepack.cmd pnpm@10.26.2 build
corepack.cmd pnpm@10.26.2 --filter @ea/web exec playwright install chromium
corepack.cmd pnpm@10.26.2 test:e2e
```

Browser tests require the API and frontend running, with the 5,000-row seed as run #1. They create 12-row test imports and candidates in that development database. Run them against a disposable development database. Screenshots are saved under `docs/screenshots/`.

You can also run backend tests in the Linux container: `docker compose exec api python -m pytest -q` (isolated SQLite). To test PostgreSQL, supply `TEST_DATABASE_URL` with the Compose database URL; the test harness creates and removes isolated schemas without modifying your imported research tables.

Full Docker acceptance test (requires Docker running and `httpx` installed):

```powershell
.venv\Scripts\python.exe scripts/verify_compose.py
```

It builds and boots Compose, checks PostgreSQL-backed API health, imports 5,000 XML rows, verifies metadata and pagination, filters/sorts, promotes a candidate and checks the web endpoint. See [verification status](docs/VERIFICATION.md) for what was actually run on the build machine.

## Architecture and scope

Next.js App Router + TypeScript + Tailwind CSS + shadcn/ui primitives provide the web workspace. FastAPI/Pydantic validate requests; SQLAlchemy 2 and Alembic manage normalized PostgreSQL tables. Safe XML parsing uses `defusedxml` with DTD/entity/external expansion forbidden. Imports are transactional; metrics and parameter values are stored separately. Metric indexes and server-side query limits support large runs.

This is a single-user local Phase 1 workspace without authentication. It does not execute uploaded EX5/MQ5 or other code. The next milestone attaches imported backtests and real tick, latency, OOS and forward evidence to the same identities. No validation stage is marked passed merely because a candidate was selected.

More detail: [Architecture](docs/ARCHITECTURE.md), [Database](docs/DATABASE.md), [MT5 import contract](docs/MT5_IMPORT_SPEC.md), [Roadmap](docs/ROADMAP.md).
