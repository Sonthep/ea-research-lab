from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.core.config import settings
from app.db.session import engine
from app.api.routes import router
from app.api.discovery import router as discovery_router
from app.api.validation import router as validation_router

app = FastAPI(title="EA Research Lab", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=settings.api_cors_origins.split(","), allow_methods=["GET", "POST", "PATCH", "PUT"], allow_headers=["Content-Type"])
app.include_router(router)
app.include_router(discovery_router)
app.include_router(validation_router)


@app.get("/health")
def health():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
        connection.execute(text("SELECT id FROM optimization_runs LIMIT 1"))
    return {"status": "ok", "version": "0.1.0"}
