import hashlib
import re
from datetime import datetime, timezone
from sqlalchemy import select, insert
from sqlalchemy.orm import Session
from app.models.entities import ExpertAdvisor, ImportFile, OptimizationRun, ParameterSet, ParameterValue, OptimizationResult
from app.parsers.mt5_xml import parse_xml
from app.schemas.requests import ImportMetadata
from app.utils.stable_id import identify


class DuplicateImport(ValueError):
    def __init__(self, run_id: int):
        self.run_id = run_id


def import_xml(db: Session, content: bytes, filename: str, overrides: ImportMetadata) -> OptimizationRun:
    digest = hashlib.sha256(content).hexdigest()
    existing = db.scalar(select(OptimizationRun).join(ImportFile).where(ImportFile.file_hash == digest))
    if existing:
        raise DuplicateImport(existing.id)
    parsed = parse_xml(content)
    meta = parsed.metadata | overrides.model_dump(exclude_none=True)
    meta = ImportMetadata.model_validate(meta).model_dump(exclude_none=True)
    parsed.warnings = [w for w in parsed.warnings if not w.startswith("Missing metadata")]
    missing = [key for key in ("ea_name", "symbol", "timeframe", "deposit", "date_from", "date_to") if not meta.get(key)]
    if missing:
        parsed.warnings.append("Missing metadata: " + ", ".join(missing))
    safe_name = re.sub(r"[^\w.\- ]", "_", filename.replace("\\", "/").split("/")[-1])[:255] or "upload.xml"
    ea_name = meta.pop("ea_name", "Unknown EA")
    run_name = meta.pop("name", None)
    ea = db.scalar(select(ExpertAdvisor).where(ExpertAdvisor.name == ea_name))
    if not ea:
        ea = ExpertAdvisor(name=ea_name)
        db.add(ea)
        db.flush()
    source = ImportFile(filename=safe_name, file_hash=digest, record_count=len(parsed.rows), warnings=parsed.warnings)
    db.add(source)
    db.flush()
    run = OptimizationRun(name=run_name or f"RUN-{datetime.now(timezone.utc):%Y%m%d}-{source.id:03d}", ea_id=ea.id, import_file_id=source.id, result_count=len(parsed.rows), parameter_names=parsed.parameter_names, **meta)
    db.add(run)
    db.flush()
    # Query only the hashes present in this import, in bounded batches.
    identities = {}
    row_hashes = []
    for row in parsed.rows:
        identity = identify(row["parameters"])
        identities[identity[1]] = identity
        row_hashes.append(identity[1])
    set_ids: dict[str, int] = {}
    hashes = list(identities)
    for start in range(0, len(hashes), 500):
        for parameter_set in db.scalars(select(ParameterSet).where(ParameterSet.full_hash.in_(hashes[start:start + 500]))):
            set_ids[parameter_set.full_hash] = parameter_set.id
    for digest, (short_id, _, canonical, parameters) in identities.items():
        if digest not in set_ids:
            parameter_set = ParameterSet(stable_set_id=short_id, full_hash=digest, canonical_json=canonical, parameters=parameters)
            db.add(parameter_set)
            db.flush()
            set_ids[digest] = parameter_set.id
            db.execute(insert(ParameterValue), [{"parameter_set_id": parameter_set.id, "name": name, "value": value} for name, value in parameters.items()])
    batch = []
    for row, row_hash in zip(parsed.rows, row_hashes):
        values = {key: value for key, value in row.items() if key != "parameters"}
        batch.append({"run_id": run.id, "parameter_set_id": set_ids[row_hash], **values})
        if len(batch) == 1000:
            db.execute(insert(OptimizationResult), batch)
            batch.clear()
    if batch:
        db.execute(insert(OptimizationResult), batch)
    db.flush()
    return run
