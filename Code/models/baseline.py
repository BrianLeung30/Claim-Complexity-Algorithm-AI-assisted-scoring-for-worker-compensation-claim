"""Lookup-table baselines keyed on intake information.

Two separate estimates per claim, never combined:
  * cost: median Total Incurred of closed claims in the claim's intake group, a
    percentile range, and a 0-100 confidence;
  * complexity: weighted average of four 0-100 sub-scores (duration, medical intensity,
    time loss, legal), with weights read from config/weights.yaml at scoring time.

Groups are (Loss Type, Loss Cause, Loss Nature). A claim uses the finest group with at least
``min_group_closed_claims`` closed claims, falling back to (Loss Type, Loss Cause), then
(Loss Type), then all claims.
"""
from __future__ import annotations

import json
import logging
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
import yaml

log = logging.getLogger(__name__)

KEY_COLS = ["Loss Type", "Loss Cause", "Loss Nature"]
LEVELS: list[list[str]] = [KEY_COLS, KEY_COLS[:2], KEY_COLS[:1], []]
LEVEL_NAMES = ["type+cause+nature", "type+cause", "type", "all claims"]
UNKNOWN = "Unknown"

SUBSCORES = {
    # name: (table stat column, high phrase, mid phrase, low phrase)
    "duration": ("dur_median_days", "long time to close", "typical time to close", "short time to close"),
    "medical_intensity": ("medical_median", "high medical costs", "typical medical costs", "low medical costs"),
    "time_loss": ("time_loss_share", "often involves time loss", "sometimes involves time loss", "rarely involves time loss"),
    "legal": ("legal_share", "frequent legal involvement", "some legal involvement", "rare legal involvement"),
}


# ----------------------------------------------------------------------------- config
def load_config(path: str | Path = "config/weights.yaml") -> dict:
    return config_from_dict(yaml.safe_load(Path(path).read_text()))


def config_from_dict(raw: dict) -> dict:
    """Flatten the weights.yaml structure into the values scoring needs."""

    def val(section: str, key: str):
        entry = raw[section][key]
        missing = {"value", "source", "approved_by"} - set(entry)
        if missing:
            raise ValueError(f"{section}.{key} missing fields {sorted(missing)}")
        return entry["value"]

    as_of = val("cost", "as_of_year") or date.today().year
    return {
        "version": int(raw.get("version") or 1),
        "weights": {k: float(val("complexity_weights", k)) for k in SUBSCORES},
        "inflation": float(val("cost", "annual_inflation_rate")),
        "as_of_year": int(as_of),
        "p_low": float(val("cost", "range_percentile_low")),
        "p_high": float(val("cost", "range_percentile_high")),
        "min_n": int(val("baseline", "min_group_closed_claims")),
        "holdout_year": int(val("baseline", "holdout_injury_year")),
        "conf_size_w": float(val("confidence", "size_weight")),
        "conf_spread_w": float(val("confidence", "spread_weight")),
        "conf_full_n": float(val("confidence", "full_confidence_n")),
    }


# ----------------------------------------------------------------------------- helpers
def _keys(df: pd.DataFrame) -> pd.DataFrame:
    return df[KEY_COLS].astype("string").fillna(UNKNOWN)


def _key_string(keys: pd.DataFrame, cols: list[str]) -> pd.Series:
    if not cols:
        return pd.Series("ALL", index=keys.index)
    return keys[cols].agg(" | ".join, axis=1)


def inflation_factor(injury_year: pd.Series, rate: float, as_of_year: int) -> pd.Series:
    years = (as_of_year - injury_year.astype(float)).clip(lower=0).fillna(0)
    return (1.0 + rate) ** years


def percentile_of(values: pd.Series, reference: np.ndarray) -> pd.Series:
    """Mid-rank percentile (0-100) of each value within the reference distribution."""
    ref = np.sort(reference[~np.isnan(reference)])
    v = values.to_numpy(dtype=float)
    lo = np.searchsorted(ref, v, side="left")
    hi = np.searchsorted(ref, v, side="right")
    pct = 100.0 * (lo + 0.5 * (hi - lo)) / max(len(ref), 1)
    pct = np.where(np.isnan(v), 50.0, pct)
    return pd.Series(np.clip(pct, 0, 100), index=values.index)


def reference_claims(feats: pd.DataFrame) -> pd.DataFrame:
    """Closed claims with known final cost: the anchors for every baseline table."""
    m = feats["is_closed"] & feats["has_financials"] & feats["Total Incurred"].notna()
    return feats.loc[m]


# ----------------------------------------------------------------------------- build
def build_tables(feats: pd.DataFrame, cfg: dict) -> pd.DataFrame:
    """Build per-group stats from closed claims. ``feats`` should already be the training set."""
    ref = reference_claims(feats).copy()
    if ref.empty:
        raise ValueError("no closed claims with financials to build baseline tables from")
    f = inflation_factor(ref["injury_year"], cfg["inflation"], cfg["as_of_year"])
    ref["cost_adj"] = ref["Total Incurred"] * f
    ref["medical_adj"] = ref["Medical Paid"] * f
    ref["time_loss"] = (ref["Indemnity Paid"] > 0).astype(float)
    ref["legal"] = ref["legal_flag"].astype(float)
    keys = _keys(ref)
    ref[KEY_COLS] = keys

    parts = []
    for lvl, cols in enumerate(LEVELS):
        g = ref.groupby(cols if cols else (lambda _: "ALL"), dropna=False)
        t = pd.DataFrame({
            "n": g.size(),
            "cost_median": g["cost_adj"].median(),
            "cost_low": g["cost_adj"].quantile(cfg["p_low"] / 100),
            "cost_high": g["cost_adj"].quantile(cfg["p_high"] / 100),
            "dur_median_days": g["days_to_close"].median(),
            "medical_median": g["medical_adj"].median(),
            "time_loss_share": g["time_loss"].mean(),
            "legal_share": g["legal"].mean(),
        }).reset_index()
        if not cols:
            t = t.drop(columns=[c for c in t.columns if c == "index"])
        t["level"] = lvl
        t["level_name"] = LEVEL_NAMES[lvl]
        for c in KEY_COLS:
            if c not in t.columns:
                t[c] = pd.NA
        t["group_key"] = _key_string(t.fillna({c: UNKNOWN for c in KEY_COLS}), cols)
        if cols:  # the all-claims level is always kept as the last fallback
            t = t[t["n"] >= cfg["min_n"]]
        parts.append(t)
    tables = pd.concat(parts, ignore_index=True)

    # sub-scores: each group's stat as a percentile across all eligible groups
    for name, (stat, *_rest) in SUBSCORES.items():
        tables[f"subscore_{name}"] = percentile_of(tables[stat], tables[stat].to_numpy(dtype=float))

    # cost confidence from group size and spread
    size = np.minimum(1.0, np.log(tables["n"].clip(lower=1)) / np.log(cfg["conf_full_n"]))
    denom = (tables["cost_high"] + tables["cost_low"]).where(lambda s: s > 0)
    spread = (1 - (tables["cost_high"] - tables["cost_low"]) / denom).clip(0, 1).fillna(0)
    w = cfg["conf_size_w"] + cfg["conf_spread_w"]
    tables["cost_confidence"] = (100 * (cfg["conf_size_w"] * size + cfg["conf_spread_w"] * spread) / w).clip(0, 100)
    tables["inflation_rate"] = cfg["inflation"]
    tables["as_of_year"] = cfg["as_of_year"]
    return tables


# ----------------------------------------------------------------------------- score
def assign_groups(feats: pd.DataFrame, tables: pd.DataFrame) -> pd.Series:
    """Index into ``tables`` of the finest eligible group for each claim."""
    keys = _keys(feats)
    idx = pd.Series(pd.NA, index=feats.index, dtype="Int64")
    for lvl, cols in enumerate(LEVELS):
        t = tables[tables["level"] == lvl]
        lookup = pd.Series(t.index, index=t["group_key"].to_numpy())
        hit = _key_string(keys, cols).map(lookup)
        idx = idx.fillna(hit.astype("Int64"))
    return idx


def _label(row: pd.Series) -> str:
    lvl = int(row["level"])
    if lvl == len(LEVELS) - 1:
        return "All claims"
    return str(row[LEVELS[lvl][-1]])


def score(feats: pd.DataFrame, tables: pd.DataFrame, cfg: dict) -> pd.DataFrame:
    """Both estimates, sub-scores and reason codes for every claim in ``feats``."""
    gi = assign_groups(feats, tables)
    g = tables.loc[gi.to_numpy()].reset_index(drop=True)
    out = pd.DataFrame({
        "ClaimNum": feats["ClaimNum"].to_numpy(),
        "Status": feats["Status"].to_numpy(),
        "is_closed": feats["is_closed"].to_numpy(),
        "injury_year": feats["injury_year"].to_numpy(),
        "group_level": g["level_name"],
        "group_key": g["group_key"],
        "group_n": g["n"],
        # cost estimate
        "cost_low": g["cost_low"],
        "cost_median": g["cost_median"],
        "cost_high": g["cost_high"],
        "cost_confidence": g["cost_confidence"],
        "cost_dollar_year": g["as_of_year"],
    })
    # complexity estimate (weights read now, at scoring time)
    w = cfg["weights"]
    total_w = sum(w.values())
    if total_w <= 0:
        raise ValueError("complexity weights must sum to a positive number")
    contrib = {}
    for name in SUBSCORES:
        out[f"subscore_{name}"] = g[f"subscore_{name}"]
        contrib[name] = w[name] * g[f"subscore_{name}"] / total_w
    out["complexity_score"] = pd.DataFrame(contrib).sum(axis=1).clip(0, 100)

    labels = g.apply(_label, axis=1)
    c = pd.DataFrame(contrib)
    order = np.argsort(-c.to_numpy(), axis=1, kind="stable")
    names = list(SUBSCORES)
    for r in range(3):
        reasons = []
        for i, j in enumerate(order[:, r]):
            name = names[j]
            s = out.at[i, f"subscore_{name}"]
            _, high, mid, low = SUBSCORES[name]
            phrase = high if s >= 67 else low if s <= 33 else mid
            reasons.append(f"{labels.iat[i]}: {phrase}")
        out[f"reason_{r + 1}"] = reasons
    out["actual_total_incurred"] = feats["Total Incurred"].where(feats["is_closed"]).to_numpy()
    return out


# ----------------------------------------------------------------------------- holdout
def holdout_check(feats: pd.DataFrame, cfg: dict) -> dict:
    """Tables from claims injured before holdout_year; test on closed claims injured in/after it."""
    year = cfg["holdout_year"]
    train = feats[feats["injury_year"] < year]
    test = reference_claims(feats)
    test = test[test["injury_year"] >= year]
    tables = build_tables(train, cfg)
    pred = score(test, tables, cfg)
    actual = (test["Total Incurred"] * inflation_factor(test["injury_year"], cfg["inflation"], cfg["as_of_year"])).to_numpy()
    err = np.abs(pred["cost_median"].to_numpy() - actual)
    inside = (actual >= pred["cost_low"].to_numpy()) & (actual <= pred["cost_high"].to_numpy())
    glob = tables.loc[tables["level"] == len(LEVELS) - 1, "cost_median"].iat[0]
    return {
        "train_closed_claims": int(len(reference_claims(train))),
        "test_closed_claims": int(len(test)),
        "mean_abs_error": float(err.mean()),
        "median_abs_error": float(np.median(err)),
        "share_inside_range": float(inside.mean()),
        "range_percentiles": [cfg["p_low"], cfg["p_high"]],
        "global_median_mean_abs_error": float(np.abs(glob - actual).mean()),
        "global_median_median_abs_error": float(np.median(np.abs(glob - actual))),
        "test_group_levels": pred["group_level"].value_counts().to_dict(),
    }


# ----------------------------------------------------------------------------- run
def run_build(clean_dir: str | Path, config_path: str | Path) -> dict:
    d = Path(clean_dir)
    cfg = load_config(config_path)
    feats = pd.read_parquet(d / "features.parquet")
    metrics = holdout_check(feats, cfg)
    tables = build_tables(feats, cfg)  # production tables: all closed claims
    tables.to_parquet(d / "baseline_tables.parquet", index=False)
    (d / "holdout_metrics.json").write_text(json.dumps(metrics, indent=2))
    log.info("baseline tables: %d groups by level %s", len(tables), tables["level_name"].value_counts().to_dict())
    log.info("holdout: %s", metrics)
    return metrics


def run_score(clean_dir: str | Path, config_path: str | Path) -> pd.DataFrame:
    d = Path(clean_dir)
    cfg = load_config(config_path)
    feats = pd.read_parquet(d / "features.parquet")
    tables = pd.read_parquet(d / "baseline_tables.parquet")
    est = score(feats, tables, cfg)
    est.to_parquet(d / "estimates.parquet", index=False)
    log.info("scored %d claims", len(est))
    return est
