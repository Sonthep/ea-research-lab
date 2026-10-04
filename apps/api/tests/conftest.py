from pathlib import Path
import sys
import os
import uuid
import pytest
from sqlalchemy import create_engine, text, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from app.db.session import Base, get_db
from app.main import app

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
from generate_sample import generate


@pytest.fixture
def xml():
    return generate(12)


@pytest.fixture
def client():
    url = os.environ.get("TEST_DATABASE_URL")
    schema = "test_" + uuid.uuid4().hex
    admin_engine = None
    if url:
        admin_engine = create_engine(url)
        with admin_engine.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        engine = create_engine(url, connect_args={"options": f"-csearch_path={schema}"})
    else:
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        @event.listens_for(engine, "connect")
        def foreign_keys(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")
    Base.metadata.create_all(engine)
    sessions = sessionmaker(engine)
    def override():
        with sessions() as db:
            yield db
    app.dependency_overrides[get_db] = override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    engine.dispose()
    if admin_engine:
        with admin_engine.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin_engine.dispose()
