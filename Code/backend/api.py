"""FastAPI backend for the Claim Scorer, Workload Board and Cost and Risk Insights dashboards.

Complexity and cost are returned as separate objects and are never combined.
No accident descriptions or diary notes are stored in the database, so none can be returned.
"""
from __future__ import annotations

import math
from enum import Enum
from pathlib import Path
from statistics import median

import yaml
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import and_, case, func, select, true
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, aliased

from backend import config_store
from backend.db import OPEN_STATUSES, Claim, Estimate, make_engine
from backend.service import ClaimNotFound, ScoringService

ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]
MAX_PAGE_SIZE = 200
MAX_BATCH = 2000


# ---------------------------------------------------------------- request models
class EstimateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    claim_number: str = Field(min_length=1)


class BatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    claim_numbers: list[str] = Field(min_length=1, max_length=MAX_BATCH)


class WeightsUpdate(BaseModel):
    """Only these settings can change here. Cost percentiles cannot."""
    model_config = ConfigDict(extra="forbid")
    duration: float | None = Field(None, ge=0, allow_inf_nan=False)
    medical_intensity: float | None = Field(None, ge=0, allow_inf_nan=False)
    time_loss: float | None = Field(None, ge=0, allow_inf_nan=False)
    legal: float | None = Field(None, ge=0, allow_inf_nan=False)
    annual_inflation_rate: float | None = Field(
        None, ge=config_store.INFLATION_MIN, le=config_store.INFLATION_MAX, allow_inf_nan=False)


class SortBy(str, Enum):
    complexity = "complexity"
    cost = "cost"
    injury_date = "injury_date"


class Order(str, Enum):
    asc = "asc"
    desc = "desc"


class GroupBy(str, Enum):
    employer = "employer"
    tier_2 = "tier_2"
    loss_cause = "loss_cause"
    injury_year = "injury_year"


# ---------------------------------------------------------------- helpers
def _num(v):
    if v is None:
        return None
    v = float(v)
    return None if math.isnan(v) else v


def _ts(dt):
    return None if dt is None else dt.isoformat(timespec="seconds") + "Z"


def normalise_claim_number(s: str) -> str:
    s = s.strip()
    return f"ClaimNum {s}" if s.isdigit() else s


def estimate_out(e) -> dict | None:
    if e is None or e.id is None:
        return None
    return {
        "estimate_id": e.id,
        "estimated_at": _ts(e.created_at),
        "weights_version": e.weights_version,
        "complexity": {
            "score": _num(e.complexity_score),
            "subscores": {
                "duration": _num(e.subscore_duration),
                "medical_intensity": _num(e.subscore_medical_intensity),
                "time_loss": _num(e.subscore_time_loss),
                "legal": _num(e.subscore_legal),
            },
            "reasons": [r for r in (e.reason_1, e.reason_2, e.reason_3) if r],
        },
        "cost": {
            "low": _num(e.cost_low),
            "median": _num(e.cost_median),
            "high": _num(e.cost_high),
            "confidence": _num(e.cost_confidence),
            "dollar_year": e.cost_dollar_year,
            "reference_group": e.group_key,
            "reference_level": e.group_level,
        },
    }


def latest_estimate():
    """(subquery of latest estimate id per claim, aliased Estimate)."""
    ids = (select(Estimate.claim_num, func.max(Estimate.id).label("eid"))
           .group_by(Estimate.claim_num).subquery())
    return ids, aliased(Estimate)


def preview_weights(
    w_duration: float | None = Query(None, description="Preview weight (read-only, not saved)"),
    w_medical_intensity: float | None = Query(None),
    w_time_loss: float | None = Query(None),
    w_legal: float | None = Query(None),
) -> dict | None:
    """Optional unsaved complexity weights for a read-only preview. All four or none."""
    vals = {"duration": w_duration, "medical_intensity": w_medical_intensity,
            "time_loss": w_time_loss, "legal": w_legal}
    if all(v is None for v in vals.values()):
        return None
    if any(v is None for v in vals.values()):
        raise HTTPException(422, detail="all four preview weights are required")
    if any(not math.isfinite(v) or v < 0 for v in vals.values()):
        raise HTTPException(422, detail="preview weights must be finite and not negative")
    total = sum(vals.values())
    if total <= 0:
        raise HTTPException(422, detail="preview weights must not sum to zero")
    return {k: v / total for k, v in vals.items()}


def complexity_expr(L, weights: dict | None):
    """Stored complexity, or the same weighted average as models/baseline.score() for a preview."""
    if weights is None:
        return L.complexity_score
    expr = (weights["duration"] * L.subscore_duration
            + weights["medical_intensity"] * L.subscore_medical_intensity
            + weights["time_loss"] * L.subscore_time_loss
            + weights["legal"] * L.subscore_legal)
    return func.max(0.0, func.min(100.0, expr))   # scalar min/max in SQLite, matches clip(0, 100)


def _load_workload_config(path: Path) -> dict:
    raw = yaml.safe_load(path.read_text())
    return {k: raw[k] for k in ("high_complexity_threshold", "warning_load_ratio", "warning_high_claims")}


# ---------------------------------------------------------------- app
def create_app(db: str | Path | Engine = "data/estimates.db",
               config_path: str | Path = "config/weights.yaml",
               workload_config_path: str | Path = "config/workload.yaml") -> FastAPI:
    engine = db if isinstance(db, Engine) else make_engine(db)
    svc = ScoringService(engine, config_path)
    workload_path = Path(workload_config_path)

    app = FastAPI(title="Penser Claim Complexity API", version="1B")
    app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_methods=["GET", "POST", "PUT"],
                       allow_headers=["Content-Type"])
    app.state.service = svc

    def fetch_estimates(ids: list[int]) -> list[dict]:
        with engine.connect() as conn:
            rows = conn.execute(select(Estimate).where(Estimate.id.in_(ids)).order_by(Estimate.id)).all()
        by_id = {r.id: r for r in rows}
        return [dict(claim_number=by_id[i].claim_num, **estimate_out(by_id[i])) for i in ids]

    # ------------------------------------------------------------ claims
    @app.get("/claims")
    def list_claims(
        search: str | None = Query(None, description="ClaimNum contains this text"),
        status: list[str] | None = Query(None, description="One or more statuses"),
        loss_type: str | None = None,
        adjuster: str | None = None,
        employer: str | None = None,
        unassigned: bool = Query(False, description="Only claims with no adjuster"),
        sort_by: SortBy = SortBy.complexity,
        order: Order = Order.desc,
        page: int = Query(1, ge=1),
        page_size: int = Query(50, ge=1, le=MAX_PAGE_SIZE),
    ):
        ids, L = latest_estimate()
        conds = []
        if search:
            conds.append(Claim.claim_num.contains(search.strip()))
        if status:
            conds.append(Claim.status.in_(status))
        for col, val in ((Claim.loss_type, loss_type), (Claim.adjuster, adjuster), (Claim.employer, employer)):
            if val is not None:
                conds.append(col == val)
        if unassigned:
            conds.append(Claim.adjuster.is_(None))
        where = and_(*conds) if conds else true()
        sort_col = {SortBy.complexity: L.complexity_score, SortBy.cost: L.cost_median,
                    SortBy.injury_date: Claim.date_of_injury}[sort_by]
        sort_expr = (sort_col.desc() if order == Order.desc else sort_col.asc()).nulls_last()
        base = (select(Claim, L).outerjoin(ids, ids.c.claim_num == Claim.claim_num)
                .outerjoin(L, L.id == ids.c.eid).where(where))
        with Session(engine) as session:
            total = session.execute(select(func.count()).select_from(Claim).where(where)).scalar_one()
            rows = session.execute(base.order_by(sort_expr, Claim.claim_num)
                                   .offset((page - 1) * page_size).limit(page_size)).all()
        items = []
        for r in rows:
            c, e = r[0], r[1]
            items.append({
                "claim_number": c.claim_num, "status": c.status, "adjuster": c.adjuster,
                "employer": c.employer, "loss_type": c.loss_type,
                "injury_date": c.date_of_injury.isoformat() if c.date_of_injury else None,
                "complexity_score": _num(e.complexity_score) if e else None,
                "cost_low": _num(e.cost_low) if e else None,
                "cost_median": _num(e.cost_median) if e else None,
                "cost_high": _num(e.cost_high) if e else None,
                "cost_confidence": _num(e.cost_confidence) if e else None,
                "subscores": ({"duration": _num(e.subscore_duration),
                               "medical_intensity": _num(e.subscore_medical_intensity),
                               "time_loss": _num(e.subscore_time_loss),
                               "legal": _num(e.subscore_legal)} if e else None),
            })
        return {"items": items, "pagination": {
            "page": page, "page_size": page_size, "total": total,
            "total_pages": math.ceil(total / page_size) if total else 0}}

    @app.get("/filters")
    def filter_options():
        """Distinct values for the claim filters. No narrative or financial fields."""
        def distinct(col):
            with engine.connect() as conn:
                return [r[0] for r in conn.execute(select(col).where(col.is_not(None)).distinct().order_by(col))]
        with engine.connect() as conn:
            no_adjuster = conn.execute(select(func.count()).select_from(Claim)
                                       .where(Claim.adjuster.is_(None))).scalar_one()
        return {"statuses": distinct(Claim.status), "loss_types": distinct(Claim.loss_type),
                "adjusters": distinct(Claim.adjuster), "employers": distinct(Claim.employer),
                "claims_without_adjuster": no_adjuster}

    @app.get("/claims/{claim_number}")
    def claim_detail(claim_number: str):
        cn = normalise_claim_number(claim_number)
        with engine.connect() as conn:
            c = conn.execute(select(Claim).where(Claim.claim_num == cn)).first()
            if c is None:
                raise HTTPException(404, detail=f"claim not found: {cn}")
            hist = conn.execute(select(Estimate).where(Estimate.claim_num == cn)
                                .order_by(Estimate.id.desc())).all()
        latest = estimate_out(hist[0]) if hist else None
        return {
            "claim": {
                "claim_number": c.claim_num, "status": c.status, "adjuster": c.adjuster,
                "employer": c.employer, "insured_division": c.insured_division, "tier_2": c.tier_2,
                "loss_type": c.loss_type, "loss_cause": c.loss_cause, "loss_nature": c.loss_nature,
                "injury_date": c.date_of_injury.isoformat() if c.date_of_injury else None,
                "injury_year": c.injury_year,
            },
            "historical_costs": {
                "has_financials": c.has_financials,
                "incurred_to_date": _num(c.total_incurred),
                "final_cost": _num(c.total_incurred) if c.is_closed and c.has_financials else None,
            },
            "complexity": latest["complexity"] if latest else None,
            "cost": latest["cost"] if latest else None,
            "latest_estimate": ({k: latest[k] for k in ("estimate_id", "estimated_at", "weights_version")}
                                if latest else None),
            "history": [estimate_out(h) for h in hist[1:]],
        }

    # ------------------------------------------------------------ estimates
    @app.post("/estimate", status_code=201)
    def create_estimate(req: EstimateRequest):
        cn = normalise_claim_number(req.claim_number)
        try:
            ids = svc.estimate([cn])
        except ClaimNotFound:
            raise HTTPException(404, detail=f"claim not found: {cn}")
        return fetch_estimates(ids)[0]

    @app.post("/estimate/batch")
    def create_estimates(req: BatchRequest):
        seen, wanted = set(), []
        for raw in req.claim_numbers:
            cn = normalise_claim_number(raw)
            if cn not in seen:
                seen.add(cn)
                wanted.append(cn)
        known = [c for c in wanted if c in svc.features.index]
        errors = [{"claim_number": c, "error": "claim not found"} for c in wanted if c not in svc.features.index]
        results = fetch_estimates(svc.estimate(known)) if known else []
        return {"results": results, "errors": errors, "created": len(results)}

    # ------------------------------------------------------------ workload
    @app.get("/workload")
    def workload(pw: dict | None = Depends(preview_weights)):
        cfg = _load_workload_config(workload_path)
        hi = float(cfg["high_complexity_threshold"]["value"])
        ids, L = latest_estimate()
        q = (select(Claim.adjuster, complexity_expr(L, pw))
             .outerjoin(ids, ids.c.claim_num == Claim.claim_num).outerjoin(L, L.id == ids.c.eid)
             .where(Claim.status.in_(OPEN_STATUSES)))
        with engine.connect() as conn:
            rows = conn.execute(q).all()
        groups: dict = {}
        for adj, score in rows:
            g = groups.setdefault(adj, {"n": 0, "scored": 0, "total": 0.0, "high": 0})
            g["n"] += 1
            if score is not None:
                g["scored"] += 1
                g["total"] += score
                g["high"] += score >= hi
        assigned_totals = [g["total"] for a, g in groups.items() if a is not None]
        med = median(assigned_totals) if assigned_totals else 0.0
        ratio = float(cfg["warning_load_ratio"]["value"])
        max_high = int(cfg["warning_high_claims"]["value"])
        out = []
        for adj, g in groups.items():
            reasons = []
            if adj is not None:
                if med > 0 and g["total"] > ratio * med:
                    reasons.append(f"total complexity above {ratio:g}x the team median")
                if g["high"] >= max_high:
                    reasons.append(f"{max_high}+ high-complexity claims")
            out.append({
                "adjuster": adj, "unassigned": adj is None,
                "assigned_claims": g["n"],
                "total_complexity": round(g["total"], 2),
                "average_complexity": round(g["total"] / g["scored"], 2) if g["scored"] else None,
                "high_complexity_claims": g["high"],
                "workload_warning": bool(reasons), "warning_reasons": reasons,
            })
        out.sort(key=lambda r: (r["unassigned"], -r["total_complexity"]))
        return {"statuses_included": list(OPEN_STATUSES), "team_median_total_complexity": round(med, 2),
                "thresholds": cfg, "preview_weights": pw, "adjusters": out}

    # ------------------------------------------------------------ analytics
    @app.get("/analytics")
    def analytics(group_by: GroupBy = GroupBy.employer, pw: dict | None = Depends(preview_weights)):
        col = getattr(Claim, group_by.value)
        ids, L = latest_estimate()
        fin = Claim.has_financials.is_(True)
        closed_fin = and_(Claim.is_closed.is_(True), fin)
        q = (select(
                col.label("group"),
                func.count(Claim.claim_num).label("claim_count"),
                func.count(L.id).label("claims_with_estimates"),
                func.avg(complexity_expr(L, pw)).label("average_complexity"),
                func.sum(L.cost_median).label("total_predicted_median_cost"),
                func.sum(case((fin, 1), else_=0)).label("claims_with_financials"),
                func.sum(case((fin, Claim.total_incurred), else_=None)).label("total_incurred_to_date"),
                func.sum(case((closed_fin, 1), else_=0)).label("closed_claims_with_final_cost"),
                func.sum(case((closed_fin, Claim.total_incurred), else_=None)).label("total_final_cost"),
             )
             .outerjoin(ids, ids.c.claim_num == Claim.claim_num).outerjoin(L, L.id == ids.c.eid)
             .group_by(col).order_by(func.count(Claim.claim_num).desc(), col))
        with engine.connect() as conn:
            rows = conn.execute(q).mappings().all()
        groups = [{
            "group": r["group"],
            "claim_count": r["claim_count"],
            "claims_with_estimates": r["claims_with_estimates"],
            "average_complexity": None if r["average_complexity"] is None else round(r["average_complexity"], 2),
            "total_predicted_median_cost": _num(r["total_predicted_median_cost"]),
            "claims_with_financials": r["claims_with_financials"],
            "total_incurred_to_date": _num(r["total_incurred_to_date"]),
            "closed_claims_with_final_cost": r["closed_claims_with_final_cost"],
            "total_final_cost": _num(r["total_final_cost"]),
        } for r in rows]
        return {
            "group_by": group_by.value,
            "preview_weights": pw,
            "definitions": {
                "total_incurred_to_date": "paid plus outstanding reserves, all claims with financial records",
                "total_final_cost": "total incurred on closed claims with financial records",
                "total_predicted_median_cost": "sum of latest predicted median cost",
            },
            "groups": groups,
        }

    # ------------------------------------------------------------ weights
    @app.get("/weights")
    def get_weights():
        return config_store.public_view(svc.raw_config)

    @app.put("/weights")
    def put_weights(req: WeightsUpdate):
        changes = req.model_dump(exclude_none=True)
        try:
            return svc.update_config(changes)
        except config_store.ConfigError as e:
            raise HTTPException(422, detail=str(e))

    return app
