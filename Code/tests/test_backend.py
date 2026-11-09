"""Backend tests on synthetic data only. Each test gets its own temp DB and config copy."""
import json
import shutil

import pandas as pd
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError

from backend import db
from backend.api import create_app
from models import baseline
from tests.conftest import ROOT


@pytest.fixture
def env(tmp_path, feats):
    for name in ("weights.yaml", "workload.yaml"):
        shutil.copy(ROOT / "config" / name, tmp_path / name)
    cfg = baseline.load_config(tmp_path / "weights.yaml")
    est = baseline.score(feats, baseline.build_tables(feats, cfg), cfg)
    engine = db.make_engine(tmp_path / "estimates.db")
    result = db.init_db(engine, feats, est, cfg["version"])
    app = create_app(engine, tmp_path / "weights.yaml", tmp_path / "workload.yaml")
    return {"client": TestClient(app), "engine": engine, "feats": feats, "est": est,
            "init": result, "tmp": tmp_path}


def count(engine, where=None):
    q = select(func.count()).select_from(db.Estimate)
    if where is not None:
        q = q.where(where)
    with engine.connect() as c:
        return c.execute(q).scalar_one()


def all_estimates(engine):
    with engine.connect() as c:
        return pd.read_sql(select(db.Estimate).order_by(db.Estimate.id), c)


def open_claim(feats):
    return feats.loc[feats["Status"].isin(db.OPEN_STATUSES), "ClaimNum"].iloc[0]


# 1
def test_database_initialises(env):
    feats = env["feats"]
    assert env["init"]["claims"] == len(feats)
    assert env["init"]["estimates_imported"] == len(feats)
    with env["engine"].connect() as c:
        nums = [r[0] for r in c.execute(select(db.Claim.claim_num))]
        cols = {r[1] for r in c.execute(text("PRAGMA table_info(claims)"))}
    assert sorted(nums) == sorted(feats["ClaimNum"])                # one row per claim, zeros kept
    assert all(n.split()[-1].startswith("0") for n in nums if n.endswith(("00001", "00010")))
    assert not {c for c in cols if "description" in c or "claimant" in c or "birth" in c}


def test_missing_financials_distinct_from_zero(env):
    feats = env["feats"]
    nofin = feats.loc[~feats["has_financials"], "ClaimNum"].iloc[0]
    with env["engine"].connect() as c:
        row = c.execute(select(db.Claim).where(db.Claim.claim_num == nofin)).first()
    assert row.has_financials is False and row.total_incurred is None


# 2
def test_repeated_init_no_duplicates(env):
    before = count(env["engine"])
    again = db.init_db(env["engine"], env["feats"], env["est"], 1)
    assert again["estimates_imported"] == 0
    assert count(env["engine"]) == before


# 3, 4
def test_new_estimate_appends_and_history_unchanged(env):
    c, engine = env["client"], env["engine"]
    before = all_estimates(engine)
    cn = open_claim(env["feats"])
    r = c.post("/estimate", json={"claim_number": cn})
    assert r.status_code == 201
    body = r.json()
    assert body["claim_number"] == cn and body["estimate_id"] > before["id"].max()
    after = all_estimates(engine)
    assert len(after) == len(before) + 1
    pd.testing.assert_frame_equal(after.iloc[: len(before)].reset_index(drop=True), before)
    d = c.get(f"/claims/{cn}").json()
    assert d["latest_estimate"]["estimate_id"] == body["estimate_id"]
    assert len(d["history"]) == 1


def test_estimates_table_is_append_only(env):
    with pytest.raises(DBAPIError):
        with env["engine"].begin() as conn:
            conn.execute(text("UPDATE estimates SET complexity_score = 0"))
    with pytest.raises(DBAPIError):
        with env["engine"].begin() as conn:
            conn.execute(text("DELETE FROM estimates"))


def test_estimate_ignores_claims_own_outcome(env):
    svc = env["client"].app.state.service
    cn = open_claim(env["feats"])
    a = svc.compute([cn])
    svc.features.loc[cn, ["Total Incurred", "days_to_close"]] = [9e9, 9999]
    b = svc.compute([cn])
    for col in ["complexity_score", "cost_low", "cost_median", "cost_high", "cost_confidence"]:
        assert a[col].iat[0] == b[col].iat[0]


# 5
def test_pagination(env):
    c, n = env["client"], len(env["feats"])
    p1 = c.get("/claims", params={"page": 1, "page_size": 25}).json()
    p2 = c.get("/claims", params={"page": 2, "page_size": 25}).json()
    assert p1["pagination"] == {"page": 1, "page_size": 25, "total": n, "total_pages": -(-n // 25)}
    assert len(p1["items"]) == 25
    assert not {i["claim_number"] for i in p1["items"]} & {i["claim_number"] for i in p2["items"]}
    assert c.get("/claims", params={"page_size": 1000}).status_code == 422


# 6
def test_sorting_and_filtering(env):
    c, feats = env["client"], env["feats"]
    items = c.get("/claims", params={"sort_by": "complexity", "order": "desc", "page_size": 200}).json()["items"]
    scores = [i["complexity_score"] for i in items]
    assert scores == sorted(scores, reverse=True)
    items = c.get("/claims", params={"sort_by": "cost", "order": "asc", "page_size": 200}).json()["items"]
    costs = [i["cost_median"] for i in items]
    assert costs == sorted(costs)
    items = c.get("/claims", params={"sort_by": "injury_date", "order": "asc", "page_size": 200}).json()["items"]
    dates = [i["injury_date"] for i in items]
    assert dates == sorted(dates)
    for field, param, col in [("status", "status", "Status"), ("loss_type", "loss_type", "Loss Type"),
                              ("adjuster", "adjuster", "Adjuster"), ("employer", "employer", "Insured Name")]:
        val = feats[col].dropna().iloc[0]
        r = c.get("/claims", params={param: val, "page_size": 200}).json()
        assert r["pagination"]["total"] == int((feats[col] == val).sum())
        assert all(i[field] == val for i in r["items"])
    r = c.get("/claims", params={"search": "00012"}).json()
    assert [i["claim_number"] for i in r["items"]] == ["ClaimNum 00012"]


# 7, 16, 17
def test_claim_detail_has_separate_estimates(env):
    cn = env["feats"]["ClaimNum"].iloc[0]
    d = env["client"].get(f"/claims/{cn}").json()
    assert set(d["complexity"]) == {"score", "subscores", "reasons"}
    assert set(d["complexity"]["subscores"]) == {"duration", "medical_intensity", "time_loss", "legal"}
    assert len(d["complexity"]["reasons"]) == 3
    assert {"low", "median", "high", "confidence"} <= set(d["cost"])
    assert "score" not in d["cost"] and "median" not in d["complexity"]
    assert d["latest_estimate"]["estimated_at"]
    # bare number also works
    assert env["client"].get(f"/claims/{cn.split()[-1]}").status_code == 200


def test_scores_bounded_and_ranges_ordered(env):
    env["client"].post("/estimate/batch", json={"claim_numbers": list(env["feats"]["ClaimNum"][:50])})
    e = all_estimates(env["engine"])
    for col in ["complexity_score", "subscore_duration", "subscore_medical_intensity",
                "subscore_time_loss", "subscore_legal", "cost_confidence"]:
        assert e[col].between(0, 100).all(), col
    assert ((e["cost_low"] <= e["cost_median"]) & (e["cost_median"] <= e["cost_high"])).all()


# 8
def test_workload(env):
    c, feats, est = env["client"], env["feats"], env["est"]
    w = c.get("/workload").json()
    thr = w["thresholds"]["high_complexity_threshold"]["value"]
    assert w["thresholds"]["high_complexity_threshold"]["approved_by"] == "pending Penser"
    m = feats[["ClaimNum", "Status", "Adjuster"]].merge(est[["ClaimNum", "complexity_score"]], on="ClaimNum")
    m = m[m["Status"].isin(db.OPEN_STATUSES)]
    exp = m.dropna(subset=["Adjuster"]).groupby("Adjuster")["complexity_score"].agg(["size", "sum", "mean"])
    got = {r["adjuster"]: r for r in w["adjusters"] if not r["unassigned"]}
    assert set(got) == set(exp.index)
    for adj, row in exp.iterrows():
        g = got[adj]
        assert g["assigned_claims"] == row["size"]
        assert g["total_complexity"] == pytest.approx(row["sum"], abs=0.01)
        assert g["average_complexity"] == pytest.approx(row["mean"], abs=0.01)
        assert g["high_complexity_claims"] == int((m[m["Adjuster"] == adj]["complexity_score"] >= thr).sum())
    assert sum(r["assigned_claims"] for r in w["adjusters"]) == len(m)


# 9
def test_analytics_no_double_count(env, raw):
    c, feats = env["client"], env["feats"]
    a = c.get("/analytics", params={"group_by": "employer"}).json()
    fin = feats[feats["has_financials"]]
    assert sum(g["claim_count"] for g in a["groups"]) == len(feats)
    assert sum(g["total_incurred_to_date"] or 0 for g in a["groups"]) == pytest.approx(fin["Total Incurred"].sum())
    closed = fin[fin["is_closed"]]
    assert sum(g["total_final_cost"] or 0 for g in a["groups"]) == pytest.approx(closed["Total Incurred"].sum())
    # the raw fixture repeats claims across diary rows; summing raw rows would be larger
    raw_rows = pd.to_numeric(raw.loc[raw["ClaimNum"].isin(feats["ClaimNum"]), "Total Incurred"]).sum()
    assert raw_rows > fin["Total Incurred"].sum()
    for gb in ["tier_2", "loss_cause", "injury_year"]:
        r = c.get("/analytics", params={"group_by": gb}).json()
        assert sum(g["claim_count"] for g in r["groups"]) == len(feats)
    assert c.get("/analytics", params={"group_by": "adjuster_name"}).status_code == 422


# 10, 11, 19
def test_weight_change_changes_complexity_not_cost(env):
    c, engine = env["client"], env["engine"]
    before = all_estimates(engine)
    r = c.put("/weights", json={"duration": 0.7, "medical_intensity": 0.1, "time_loss": 0.1, "legal": 0.1})
    assert r.status_code == 200, r.text
    body = r.json()
    n_open = int(env["feats"]["Status"].isin(db.OPEN_STATUSES).sum())
    assert body["claims_recalculated"] == n_open
    s = body["settings"]
    assert s["version"] == 2
    assert s["complexity_weights"]["duration"]["value"] == pytest.approx(0.7)
    assert all(v["approved_by"] == "pending Penser" for v in s["complexity_weights"].values())
    after = all_estimates(engine)
    assert len(after) == len(before) + n_open
    pd.testing.assert_frame_equal(after.iloc[: len(before)].reset_index(drop=True), before)  # 19
    new = after[after["weights_version"] == 2].set_index("claim_num")
    old = before.set_index("claim_num").loc[new.index]
    assert not (new["complexity_score"].round(6) == old["complexity_score"].round(6)).all()
    for col in ["cost_low", "cost_median", "cost_high", "cost_confidence"]:
        assert (new[col].round(6) == old[col].round(6)).all(), col
    assert c.get("/weights").json()["version"] == 2
    assert baseline.load_config(env["tmp"] / "weights.yaml")["weights"]["duration"] == pytest.approx(0.7)


def test_weights_are_normalised(env):
    r = env["client"].put("/weights", json={"duration": 2, "medical_intensity": 1, "time_loss": 1, "legal": 0})
    w = r.json()["settings"]["complexity_weights"]
    assert sum(v["value"] for v in w.values()) == pytest.approx(1.0)
    assert w["duration"]["value"] == pytest.approx(0.5)


# 12
def test_inflation_updates_cost(env):
    c, engine = env["client"], env["engine"]
    before = all_estimates(engine).set_index("claim_num")
    r = c.put("/weights", json={"annual_inflation_rate": 0.05})
    assert r.status_code == 200, r.text
    assert r.json()["settings"]["annual_inflation_rate"]["value"] == 0.05
    assert r.json()["settings"]["annual_inflation_rate"]["approved_by"] == "pending Penser"
    new = all_estimates(engine)
    new = new[new["weights_version"] == 2].set_index("claim_num")
    old = before.loc[new.index]
    assert (new["cost_median"] >= old["cost_median"] - 1e-9).all()
    assert (new["cost_median"] > old["cost_median"]).any()


# 13
@pytest.mark.parametrize("payload", [
    {"duration": -0.1},
    {"duration": 0, "medical_intensity": 0, "time_loss": 0, "legal": 0},
    {"annual_inflation_rate": -0.01},
    {"annual_inflation_rate": 0.9},
    {"annual_inflation_rate": "abc"},
    {"range_percentile_low": 5},
    {},
])
def test_invalid_config_rejected(env, payload):
    c, engine = env["client"], env["engine"]
    before_yaml = (env["tmp"] / "weights.yaml").read_text()
    before_n = count(engine)
    r = c.put("/weights", json=payload)
    assert r.status_code == 422
    assert (env["tmp"] / "weights.yaml").read_text() == before_yaml
    assert count(engine) == before_n
    assert not list(env["tmp"].glob(".weights-*"))


def test_get_weights(env):
    w = env["client"].get("/weights").json()
    assert set(w["complexity_weights"]) == {"duration", "medical_intensity", "time_loss", "legal"}
    assert {"value", "source", "approved_by"} <= set(w["annual_inflation_rate"])
    assert w["cost_range_percentiles"]["low"]["value"] == 10
    assert w["version"] == 1
    assert w["limits"] == {"complexity_weight_min": 0.0, "annual_inflation_rate_min": 0.0,
                           "annual_inflation_rate_max": 0.25}


# 14, 15
def test_missing_claims(env):
    c = env["client"]
    assert c.get("/claims/ClaimNum 99999").status_code == 404
    assert c.post("/estimate", json={"claim_number": "ClaimNum 99999"}).status_code == 404
    good = env["feats"]["ClaimNum"].iloc[0]
    before = count(env["engine"])
    r = c.post("/estimate/batch", json={"claim_numbers": [good, "ClaimNum 99999", good]}).json()
    assert [x["claim_number"] for x in r["results"]] == [good]
    assert r["errors"] == [{"claim_number": "ClaimNum 99999", "error": "claim not found"}]
    assert count(env["engine"]) == before + 1


# 18
def test_no_descriptions_in_responses(env):
    c, feats = env["client"], env["feats"]
    cn = feats["ClaimNum"].iloc[0]
    bodies = [
        c.get("/claims", params={"page_size": 200}).text,
        c.get(f"/claims/{cn}").text,
        c.post("/estimate", json={"claim_number": cn}).text,
        c.post("/estimate/batch", json={"claim_numbers": [cn]}).text,
        c.get("/workload").text,
        c.get("/analytics").text,
        c.get("/weights").text,
    ]
    snippets = {d for d in feats["Accident Description"].dropna()} | {"Loss_Agent", "while lifting"}
    for b in bodies:
        json.loads(b)
        assert "Accident Description" not in b and "Claimant" not in b
        assert not any(s in b for s in snippets)


# ---------------------------------------------------------------- 2B read-only additions
NEW_W = {"duration": 0.7, "medical_intensity": 0.1, "time_loss": 0.1, "legal": 0.1}
PREVIEW_Q = {f"w_{k}": v for k, v in NEW_W.items()}


def test_workload_preview_matches_saved_result_and_writes_nothing(env):
    c, engine = env["client"], env["engine"]
    yaml_before = (env["tmp"] / "weights.yaml").read_text()
    n_before = count(engine)
    preview = c.get("/workload", params=PREVIEW_Q).json()
    assert preview["preview_weights"] == pytest.approx(NEW_W)
    assert count(engine) == n_before                                   # no estimate rows
    assert (env["tmp"] / "weights.yaml").read_text() == yaml_before   # no config change
    assert c.get("/workload").json()["preview_weights"] is None
    assert c.put("/weights", json=NEW_W).status_code == 200
    saved = c.get("/workload").json()
    key = lambda r: r["adjuster"] or ""
    for p, s in zip(sorted(preview["adjusters"], key=key), sorted(saved["adjusters"], key=key)):
        assert p["adjuster"] == s["adjuster"]
        assert p["total_complexity"] == pytest.approx(s["total_complexity"], abs=0.02)
        assert p["high_complexity_claims"] == s["high_complexity_claims"]
        assert p["workload_warning"] == s["workload_warning"]


def test_analytics_preview_uses_backend_formula(env):
    c, engine = env["client"], env["engine"]
    n_before = count(engine)
    a = c.get("/analytics", params={"group_by": "employer", **PREVIEW_Q}).json()
    assert count(engine) == n_before
    e = all_estimates(engine)
    feats = env["feats"][["ClaimNum", "Insured Name"]].rename(columns={"ClaimNum": "claim_num"})
    m = e.merge(feats, on="claim_num")
    s = sum(NEW_W[k] * m[f"subscore_{k}"] for k in NEW_W) / sum(NEW_W.values())
    exp = s.groupby(m["Insured Name"]).mean()
    got = {g["group"]: g for g in a["groups"]}
    for emp, v in exp.items():
        assert got[emp]["average_complexity"] == pytest.approx(v, abs=0.01)
        assert got[emp]["claims_with_estimates"] == int((m["Insured Name"] == emp).sum())
    # costs are identical with and without preview weights
    plain = {g["group"]: g for g in c.get("/analytics", params={"group_by": "employer"}).json()["groups"]}
    for k, g in got.items():
        for f in ["total_predicted_median_cost", "total_incurred_to_date", "total_final_cost"]:
            assert g[f] == plain[k][f]


@pytest.mark.parametrize("params", [
    {"w_duration": 1},
    {"w_duration": -1, "w_medical_intensity": 1, "w_time_loss": 1, "w_legal": 1},
    {"w_duration": 0, "w_medical_intensity": 0, "w_time_loss": 0, "w_legal": 0},
])
def test_invalid_preview_weights_rejected(env, params):
    assert env["client"].get("/workload", params=params).status_code == 422
    assert env["client"].get("/analytics", params=params).status_code == 422


def test_claims_multi_status_unassigned_and_subscores(env):
    c, feats = env["client"], env["feats"]
    active = feats["Status"].isin(db.OPEN_STATUSES)
    r = c.get("/claims", params={"status": ["Open", "Reopened"], "page_size": 200}).json()
    assert r["pagination"]["total"] == int(active.sum())
    assert {i["status"] for i in r["items"]} <= {"Open", "Reopened"}
    item = r["items"][0]
    assert set(item["subscores"]) == {"duration", "medical_intensity", "time_loss", "legal"}
    adj = feats.loc[active & feats["Adjuster"].notna(), "Adjuster"].iloc[0]
    r = c.get("/claims", params={"status": ["Open", "Reopened"], "adjuster": adj, "page_size": 200}).json()
    assert r["pagination"]["total"] == int((active & (feats["Adjuster"] == adj)).sum())
    r = c.get("/claims", params={"unassigned": "true", "page_size": 200}).json()
    assert r["pagination"]["total"] == int(feats["Adjuster"].isna().sum())
    assert all(i["adjuster"] is None for i in r["items"])


def test_filter_options(env):
    feats = env["feats"]
    f = env["client"].get("/filters").json()
    assert f["statuses"] == sorted(feats["Status"].dropna().unique())
    assert f["loss_types"] == sorted(feats["Loss Type"].dropna().unique())
    assert f["adjusters"] == sorted(feats["Adjuster"].dropna().unique())
    assert f["employers"] == sorted(feats["Insured Name"].dropna().unique())
    assert f["claims_without_adjuster"] == int(feats["Adjuster"].isna().sum())
    assert all(a.startswith("Adjuster 0") for a in f["adjusters"])        # zeros kept
    assert set(f) == {"statuses", "loss_types", "adjusters", "employers", "claims_without_adjuster"}
