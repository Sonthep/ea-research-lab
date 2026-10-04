from typing import Literal
from pydantic import BaseModel, Field, ConfigDict


class ImportMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    ea_name: str | None = Field(default=None, min_length=1, max_length=200)
    symbol: str | None = Field(default=None, max_length=80)
    timeframe: str | None = Field(default=None, max_length=30)
    date_from: str | None = Field(default=None, max_length=40)
    date_to: str | None = Field(default=None, max_length=40)
    broker: str | None = Field(default=None, max_length=200)
    deposit: float | None = Field(default=None, gt=0, allow_inf_nan=False)
    leverage: str | None = Field(default=None, max_length=40)
    modelling_method: str | None = Field(default=None, max_length=120)
    optimization_algorithm: str | None = Field(default=None, max_length=120)
    criterion: str | None = Field(default=None, max_length=120)


class RenameRun(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    model_config = ConfigDict(str_strip_whitespace=True)


class PromoteCandidates(BaseModel):
    result_ids: list[int] = Field(min_length=1, max_length=500)


class EditCandidate(BaseModel):
    notes: str = Field(max_length=10000)
    tags: list[str] = Field(default_factory=list, max_length=20)


class Filter(BaseModel):
    field: Literal["profit", "profit_pct", "equity_dd", "profit_factor", "recovery_factor", "sharpe", "trades", "result", "expected_payoff"]
    op: Literal["gt", "gte", "lt", "lte", "eq"]
    value: float = Field(allow_inf_nan=False)
