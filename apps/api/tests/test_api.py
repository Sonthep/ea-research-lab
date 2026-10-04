import json
from generate_sample import generate


def upload(client, content, metadata=None):
    return client.post("/api/import/mt5/xml", files={"file": ("export.xml",content,"application/xml")}, data={"metadata": json.dumps(metadata or {})})


def test_import_run_detail_candidate_flow(client, xml):
    res = upload(client,xml)
    assert res.status_code == 201, res.text
    run = res.json()
    assert run["result_count"] == 12
    assert run["ea_name"] == "HybridSMC"
    assert "InpOBLookback" in run["parameter_names"]
    assert client.get("/api/optimization-runs").json()["total"] == 1
    assert client.get(f'/api/optimization-runs/{run["id"]}').json()["deposit"] == 3000
    assert client.patch(f'/api/optimization-runs/{run["id"]}', json={"name":"Renamed"}).json()["name"] == "Renamed"
    rows = client.get("/api/results").json()["items"]
    result = rows[0]
    assert result["stable_set_id"].startswith("SET-")
    detail = client.get(f'/api/sets/{result["parameter_set_id"]}').json()
    assert detail["full_hash"] == result["full_hash"]
    assert client.post("/api/candidates",json={"result_ids":[result["id"]]}).json()["created"] == 1
    assert client.post("/api/candidates",json={"result_ids":[result["id"]]}).json()["created"] == 0
    candidates = client.get("/api/candidates").json()
    assert candidates["total"] == 1 and candidates["items"][0]["baseline"]["id"] == result["id"]
    candidate_id = candidates["items"][0]["id"]
    assert client.patch(f"/api/candidates/{candidate_id}",json={"notes":"Research", "tags":["shortlist"]}).status_code == 200
    assert client.get("/api/imports").json()["total"] == 1


def test_duplicate_and_parameter_reuse(client, xml):
    first = upload(client,xml)
    duplicate = upload(client,xml)
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"]["run_id"] == first.json()["id"]
    second = upload(client,xml.replace(b">1 minute OHLC<",b">Every tick<"))
    assert second.status_code == 201
    a = client.get("/api/results",params={"run_id":first.json()["id"], "sort":"id:asc"}).json()["items"][0]
    b = client.get("/api/results",params={"run_id":second.json()["id"], "sort":"id:asc"}).json()["items"][0]
    assert a["parameter_set_id"] == b["parameter_set_id"]
    assert a["full_hash"] == b["full_hash"]


def test_thousands_pagination_filter_sort(client):
    response = upload(client,generate(5000))
    assert response.status_code == 201, response.text
    first = client.get("/api/results",params={"page":1,"page_size":50}).json()
    last = client.get("/api/results",params={"page":100,"page_size":50}).json()
    assert first["total"] == 5000 and len(last["items"]) == 50
    assert not set(r["id"] for r in first["items"]) & set(r["id"] for r in last["items"])
    filters = [{"field":"equity_dd","op":"lte","value":10},{"field":"profit_factor","op":"gte","value":2},{"field":"trades","op":"gte","value":100},{"field":"profit","op":"gt","value":0}]
    filtered = client.get("/api/results",params={"filters":json.dumps(filters),"sort":"equity_dd:asc,profit:desc", "page_size":200}).json()
    rows = filtered["items"]
    assert len(rows) == 200 and filtered["total"] > 200
    assert all(r["equity_dd"] <= 10 and r["profit_factor"] >= 2 and r["trades"] >= 100 and r["profit"] > 0 for r in rows)
    assert [(r["equity_dd"], -r["profit"]) for r in rows] == sorted((r["equity_dd"], -r["profit"]) for r in rows)


def test_profit_percentage_and_search(client,xml):
    upload(client,xml)
    r = client.get("/api/results",params={"sort":"id:asc"}).json()["items"][0]
    assert round(r["profit_pct"],2) == 46.29
    assert client.get("/api/results",params={"search":r["stable_set_id"]}).json()["total"] == 1
    assert client.get("/api/results",params={"search":"%"}).json()["total"] == 0
    assert client.get("/api/results",params={"filters":json.dumps([{"field":"profit_pct","op":"gt","value":40}])}).status_code == 200


def test_atomic_failure_and_bad_requests(client,xml):
    assert upload(client,xml.replace(b">1388.66<",b">NaN<",1)).status_code == 422
    assert client.get("/api/optimization-runs").json()["total"] == 0
    assert client.get("/api/imports").json()["total"] == 0
    assert upload(client,b"<broken>").status_code == 422
    assert upload(client,xml,{"deposit":-1}).status_code == 422
    assert client.get("/api/results",params={"sort":"profit;DROP:asc"}).status_code == 422
    assert client.get("/api/results",params={"filters":"{}"}).status_code == 422
    assert client.get("/api/results",params={"page_size":1000}).status_code == 422
    assert client.get("/api/sets/999999").status_code == 404
    assert client.post("/api/candidates",json={"result_ids":[999]}).status_code == 404
    assert client.post("/api/candidates",json={"result_ids":[]}).status_code == 422


def test_filename_and_override(client,xml):
    res = client.post("/api/import/mt5/xml",files={"file":("../../evil.xml",xml)},data={"metadata":json.dumps({"symbol":"EURUSD","name":"Manual run"})})
    assert res.status_code == 201, res.text
    assert res.json()["source_filename"] == "evil.xml"
    assert res.json()["symbol"] == "EURUSD"
    assert res.json()["name"] == "Manual run"


def test_size_limit(client,monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings,"max_upload_mb",0)
    assert upload(client,b"<Workbook />").status_code == 413
