from pydantic import BaseModel, ConfigDict, Field


class DiscoveryPolicy(BaseModel):
    model_config = ConfigDict(extra="forbid")
    max_equity_dd: float = Field(default=10, ge=0, le=100, allow_inf_nan=False)
    min_profit_factor: float = Field(default=2, ge=0, allow_inf_nan=False)
    min_trades: int = Field(default=100, ge=0, strict=True)
    profit_above: float = Field(default=0, allow_inf_nan=False)
    min_recovery: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    min_sharpe: float | None = Field(default=None, allow_inf_nan=False)
    min_expected_payoff: float | None = Field(default=None, allow_inf_nan=False)
    min_result: float | None = Field(default=None, allow_inf_nan=False)


class DiscoveryRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    run_id: int = Field(gt=0)
    top_count: int = Field(default=20, ge=1, le=50)
    policy: DiscoveryPolicy = Field(default_factory=DiscoveryPolicy)


class DiscoveryPromotion(DiscoveryRequest):
    result_ids: list[int] = Field(min_length=1, max_length=50)


class DiscoverySettings(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    optimization_algorithm: str | None = Field(default=None, max_length=120)
    criterion: str | None = Field(default=None, max_length=120)
    modelling_method: str | None = Field(default=None, max_length=120)
