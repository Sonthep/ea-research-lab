"""Extract only PostgreSQL runtime components from the EDB Windows archive."""
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
destination = (root / ".tools").resolve()
with zipfile.ZipFile(destination / "postgresql.zip") as archive:
    for entry in archive.infolist():
        if entry.filename.startswith(("pgsql/bin/", "pgsql/lib/", "pgsql/share/")):
            target = (destination / entry.filename).resolve()
            if not target.is_relative_to(destination):
                raise ValueError("Unsafe archive path")
            archive.extract(entry, destination)
print("Extracted PostgreSQL runtime to .tools/pgsql.")
