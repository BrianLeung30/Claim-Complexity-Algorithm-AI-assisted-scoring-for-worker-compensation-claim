import copy
import re

import numpy as np
import pandas as pd
import pytest
import yaml

from models import baseline
from pipeline import clean, features
from tests.conftest import IDENTIFIER, LEGIT_CODE, ROOT, SSN_FORMAT, TEST_MASKS


def _text_cols(df):
    return [c for c in df.columns if pd.api.types.is_object_dtype(df[c]) or pd.api.types.is_string_dtype(df[c])]


# ---------------------------------------------------------------- cleaning
def test_one_row_per_claim(raw, cleaned):
    claims, diary, dropped, rep, _ = cleaned
    assert raw["ClaimNum"].duplicated().any()  # fixture really has repeated rows
    assert claims["ClaimNum"].is_unique
    assert len(claims) == raw["ClaimNum"].nunique() - rep.test_claims_dropped


def test_test_claims_dropped(cleaned):
    claims, _, dropped, rep, _ = cleaned
    assert rep.test_claims_dropped == 1
    assert "ClaimNum 00005" in set(dropped["ClaimNum"])
    assert "ClaimNum 00005" not in set(claims["ClaimNum"])


def _desc(claims, n):
    return claims.loc[claims["ClaimNum"] == f"ClaimNum {n:05d}", "Accident Description"].iat[0]


def test_legitimate_long_codes_preserved(cleaned):
    claims, *_ = cleaned
    assert LEGIT_CODE in _desc(claims, 7)
    assert LEGIT_CODE in _desc(claims, 8)  # same cell as a masked identifier: only that run masked


def test_listed_identifier_masked(cleaned):
    claims, diary, _, rep, _ = cleaned
    assert rep.identifier_masks_applied == 1
    assert rep.identifier_masks_by_status == {"confirmed_identifying": 1}
    for df in (claims, diary):
        for c in _text_cols(df):
            assert not df[c].astype("string").str.contains(IDENTIFIER, regex=False, na=False).any(), c


def test_identifying_formats_masked(cleaned):
    claims, _, _, rep, _ = cleaned
    assert SSN_FORMAT not in _desc(claims, 10)
    assert rep.pattern_masks_applied.get("ssn_dashed") == 1


def test_unlisted_runs_listed_for_review_without_values(cleaned):
    *_, rep, review = cleaned
    assert set(review["ClaimNum"]) == {"ClaimNum 00007", "ClaimNum 00008"}
    assert rep.digit_runs_for_review == 2
    assert list(review.columns) == ["table", "ClaimNum", "column", "occurrence", "length"]


def test_mask_length_mismatch_stops(raw):
    bad = [dict(TEST_MASKS[0], length=9)]
    with pytest.raises(ValueError, match="length mismatch"):
        clean.clean(raw, bad, use_dictionary=False)


def _assert_no_values(entries):
    for e in entries:
        assert set(e) <= {"claim", "column", "occurrence", "length", "status", "note"}
        assert e["status"] in {"confirmed_identifying", "unresolved"}
        assert not re.search(r"\d{6,}", str(e.get("note", "")))


def test_tracked_masks_example_has_the_structure_but_no_entries():
    # The real list is claim-specific and local; the tracked example must never hold entries.
    assert clean.load_masks(clean.EXAMPLE_MASKS_PATH) == []
    text = clean.EXAMPLE_MASKS_PATH.read_text()
    assert yaml.safe_load(text) == {"masks": []}
    assert not re.search(r"\d{6,}", text)                        # no digit values, even in comments
    for key in ("claim:", "column:", "occurrence:", "length:", "status:", "note:"):
        assert key in text                                        # documents the entry format


def test_masks_load_from_a_local_file(tmp_path):
    path = tmp_path / "identifier_masks.yaml"
    path.write_text(yaml.safe_dump({"masks": TEST_MASKS}))
    entries = clean.load_masks(path)
    assert entries == TEST_MASKS
    _assert_no_values(entries)
    path.write_text(yaml.safe_dump({"masks": [{"claim": "ClaimNum 00008", "column": "Accident Description"}]}))
    with pytest.raises(ValueError, match="missing"):
        clean.load_masks(path)


def test_default_masks_path_is_local_and_gitignored():
    assert clean.DEFAULT_MASKS_PATH == ROOT / "data" / "identifier_masks.yaml"
    ignore = (ROOT / ".gitignore").read_text().splitlines()
    assert "data/" in ignore
    assert "config/identifier_masks.yaml" in ignore               # guards the old tracked location


def test_missing_local_masks_stop_with_setup_help(tmp_path):
    with pytest.raises(FileNotFoundError, match=r"data/identifier_masks\.yaml.*config/identifier_masks\.example\.yaml"):
        clean.load_masks(tmp_path / "identifier_masks.yaml")


def test_cli_clean_uses_the_given_local_masks(raw, tmp_path):
    from cli import main
    csv, masks, out = tmp_path / "raw.csv", tmp_path / "identifier_masks.yaml", tmp_path / "clean"
    raw.to_csv(csv, index=False)
    masks.write_text(yaml.safe_dump({"masks": TEST_MASKS}))
    main(["clean", "--raw", str(csv), "--clean-dir", str(out), "--masks", str(masks)])
    desc = pd.read_parquet(out / "claims.parquet").set_index("ClaimNum")["Accident Description"]
    assert not desc.str.contains(IDENTIFIER, regex=False, na=False).any()
    assert LEGIT_CODE in desc["ClaimNum 00008"]                   # only the listed run is masked


def test_cli_clean_stops_without_local_masks(raw, tmp_path, monkeypatch):
    from cli import main
    csv = tmp_path / "raw.csv"
    raw.to_csv(csv, index=False)
    monkeypatch.setattr(clean, "DEFAULT_MASKS_PATH", tmp_path / "missing.yaml")
    with pytest.raises(FileNotFoundError, match="identifier mask list not found"):
        main(["clean", "--raw", str(csv), "--clean-dir", str(tmp_path / "clean")])
    assert not (tmp_path / "clean" / "claims.parquet").exists()   # nothing written unmasked


def test_paid_buckets_sum_to_period_paid(cleaned):
    claims, *_ = cleaned
    fin = claims[claims["has_financials"]]
    total = fin[clean.PAID_COLS].sum(axis=1)
    assert np.allclose(total, fin["Period Paid"], atol=0.01)


def test_loss_agent_split_and_xy_merge(cleaned):
    claims, diary, *_ = cleaned
    assert claims["Loss Agent"].notna().all()
    assert not claims["Accident Description"].str.contains("Loss_Agent", na=False).any()
    assert not any(c.endswith(("_x", "_y")) for c in claims.columns)
    assert "Task Status" in diary.columns
    assert pd.api.types.is_datetime64_any_dtype(diary["Due Date"]) and diary["Due Date"].notna().all()


# ---------------------------------------------------------------- features
def test_features_have_no_diary_counts(feats):
    banned = re.compile(r"(task|diary|touch|activity).*(count|num|n_)|^n_", re.I)
    added = [c for c in feats.columns if c.islower()]
    assert not [c for c in added if banned.search(c)]


def test_feature_values(feats):
    assert feats["legal_flag"].any()
    assert (feats["prior_claims"] >= 0).all() and (feats["prior_claims"] > 0).any()
    assert feats.loc[~feats["is_closed"], "days_to_close"].isna().all()
    fin = feats[feats["has_financials"]]
    assert (fin["time_loss_flag"] == (fin["Indemnity Paid"] > 0)).all()


def test_feature_registry_is_pluggable(cleaned):
    claims, diary, *_ = cleaned

    def notes_stub(c, d):
        return pd.DataFrame({"ClaimNum": c["ClaimNum"], "notes_feature": 1})

    out = features.build_features(claims, diary, features.FEATURE_GROUPS + [notes_stub])
    assert "notes_feature" in out.columns and out["ClaimNum"].is_unique


# ---------------------------------------------------------------- baseline
def test_scores_within_bounds(feats, cfg):
    est = baseline.score(feats, baseline.build_tables(feats, cfg), cfg)
    assert len(est) == len(feats)
    for c in ["complexity_score", "cost_confidence"] + [c for c in est if c.startswith("subscore_")]:
        assert est[c].between(0, 100).all(), c
    assert est[["reason_1", "reason_2", "reason_3"]].notna().all().all()


def test_cost_range_ordered(feats, cfg):
    est = baseline.score(feats, baseline.build_tables(feats, cfg), cfg)
    assert (est["cost_low"] <= est["cost_median"]).all()
    assert (est["cost_median"] <= est["cost_high"]).all()


def test_weights_change_complexity_not_cost(feats, cfg):
    tables = baseline.build_tables(feats, cfg)
    a = baseline.score(feats, tables, cfg)
    cfg2 = copy.deepcopy(cfg)
    cfg2["weights"] = {"duration": 0.7, "medical_intensity": 0.1, "time_loss": 0.1, "legal": 0.1}
    b = baseline.score(feats, tables, cfg2)
    assert not np.allclose(a["complexity_score"], b["complexity_score"])
    for c in ["cost_low", "cost_median", "cost_high", "cost_confidence"]:
        assert np.allclose(a[c], b[c]), c


def test_fallback_to_coarser_group(feats, cfg):
    cfg2 = dict(cfg, min_n=10_000)
    est = baseline.score(feats, baseline.build_tables(feats, cfg2), cfg2)
    assert (est["group_level"] == "all claims").all()


def test_inflation_raises_cost(feats, cfg):
    base = baseline.build_tables(feats, cfg)
    infl = baseline.build_tables(feats, dict(cfg, inflation=0.05))
    assert (infl["cost_median"] >= base["cost_median"]).all()
    assert (infl["cost_median"] > base["cost_median"]).any()


def test_holdout_check_runs(feats, cfg):
    m = baseline.holdout_check(feats, dict(cfg, holdout_year=2025))
    assert m["test_closed_claims"] > 0
    assert 0 <= m["share_inside_range"] <= 1
    assert m["median_abs_error"] >= 0
