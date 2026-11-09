"""Scoring service: reuses models/baseline.py against claims stored in the database.

Reference tables are built from closed claims in the database with the current config.
The claim being estimated contributes only its intake fields (Loss Type, Loss Cause,
Loss Nature, injury year, status). Its own final cost, closure duration and other outcomes
are never passed to scoring as inputs.
"""
from __future__ import annotations

import threading
from pathlib import Path

import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.engine import Engine

from backend import config_store
from backend.db import OPEN_STATUSES, Claim, Estimate, estimate_rows, insert_estimates, utcnow
from models import baseline

# claims-table column -> baseline feature column
TO_FEATURE = {
    "claim_num": "ClaimNum", "status": "Status", "is_closed": "is_closed",
    "has_financials": "has_financials", "loss_type": "Loss Type", "loss_cause": "Loss Cause",
    "loss_nature": "Loss Nature", "injury_year": "injury_year", "total_incurred": "Total Incurred",
    "medical_paid": "Medical Paid", "indemnity_paid": "Indemnity Paid",
    "days_to_close": "days_to_close", "legal_flag": "legal_flag",
}
INTAKE = ["ClaimNum", "Status", "is_closed", "injury_year", *baseline.KEY_COLS]


class ClaimNotFound(KeyError):
    pass


class ScoringService:
    def __init__(self, engine: Engine, config_path: str | Path):
        self.engine = engine
        self.config_path = Path(config_path)
        self.lock = threading.Lock()
        self.reload()

    # ------------------------------------------------------------------ state
    def load_features(self) -> pd.DataFrame:
        cols = [getattr(Claim, c) for c in TO_FEATURE]
        with self.engine.connect() as conn:
            df = pd.DataFrame(conn.execute(select(*cols)).mappings().all(), columns=list(TO_FEATURE))
        df = df.rename(columns=TO_FEATURE)
        for c in ["Total Incurred", "Medical Paid", "Indemnity Paid", "days_to_close"]:
            df[c] = pd.to_numeric(df[c], errors="coerce").astype(float)
        df["injury_year"] = pd.to_numeric(df["injury_year"], errors="coerce").astype("Int64")
        df["legal_flag"] = df["legal_flag"].fillna(False).astype(bool)
        df["is_closed"] = df["is_closed"].astype(bool)
        df["has_financials"] = df["has_financials"].astype(bool)
        for c in baseline.KEY_COLS + ["Status"]:
            df[c] = df[c].astype("string")
        return df.set_index("ClaimNum", drop=False)

    def reload(self) -> None:
        raw = config_store.read_raw(self.config_path)
        self.raw_config = raw
        self.cfg = baseline.config_from_dict(raw)
        self.features = self.load_features()
        self.tables = baseline.build_tables(self.features, self.cfg)

    # ------------------------------------------------------------------ scoring
    @staticmethod
    def intake_frame(feats: pd.DataFrame) -> pd.DataFrame:
        """Only intake fields for the claims being estimated; outcomes are blanked."""
        f = feats[INTAKE].reset_index(drop=True).copy()
        f["Total Incurred"] = float("nan")
        return f

    def compute(self, claim_nums: list[str], cfg: dict | None = None,
                tables: pd.DataFrame | None = None) -> pd.DataFrame:
        missing = [c for c in claim_nums if c not in self.features.index]
        if missing:
            raise ClaimNotFound(missing)
        target = self.intake_frame(self.features.loc[claim_nums])
        return baseline.score(target, self.tables if tables is None else tables, cfg or self.cfg)

    def append(self, scored: pd.DataFrame, weights_version: int, conn=None) -> list[int]:
        rows = estimate_rows(scored, weights_version, utcnow())
        if conn is not None:
            return self._insert(conn, rows)
        with self.engine.begin() as c:
            return self._insert(c, rows)

    @staticmethod
    def _insert(conn, rows: list[dict]) -> list[int]:
        start = conn.execute(select(func.coalesce(func.max(Estimate.id), 0))).scalar_one()
        insert_estimates(conn, rows)
        return list(range(start + 1, start + 1 + len(rows)))

    def estimate(self, claim_nums: list[str]) -> list[int]:
        with self.lock:
            scored = self.compute(claim_nums)
            return self.append(scored, self.cfg["version"])

    def open_claims(self) -> list[str]:
        f = self.features
        return f.index[f["Status"].isin(OPEN_STATUSES)].tolist()

    # ------------------------------------------------------------------ config
    def update_config(self, changes: dict) -> dict:
        """Validate, recalculate open claims, then apply. All-or-nothing as far as possible."""
        with self.lock:
            new_raw = config_store.prepare_update(self.raw_config, changes)      # 1. validate
            new_cfg = baseline.config_from_dict(new_raw)
            new_tables = baseline.build_tables(self.features, new_cfg)            # 2. prepare
            targets = self.open_claims()
            scored = self.compute(targets, new_cfg, new_tables) if targets else None
            tmp = config_store.write_temp(new_raw, self.config_path)              # 3. stage file
            try:
                with self.engine.begin() as conn:                                 # 4. one transaction
                    if scored is not None:
                        self.append(scored, new_cfg["version"], conn)
            except Exception:
                tmp.unlink(missing_ok=True)
                raise
            config_store.commit_temp(tmp, self.config_path)                       # 5. atomic replace
            self.raw_config, self.cfg, self.tables = new_raw, new_cfg, new_tables
            return {"settings": config_store.public_view(new_raw), "claims_recalculated": len(targets)}
