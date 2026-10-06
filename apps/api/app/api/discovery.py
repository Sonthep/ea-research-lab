from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from app.api.routes import DB, require, run_data, result_data
from app.models.entities import OptimizationRun, OptimizationResult, ParameterSet, Candidate, DiscoveryBatch
from app.schemas.discovery import DiscoveryRequest, DiscoveryPromotion, DiscoverySettings
from app.services.discovery import (
    RANKING, RECOMMENDED, OBJECTIVE_RANKINGS,
    conditions, ordering, shortlist_query, settings_evidence
)

router = APIRouter(prefix="/api/discovery", tags=["Candidate discovery"])


@router.get("/configuration")
def configuration():
    return {
        "recommended": RECOMMENDED,
        "ranking": RANKING,
        "objectives": list(OBJECTIVE_RANKINGS.keys()),
        "min_candidates": 10,
        "max_candidates": 30
    }


@router.patch("/runs/{run_id}/settings")
def update_settings(run_id: int, body: DiscoverySettings, db: DB):
    run = require(db, OptimizationRun, run_id)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(run, key, value or None)
    db.commit()
    return run_data(db, run)


def build_preview(body: DiscoveryRequest, db):
    run = require(db, OptimizationRun, body.run_id)
    obj = body.ranking_objective or "quant_robustness"
    ranking_list = OBJECTIVE_RANKINGS.get(obj, OBJECTIVE_RANKINGS["quant_robustness"])
    unique = shortlist_query(run.id, body.policy, obj)
    eligible = db.scalar(select(func.count()).select_from(unique.subquery()))
    matches = db.scalar(select(func.count()).select_from(OptimizationResult).where(
        OptimizationResult.run_id == run.id, *conditions(body.policy)))
    
    base_conditions = [OptimizationResult.id.in_(unique)]
    if body.pass_search and body.pass_search.strip():
        search_term = body.pass_search.strip()
        base_conditions.append(OptimizationResult.mt5_pass.ilike(f"%{search_term}%"))

    query = select(OptimizationResult, ParameterSet, Candidate.id).join(
        ParameterSet, OptimizationResult.parameter_set_id == ParameterSet.id).outerjoin(
        Candidate, Candidate.parameter_set_id == ParameterSet.id).where(
        *base_conditions).order_by(*ordering(obj)).limit(body.top_count)
    actual, warnings = settings_evidence(run)
    return {"run": run_data(db, run), "settings": actual, "recommended": RECOMMENDED,
            "settings_warnings": warnings, "policy": body.policy.model_dump(),
            "ranking": ranking_list, "ranking_objective": obj,
            "available_objectives": list(OBJECTIVE_RANKINGS.keys()),
            "top_count": body.top_count, "total_results": run.result_count,
            "qualifying_results": matches, "qualifying_sets": eligible,
            "status": "DISCOVERED" if eligible else "NO_MATCHES", "validation_status": "NOT_TESTED",
            "items": [{**result_data(r, p, run.deposit, candidate_id), "discovery_rank": i + 1}
                      for i, (r, p, candidate_id) in enumerate(db.execute(query))]}


@router.post("/preview")
def preview(body: DiscoveryRequest, db: DB):
    return build_preview(body, db)


@router.post("/promote", status_code=201)
def promote_discovery(body: DiscoveryPromotion, db: DB):
    preview = build_preview(body, db)
    ids = set(body.result_ids)
    allowed = {r["id"]: r for r in preview["items"]}
    if not ids.issubset(allowed):
        valid_count = db.scalar(select(func.count()).select_from(OptimizationResult).where(
            OptimizationResult.id.in_(ids), OptimizationResult.run_id == body.run_id, *conditions(body.policy)))
        if valid_count != len(ids):
            raise HTTPException(422, "Select only results from the current run that satisfy the discovery policy.")
        extra_query = select(OptimizationResult, ParameterSet, Candidate.id).join(
            ParameterSet, OptimizationResult.parameter_set_id == ParameterSet.id).outerjoin(
            Candidate, Candidate.parameter_set_id == ParameterSet.id).where(OptimizationResult.id.in_(ids))
        for r, p, c_id in db.execute(extra_query):
            allowed[r.id] = {**result_data(r, p, preview["run"]["deposit"], c_id), "discovery_rank": 0}

    existing = {c.parameter_set_id: c for c in db.scalars(select(Candidate).where(
        Candidate.parameter_set_id.in_([allowed[i]["parameter_set_id"] for i in ids])))}
    new_rows = [allowed[i] for i in ids if allowed[i]["parameter_set_id"] not in existing]
    batch = None
    if new_rows:
        batch = DiscoveryBatch(run_id=body.run_id, policy=preview["policy"], ranking=preview["ranking"],
            run_settings={**preview["settings"], "ea_name": preview["run"]["ea_name"],
                          "symbol": preview["run"]["symbol"], "timeframe": preview["run"]["timeframe"],
                          "date_from": preview["run"]["date_from"], "date_to": preview["run"]["date_to"]},
            selected_results=[{"result_id": r["id"], "parameter_set_id": r["parameter_set_id"],
                               "full_hash": r["full_hash"], "rank": r["discovery_rank"]} for r in new_rows])
        db.add(batch)
        db.flush()
        for row in new_rows:
            db.add(Candidate(parameter_set_id=row["parameter_set_id"], baseline_result_id=row["id"],
                             discovery_batch_id=batch.id))
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Concurrent discovery promotion; refresh and retry.") from exc
    return {"created": len(new_rows), "already_candidates": len(ids) - len(new_rows),
            "batch_id": batch.id if batch else None, "validation_status": "NOT_TESTED"}


@router.get("/batches")
def batches(db: DB, run_id: int | None = None, page: int = Query(1, ge=1), page_size: int = Query(10, ge=1, le=100)):
    query = select(DiscoveryBatch)
    if run_id is not None:
        require(db, OptimizationRun, run_id)
        query = query.where(DiscoveryBatch.run_id == run_id)
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    items = db.scalars(query.order_by(DiscoveryBatch.id.desc()).offset((page - 1) * page_size).limit(page_size))
    return {"total": total, "items": [{c.name: getattr(item, c.name) for c in item.__table__.columns} for item in items]}
