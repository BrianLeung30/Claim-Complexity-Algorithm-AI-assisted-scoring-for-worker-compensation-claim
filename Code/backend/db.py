"""SQLite database: one row per claim, and append-only estimate history.

Tables
  claims     one row per ClaimNum. Only the fields needed for search, filters, workload,
             analytics and baseline reference statistics. No accident descriptions, diary
             notes, claimant, birth date or other unneeded confidential fields.
  estimates  append-only history. Every calculation inserts a new row; UPDATE and DELETE
             are blocked by triggers. The latest estimate for a claim is the row with the
             highest id (indexed on claim_num, id).
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from sqlalchemy import (Boolean, Column, Date, DateTime, DDL, Float, ForeignKey, Index, Integer,
                        String, UniqueConstraint, create_engine, event, func, select)
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base

log = logging.getLogger(__name__)

DEFAULT_DB_PATH = "data/estimates.db"
INITIAL_IMPORT_KEY = "initial_import"
OPEN_STATUSES = ("Open", "Reopened")

Base = declarative_base()


class Claim(Base):
    __tablename__ = "claims"
    claim_num = Column(String, primary_key=True)          # e.g. "ClaimNum 00001", text keeps zeros
    status = Column(String, index=True)
    is_closed = Column(Boolean, nullable=False)
    adjuster = Column(String, index=True)
    employer = Column(String, index=True)                  # cleaned "Insured Name" token
    insured_division = Column(String)
    tier_2 = Column(String)
    loss_type = Column(String, index=True)
    loss_cause = Column(String)
    loss_nature = Column(String)
    date_of_injury = Column(Date)
    injury_year = Column(Integer)
    closure_date = Column(Date)
    # financials: NULL when the claim has no financial record (distinct from $0)
    has_financials = Column(Boolean, nullable=False)
    total_incurred = Column(Float)
    period_paid = Column(Float)
    total_outstanding_reserves = Column(Float)
    medical_paid = Column(Float)
    indemnity_paid = Column(Float)
    # outcome features, used only for reference statistics from other closed claims
    days_to_close = Column(Float)
    legal_flag = Column(Boolean)
    time_loss_flag = Column(Boolean)


class Estimate(Base):
    __tablename__ = "estimates"
    id = Column(Integer, primary_key=True, autoincrement=True)
    claim_num = Column(String, ForeignKey("claims.claim_num"), nullable=False)
    # complexity estimate
    complexity_score = Column(Float, nullable=False)
    subscore_duration = Column(Float, nullable=False)
    subscore_medical_intensity = Column(Float, nullable=False)
    subscore_time_loss = Column(Float, nullable=False)
    subscore_legal = Column(Float, nullable=False)
    reason_1 = Column(String)
    reason_2 = Column(String)
    reason_3 = Column(String)
    # cost estimate (separate; never combined with complexity)
    cost_low = Column(Float, nullable=False)
    cost_median = Column(Float, nullable=False)
    cost_high = Column(Float, nullable=False)
    cost_confidence = Column(Float, nullable=False)
    cost_dollar_year = Column(Integer)
    group_level = Column(String)
    group_key = Column(String)
    # provenance
    weights_version = Column(Integer, nullable=False)
    created_at = Column(DateTime, nullable=False)          # UTC
    import_key = Column(String)                            # set only for repeatable imports
    __table_args__ = (
        UniqueConstraint("claim_num", "import_key", name="uq_estimate_import"),
        Index("ix_estimates_claim_latest", "claim_num", "id"),
    )


for _op in ("UPDATE", "DELETE"):
    event.listen(Estimate.__table__, "after_create", DDL(
        f"CREATE TRIGGER estimates_no_{_op.lower()} BEFORE {_op} ON estimates "
        f"BEGIN SELECT RAISE(ABORT, 'estimates are append-only'); END;"))


def make_engine(url_or_path: str | Path = DEFAULT_DB_PATH) -> Engine:
    url = str(url_or_path)
    if "://" not in url:
        Path(url).parent.mkdir(parents=True, exist_ok=True)
        url = f"sqlite:///{url}"
    engine = create_engine(url, connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def _fk_on(dbapi_conn, _):
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    return engine


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _none(v):
    if v is None or v is pd.NA or v is pd.NaT:
        return None
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        pass
    return v.item() if hasattr(v, "item") else v


def _date(v):
    v = _none(v)
    return None if v is None else pd.Timestamp(v).date()


def claim_rows(feats: pd.DataFrame) -> list[dict]:
    """Map the cleaned feature table to claims-table rows (one per ClaimNum)."""
    if not feats["ClaimNum"].is_unique:
        raise ValueError("features must have one row per ClaimNum")
    rows = []
    for r in feats.to_dict("records"):
        fin = bool(r["has_financials"])
        money = lambda k: _none(r.get(k)) if fin else None  # noqa: E731
        rows.append({
            "claim_num": str(r["ClaimNum"]),
            "status": _none(r.get("Status")),
            "is_closed": bool(r["is_closed"]),
            "adjuster": _none(r.get("Adjuster")),
            "employer": _none(r.get("Insured Name")),
            "insured_division": _none(r.get("Insured Division")),
            "tier_2": _none(r.get("Tier 2")),
            "loss_type": _none(r.get("Loss Type")),
            "loss_cause": _none(r.get("Loss Cause")),
            "loss_nature": _none(r.get("Loss Nature")),
            "date_of_injury": _date(r.get("Date Of Injury")),
            "injury_year": _none(r.get("injury_year")),
            "closure_date": _date(r.get("Closure Date")),
            "has_financials": fin,
            "total_incurred": money("Total Incurred"),
            "period_paid": money("Period Paid"),
            "total_outstanding_reserves": money("Total Outstanding Reserves"),
            "medical_paid": money("Medical Paid"),
            "indemnity_paid": money("Indemnity Paid"),
            "days_to_close": _none(r.get("days_to_close")),
            "legal_flag": _none(r.get("legal_flag")),
            "time_loss_flag": _none(r.get("time_loss_flag")),
        })
    return rows


ESTIMATE_FIELDS = [
    "complexity_score", "subscore_duration", "subscore_medical_intensity", "subscore_time_loss",
    "subscore_legal", "reason_1", "reason_2", "reason_3", "cost_low", "cost_median", "cost_high",
    "cost_confidence", "cost_dollar_year", "group_level", "group_key",
]


def estimate_rows(scored: pd.DataFrame, weights_version: int, created_at: datetime,
                  import_key: str | None = None) -> list[dict]:
    """Map baseline.score() output to estimates-table rows."""
    out = []
    for r in scored.to_dict("records"):
        row = {k: _none(r[k]) for k in ESTIMATE_FIELDS}
        row.update(claim_num=str(r["ClaimNum"]), weights_version=int(weights_version),
                   created_at=created_at, import_key=import_key)
        out.append(row)
    return out


def _chunks(rows: list[dict], n: int = 500):
    for i in range(0, len(rows), n):
        yield rows[i:i + n]


def upsert_claims(conn, rows: list[dict]) -> None:
    cols = [c.name for c in Claim.__table__.columns if c.name != "claim_num"]
    for chunk in _chunks(rows):
        stmt = sqlite_insert(Claim.__table__).values(chunk)
        conn.execute(stmt.on_conflict_do_update(
            index_elements=["claim_num"], set_={c: stmt.excluded[c] for c in cols}))


def insert_estimates(conn, rows: list[dict], ignore_duplicate_imports: bool = False) -> int:
    """Append estimate rows. Returns rows inserted."""
    before = conn.execute(select(func.count()).select_from(Estimate)).scalar_one()
    for chunk in _chunks(rows):
        stmt = sqlite_insert(Estimate.__table__).values(chunk)
        if ignore_duplicate_imports:
            stmt = stmt.on_conflict_do_nothing(index_elements=["claim_num", "import_key"])
        conn.execute(stmt)
    return conn.execute(select(func.count()).select_from(Estimate)).scalar_one() - before


def init_db(engine: Engine, features: pd.DataFrame, estimates: pd.DataFrame | None,
            weights_version: int, estimates_time: datetime | None = None) -> dict:
    """Create tables, upsert claims and import initial estimates once (repeatable)."""
    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        upsert_claims(conn, claim_rows(features))
        imported = 0
        if estimates is not None:
            known = set(features["ClaimNum"])
            est = estimates[estimates["ClaimNum"].isin(known)]
            rows = estimate_rows(est, weights_version, estimates_time or utcnow(), INITIAL_IMPORT_KEY)
            imported = insert_estimates(conn, rows, ignore_duplicate_imports=True)
        n_claims = conn.execute(select(func.count()).select_from(Claim)).scalar_one()
        n_est = conn.execute(select(func.count()).select_from(Estimate)).scalar_one()
    return {"claims": n_claims, "estimates_imported": imported, "estimates_total": n_est}


def run_init(clean_dir: str | Path, db_path: str | Path, weights_version: int) -> dict:
    d = Path(clean_dir)
    feats = pd.read_parquet(d / "features.parquet")
    est_path = d / "estimates.parquet"
    est = pd.read_parquet(est_path) if est_path.exists() else None
    when = (datetime.fromtimestamp(est_path.stat().st_mtime, timezone.utc).replace(tzinfo=None)
            if est is not None else None)
    result = init_db(make_engine(db_path), feats, est, weights_version, when)
    log.info("database initialised: %s", result)
    return result
