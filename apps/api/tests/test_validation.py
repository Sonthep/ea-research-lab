import json
import pytest
from generate_sample import generate

OOS = {"period_from": "2026-10-05", "period_to": "2026-12-31"}


def make_candidate(client, count=120):
    run = client.post("/api/import/mt5/xml", files={"file": ("v.xml", generate(count))}, data={"metadata": "{}"}).json()
    items = client.post("/api/discovery/preview", json={"run_id": run["id"], "top_count": 10}).json()["items"]
    body = {"run_id": run["id"], "top_count": 10, "result_ids": [items[0]["id"]]}
    assert client.post("/api/discovery/promote", json=body).status_code == 201
    return client.get("/api/candidates").json()["items"][0]


def metrics(base, factor=1.0, **over):
    data = {"profit": base["profit"] * factor, "equity_dd": base["equity_dd"], "profit_factor": max(base["profit_factor"], 2),
            "recovery_factor": base["recovery_factor"], "sharpe": base["sharpe"], "trades": base["trades"], "win_rate": 55}
    return {**data, **over}


def submit(client, cid, stage, body, status=201):
    response = client.post(f"/api/candidates/{cid}/validation/{stage}", json=body)
    assert response.status_code == status, response.text
    return response.json()


def stage(client, cid, key):
    return next(s for s in client.get(f"/api/candidates/{cid}").json()["pipeline"] if s["key"] == key)


def test_fresh_candidate_is_discovered_not_validated(client):
    c = make_candidate(client)
    detail = client.get(f"/api/candidates/{c['id']}").json()
    statuses = {s["key"]: s["status"] for s in detail["pipeline"]}
    assert statuses["discovery"] == "PASSED" and statuses["filter"] == "PASSED"
    assert all(v == "NOT_TESTED" for k, v in statuses.items() if k not in ("discovery", "filter"))
    assert detail["overall_status"] == "DISCOVERED" and detail["validation_status"] == "NOT_TESTED"
    assert "slippage" not in statuses and detail["validation_method"] == "Every tick based on real ticks"
    assert detail["run"]["result_count"] == 120 and detail["records"] == []


def test_real_tick_degradation_is_evidence_not_automatic_failure(client):
    c = make_candidate(client)
    b = c["baseline"]
    good = submit(client, c["id"], "real_tick", {"metrics": metrics(b, 0.95)})
    assert good["status"] == "PASSED" and good["settings"]["delay_ms"] == 0 and good["settings"]["optimization"] == "Disabled"
    assert good["baseline_source"] == "discovery" and good["comparison"]["deltas"]["profit"]["degradation_pct"] == pytest.approx(5)
    one = submit(client, c["id"], "real_tick", {"label": "weak", "metrics": metrics(b, 0.5)})
    assert one["status"] == "WARNING"
    assert [w["code"] for w in one["comparison"]["warnings"]] == ["PROFIT_DEGRADATION"]
    many = submit(client, c["id"], "real_tick", {"label": "bad", "metrics": metrics(b, 0.5, equity_dd=b["equity_dd"] * 3, profit_factor=1.1)})
    assert many["status"] == "FAILED" and len(many["comparison"]["warnings"]) >= 3
    loss = submit(client, c["id"], "real_tick", {"label": "loss", "metrics": metrics(b, -1, profit_factor=2)})
    assert loss["status"] == "FAILED"
    assert stage(client, c["id"], "real_tick")["status"] == "FAILED"


def test_trade_change_and_override(client):
    c = make_candidate(client)
    b = c["baseline"]
    r = submit(client, c["id"], "real_tick", {"metrics": metrics(b, 1, trades=int(b["trades"] * 2))})
    assert r["status"] == "WARNING" and r["comparison"]["warnings"][0]["code"] == "TRADE_COUNT_CHANGE"
    r = submit(client, c["id"], "real_tick", {"label": "manual", "status": "PASSED", "metrics": metrics(b, 1, trades=int(b["trades"] * 2))})
    assert r["status"] == "PASSED" and r["status_overridden"] is True


def test_stress_requires_real_tick_and_compares_side_by_side(client):
    c = make_candidate(client)
    b = c["baseline"]
    submit(client, c["id"], "latency", {"metrics": metrics(b), "settings": {"delay_ms": 29}}, 422)
    submit(client, c["id"], "real_tick", {"metrics": metrics(b, 0.9)})
    submit(client, c["id"], "latency", {"metrics": metrics(b), "settings": {}}, 422)
    lat = submit(client, c["id"], "latency", {"metrics": metrics(b, 0.85), "settings": {"delay_ms": 29}})
    assert lat["label"] == "29 ms" and lat["baseline_source"] == "real_tick" and lat["status"] == "PASSED"
    running = submit(client, c["id"], "random_delay", {"status": "RUNNING", "settings": {"delay_min_ms": 20, "delay_max_ms": 50}})
    assert running["status"] == "RUNNING" and running["metrics"] == {}
    assert stage(client, c["id"], "random_delay")["status"] == "RUNNING"
    submit(client, c["id"], "random_delay", {"metrics": metrics(b, 0.8), "settings": {"delay_min_ms": 50, "delay_max_ms": 20}}, 422)
    submit(client, c["id"], "slippage", {"metrics": metrics(b, 0.8), "settings": {"slippage_points": 3}})
    assert stage(client, c["id"], "slippage")["status"] in ("PASSED", "WARNING")


def test_oos_forward_and_validation(client):
    c = make_candidate(client)
    b = c["baseline"]
    submit(client, c["id"], "oos", {"metrics": metrics(b), "settings": {"period_from": "2026-08-01", "period_to": "2026-12-31"}}, 422)
    submit(client, c["id"], "oos", {"metrics": metrics(b), "settings": {}}, 422)
    oos = submit(client, c["id"], "oos", {"metrics": metrics(b, 0.9), "settings": OOS})
    assert oos["evidence"]["in_sample"]["from"] == "2026.07.01" and oos["evidence"]["out_of_sample"]["from"] == "2026-10-05"
    assert oos["comparison"]["deltas"]["trades"].get("abs_change_pct") is None
    fw = submit(client, c["id"], "forward", {"metrics": metrics(b, 0.9), "settings": {"forward_index": "1/3"}})
    assert fw["label"] == "Forward 1/3"
    submit(client, c["id"], "forward", {"metrics": metrics(b), "settings": {"forward_index": "4/3"}}, 422)
    submit(client, c["id"], "nonsense", {"metrics": metrics(b)}, 404)
    submit(client, 9999, "oos", {"metrics": metrics(b), "settings": OOS}, 404)
    submit(client, c["id"], "oos", {"settings": OOS}, 422)


def points(values, good):
    return [{"x": v, "profit": 100 if v in good else -5, "equity_dd": 5, "profit_factor": 2 if v in good else 0.8, "trades": 120} for v in values]


def test_parameter_plateau_and_sensitivity(client):
    c = make_candidate(client)
    center = float(client.get(f"/api/candidates/{c['id']}").json()["parameters"]["InpSwingLookback"])
    values = [center - 2, center - 1, center, center + 1, center + 2]
    plateau = submit(client, c["id"], "robustness", {"parameter": "InpSwingLookback", "points": points(values, set(values))})
    assert plateau["status"] == "PASSED" and plateau["evidence"]["classification"] == "PARAMETER_PLATEAU"
    sens = submit(client, c["id"], "robustness", {"parameter": "InpSwingLookback", "points": points(values, {center})})
    assert sens["status"] == "WARNING" and sens["evidence"]["classification"] == "PARAMETER_SENSITIVITY"
    assert "overfitting" in sens["comparison"]["warnings"][0]["message"]
    submit(client, c["id"], "robustness", {"parameter": "InpSwingLookback", "points": points([1, 2, 3], {1})}, 422)
    submit(client, c["id"], "robustness", {"parameter": "Missing", "points": points(values, set(values))}, 422)
    cy = float(client.get(f"/api/candidates/{c['id']}").json()["parameters"]["InpMinRR"])
    heat = [{"x": center + i, "y": cy + j, "profit": 10, "equity_dd": 4, "profit_factor": 2, "trades": 100} for i in (-1, 0, 1) for j in (-1, 0, 1)]
    submit(client, c["id"], "robustness", {"parameter": "InpSwingLookback", "parameter_y": "InpMinRR", "points": heat})
    submit(client, c["id"], "robustness", {"parameter": "InpSwingLookback", "parameter_y": "InpMinRR", "points": points(values, set(values))}, 422)


def test_long_period_regimes(client):
    c = make_candidate(client)
    b = c["baseline"]
    long = {"period_from": "2020-01-01", "period_to": "2026-06-30"}
    weak = {"range": metrics(b, 0.1, profit=-10, profit_factor=0.8), "trend": metrics(b)}
    r = submit(client, c["id"], "long_period", {"metrics": metrics(b), "settings": long, "regimes": weak})
    assert r["status"] == "WARNING" and r["comparison"]["warnings"][0]["code"] == "REGIME_WEAK"
    assert set(r["evidence"]["regimes"]) == {"range", "trend"}


def test_live_candidate_only_after_required_stages_and_funnel(client):
    c = make_candidate(client)
    cid, b = c["id"], c["baseline"]
    plan = [("real_tick", {}), ("latency", {"delay_ms": 29}), ("random_delay", {"delay_min_ms": 20, "delay_max_ms": 50}), ("oos", OOS),
            ("forward", {"forward_index": "1/3"}), ("long_period", {"period_from": "2020-01-01", "period_to": "2026-06-30"}),
            ("demo", {"period_from": "2026-10-01", "period_to": "2026-10-20"})]
    center = float(client.get(f"/api/candidates/{cid}").json()["parameters"]["InpSwingLookback"])
    values = [center - 1, center, center + 1]
    for key, settings in plan:
        assert client.get(f"/api/candidates/{cid}").json()["overall_status"] in ("DISCOVERED", "VALIDATING")
        submit(client, cid, key, {"metrics": metrics(b, 0.95), "settings": settings})
        if key == "real_tick":
            assert client.get(f"/api/candidates/{cid}").json()["overall_status"] == "VALIDATING"
    assert client.get(f"/api/candidates/{cid}").json()["overall_status"] == "VALIDATING"  # robustness still missing
    submit(client, cid, "robustness", {"parameter": "InpSwingLookback", "points": points(values, set(values))})
    detail = client.get(f"/api/candidates/{cid}").json()
    assert detail["overall_status"] == "LIVE_CANDIDATE" and detail["validation_status"] == "LIVE_CANDIDATE"
    funnel = {s["key"]: s["count"] for s in client.get("/api/dashboard").json()["funnel"]}
    assert funnel["results"] == 120 and funnel["candidates"] == 1 and funnel["live"] == 1
    counts = {s["key"]: s for s in client.get("/api/dashboard").json()["stage_counts"]}
    assert counts["discovery"]["PASSED"] == 1 and counts["real_tick"]["PASSED"] == 1 and counts["cross_broker"]["NOT_TESTED"] == 1 and "slippage" not in counts
    assert [funnel[k] for k in ("real_tick", "stress", "oos", "forward", "robustness", "long_period", "demo")] == [1] * 7
    rules = client.get("/api/validation/config").json()["rules"]
    client.put("/api/validation/config", json={**rules, "required_stages": ["real_tick", "latency", "random_delay", "oos", "forward", "robustness", "long_period", "demo", "cross_broker"]})
    assert client.get(f"/api/candidates/{cid}").json()["overall_status"] == "VALIDATING"


def test_failed_required_stage_and_configurable_thresholds(client):
    c = make_candidate(client)
    cid, b = c["id"], c["baseline"]
    assert submit(client, cid, "real_tick", {"metrics": metrics(b, 0.5)})["status"] == "WARNING"
    rules = client.get("/api/validation/config").json()["rules"]
    assert rules["profit_degradation_pct"] == 30 and rules["drawdown_multiple"] == 2 and rules["min_profit_factor"] == 1.5 and rules["trade_change_pct"] == 25
    assert client.put("/api/validation/config", json={**rules, "profit_degradation_pct": 80}).status_code == 200
    assert submit(client, cid, "real_tick", {"label": "relaxed", "metrics": metrics(b, 0.5)})["status"] == "PASSED"
    assert client.put("/api/validation/config", json={**rules, "fail_warning_count": 9}).status_code == 422
    assert client.put("/api/validation/config", json={**rules, "unknown": 1}).status_code == 422
    submit(client, cid, "oos", {"metrics": metrics(b, -1), "settings": OOS})
    assert client.get(f"/api/candidates/{cid}").json()["overall_status"] == "FAILED"
    assert json.dumps(client.get("/api/dashboard").json()["funnel"])
