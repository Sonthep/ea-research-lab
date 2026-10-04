from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

Status = Literal["NOT_TESTED", "RUNNING", "PASSED", "WARNING", "FAILED"]
Stage = Literal["real_tick", "latency", "random_delay", "slippage", "spread", "oos", "forward", "long_period", "cross_broker", "demo"]
STAGE_KEYS = ["real_tick", "latency", "random_delay", "slippage", "spread", "oos", "forward", "robustness", "long_period", "cross_broker", "demo"]
Regime = Literal["trend", "range", "high_volatility", "low_volatility"]
Num = dict(allow_inf_nan=False)


class ValidationConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")
    profit_degradation_pct: float = Field(default=30, ge=0, **Num)
    drawdown_multiple: float = Field(default=2, gt=0, **Num)
    min_profit_factor: float = Field(default=1.5, ge=0, **Num)
    trade_change_pct: float = Field(default=25, ge=0, **Num)
    fail_warning_count: int = Field(default=3, ge=1, le=4)
    robustness_min_profit_factor: float = Field(default=1.3, ge=0, **Num)
    plateau_min_good_ratio: float = Field(default=0.6, gt=0, le=1, **Num)
    required_stages: list[Literal[tuple(STAGE_KEYS)]] = Field(default=["real_tick", "latency", "random_delay", "oos", "forward", "robustness", "long_period", "demo"])
    warning_counts_as_pass: bool = False


class Metrics(BaseModel):
    model_config = ConfigDict(extra="forbid")
    profit: float | None = Field(default=None, **Num)
    equity_dd: float | None = Field(default=None, ge=0, le=100, **Num)
    profit_factor: float | None = Field(default=None, ge=0, **Num)
    recovery_factor: float | None = Field(default=None, **Num)
    sharpe: float | None = Field(default=None, **Num)
    trades: int | None = Field(default=None, ge=0)
    win_rate: float | None = Field(default=None, ge=0, le=100, **Num)


class StageSettings(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    modelling_method: str | None = Field(default=None, max_length=120)
    delay_ms: int | None = Field(default=None, ge=0, le=60000)
    delay_min_ms: int | None = Field(default=None, ge=0, le=60000)
    delay_max_ms: int | None = Field(default=None, ge=0, le=60000)
    slippage_points: float | None = Field(default=None, ge=0, **Num)
    spread_points: float | None = Field(default=None, ge=0, **Num)
    period_from: str | None = Field(default=None, max_length=40)
    period_to: str | None = Field(default=None, max_length=40)
    broker: str | None = Field(default=None, max_length=200)
    forward_index: str | None = Field(default=None, pattern=r"^\d{1,2}/\d{1,2}$")
    execution_notes: str | None = Field(default=None, max_length=2000)


class StageSubmission(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    label: str | None = Field(default=None, max_length=80)
    status: Status | None = None
    metrics: Metrics | None = None
    settings: StageSettings = Field(default_factory=StageSettings)
    regimes: dict[Regime, Metrics] = Field(default_factory=dict)
    notes: str = Field(default="", max_length=5000)

    @model_validator(mode="after")
    def need_evidence(self):
        if self.status != "RUNNING" and self.metrics is None:
            raise ValueError("metrics are required unless the test is marked RUNNING")
        return self


class RobustnessPoint(BaseModel):
    model_config = ConfigDict(extra="forbid")
    x: float = Field(**Num)
    y: float | None = Field(default=None, **Num)
    profit: float = Field(**Num)
    equity_dd: float = Field(ge=0, le=100, **Num)
    profit_factor: float = Field(ge=0, **Num)
    trades: int = Field(ge=0)


class RobustnessSubmission(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    parameter: str = Field(min_length=1, max_length=200)
    parameter_y: str | None = Field(default=None, min_length=1, max_length=200)
    points: list[RobustnessPoint] = Field(min_length=3, max_length=500)
    notes: str = Field(default="", max_length=5000)

    @model_validator(mode="after")
    def consistent_axes(self):
        if any((p.y is None) != (self.parameter_y is None) for p in self.points):
            raise ValueError("every point needs y exactly when parameter_y is set")
        return self
