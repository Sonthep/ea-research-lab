# Phase 1 verification

Verified on 2026-10-03 (Asia/Bangkok), Windows, Python 3.11.9, Node.js 24.12.0, pnpm 10.26.2, Next.js 16.3.8 and React 19.3.0.

- Dependency installation completed; pnpm lockfile and pinned backend requirements are included.
- SQLite migration applied and `alembic check` found no model drift.
- Portable PostgreSQL 17.11 initialized and started on localhost:5433; PostgreSQL migration applied and `alembic check` found no drift.
- All 38 backend tests passed on SQLite **and** PostgreSQL. API tests cover 5,000-row imports, pagination including page 100, combined conditions, multi-sort, metadata/rename, source hashes, exact parameter-set reuse, candidate promotion/notes, set detail, invalid input, XML safety, upload limits and transaction rollback. Hash and metric calculation tests also pass.
- The same 38 backend tests passed inside the Linux API container against isolated schemas in the Compose PostgreSQL database (8.82 seconds).
- TypeScript typecheck passed and Next.js production build passed.
- Three Playwright browser tests passed against both the SQLite app and then the **PostgreSQL-backed API with the production standalone frontend**: UI import/candidate flow, 5,000-row Explorer browsing/filtering/search/visibility/metadata/rename, dashboard and mobile width. No browser runtime errors occurred in the import-to-candidate flow.
- Frozen-lockfile offline installation passed; Compose YAML syntax and build paths passed a static check (not a boot test).
- All three Playwright tests passed again against the complete Compose deployment (4.3 seconds). The standalone Docker frontend serves the production build, including static assets.
- Dashboard and API health returned HTTP 200. Screenshots are in `docs/screenshots/`.

## Acceptance status — all seven criteria verified

1. Docker Compose boots: Docker Desktop installed and started; Linux API and web images built from the lockfile/requirements. PostgreSQL, API and web passed their healthchecks. `scripts/verify_compose.py` completed successfully after a fresh PostgreSQL volume initialized and startup migration applied.

2. MT5 XML imports: verified with 12-row and 5,000-row synthetic SpreadsheetML fixtures, through both API and UI.
3. Run metadata is visible: verified in run detail with symbol, timeframe, deposit, provenance and detected inputs.
4. Thousands of rows can be browsed: verified 5,000 rows, bounded pages up to 200, page navigation in browser and API.
5. Filtering/sorting works: combined filter + multi-sort API checks and UI filter/sort tests pass.
6. Stable Set IDs appear: UI and deterministic normalization/hash tests pass. Full hash retained for identity.
7. Candidate promotion works: UI, idempotent API promotion, baseline persistence and editable notes/tags tested.

The Compose acceptance script verified API/database health, run metadata, 5,000-row import and page 100, stable identifiers, combined filtering and multi-sort, candidate promotion, and frontend reachability. All services remain running in Compose at localhost:3000 (web), localhost:8000 (API), and localhost:5432 (PostgreSQL).

Native API/web services were stopped before Compose took over those ports. Portable PostgreSQL artifacts and native environment configuration are gitignored; the optional native database listens on localhost:5433. After a reboot, start Docker Desktop and run `docker compose up -d --wait` to restore the application.

The provided fixture is synthetic; no user MT5 file was supplied to verify exporter-specific variations. One upstream Starlette TestClient deprecation warning is emitted; tests pass.

## Clean UI refresh

Updated the neutral charcoal palette, typography, spacing, sidebar and Dashboard hierarchy. Saved filters, table instructions and optional import metadata use progressive disclosure. Mobile navigation collapses into an accessible menu.

TypeScript and the Docker production build passed. Read-only Playwright checks passed on desktop (1440 px) and mobile (390 px) for Dashboard, Explorer, Imports and Candidates, including filters, sorting, column visibility, disclosures and mobile navigation. No page overflow or browser runtime errors occurred; these checks did not modify research records. The updated web container passed its healthcheck. Screenshots: `docs/screenshots/clean-*.png`.

Further refinement groups Dashboard metrics into one quiet summary, removes duplicate eyebrow labels, and collapses the Explorer filter builder behind a Filters button. Active conditions remain visible when the builder is closed. Production build and desktop/mobile checks passed again, including expanding filters, applying conditions, collapsing the builder, retaining active chips, sorting and column visibility.

## Reference-based light UI — 2026-10-04

Updated the application to the user's requested visual direction from [parnuan.com](https://parnuan.com/): white and blush surfaces, pink accents, rounded cards, pill buttons, generous spacing and self-hosted Noto Sans Thai typography. Replaced the accumulated dark-theme overrides with a single coherent light stylesheet and semantic button variants. Existing research workflows remain available.

TypeScript and the Docker production build passed. Read-only Playwright checks passed again at 1440 px and 390 px, covering Dashboard, Explorer filters/sorting/column visibility, Imports disclosures, Candidates and mobile navigation. No page overflow or browser runtime errors occurred. Desktop and mobile screenshots in `docs/screenshots/clean-*.png` were refreshed and visually inspected. The web container is healthy and serves the new UI at localhost:3000; research records were not modified by these checks.

## Stage 1 Candidate Discovery — 2026-10-04

Implemented `/discovery`, run-scoped configurable filters, unique-configuration ranking and a bounded 10–30 target, bulk promotion with immutable selection evidence, recorded MT5 setup, candidate method separation and a stored-data Dashboard funnel. See CANDIDATE_DISCOVERY.md for behavior and API details. Later validation stages remain NOT_TESTED.

The Docker production build and TypeScript passed. Migration upgrade/check/downgrade/upgrade passed against a scratch SQLite database. The Compose PostgreSQL database upgraded with existing runs/candidates preserved; `alembic check` reported no model drift. All services are healthy.

All 44 backend tests passed on SQLite and in the Linux API container against isolated PostgreSQL schemas. Coverage includes preserving an existing candidate's baseline/notes/tags and rejecting a qualifying result outside the requested top-count window. A final read-only desktop/mobile UI regression check also passed after the final build.

All four Playwright tests passed against the production Compose app: new discovery flow plus existing import/Explorer/candidate and responsive checks. Discovery UI checks cover a 5,000-row run, a unique top-10 shortlist, filter invalidation, promotion, saved history, candidate method/evidence, mobile width and no-match behavior. No browser runtime errors occurred. The discovery test imports an explicitly named synthetic run with a unique test parameter and creates ten test candidates; the existing regression flow also creates a synthetic import. Screenshots `discovery.png` and `discovery-mobile.png` were visually reviewed.
