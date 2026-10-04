from pathlib import Path
from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.entities import Candidate, OptimizationResult
from app.schemas.requests import ImportMetadata
from app.services.importer import import_xml, DuplicateImport


def seed():
    path = Path(__file__).resolve().parents[3] / "sample-data" / "mt5-optimization-5000.xml"
    with SessionLocal() as db:
        try:
            run = import_xml(db, path.read_bytes(), path.name, ImportMetadata(name="Synthetic · HybridSMC XAUUSD M1 · 5,000 passes"))
            result = db.scalar(select(OptimizationResult).where(OptimizationResult.run_id == run.id).order_by(OptimizationResult.id))
            db.add(Candidate(parameter_set_id=result.parameter_set_id, baseline_result_id=result.id, notes="Synthetic reference candidate from the specification. Requires independent validation.", tags=["sample", "synthetic"]))
            db.commit()
            print(f"Seeded {run.result_count:,} results and one synthetic candidate.")
        except DuplicateImport:
            print("Sample data already imported; no changes made.")


if __name__ == "__main__":
    seed()
