import json
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from pydantic import ValidationError
from sqlalchemy import select, func, case
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.session import get_db
from app.models.entities import ExpertAdvisor, ImportFile, OptimizationRun, OptimizationResult, ParameterSet, Candidate, DiscoveryBatch
from app.schemas.requests import ImportMetadata, RenameRun, PromoteCandidates, EditCandidate, Filter
from app.services.importer import import_xml, DuplicateImport
from app.utils.metrics import profit_percentage
from app.schemas.discovery import DiscoveryPolicy
from app.services.discovery import conditions
from app.services.validation import get_config, records_by_candidate, build_pipeline, overall_status, funnel, stage_counts

router = APIRouter(prefix="/api")
DB = Annotated[Session, Depends(get_db)]


def require(db: Session, model, identifier: int):
    item = db.get(model, identifier)
    if item is None:
        raise HTTPException(404, "Record not found")
    return item


def run_data(db: Session, run: OptimizationRun):
    source = require(db, ImportFile, run.import_file_id)
    return {**{c.name: getattr(run, c.name) for c in run.__table__.columns}, "ea_name": require(db, ExpertAdvisor, run.ea_id).name,
            "source_filename": source.filename, "file_hash": source.file_hash, "warnings": source.warnings}


def result_data(result: OptimizationResult, parameter_set: ParameterSet, deposit: float | None, candidate_id: int | None = None):
    return {**{c.name: getattr(result, c.name) for c in result.__table__.columns}, "stable_set_id": parameter_set.stable_set_id,
            "full_hash": parameter_set.full_hash, "parameters": parameter_set.parameters, "profit_pct": profit_percentage(result.profit, deposit), "candidate_id": candidate_id}


@router.post("/import/mt5/xml", status_code=201)
def upload_xml(db: DB, file: UploadFile = File(...), metadata: str = Form("{}")):
    if not file.filename or not file.filename.lower().endswith(".xml"):
        raise HTTPException(415, "Upload an MT5 XML file")
    chunks = bytearray()
    while chunk := file.file.read(1024 * 1024):
        chunks.extend(chunk)
        if len(chunks) > settings.max_upload_mb * 1024 * 1024:
            raise HTTPException(413, f"File exceeds {settings.max_upload_mb} MB")
    try:
        overrides = ImportMetadata.model_validate_json(metadata)
        run = import_xml(db, bytes(chunks), file.filename, overrides)
        db.commit()
        return run_data(db, run)
    except DuplicateImport as exc:
        db.rollback()
        raise HTTPException(409, {"message": "This file has already been imported", "run_id": exc.run_id}) from exc
    except (ValueError, ValidationError) as exc:
        db.rollback()
        raise HTTPException(422, str(exc)) from exc
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Concurrent import conflict; retry or check import history") from exc


@router.get("/optimization-runs")
def runs(db: DB, page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=200)):
    total = db.scalar(select(func.count()).select_from(OptimizationRun))
    items = db.scalars(select(OptimizationRun).order_by(OptimizationRun.id.desc()).offset((page - 1) * page_size).limit(page_size))
    return {"items": [run_data(db, r) for r in items], "total": total}


@router.get("/optimization-runs/{run_id}")
def run_detail(run_id: int, db: DB):
    return run_data(db, require(db, OptimizationRun, run_id))


@router.patch("/optimization-runs/{run_id}")
def rename_run(run_id: int, body: RenameRun, db: DB):
    run = require(db, OptimizationRun, run_id)
    run.name = body.name
    db.commit()
    return run_data(db, run)


@router.get("/results")
def results(db: DB, run_id: int | None = None, page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200), search: str = Query("", max_length=200), filters: str = "[]", sort: str = "profit:desc"):
    pct = case((OptimizationRun.deposit > 0, OptimizationResult.profit / OptimizationRun.deposit * 100), else_=None)
    fields = {name: getattr(OptimizationResult, name) for name in ("id", "profit", "equity_dd", "profit_factor", "recovery_factor", "sharpe", "trades", "result", "expected_payoff", "mt5_pass", "custom")}
    fields.update(stable_set_id=ParameterSet.stable_set_id, profit_pct=pct)
    query = select(OptimizationResult, ParameterSet, OptimizationRun.deposit, Candidate.id).select_from(OptimizationResult).join(ParameterSet, OptimizationResult.parameter_set_id == ParameterSet.id).join(OptimizationRun, OptimizationResult.run_id == OptimizationRun.id).outerjoin(Candidate, Candidate.parameter_set_id == ParameterSet.id)
    if run_id:
        require(db, OptimizationRun, run_id)
        query = query.where(OptimizationResult.run_id == run_id)
    if search:
        # Literal search; user '%' and '_' characters do not become SQL wildcards.
        query = query.where(ParameterSet.stable_set_id.icontains(search, autoescape=True) | ParameterSet.canonical_json.icontains(search, autoescape=True))
    try:
        conditions = json.loads(filters)
        if not isinstance(conditions, list) or len(conditions) > 20:
            raise ValueError("Provide at most 20 filters")
        for condition in conditions:
            f = Filter.model_validate(condition)
            col = fields[f.field]
            query = query.where({"gt": col.__gt__, "gte": col.__ge__, "lt": col.__lt__, "lte": col.__le__, "eq": col.__eq__}[f.op](f.value))
        sorts = sort.split(",")
        if len(sorts) > 5:
            raise ValueError("At most five sort columns")
        ordering = []
        for item in sorts:
            name, direction = item.split(":")
            if name not in fields or direction not in {"asc", "desc"}:
                raise ValueError("Unknown sort column or direction")
            ordering.append((fields[name].asc() if direction == "asc" else fields[name].desc()).nulls_last())
    except (ValueError, ValidationError, TypeError) as exc:
        raise HTTPException(422, f"Invalid filters/sort: {exc}") from exc
    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.execute(query.order_by(*ordering, OptimizationResult.id.asc()).offset((page - 1) * page_size).limit(page_size))
    return {"items": [result_data(*row) for row in rows], "total": total, "page": page, "page_size": page_size}


@router.get("/sets/{set_id}")
def set_detail(set_id: int, db: DB):
    item = require(db, ParameterSet, set_id)
    rows = db.execute(select(OptimizationResult, OptimizationRun.deposit).join(OptimizationRun).where(OptimizationResult.parameter_set_id == set_id).order_by(OptimizationResult.id.desc()).limit(50))
    return {"id": item.id, "stable_set_id": item.stable_set_id, "full_hash": item.full_hash, "canonical_json": item.canonical_json, "parameters": item.parameters,
            "results": [result_data(r, item, deposit) for r, deposit in rows], "result_count": db.scalar(select(func.count()).select_from(OptimizationResult).where(OptimizationResult.parameter_set_id == set_id))}


@router.post("/candidates", status_code=201)
def promote(body: PromoteCandidates, db: DB):
    ids = set(body.result_ids)
    rows = list(db.scalars(select(OptimizationResult).where(OptimizationResult.id.in_(ids))))
    if len(rows) != len(ids):
        raise HTTPException(404, "One or more optimization results do not exist")
    existing = set(db.scalars(select(Candidate.parameter_set_id)))
    created = 0
    for row in rows:
        if row.parameter_set_id not in existing:
            db.add(Candidate(parameter_set_id=row.parameter_set_id, baseline_result_id=row.id))
            existing.add(row.parameter_set_id)
            created += 1
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Concurrent candidate promotion; refresh and retry") from exc
    return {"created": created, "already_candidates": len(ids) - created}


CANDIDATE_JOINS = (select(Candidate, OptimizationResult, ParameterSet, OptimizationRun, DiscoveryBatch).join(OptimizationResult, Candidate.baseline_result_id == OptimizationResult.id).join(ParameterSet, Candidate.parameter_set_id == ParameterSet.id).join(OptimizationRun, OptimizationResult.run_id == OptimizationRun.id).outerjoin(DiscoveryBatch, Candidate.discovery_batch_id == DiscoveryBatch.id))


def candidate_item(db, row, records, cfg):
    c, r, p, run, batch = row
    method = batch.run_settings if batch else {key: getattr(run, key) for key in ("optimization_algorithm", "criterion", "modelling_method")}
    evidence = None
    if batch:
        selected = next(item for item in batch.selected_results if item["result_id"] == r.id)
        evidence = {"batch_id": batch.id, "rank": selected["rank"], "policy": batch.policy, "ranking": batch.ranking, "selected_at": batch.created_at}
    pipeline = build_pipeline(batch is not None, records, cfg)
    overall = overall_status(pipeline, cfg)
    return {"id": c.id, "notes": c.notes, "tags": c.tags, "created_at": c.created_at,
            "baseline": result_data(r, p, run.deposit, c.id), "overall_status": overall,
            "validation_status": "NOT_TESTED" if overall == "DISCOVERED" else overall, "pipeline": pipeline,
            "run": {"id": run.id, "name": run.name, "ea_name": require(db, ExpertAdvisor, run.ea_id).name, "symbol": run.symbol, "timeframe": run.timeframe,
                    "date_from": run.date_from, "date_to": run.date_to, "result_count": run.result_count, "broker": run.broker},
            "discovery_method": method, "discovery_evidence": evidence,
            "validation_method": "Every tick based on real ticks"}


@router.get("/candidates")
def candidates(db: DB, page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=200)):
    rows = list(db.execute(CANDIDATE_JOINS.order_by(Candidate.id.desc()).offset((page - 1) * page_size).limit(page_size)))
    cfg, grouped = get_config(db), records_by_candidate(db, [row[0].id for row in rows])
    return {"items": [candidate_item(db, row, grouped[row[0].id], cfg) for row in rows], "total": db.scalar(select(func.count()).select_from(Candidate))}


@router.patch("/candidates/{candidate_id}")
def edit_candidate(candidate_id: int, body: EditCandidate, db: DB):
    candidate = require(db, Candidate, candidate_id)
    candidate.notes, candidate.tags = body.notes, body.tags
    db.commit()
    return {"id": candidate.id, "notes": candidate.notes, "tags": candidate.tags}


@router.get("/imports")
def imports(db: DB, page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=200)):
    rows = db.execute(select(ImportFile, OptimizationRun.id).join(OptimizationRun).order_by(ImportFile.id.desc()).offset((page - 1) * page_size).limit(page_size))
    return {"items": [{**{c.name: getattr(f, c.name) for c in f.__table__.columns}, "run_id": run_id} for f, run_id in rows], "total": db.scalar(select(func.count()).select_from(ImportFile))}


def dashboard_funnel(db: Session):
    policy = DiscoveryPolicy()
    head = [("results", "Optimization Results", db.scalar(select(func.count()).select_from(OptimizationResult))),
            ("initial_filter", "Pass Initial Filter", db.scalar(select(func.count()).select_from(OptimizationResult).where(*conditions(policy)))),
            ("candidates", "Candidate Sets", db.scalar(select(func.count()).select_from(Candidate)))]
    return [{"key": k, "label": label, "count": count} for k, label, count in head] + funnel(db, get_config(db))


@router.get("/dashboard")
def dashboard(db: DB):
    return {"results": db.scalar(select(func.count()).select_from(OptimizationResult)), "runs": db.scalar(select(func.count()).select_from(OptimizationRun)), "profitable": db.scalar(select(func.count()).select_from(OptimizationResult).where(OptimizationResult.profit > 0)), "low_dd": db.scalar(select(func.count()).select_from(OptimizationResult).where(OptimizationResult.equity_dd <= 10)), "high_pf": db.scalar(select(func.count()).select_from(OptimizationResult).where(OptimizationResult.profit_factor >= 2)), "candidates": db.scalar(select(func.count()).select_from(Candidate)),
            "initial_filter_results": db.scalar(select(func.count()).select_from(OptimizationResult).where(*conditions(DiscoveryPolicy()))),
            "initial_filter_sets": db.scalar(select(func.count(func.distinct(OptimizationResult.parameter_set_id))).where(*conditions(DiscoveryPolicy()))),
            "discovery_batches": db.scalar(select(func.count()).select_from(DiscoveryBatch)),
            "funnel": dashboard_funnel(db), "stage_counts": stage_counts(db, get_config(db))}
