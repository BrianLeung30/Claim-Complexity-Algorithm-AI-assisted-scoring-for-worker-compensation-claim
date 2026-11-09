"""Read, validate and save config/weights.yaml for the API.

Only the four complexity weights and the annual inflation rate can be changed here.
Changed entries are marked "pending Penser"; nothing is ever marked approved by Penser.
"""
from __future__ import annotations

import copy
import math
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import yaml

from models import baseline

WEIGHT_KEYS = list(baseline.SUBSCORES)            # duration, medical_intensity, time_loss, legal
INFLATION_MIN, INFLATION_MAX = 0.0, 0.25
PENDING = "pending Penser"
CHANGED_SOURCE = "changed via PUT /weights"
HEADER = ("# Baseline weights and parameters. Every entry has value, source and approved_by.\n"
          "# All values are placeholders until Penser reviews them. This file is rewritten by\n"
          "# PUT /weights; explanations live in `note` fields so they survive rewrites.\n")


class ConfigError(ValueError):
    pass


def read_raw(path: str | Path) -> dict:
    return yaml.safe_load(Path(path).read_text())


def public_view(raw: dict) -> dict:
    """What GET /weights returns."""
    def entry(e):
        return {k: e.get(k) for k in ("value", "source", "approved_by", "note") if k in e}
    cost = raw["cost"]
    return {
        "version": int(raw.get("version") or 1),
        "updated_at": raw.get("updated_at"),
        "complexity_weights": {k: entry(raw["complexity_weights"][k]) for k in WEIGHT_KEYS},
        "annual_inflation_rate": entry(cost["annual_inflation_rate"]),
        "cost_range_percentiles": {"low": entry(cost["range_percentile_low"]),
                                   "high": entry(cost["range_percentile_high"])},
        "limits": {"complexity_weight_min": 0.0,
                   "annual_inflation_rate_min": INFLATION_MIN, "annual_inflation_rate_max": INFLATION_MAX},
    }


def prepare_update(raw: dict, changes: dict) -> dict:
    """Return a new validated config dict with the changes applied. ``raw`` is not modified.

    ``changes`` may contain any of the four weight keys and ``annual_inflation_rate``.
    Weights are normalised to sum to 1.
    """
    allowed = set(WEIGHT_KEYS) | {"annual_inflation_rate"}
    unknown = set(changes) - allowed
    if unknown:
        raise ConfigError(f"cannot change {sorted(unknown)} here")
    if not changes:
        raise ConfigError("no changes given")
    for k, v in changes.items():
        if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v):
            raise ConfigError(f"{k} must be a finite number")

    new = copy.deepcopy(raw)
    weights = {k: float(new["complexity_weights"][k]["value"]) for k in WEIGHT_KEYS}
    weights.update({k: float(changes[k]) for k in WEIGHT_KEYS if k in changes})
    if any(w < 0 for w in weights.values()):
        raise ConfigError("complexity weights cannot be negative")
    total = sum(weights.values())
    if total <= 0:
        raise ConfigError("complexity weights must not sum to zero")
    normalised = {k: round(w / total, 6) for k, w in weights.items()}

    def set_value(entry: dict, value):
        if entry["value"] != value:
            entry["value"] = value
            entry["source"] = CHANGED_SOURCE
            entry["approved_by"] = PENDING          # never auto-approve

    for k in WEIGHT_KEYS:
        set_value(new["complexity_weights"][k], normalised[k])
    if "annual_inflation_rate" in changes:
        rate = float(changes["annual_inflation_rate"])
        if not INFLATION_MIN <= rate <= INFLATION_MAX:
            raise ConfigError(f"annual_inflation_rate must be between {INFLATION_MIN} and {INFLATION_MAX}")
        set_value(new["cost"]["annual_inflation_rate"], rate)

    new["version"] = int(raw.get("version") or 1) + 1
    new["updated_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    baseline.config_from_dict(new)                 # final structural check
    return new


def write_temp(raw: dict, path: str | Path) -> Path:
    """Write the config next to ``path`` without replacing it yet."""
    path = Path(path)
    fd, tmp = tempfile.mkstemp(prefix=".weights-", suffix=".yaml", dir=path.parent)
    with os.fdopen(fd, "w") as fh:
        fh.write(HEADER)
        yaml.safe_dump(raw, fh, sort_keys=False, width=100)
    return Path(tmp)


def commit_temp(tmp: Path, path: str | Path) -> None:
    os.replace(tmp, path)                          # atomic on the same filesystem
