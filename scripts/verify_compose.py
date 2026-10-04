"""Real Docker acceptance check: build, boot, import fixture and test data flow."""
from pathlib import Path
import subprocess
import time
import json
import os
import shutil
import httpx

root = Path(__file__).resolve().parents[1]
docker = shutil.which("docker")
if not docker and os.name == "nt":
    candidate = Path(os.environ.get("ProgramFiles", "C:/Program Files")) / "Docker/Docker/resources/bin/docker.exe"
    if candidate.exists():
        docker = str(candidate)
        os.environ["PATH"] = str(candidate.parent) + os.pathsep + os.environ.get("PATH", "")
if not docker:
    raise SystemExit("Install/start Docker Desktop or Docker Engine first.")
subprocess.run([docker, "compose", "up", "--build", "-d", "--wait", "--wait-timeout", "180"], cwd=root, check=True)
with httpx.Client(base_url="http://localhost:8000", timeout=120) as client:
    assert client.get("/health").status_code == 200
    with (root / "sample-data/mt5-optimization-5000.xml").open("rb") as file:
        response = client.post("/api/import/mt5/xml", files={"file": (file.name, file, "application/xml")})
    if response.status_code == 409:
        run_id = response.json()["detail"]["run_id"]
    else:
        assert response.status_code == 201, response.text
        run_id = response.json()["id"]
    run = client.get(f"/api/optimization-runs/{run_id}").json()
    assert run["symbol"] == "XAUUSD" and run["result_count"] == 5000
    rows = client.get("/api/results", params={"run_id":run_id, "page":100,"page_size":50}).json()
    assert rows["total"] == 5000 and len(rows["items"]) == 50
    assert rows["items"][0]["stable_set_id"].startswith("SET-")
    filtered = client.get("/api/results", params={"run_id":run_id, "filters":json.dumps([{"field":"equity_dd","op":"lte","value":10},{"field":"profit","op":"gt","value":0}]), "sort":"equity_dd:asc,profit:desc"}).json()
    assert filtered["total"] > 0
    assert all(r["equity_dd"] <= 10 and r["profit"] > 0 for r in filtered["items"])
    assert [r["equity_dd"] for r in filtered["items"]] == sorted(r["equity_dd"] for r in filtered["items"])
    assert client.post("/api/candidates", json={"result_ids":[rows["items"][0]["id"]]}).status_code == 201
assert httpx.get("http://localhost:3000/dashboard", timeout=30).status_code == 200
print("Compose acceptance passed: PostgreSQL, migration, API, frontend, 5,000-row XML, metadata, pagination and candidate promotion.")
