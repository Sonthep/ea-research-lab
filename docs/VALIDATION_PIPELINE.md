# Validation Pipeline

Candidate Discovery (Fast genetic, Complex Criterion max, 1 minute OHLC) only finds promising parameter sets. Every later stage re-tests the **same Stable Set** with optimization disabled.

| # | Stage | Key | Baseline | Notes |
|---|-------|-----|----------|-------|
| 1 | Candidate Discovery | `discovery` | - | Derived from the imported run. Never validation. |
| 2 | Candidate Filter | `filter` | - | PASSED when promoted through a stored filter policy, WARNING for manual promotion. |
| 3 | Real Tick | `real_tick` | discovery result | Every tick based on real ticks, zero latency by default. |
| 4 | Execution Stress | `latency`, `random_delay` (`slippage`, `spread` accepted, future) | latest Real Tick | Requires a Real Tick result first. |
| 5 | Out-of-Sample | `oos` | discovery result | Period must not overlap the in-sample run dates. |
| 6 | Forward | `forward` | discovery result | `forward_index` such as `1/3`. |
| 7 | Parameter Robustness | `robustness` | neighbours | Plateau / Sensitivity / Mixed. Never labelled overfitting. |
| 8 | Long Period | `long_period` | discovery result | Optional regime results: trend, range, high/low volatility. |
| 9 | Cross-Broker | `cross_broker` | Real Tick | Optional by default. |
| 10 | Demo | `demo` | Real Tick | Manually imported statistics. |
| 11 | Live Candidate | derived | - | See below. |

## Status logic

Stage statuses: `NOT_TESTED`, `RUNNING`, `PASSED`, `WARNING`, `FAILED`.

- A test compares its metrics with the baseline and produces warnings: profit degradation, drawdown multiple, minimum Profit Factor, trade-count change (only for same-period stages).
- No warnings: `PASSED`. Some warnings: `WARNING`. `FAILED` needs a net loss or at least `fail_warning_count` warnings. One crossed threshold never fails a test by itself.
- The status may be overridden manually; the record stores `status_overridden`.
- A stage with several tests uses the latest record per label; the worst status wins.
- Overall status is `DISCOVERED`, `VALIDATING`, `FAILED` (a required stage failed) or `LIVE_CANDIDATE` (all required stages passed). It is never `PASSED`.

All thresholds, the required stages and `warning_counts_as_pass` live in the `validation_rules` table (`GET/PUT /api/validation/config`, Settings page). Each record keeps a snapshot of the thresholds used.

## API

- `GET /api/candidates` - list with `pipeline`, `overall_status`, `validation_status`.
- `GET /api/candidates/{id}` - detail, validation records, rules, parameters.
- `POST /api/candidates/{id}/validation/{stage}` - record a test (`metrics`, `settings`, optional `status`, `regimes`, `notes`). `status: "RUNNING"` needs no metrics.
- `POST /api/candidates/{id}/validation/robustness` - `parameter`, optional `parameter_y`, `points` (must include the candidate's own value and 2+ neighbours).
- `GET /api/dashboard` - `funnel`: cumulative counts computed from stored data.

## Data model

`validation_records` (candidate, stage, label, status, metrics, baseline snapshot, comparison, settings, evidence) and `validation_rules` (single row). Migration `d022_validation_pipeline`.

## Limits

The application does not run MT5; results are imported manually. Funnel counts are cumulative: a candidate counts at a step only if it passed all earlier steps.
