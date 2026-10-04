"""Validation pipeline logic: stage catalogue, degradation evidence, status and funnel rules."""
from sqlalchemy import select
from app.models.entities import Candidate, ValidationRecord, ValidationRules
from app.schemas.validation import ValidationConfig

NOT_TESTED, RUNNING, PASSED, WARNING, FAILED = "NOT_TESTED", "RUNNING", "PASSED", "WARNING", "FAILED"
METRICS = ["profit", "equity_dd", "profit_factor", "recovery_factor", "sharpe", "trades", "win_rate"]

# key, label, group. Discovery and filter are derived from stored selection evidence.
PIPELINE = [
    ("discovery", "Candidate Discovery", "Discovery"), ("filter", "Candidate Filter", "Discovery"),
    ("real_tick", "Real Tick", "Real Tick"), ("latency", "Latency", "Execution Stress"),
    ("random_delay", "Random Delay", "Execution Stress"), ("slippage", "Slippage", "Execution Stress"),
    ("spread", "Spread Stress", "Execution Stress"), ("oos", "Out-of-Sample", "Out-of-Sample"),
    ("forward", "Forward", "Forward"), ("robustness", "Parameter Robustness", "Robustness"),
    ("long_period", "Long Period", "Long Period"), ("cross_broker", "Cross-Broker", "Cross-Broker"),
    ("demo", "Demo", "Demo"),
]
LABELS = {key: label for key, label, _ in PIPELINE}
VALIDATION_STAGES = [key for key, _, _ in PIPELINE if key not in ("discovery", "filter")]
FUTURE_STAGES = {"slippage", "spread"}  # accepted, shown only once data exists
OPTIONAL_STAGES = FUTURE_STAGES | {"cross_broker"}
STRESS_STAGES = {"latency", "random_delay", "slippage", "spread"}
# Trade counts are only comparable when the tested period equals the discovery period.
SAME_PERIOD_STAGES = {"real_tick"} | STRESS_STAGES | {"cross_broker"}
FUNNEL = [("real_tick", "Real Tick Passed", ["real_tick"]), ("stress", "Stress Test Passed", ["latency", "random_delay"]),
          ("oos", "OOS Passed", ["oos"]), ("forward", "Forward Passed", ["forward"]),
          ("robustness", "Parameter Robust", ["robustness"]), ("long_period", "Long Period Passed", ["long_period"]),
          ("demo", "Demo Passed", ["demo"])]


def _pct(base, value):
    return None if base in (None, 0) or value is None else (value - base) / abs(base) * 100


def compare(baseline: dict, metrics: dict, cfg: ValidationConfig, stage: str) -> dict:
    """Metric deltas plus configurable warnings. Warnings are evidence, not verdicts."""
    deltas = {}
    for name in METRICS:
        b, v = baseline.get(name), metrics.get(name)
        deltas[name] = {"baseline": b, "value": v, "change": None if b is None or v is None else v - b, "change_pct": _pct(b, v)}
    warnings = []

    def warn(code, metric, message, threshold):
        warnings.append({"code": code, "metric": metric, "message": message, "threshold": threshold,
                         "baseline": baseline.get(metric), "value": metrics.get(metric)})
    bp, vp = baseline.get("profit"), metrics.get("profit")
    if bp and bp > 0 and vp is not None:
        degradation = (bp - vp) / bp * 100
        deltas["profit"]["degradation_pct"] = degradation
        if degradation > cfg.profit_degradation_pct:
            warn("PROFIT_DEGRADATION", "profit", f"Profit degraded {degradation:.1f}% (limit {cfg.profit_degradation_pct:g}%).", cfg.profit_degradation_pct)
    bd, vd = baseline.get("equity_dd"), metrics.get("equity_dd")
    if bd and bd > 0 and vd is not None and vd > cfg.drawdown_multiple * bd:
        warn("DRAWDOWN_INCREASE", "equity_dd", f"Equity DD {vd:g}% is above {cfg.drawdown_multiple:g}x baseline ({bd:g}%).", cfg.drawdown_multiple)
    vf = metrics.get("profit_factor")
    if vf is not None and vf < cfg.min_profit_factor:
        warn("LOW_PROFIT_FACTOR", "profit_factor", f"Profit Factor {vf:g} is below {cfg.min_profit_factor:g}.", cfg.min_profit_factor)
    bt, vt = baseline.get("trades"), metrics.get("trades")
    if stage in SAME_PERIOD_STAGES and bt and vt is not None:
        change = abs(vt - bt) / bt * 100
        deltas["trades"]["abs_change_pct"] = change
        if change > cfg.trade_change_pct:
            warn("TRADE_COUNT_CHANGE", "trades", f"Trade count changed {change:.1f}% (limit {cfg.trade_change_pct:g}%).", cfg.trade_change_pct)
    return {"deltas": deltas, "warnings": warnings}


def status_from_comparison(comparison: dict, metrics: dict, cfg: ValidationConfig) -> str:
    """A single crossed threshold is a WARNING; FAILED needs a loss or several independent warnings."""
    count = len(comparison["warnings"])
    if (metrics.get("profit") is not None and metrics["profit"] <= 0) or count >= cfg.fail_warning_count:
        return FAILED
    return WARNING if count else PASSED


def analyse_robustness(points: list[dict], center_x: float, center_y: float | None, cfg: ValidationConfig) -> dict:
    for p in points:
        p["good"] = p["profit"] > 0 and p["profit_factor"] >= cfg.robustness_min_profit_factor
        p["is_candidate"] = abs(p["x"] - center_x) < 1e-9 and (center_y is None or (p.get("y") is not None and abs(p["y"] - center_y) < 1e-9))
    centre = [p for p in points if p["is_candidate"]]
    neighbours = [p for p in points if not p["is_candidate"]]
    good_neighbours = sum(p["good"] for p in neighbours)
    ratio = good_neighbours / len(neighbours) if neighbours else 0
    centre_good = bool(centre and centre[0]["good"])
    if ratio >= cfg.plateau_min_good_ratio:
        classification, status = "PARAMETER_PLATEAU", PASSED if centre_good else WARNING
        message = f"{good_neighbours} of {len(neighbours)} nearby values perform well: Parameter Plateau."
    elif ratio < 0.3:
        classification, status = "PARAMETER_SENSITIVITY", WARNING
        message = f"Only {good_neighbours} of {len(neighbours)} nearby values perform well: Parameter Sensitivity warning. This alone is not proof of overfitting."
    else:
        classification, status = "MIXED", WARNING
        message = f"{good_neighbours} of {len(neighbours)} nearby values perform well: inconclusive; review the neighbours."
    return {"classification": classification, "status": status, "message": message, "good_neighbours": good_neighbours,
            "neighbours": len(neighbours), "good_ratio": ratio, "center_good": centre_good, "points": points}


def stage_status(rows) -> str:
    """Latest record per label; any failure dominates, then running, then warning."""
    latest = {}
    for row in sorted(rows, key=lambda r: r.id):
        latest[row.label] = row.status
    if not latest:
        return NOT_TESTED
    values = set(latest.values())
    for status in (FAILED, RUNNING, WARNING):
        if status in values:
            return status
    return PASSED if values == {PASSED} else NOT_TESTED


def build_pipeline(candidate_has_batch: bool, rows, cfg: ValidationConfig) -> list[dict]:
    by_stage = {}
    for row in rows:
        by_stage.setdefault(row.stage, []).append(row)
    stages = [
        {"key": "discovery", "label": LABELS["discovery"], "status": PASSED, "required": True, "tests": 0,
         "detail": "A promising parameter set was found. This is not validation."},
        {"key": "filter", "label": LABELS["filter"], "status": PASSED if candidate_has_batch else WARNING, "required": True, "tests": 0,
         "detail": "Selected with recorded filters." if candidate_has_batch else "Added manually; no filter policy recorded."},
    ]
    for key in VALIDATION_STAGES:
        stage_rows = by_stage.get(key, [])
        if key in FUTURE_STAGES and not stage_rows:
            continue
        status = stage_status(stage_rows)
        required = key in cfg.required_stages
        detail = "" if stage_rows else ("Optional" if key in OPTIONAL_STAGES and not required else "Not tested")
        stages.append({"key": key, "label": LABELS[key], "status": status, "required": required, "tests": len(stage_rows), "detail": detail})
    return stages


def overall_status(pipeline: list[dict], cfg: ValidationConfig) -> str:
    """Never PASSED: a candidate is at most LIVE_CANDIDATE once every required stage is complete."""
    tested = [s for s in pipeline if s["key"] not in ("discovery", "filter")]
    required = [s for s in tested if s["required"]]
    if any(s["status"] == FAILED for s in required):
        return "FAILED"
    ok = {PASSED, WARNING} if cfg.warning_counts_as_pass else {PASSED}
    if required and all(s["status"] in ok for s in required):
        return "LIVE_CANDIDATE"
    return "VALIDATING" if any(s["status"] != NOT_TESTED for s in tested) else "DISCOVERED"


def get_config(db) -> ValidationConfig:
    row = db.get(ValidationRules, 1)
    return ValidationConfig(**(row.rules if row else {}))


def records_by_candidate(db, candidate_ids) -> dict[int, list]:
    grouped = {i: [] for i in candidate_ids}
    if grouped:
        for row in db.scalars(select(ValidationRecord).where(ValidationRecord.candidate_id.in_(list(grouped))).order_by(ValidationRecord.id)):
            grouped[row.candidate_id].append(row)
    return grouped


def all_pipelines(db, cfg: ValidationConfig) -> dict[int, list[dict]]:
    candidates = list(db.execute(select(Candidate.id, Candidate.discovery_batch_id)))
    grouped = records_by_candidate(db, [c[0] for c in candidates])
    return {cid: build_pipeline(batch is not None, grouped[cid], cfg) for cid, batch in candidates}


def stage_counts(db, cfg: ValidationConfig) -> list[dict]:
    """Per-stage status totals across all candidates, in pipeline order."""
    pipelines = all_pipelines(db, cfg)
    order = [(k, label) for k, label, _ in PIPELINE if k not in FUTURE_STAGES or any(s["key"] == k for p in pipelines.values() for s in p)]
    rows = []
    for key, label in order:
        counts = {NOT_TESTED: 0, RUNNING: 0, PASSED: 0, WARNING: 0, FAILED: 0}
        for pipeline in pipelines.values():
            counts[next(s for s in pipeline if s["key"] == key)["status"]] += 1
        rows.append({"key": key, "label": label, "required": key in cfg.required_stages or key in ("discovery", "filter"), **counts})
    return rows


def funnel(db, cfg: ValidationConfig) -> list[dict]:
    """Cumulative counts from stored data: a candidate counts at a step only if it passed every earlier step."""
    pipelines = all_pipelines(db, cfg)
    alive, steps = set(pipelines), []
    for key, label, stages in FUNNEL:
        alive = {cid for cid in alive if all(next(s for s in pipelines[cid] if s["key"] == st)["status"] == PASSED for st in stages)}
        steps.append({"key": key, "label": label, "count": len(alive)})
    live = sum(overall_status(pipelines[cid], cfg) == "LIVE_CANDIDATE" for cid in alive)
    return steps + [{"key": "live", "label": "Live Candidates", "count": live}]
