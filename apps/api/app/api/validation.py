from datetime import date
from fastapi import APIRouter, HTTPException
from app.api.routes import DB, require, candidate_item, CANDIDATE_JOINS
from app.models.entities import Candidate, ValidationRecord, ValidationRules
from app.schemas.validation import ValidationConfig, StageSubmission, RobustnessSubmission, STAGE_KEYS
from app.services.validation import (LABELS, STRESS_STAGES, RUNNING, PASSED, compare, status_from_comparison,
                                     analyse_robustness, get_config, records_by_candidate)

router = APIRouter(prefix="/api", tags=["Validation pipeline"])
STAGE_KEYS_NO_ROBUSTNESS = [k for k in STAGE_KEYS if k != "robustness"]


@router.get("/validation/config")
def read_config(db: DB):
    return {"rules": get_config(db).model_dump(), "defaults": ValidationConfig().model_dump(), "stages": LABELS}


@router.put("/validation/config")
def write_config(body: ValidationConfig, db: DB):
    row = db.get(ValidationRules, 1) or ValidationRules(id=1, rules={})
    row.rules = body.model_dump()
    db.add(row)
    db.commit()
    return {"rules": body.model_dump(), "defaults": ValidationConfig().model_dump(), "stages": LABELS}


def record_data(row: ValidationRecord):
    return {c.name: getattr(row, c.name) for c in row.__table__.columns} | {"stage_label": LABELS[row.stage]}


def load_candidate(db, candidate_id: int):
    row = db.execute(CANDIDATE_JOINS.where(Candidate.id == candidate_id)).first()
    if row is None:
        raise HTTPException(404, "Record not found")
    return row


def candidate_detail(db, candidate_id: int):
    row = load_candidate(db, candidate_id)
    cfg = get_config(db)
    records = records_by_candidate(db, [candidate_id])[candidate_id]
    return {**candidate_item(db, row, records, cfg), "records": [record_data(r) for r in records], "rules": cfg.model_dump(),
            "parameters": row[2].parameters}


@router.get("/candidates/{candidate_id}")
def get_candidate(candidate_id: int, db: DB):
    return candidate_detail(db, candidate_id)


def parse_day(text):
    if not text:
        return None
    try:
        return date.fromisoformat(text.strip()[:10].replace(".", "-").replace("/", "-"))
    except ValueError:
        return None


def discovery_baseline(result):
    return {k: getattr(result, k) for k in ("profit", "equity_dd", "profit_factor", "recovery_factor", "sharpe", "trades")} | {"win_rate": None}


def pick_baseline(stage, result, records):
    real_tick = [r for r in records if r.stage == "real_tick" and r.metrics]
    if stage in STRESS_STAGES:
        if not real_tick:
            raise HTTPException(422, "Record a Real Tick validation first; stress tests compare against it.")
        return real_tick[-1].metrics, "real_tick"
    if stage in ("cross_broker", "demo") and real_tick:
        return real_tick[-1].metrics, "real_tick"
    return discovery_baseline(result), "discovery"


def validated_label_and_settings(stage, body: StageSubmission, run):
    s = body.settings.model_dump(exclude_none=True)
    if stage == "real_tick":
        s.setdefault("modelling_method", "Every tick based on real ticks")
        s.setdefault("delay_ms", 0)
    if stage == "latency":
        if not s.get("delay_ms"):
            raise HTTPException(422, "Latency tests need settings.delay_ms above zero.")
        label = body.label or f"{s['delay_ms']} ms"
    elif stage == "random_delay":
        lo, hi = s.get("delay_min_ms"), s.get("delay_max_ms")
        if lo is not None and hi is not None and lo > hi:
            raise HTTPException(422, "delay_min_ms must not exceed delay_max_ms.")
        label = body.label or "Random Delay"
    elif stage == "cross_broker":
        if not s.get("broker"):
            raise HTTPException(422, "Cross-broker tests need settings.broker.")
        label = body.label or s["broker"]
    else:
        label = body.label or LABELS[stage]
    evidence = {}
    if stage in ("oos", "forward", "long_period", "demo") and body.status != RUNNING:
        start, end = parse_day(s.get("period_from")), parse_day(s.get("period_to"))
        if stage != "forward" and (not start or not end or start > end):
            raise HTTPException(422, "Provide period_from and period_to as valid dates (YYYY-MM-DD) with from before to.")
        if stage == "oos":
            ins_start, ins_end = parse_day(run.date_from), parse_day(run.date_to)
            if ins_start and ins_end and start <= ins_end and end >= ins_start:
                raise HTTPException(422, "Out-of-Sample period must not overlap the in-sample discovery period.")
    if stage == "oos":
        evidence["in_sample"] = {"from": run.date_from, "to": run.date_to}
        evidence["out_of_sample"] = {"from": s.get("period_from"), "to": s.get("period_to")}
    if stage == "forward":
        index = s.get("forward_index")
        if not index:
            raise HTTPException(422, "Forward tests need settings.forward_index such as 1/3.")
        number, total = map(int, index.split("/"))
        if not 1 <= number <= total:
            raise HTTPException(422, "forward_index must be N/M with 1 <= N <= M.")
        evidence["in_sample"] = {"from": run.date_from, "to": run.date_to}
        label = body.label or f"Forward {index}"
    s["optimization"] = "Disabled"
    return label, s, evidence


@router.post("/candidates/{candidate_id}/validation/robustness", status_code=201)
def submit_robustness(candidate_id: int, body: RobustnessSubmission, db: DB):
    row = load_candidate(db, candidate_id)
    parameters, cfg = row[2].parameters, get_config(db)
    def centre(name):
        try:
            return float(parameters[name])
        except (KeyError, ValueError):
            raise HTTPException(422, f"Parameter '{name}' is missing or not numeric for this candidate.") from None
    cx, cy = centre(body.parameter), centre(body.parameter_y) if body.parameter_y else None
    analysis = analyse_robustness([p.model_dump() for p in body.points], cx, cy, cfg)
    if not any(p["is_candidate"] for p in analysis["points"]):
        raise HTTPException(422, f"Include the candidate's own value ({body.parameter}={cx:g}) as one of the points.")
    if analysis["neighbours"] < 2:
        raise HTTPException(422, "Provide at least two neighbouring values.")
    label = body.parameter if not body.parameter_y else f"{body.parameter} × {body.parameter_y}"
    warnings = [] if analysis["status"] == PASSED else [{"code": analysis["classification"], "message": analysis["message"]}]
    record = ValidationRecord(candidate_id=candidate_id, stage="robustness", label=label, status=analysis["status"],
        metrics={k: analysis[k] for k in ("good_neighbours", "neighbours", "good_ratio")}, baseline={}, baseline_source="neighbours",
        comparison={"deltas": {}, "warnings": warnings}, settings={"parameter": body.parameter, "parameter_y": body.parameter_y,
        "center": {"x": cx, "y": cy}, "optimization": "Disabled", "min_profit_factor": cfg.robustness_min_profit_factor},
        evidence=analysis, notes=body.notes)
    db.add(record)
    db.commit()
    return record_data(record)


@router.post("/candidates/{candidate_id}/validation/{stage}", status_code=201)
def submit_stage(candidate_id: int, stage: str, body: StageSubmission, db: DB):
    if stage not in STAGE_KEYS_NO_ROBUSTNESS:
        raise HTTPException(404, "Unknown validation stage")
    row = load_candidate(db, candidate_id)
    cfg = get_config(db)
    records = records_by_candidate(db, [candidate_id])[candidate_id]
    label, settings, evidence = validated_label_and_settings(stage, body, row[3])
    metrics = body.metrics.model_dump() if body.metrics else {}
    baseline, source = pick_baseline(stage, row[1], records)
    comparison = {"deltas": {}, "warnings": []}
    status = RUNNING
    if body.metrics:
        comparison = compare(baseline, metrics, cfg, stage)
        for regime, values in body.regimes.items():
            data = values.model_dump()
            if (data["profit"] is not None and data["profit"] <= 0) or (data["profit_factor"] is not None and data["profit_factor"] < 1):
                comparison["warnings"].append({"code": "REGIME_WEAK", "metric": regime, "message": f"Weak performance in {regime.replace('_', ' ')} periods.", "baseline": None, "value": data["profit"], "threshold": None})
        status = status_from_comparison(comparison, metrics, cfg)
    if body.regimes:
        evidence["regimes"] = {k: v.model_dump() for k, v in body.regimes.items()}
    overridden = body.status is not None and body.status != status and body.metrics is not None
    if body.status is not None:
        status = body.status
    record = ValidationRecord(candidate_id=candidate_id, stage=stage, label=label, status=status, metrics=metrics, baseline=baseline,
        baseline_source=source, comparison={**comparison, "thresholds": cfg.model_dump()}, settings=settings, evidence=evidence,
        status_overridden=overridden, notes=body.notes)
    db.add(record)
    db.commit()
    return record_data(record)
