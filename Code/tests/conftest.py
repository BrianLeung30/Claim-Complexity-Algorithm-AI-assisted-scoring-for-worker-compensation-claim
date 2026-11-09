"""Synthetic fixture shaped like the raw joined extract. Never touches the real file."""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from models import baseline
from pipeline import clean, features

ROOT = Path(__file__).resolve().parents[1]

RAW_COLUMNS = [
    "Insured Division", "Insured Name", "ClaimNum", "Claimant_x", "Adjuster", "Date Of Injury",
    "Claim Type", "Date Reported", "Entry Date", "FROI Received Date", "Status_x", "Status Date",
    "Accident Description_x", "Claimant_y", "Department Name", "Claim Status", "Date of Loss",
    "Hire Date", "Closure Date", "Period Paid", "Total Outstanding Reserves", "Total Incurred",
    "Accident Description_y", "Loss Type", "Loss Cause", "Loss Nature", "Body Part", "Birth Date",
    "Tier 2", "Tier 3", "Tier 4", "Tier 5", "Tier 6", "Rehab Paid", "Rehab Reserve", "Medical Paid",
    "Medical Reserve", "Indemnity Paid", "Indemnity Reserve", "Expense Paid", "Expense Reserve",
    "Task Number", "Diary Name", "Diary Type", "Priority", "User", "Status_y", "Due Date",
]


LEGIT_CODE = "4500012345"   # synthetic long numeric code, must survive cleaning
IDENTIFIER = "98765432"     # synthetic identifier, listed in TEST_MASKS
SSN_FORMAT = "123-45-6789"  # synthetic SSN-format string
TEST_MASKS = [
    {"claim": "ClaimNum 00008", "column": "Accident Description", "occurrence": 2, "length": 8,
     "status": "confirmed_identifying"},
]


def make_raw(n_claims: int = 240, seed: int = 0) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    rows = []
    loss_types = ["Medical only", "Indemnity"]
    causes = ["Lifting", "Fall", "Struck by"]
    natures = ["Strain", "Contusion"]
    task = 0
    for i in range(1, n_claims + 1):
        doi = pd.Timestamp("2021-01-01") + pd.Timedelta(days=int(rng.integers(0, 1700)))
        closed = rng.random() < 0.8
        close = doi + pd.Timedelta(days=int(rng.integers(10, 600)))
        has_fin = i % 9 != 0
        lt = loss_types[i % 2]
        paid = {
            "Rehab": float(rng.integers(0, 3)) * 100,
            "Medical": round(float(rng.gamma(2, 1500)), 2),
            "Indemnity": round(float(rng.gamma(2, 4000)), 2) if lt == "Indemnity" else 0.0,
            "Expense": round(float(rng.gamma(2, 300)), 2),
        }
        reserve = {k: 0.0 if closed else round(float(rng.gamma(2, 500)), 2) for k in paid}
        desc = f"Employee xxxx while lifting xxxx Loss_Agent: {100 + i % 7} - Agent {i % 7}"
        if i == 5:
            desc = "test claim"  # junk test claim
        if i == 7:  # legitimate long code: must be kept exactly
            desc = f"Employee xxxx part {LEGIT_CODE} broke Loss_Agent: 101 - Agent 1"
        if i == 8:  # second run is listed in TEST_MASKS as identifying
            desc = f"Employee xxxx ref {LEGIT_CODE} and {IDENTIFIER} Loss_Agent: 101 - Agent 1"
        if i == 10:  # identifying format
            desc = f"Employee xxxx gave {SSN_FORMAT} Loss_Agent: 101 - Agent 1"
        base = {
            "Insured Division": f"Insured Division {i % 4:05d}",
            "Insured Name": f"Insured Name {i % 3:05d}",
            "ClaimNum": f"ClaimNum {i:05d}",
            "Claimant_x": f"Claimant_x {(i % 200):05d}",  # some repeat claimants
            "Adjuster": f"Adjuster {i % 5:05d}",
            "Date Of Injury": doi.strftime("%Y-%m-%d"),
            "Claim Type": "Indemnity",
            "Entry Date": (doi + pd.Timedelta(days=3)).strftime("%Y-%m-%d"),
            "FROI Received Date": (doi + pd.Timedelta(days=int(rng.integers(0, 30)))).strftime("%Y-%m-%d"),
            "Status_x": "Closed" if closed else "Open",
            "Status Date": close.strftime("%Y-%m-%d") if closed else doi.strftime("%Y-%m-%d"),
            "Accident Description_x": desc,
            "Hire Date": (doi - pd.Timedelta(days=int(rng.integers(30, 4000)))).strftime("%Y-%m-%d"),
        }
        if has_fin:
            base.update({
                "Claimant_y": f"Claimant_y {(i % 200):05d}",
                "Claim Status": base["Status_x"],
                "Date of Loss": base["Date Of Injury"],
                "Closure Date": base["Status Date"] if closed else None,
                "Accident Description_y": desc,
                "Loss Type": lt,
                "Loss Cause": causes[i % 3],
                "Loss Nature": natures[i % 2],
                "Birth Date": f"Birth Date {i:05d}",
                **{f"{k} Paid": f"{v:.2f}" for k, v in paid.items()},
                **{f"{k} Reserve": f"{v:.2f}" for k, v in reserve.items()},
                "Period Paid": f"{sum(paid.values()):.2f}",
                "Total Outstanding Reserves": f"{sum(reserve.values()):.2f}",
                "Total Incurred": f"{sum(paid.values()) + sum(reserve.values()):.2f}",
            })
        n_tasks = int(rng.integers(0, 3))
        if n_tasks == 0:
            rows.append(base)
        for t in range(n_tasks):
            task += 1
            legal = i % 6 == 0 and t == 0
            due = doi + pd.Timedelta(days=30 * (t + 1))
            rows.append({**base,
                         "Task Number": f"Task Number {task:05d}",
                         "Diary Name": "BIIA appeal review" if legal else "Check medical",
                         "Diary Type": "Legal" if legal else "Medical",
                         "Priority": "Normal", "User": f"User {t:05d}", "Status_y": "Open",
                         "Due Date": due.strftime("%Y-%m-%d %H:%M:%S") if t else due.strftime("%Y-%m-%d")})
    return pd.DataFrame(rows).reindex(columns=RAW_COLUMNS).astype("string").astype(object).where(lambda d: d.notna(), None)


@pytest.fixture(scope="session")
def raw() -> pd.DataFrame:
    return make_raw()


@pytest.fixture(scope="session")
def cleaned(raw):
    claims, diary, dropped, review, rep = clean.clean(raw, TEST_MASKS, use_dictionary=False)
    return claims, diary, dropped, rep, review


@pytest.fixture(scope="session")
def feats(cleaned):
    claims, diary, *_ = cleaned
    return features.build_features(claims, diary)


@pytest.fixture
def cfg():
    c = baseline.load_config(ROOT / "config" / "weights.yaml")
    c["min_n"] = 10
    return c
