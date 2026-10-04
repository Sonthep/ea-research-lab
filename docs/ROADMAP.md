# Roadmap

Phase 1: foundation, PostgreSQL/Alembic, safe XML import, stable identities, runs, Explorer, filters and candidate selection. See VERIFICATION.md for acceptance evidence and environment constraints.

Phase 2: imported backtests attached to stable sets; real tick, latency/random delay, OOS and forward stages; baseline differences with configurable warnings. Candidate selection must never automatically mark validation passed.

Phase 3: Pareto, parameter sensitivity, duplicate/near-duplicate evidence and mixed-type clustering with background analytics jobs.

Phase 4: experiments, notes and equity histories; configurable evidence scores, reports and research attachments. No score forecasts profitability.

Stage 1 Candidate Discovery is implemented: recommended MT5 setup, run metadata, configurable combined thresholds, whole-run ranking of unique configurations, 10–30 candidate targets, saved selection evidence and a stored-data Dashboard funnel. See CANDIDATE_DISCOVERY.md.

The requested complete validation pipeline continues through Real Tick, execution stress, Out-of-Sample, Forward, parameter robustness, long-period, cross-broker, Demo and Live Candidate. These later stages remain future increments; discovery selections retain NOT_TESTED validation status.

Deferred until the MVP is stable: automatic MT5 workers/bridges, `.set` generation, queued trading tests, Monte Carlo/walk-forward and portfolio research.
