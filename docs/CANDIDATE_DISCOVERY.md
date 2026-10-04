# Stage 1 — Candidate Discovery

Open `/discovery` from the sidebar, or choose **Discover candidates** on a run. MT5 remains the optimization engine. EA Research Lab imports and reviews results; it does not launch optimization or execute an EA.

## Workflow

1. In MT5, use **Fast genetic based algorithm**, **Complex Criterion max**, and **1 minute OHLC** for discovery. Export the optimization table as XML and import it into the app.
2. Choose one imported run. Review its EA, symbol, timeframe, dates, algorithm, criterion, modelling method and result count. Missing or different settings are shown as evidence warnings rather than replaced with the recommendations. Use **Record MT5 settings** only to record the actual settings used. The import form also accepts these fields.
3. Apply the default combined filter: **Equity DD ≤ 10%, PF ≥ 2, Trades ≥ 100, Profit > 0**. Thresholds are configurable. Optional minimums cover Recovery, Sharpe, Expected Payoff and criterion Result. A missing metric fails a filter on that metric; negative DD is excluded.
4. Choose a target of **10–30** candidates and preview. The server filters the whole run, not the current Explorer page. It keeps one best eligible result per complete parameter configuration before limiting the shortlist. If fewer configurations qualify, it returns only those configurations.
5. Review selections and promote them. Existing candidates retain their original baseline, notes, tags and evidence. Repeating a promotion creates no duplicate candidates or empty selection batches.

## Transparent ranking

The ordering is lexicographic: **PF descending → Recovery descending → DD ascending → Trades descending → criterion Result descending → Profit descending**, with result ID ascending as a deterministic final tie breaker. Subsequent metrics break ties; this is not a weighted score. Missing ranking metrics sort last. Profit alone never determines the shortlist. The UI displays this ordering.

Stable identities continue to use the complete canonical input JSON and full SHA-256 hash. MT5 Pass is shown only as source context. A discovery batch saves the filter thresholds, ranking, run context and newly selected result IDs/full hashes/ranks. Candidate cards display the recorded discovery method, selection evidence and the next Real Tick method separately. Updating run settings later does not rewrite saved selection evidence.

## Status boundaries

An imported discovery run is **IMPORTED / NOT VALIDATED**. Preview results are **DISCOVERED** or **NO_MATCHES**. All promoted candidates retain validation status **NOT_TESTED**. Neither selection nor an optimization result marks Real Tick, execution stress, OOS, Forward, robustness or Demo as passed. No automatic Live Ready label is added.

This increment implements the user's Stage 1 discovery and shortlist flow. The later validation stages described in the attached pipeline specification still require their own test imports, comparisons and stage logic.

The Dashboard funnel uses stored results and candidates. It counts default-filter results and distinct eligible parameter sets across all runs. Saved candidates include earlier manual Explorer selections, so the candidate count is not necessarily a subset of today's default-filter count.

## API

- `GET /api/discovery/configuration`: recommended setup and ranking.
- `PATCH /api/discovery/runs/{id}/settings`: record actual algorithm, criterion and modelling settings.
- `POST /api/discovery/preview`: run ID, `top_count` (10–30) and optional `policy`; bounded shortlist plus counts and metadata.
- `POST /api/discovery/promote`: the same request plus selected `result_ids`; rejects results outside the current filtered shortlist.
- `GET /api/discovery/batches?run_id=…&page=1&page_size=10`: persisted selection history.

The policy keys are `max_equity_dd`, `min_profit_factor`, `min_trades`, `profit_above`, `min_recovery`, `min_sharpe`, `min_expected_payoff`, and `min_result`. Optional minimums default to null. Numeric fields reject non-finite values; trade thresholds must be nonnegative integers.

## Database and checks

Migration `d021_stage1_discovery` adds `discovery_batches` and the nullable candidate batch reference. Existing candidates keep their baseline and remain usable with no batch reference. Startup migrations run through the existing API container command.

Backend tests cover filtering 5,000 rows, top-count bounds, ranking, unique identities, optional filters, missing metrics, exact boundaries, cross-run selection rejection, idempotency and immutable setting snapshots. `apps/web/tests/discovery.spec.ts` exercises the full browser flow with a uniquely tagged synthetic fixture, stale-selection invalidation, candidate evidence, mobile width and an empty shortlist. It creates synthetic research records in the configured test application.
