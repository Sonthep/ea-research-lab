"""Run-scoped discovery: SQL filtering, unique configurations and bounded ranking."""
from sqlalchemy import select, func
from app.models.entities import OptimizationResult as R
from app.schemas.discovery import DiscoveryPolicy

OBJECTIVE_RANKINGS = {
    "quant_robustness": ["profit_factor:desc", "recovery_factor:desc", "equity_dd:asc", "trades:desc", "result:desc", "profit:desc"],
    "max_profit": ["profit:desc", "profit_factor:desc", "recovery_factor:desc", "equity_dd:asc", "trades:desc"],
    "mt5_result": ["result:desc", "profit:desc", "profit_factor:desc", "equity_dd:asc", "trades:desc"],
    "min_dd": ["equity_dd:asc", "profit_factor:desc", "profit:desc", "trades:desc"]
}
RANKING = OBJECTIVE_RANKINGS["quant_robustness"]
RECOMMENDED = {"optimization_algorithm": "Fast genetic based algorithm", "criterion": "Complex Criterion max", "modelling_method": "1 minute OHLC"}


def conditions(policy: DiscoveryPolicy):
    checks = [R.equity_dd >= 0, R.equity_dd <= policy.max_equity_dd,
              R.profit_factor >= policy.min_profit_factor, R.trades >= policy.min_trades,
              R.profit > policy.profit_above]
    for field, threshold in (("recovery_factor", policy.min_recovery), ("sharpe", policy.min_sharpe),
                             ("expected_payoff", policy.min_expected_payoff), ("result", policy.min_result)):
        if threshold is not None:
            checks.append(getattr(R, field) >= threshold)
    return checks


def ordering(ranking_objective: str = "quant_robustness"):
    ranking = OBJECTIVE_RANKINGS.get(ranking_objective, OBJECTIVE_RANKINGS["quant_robustness"])
    return [((getattr(R, name).asc() if direction == "asc" else getattr(R, name).desc()).nulls_last())
            for name, direction in (item.split(":") for item in ranking)] + [R.id.asc()]


def shortlist_query(run_id: int, policy: DiscoveryPolicy, ranking_objective: str = "quant_robustness"):
    # Repeated passes of the same full parameter hash count as one candidate.
    ranked = select(R.id.label("result_id"), func.row_number().over(
        partition_by=R.parameter_set_id, order_by=ordering(ranking_objective)).label("position")).where(
            R.run_id == run_id, *conditions(policy)).subquery()
    return select(ranked.c.result_id).where(ranked.c.position == 1)


def settings_evidence(run):
    actual = {key: getattr(run, key) for key in RECOMMENDED}
    warnings = []
    for key, recommended in RECOMMENDED.items():
        value = actual[key]
        accepted = {recommended.lower()}
        if key == "optimization_algorithm":
            accepted.update({"genetic", "fast genetic", "fast genetic based algorithm"})
        if not value:
            warnings.append(f"{key.replace('_', ' ').capitalize()} was not supplied. Record the settings used in MT5.")
        elif value.strip().lower() not in accepted:
            warnings.append(f"Recorded {key.replace('_', ' ')} differs from the recommended discovery setup.")
    return actual, warnings
