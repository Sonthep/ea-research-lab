from datetime import datetime, timezone
from sqlalchemy import String, Text, ForeignKey, Float, Integer, JSON, DateTime, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


def now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))


class ExpertAdvisor(Base):
    __tablename__ = "expert_advisors"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)


class ImportFile(Base):
    __tablename__ = "import_files"
    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(255))
    file_hash: Mapped[str] = mapped_column(String(64), unique=True)
    import_type: Mapped[str] = mapped_column(String(30), default="MT5_XML")
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    record_count: Mapped[int] = mapped_column(default=0)
    warnings: Mapped[list] = mapped_column(JSON, default=list)
    errors: Mapped[list] = mapped_column(JSON, default=list)


class OptimizationRun(Base):
    __tablename__ = "optimization_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    ea_id: Mapped[int] = mapped_column(ForeignKey("expert_advisors.id"))
    import_file_id: Mapped[int] = mapped_column(ForeignKey("import_files.id"), unique=True)
    symbol: Mapped[str | None] = mapped_column(String(80))
    timeframe: Mapped[str | None] = mapped_column(String(30))
    date_from: Mapped[str | None] = mapped_column(String(40))
    date_to: Mapped[str | None] = mapped_column(String(40))
    broker: Mapped[str | None] = mapped_column(String(200))
    deposit: Mapped[float | None] = mapped_column(Float)
    leverage: Mapped[str | None] = mapped_column(String(40))
    modelling_method: Mapped[str | None] = mapped_column(String(120))
    optimization_algorithm: Mapped[str | None] = mapped_column(String(120))
    criterion: Mapped[str | None] = mapped_column(String(120))
    result_count: Mapped[int] = mapped_column(default=0)
    parameter_names: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ParameterSet(Base):
    __tablename__ = "parameter_sets"
    id: Mapped[int] = mapped_column(primary_key=True)
    full_hash: Mapped[str] = mapped_column(String(64), unique=True)
    stable_set_id: Mapped[str] = mapped_column(String(12), index=True)
    canonical_json: Mapped[str] = mapped_column(Text)
    parameters: Mapped[dict] = mapped_column(JSON)


class ParameterValue(Base):
    __tablename__ = "parameter_values"
    __table_args__ = (UniqueConstraint("parameter_set_id", "name"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    parameter_set_id: Mapped[int] = mapped_column(ForeignKey("parameter_sets.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    value: Mapped[str] = mapped_column(Text)


class OptimizationResult(Base):
    __tablename__ = "optimization_results"
    __table_args__ = (Index("ix_result_run_profit", "run_id", "profit"), Index("ix_result_run_dd", "run_id", "equity_dd"), Index("ix_result_run_pf", "run_id", "profit_factor"), Index("ix_result_run_trades", "run_id", "trades"))
    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("optimization_runs.id"), index=True)
    parameter_set_id: Mapped[int] = mapped_column(ForeignKey("parameter_sets.id"), index=True)
    mt5_pass: Mapped[str | None] = mapped_column(String(80))
    result: Mapped[float | None] = mapped_column(Float)
    profit: Mapped[float | None] = mapped_column(Float)
    expected_payoff: Mapped[float | None] = mapped_column(Float)
    profit_factor: Mapped[float | None] = mapped_column(Float)
    recovery_factor: Mapped[float | None] = mapped_column(Float)
    sharpe: Mapped[float | None] = mapped_column(Float)
    custom: Mapped[float | None] = mapped_column(Float)
    equity_dd: Mapped[float | None] = mapped_column(Float)
    trades: Mapped[int | None] = mapped_column(Integer)


class Candidate(Base):
    __tablename__ = "candidate_sets"
    id: Mapped[int] = mapped_column(primary_key=True)
    parameter_set_id: Mapped[int] = mapped_column(ForeignKey("parameter_sets.id"), unique=True)
    baseline_result_id: Mapped[int] = mapped_column(ForeignKey("optimization_results.id"))
    notes: Mapped[str] = mapped_column(Text, default="")
    tags: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    discovery_batch_id: Mapped[int | None] = mapped_column(ForeignKey("discovery_batches.id"), index=True)


class DiscoveryBatch(Base):
    """Immutable selection evidence; later validation never inherits a passed status."""
    __tablename__ = "discovery_batches"
    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("optimization_runs.id"), index=True)
    policy: Mapped[dict] = mapped_column(JSON)
    ranking: Mapped[list] = mapped_column(JSON)
    run_settings: Mapped[dict] = mapped_column(JSON)
    selected_results: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ValidationRecord(Base):
    """One imported validation test for a candidate; the stage status is derived from the latest per label."""
    __tablename__ = "validation_records"
    __table_args__ = (Index("ix_validation_candidate_stage", "candidate_id", "stage"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidate_sets.id"), index=True)
    stage: Mapped[str] = mapped_column(String(40))
    label: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(30), default="NOT_TESTED")
    metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    baseline: Mapped[dict] = mapped_column(JSON, default=dict)
    baseline_source: Mapped[str] = mapped_column(String(30), default="discovery")
    comparison: Mapped[dict] = mapped_column(JSON, default=dict)
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    evidence: Mapped[dict] = mapped_column(JSON, default=dict)
    status_overridden: Mapped[bool] = mapped_column(default=False)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ValidationRules(Base):
    """Single-row project rules: warning thresholds and the stages required for LIVE CANDIDATE."""
    __tablename__ = "validation_rules"
    id: Mapped[int] = mapped_column(primary_key=True)
    rules: Mapped[dict] = mapped_column(JSON, default=dict)


# Reserved normalized entities for later phases; no trading code is executed.
class BacktestRun(Base):
    __tablename__ = "backtest_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    parameter_set_id: Mapped[int] = mapped_column(ForeignKey("parameter_sets.id"), index=True)
    test_type: Mapped[str] = mapped_column(String(40))
    metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    settings: Mapped[dict] = mapped_column(JSON, default=dict)


class ValidationTest(Base):
    __tablename__ = "validation_tests"
    id: Mapped[int] = mapped_column(primary_key=True)
    backtest_run_id: Mapped[int] = mapped_column(ForeignKey("backtest_runs.id"))
    stage: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(30), default="NOT_TESTED")


class Experiment(Base):
    __tablename__ = "experiments"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))


class Note(Base):
    __tablename__ = "notes"
    id: Mapped[int] = mapped_column(primary_key=True)
    parameter_set_id: Mapped[int | None] = mapped_column(ForeignKey("parameter_sets.id"))
    experiment_id: Mapped[int | None] = mapped_column(ForeignKey("experiments.id"))
    body: Mapped[str] = mapped_column(Text)


class EquityPoint(Base):
    __tablename__ = "equity_points"
    id: Mapped[int] = mapped_column(primary_key=True)
    backtest_run_id: Mapped[int] = mapped_column(ForeignKey("backtest_runs.id"), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    balance: Mapped[float] = mapped_column(Float)
    equity: Mapped[float] = mapped_column(Float)
    drawdown: Mapped[float] = mapped_column(Float)
