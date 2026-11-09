"""Per-claim features, built from modular, registered feature groups.

Each feature group is a function ``(claims, diary) -> DataFrame`` that returns one row per
ClaimNum (a ``ClaimNum`` column plus feature columns). Groups are registered in
``FEATURE_GROUPS``; ``build_features`` left-joins all of them onto the claims table.

To add a new source (for example sanitized diary notes), write a new module with a function
that returns per-claim columns keyed on ClaimNum and register it with ``@register``. Cleaning
and scoring code do not change.

Rule: no feature may be derived from counts of diary tasks or other examiner activity.
Penser said examiner touch points must not count as complexity.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Callable

import pandas as pd

log = logging.getLogger(__name__)

FeatureFn = Callable[[pd.DataFrame, pd.DataFrame], pd.DataFrame]
FEATURE_GROUPS: list[FeatureFn] = []

LEGAL_PATTERN = r"legal|biia|attorney"


def register(fn: FeatureFn) -> FeatureFn:
    FEATURE_GROUPS.append(fn)
    return fn


def _days(later: pd.Series, earlier: pd.Series) -> pd.Series:
    d = (later - earlier).dt.days
    return d.where(d >= 0)  # negative intervals are data errors -> missing


@register
def timing_features(claims: pd.DataFrame, diary: pd.DataFrame) -> pd.DataFrame:
    close_date = claims["Closure Date"].fillna(claims["Status Date"])  # equal on closed claims
    return pd.DataFrame({
        "ClaimNum": claims["ClaimNum"],
        "injury_year": claims["Date Of Injury"].dt.year.astype("Int64"),
        "reporting_lag_days": _days(claims["FROI Received Date"], claims["Date Of Injury"]),
        "tenure_at_injury_days": _days(claims["Date Of Injury"], claims["Hire Date"]),
        "days_to_close": _days(close_date, claims["Date Of Injury"]).where(claims["is_closed"]),
    })


@register
def history_features(claims: pd.DataFrame, diary: pd.DataFrame) -> pd.DataFrame:
    """Prior claims by the same claimant with an earlier injury date."""
    c = claims[["ClaimNum", "Claimant", "Date Of Injury"]]
    m = c.merge(c, on="Claimant", suffixes=("", "_other"))
    m = m[(m["ClaimNum"] != m["ClaimNum_other"]) & (m["Date Of Injury_other"] < m["Date Of Injury"])]
    prior = m.groupby("ClaimNum").size().rename("prior_claims")
    out = c[["ClaimNum"]].merge(prior, left_on="ClaimNum", right_index=True, how="left")
    out["prior_claims"] = out["prior_claims"].fillna(0).astype(int)
    return out


@register
def financial_features(claims: pd.DataFrame, diary: pd.DataFrame) -> pd.DataFrame:
    flag = (claims["Indemnity Paid"] > 0).astype("boolean").where(claims["has_financials"], pd.NA)
    return pd.DataFrame({"ClaimNum": claims["ClaimNum"], "time_loss_flag": flag})


@register
def legal_features(claims: pd.DataFrame, diary: pd.DataFrame) -> pd.DataFrame:
    """Any diary task whose name or type mentions legal, BIIA or attorney.

    Uses task content only; never the number of tasks.
    """
    text = diary["Diary Name"].fillna("") + " " + diary["Diary Type"].fillna("")
    legal_ids = set(diary.loc[text.str.contains(LEGAL_PATTERN, case=False, regex=True), "ClaimNum"])
    return pd.DataFrame({"ClaimNum": claims["ClaimNum"], "legal_flag": claims["ClaimNum"].isin(legal_ids)})


def build_features(claims: pd.DataFrame, diary: pd.DataFrame,
                   groups: list[FeatureFn] | None = None) -> pd.DataFrame:
    out = claims.copy()
    for fn in groups or FEATURE_GROUPS:
        f = fn(claims, diary)
        if not f["ClaimNum"].is_unique:
            raise ValueError(f"{fn.__name__} returned more than one row per ClaimNum")
        clash = (set(f.columns) - {"ClaimNum"}) & set(out.columns)
        if clash:
            raise ValueError(f"{fn.__name__} redefines columns {sorted(clash)}")
        out = out.merge(f, on="ClaimNum", how="left")
    assert out["ClaimNum"].is_unique
    return out


def run(clean_dir: str | Path) -> pd.DataFrame:
    d = Path(clean_dir)
    claims = pd.read_parquet(d / "claims.parquet")
    diary = pd.read_parquet(d / "diary_tasks.parquet")
    feats = build_features(claims, diary)
    feats.to_parquet(d / "features.parquet", index=False)
    log.info("features: %d claims, groups=%s", len(feats), [f.__name__ for f in FEATURE_GROUPS])
    return feats
