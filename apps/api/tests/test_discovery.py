import json
import xml.etree.ElementTree as ET
from generate_sample import generate, SS


def import_run(client, count=120, suffix="", metadata=None):
    response = client.post("/api/import/mt5/xml", files={"file": ("discovery.xml", generate(count, suffix))},
                           data={"metadata": json.dumps(metadata or {})})
    assert response.status_code == 201, response.text
    return response.json()


def preview(client, run_id, **overrides):
    response = client.post("/api/discovery/preview", json={"run_id": run_id, **overrides})
    assert response.status_code == 200, response.text
    return response.json()


def test_discovery_filters_top_count_and_actual_method(client):
    run = import_run(client, 5000)
    data = preview(client, run["id"], top_count=30)
    assert data["total_results"] == 5000 and data["qualifying_sets"] > 30
    assert len(data["items"]) == 30 and data["validation_status"] == "NOT_TESTED"
    assert len({r["full_hash"] for r in data["items"]}) == 30
    assert all(r["equity_dd"] <= 10 and r["profit_factor"] >= 2 and r["trades"] >= 100 and r["profit"] > 0 for r in data["items"])
    keys = [(-r["profit_factor"], -r["recovery_factor"], r["equity_dd"], -r["trades"], -r["result"], -r["profit"], r["id"]) for r in data["items"]]
    assert keys == sorted(keys)
    assert data["settings"]["criterion"] == "Custom max"  # Never replace actual settings with recommendations.
    assert data["settings_warnings"]
    assert client.get("/api/candidates").json()["total"] == 0  # Preview has no side effects.
    stats = client.get("/api/dashboard").json()
    assert stats["initial_filter_results"] == data["qualifying_results"]
    assert stats["initial_filter_sets"] == data["qualifying_sets"]


def test_promotion_snapshots_and_idempotency(client):
    run = import_run(client, 500)
    settings = client.get("/api/discovery/configuration").json()["recommended"]
    assert client.patch(f'/api/discovery/runs/{run["id"]}/settings', json=settings).status_code == 200
    data = preview(client, run["id"], top_count=10)
    assert not data["settings_warnings"]
    body = {"run_id": run["id"], "top_count": 10, "result_ids": [r["id"] for r in data["items"]]}
    promoted = client.post("/api/discovery/promote", json=body)
    assert promoted.status_code == 201, promoted.text
    assert promoted.json()["created"] == 10
    assert client.post("/api/discovery/promote", json=body).json()["created"] == 0
    assert client.get("/api/discovery/batches").json()["total"] == 1
    client.patch(f'/api/discovery/runs/{run["id"]}/settings', json={"modelling_method": "Every tick"})
    candidates = client.get("/api/candidates").json()["items"]
    assert len(candidates) == 10
    for candidate in candidates:
        assert candidate["validation_status"] == "NOT_TESTED"
        assert candidate["discovery_method"]["modelling_method"] == "1 minute OHLC"
        assert candidate["discovery_evidence"]["batch_id"] == promoted.json()["batch_id"]
        assert candidate["discovery_evidence"]["rank"] in range(1, 11)
    batch = client.get("/api/discovery/batches", params={"run_id": run["id"]}).json()["items"][0]
    assert batch["policy"]["max_equity_dd"] == 10 and len(batch["selected_results"]) == 10


def test_run_scope_invalid_selection_and_bounds(client):
    first, second = import_run(client, 120, "one"), import_run(client, 120, "two")
    wrong_id = preview(client, second["id"])["items"][0]["id"]
    response = client.post("/api/discovery/promote", json={"run_id": first["id"], "result_ids": [wrong_id]})
    assert response.status_code == 422
    assert client.get("/api/candidates").json()["total"] == 0
    assert client.get("/api/discovery/batches").json()["total"] == 0
    for top_count in (0, -1, 51, 1000):
        assert client.post("/api/discovery/preview", json={"run_id": first["id"], "top_count": top_count}).status_code == 422
    assert client.post("/api/discovery/preview", json={"run_id": 99999}).status_code == 404
    assert client.post("/api/discovery/preview", json={"run_id": first["id"], "policy": {"min_trades": 1.5}}).status_code == 422


def test_optional_filters_and_no_matches(client):
    run = import_run(client)
    data = preview(client, run["id"], policy={"min_recovery": 3, "min_sharpe": 1, "min_expected_payoff": 1, "min_result": 1})
    assert all(r["recovery_factor"] >= 3 and r["sharpe"] >= 1 and r["expected_payoff"] >= 1 and r["result"] >= 1 for r in data["items"])
    empty = preview(client, run["id"], policy={"min_profit_factor": 10000})
    assert empty["qualifying_sets"] == 0 and empty["items"] == [] and empty["status"] == "NO_MATCHES"
    assert client.post("/api/discovery/promote", json={"run_id": run["id"], "result_ids": []}).status_code == 422


def test_existing_candidates_keep_baseline_and_selection_outside_top_is_rejected(client):
    first = import_run(client, 500, "first")
    original = preview(client, first["id"], top_count=10)["items"][0]
    assert client.post("/api/candidates", json={"result_ids": [original["id"]]}).json()["created"] == 1
    candidate = client.get("/api/candidates").json()["items"][0]
    client.patch(f'/api/candidates/{candidate["id"]}', json={"notes": "Keep my baseline", "tags": ["original"]})
    second = import_run(client, 500, "second")
    top = preview(client, second["id"], top_count=10)
    same = next(r for r in top["items"] if r["parameter_set_id"] == original["parameter_set_id"])
    response = client.post("/api/discovery/promote", json={"run_id": second["id"], "top_count": 10, "result_ids": [same["id"]]})
    assert response.status_code == 201 and response.json()["already_candidates"] == 1
    saved = client.get("/api/candidates").json()["items"][0]
    assert saved["baseline"]["id"] == original["id"] and saved["notes"] == "Keep my baseline"
    assert saved["tags"] == ["original"] and saved["discovery_evidence"] is None
    assert client.get("/api/discovery/batches").json()["total"] == 0
    outside = preview(client, second["id"], top_count=30)["items"][-1]["id"]
    assert outside not in [r["id"] for r in top["items"]]
    assert client.post("/api/discovery/promote", json={"run_id": second["id"], "top_count": 10, "result_ids": [outside]}).status_code == 422


def test_duplicate_passes_missing_metrics_and_boundary(client):
    # Explicit boundary evidence and a duplicate configuration with a weaker PF.
    root = ET.fromstring(generate(1))
    table = root.find(f".//{{{SS}}}Table")
    row = table.findall(f"{{{SS}}}Row")[-1]
    values = row.findall(f"{{{SS}}}Cell/{{{SS}}}Data")
    values[4].text, values[8].text, values[9].text = "2", "10", "100"
    duplicate = ET.fromstring(ET.tostring(row))
    duplicate.findall(f"{{{SS}}}Cell/{{{SS}}}Data")[0].text = "999"
    table.append(duplicate)
    missing = ET.fromstring(ET.tostring(row))
    missing_values = missing.findall(f"{{{SS}}}Cell/{{{SS}}}Data")
    missing_values[4].text, missing_values[15].text = "", "999"
    table.append(missing)
    response = client.post("/api/import/mt5/xml", files={"file": ("boundary.xml", ET.tostring(root))})
    assert response.status_code == 201, response.text
    data = preview(client, response.json()["id"])
    assert data["qualifying_results"] == 2 and data["qualifying_sets"] == 1
    assert len(data["items"]) == 1 and data["items"][0]["mt5_pass"] == "1"
    promoted = client.post("/api/discovery/promote", json={"run_id": response.json()["id"], "result_ids": [data["items"][0]["id"]]})
    assert promoted.status_code == 201 and promoted.json()["created"] == 1  # Do not pad a small valid shortlist.


def test_discovery_ranking_objectives_and_pass_search(client):
    run = import_run(client, 100)
    profit_data = preview(client, run["id"], top_count=5, ranking_objective="max_profit")
    assert profit_data["ranking_objective"] == "max_profit"
    profits = [r["profit"] for r in profit_data["items"]]
    assert profits == sorted(profits, reverse=True)

    first_pass = profit_data["items"][0]["mt5_pass"]
    search_data = preview(client, run["id"], top_count=5, pass_search=first_pass)
    assert any(r["mt5_pass"] == first_pass for r in search_data["items"])

