"""Start native API and web; apply migrations first. Ctrl+C stops child processes."""
from pathlib import Path
import os
import subprocess
import sys
import time

root = Path(__file__).resolve().parents[1]
python = root / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
next_cli = root / "apps/web/node_modules/next/dist/bin/next"
if not python.exists() or not next_cli.exists():
    sys.exit("Install dependencies first; see README.md.")

subprocess.run([str(python), "-m", "alembic", "upgrade", "head"], cwd=root / "apps/api", check=True)
if "--seed" in sys.argv:
    subprocess.run([str(python), "-m", "app.seed"], cwd=root / "apps/api", check=True)
children = []
try:
    children.append(subprocess.Popen([str(python), "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"], cwd=root / "apps/api"))
    children.append(subprocess.Popen(["node", str(next_cli), "dev", "apps/web", "--hostname", "127.0.0.1", "--port", "3000"], cwd=root))
    print("API: http://localhost:8000/docs\nWeb: http://localhost:3000\nCtrl+C to stop both services.", flush=True)
    while all(child.poll() is None for child in children):
        time.sleep(.5)
except KeyboardInterrupt:
    pass
finally:
    for child in children:
        if child.poll() is None:
            child.terminate()
    for child in children:
        try:
            child.wait(timeout=10)
        except subprocess.TimeoutExpired:
            child.kill()
