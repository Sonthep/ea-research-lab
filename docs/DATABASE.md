# Database

Alembic revision `5563350a2570` creates the normalized foundation. Migrations are frozen DDL, independent of future ORM model changes. Apply using `python -m alembic upgrade head` from `apps/api`; inspect drift with `python -m alembic check`.

- `expert_advisors` → `optimization_runs` → `optimization_results`.
- `import_files`: unique SHA-256 source hash, filename, timestamp, count and warnings.
- `parameter_sets`: unique full hash, indexed short label, canonical JSON and normalized input map.
- `parameter_values`: one row per input; unique (parameter set, name).
- `optimization_results`: separate result metrics and original MT5 Pass per run; FK to a parameter set.
- `candidate_sets`: unique parameter-set FK and selected result FK; notes, tags and creation time.
- `users`, `backtest_runs`, `validation_tests`, `experiments`, `notes`, `equity_points`: reserved normalized foundation for later phases. Later phases extend settings, attachment and evidence models via new migrations.

Results index run ID, parameter-set ID and run-plus-profit/DD/PF/trades to support Explorer. JSON columns use portable SQLAlchemy JSON so both PostgreSQL and SQLite work. Date range fields preserve source strings because MT5 formats vary. Import timestamps use timezone-aware timestamps (PostgreSQL); browser displays local time.

Database constraints enforce exact parameter reuse and one candidate per parameter set. Short-label collisions do not merge parameter sets. Baseline comparisons will use the selected result and its associated deposit.
