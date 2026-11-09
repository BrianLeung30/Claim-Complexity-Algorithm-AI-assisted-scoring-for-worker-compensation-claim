"""Clean the raw joined extract into one-row-per-claim and diary-task tables.

The raw file is three tables already joined: claims (columns ending _x), financials
(columns ending _y) and diary tasks (Task Number .. Due Date). A claim with several diary
tasks repeats across rows, so claim-level data is deduped to one row per ClaimNum before
any money math, and diary tasks are kept as their own table.

Logging reports counts only; no raw text from the data is ever printed.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd
import yaml

log = logging.getLogger(__name__)

# Diary-task columns. Status_y is the diary task status (populated only on diary rows),
# not a financial duplicate of Status_x, so it is renamed rather than merged.
DIARY_COLS = ["Task Number", "Diary Name", "Diary Type", "Priority", "User", "Status_y", "Due Date"]
DIARY_RENAME = {"Status_y": "Task Status"}

PAID_COLS = ["Rehab Paid", "Medical Paid", "Indemnity Paid", "Expense Paid"]
RESERVE_COLS = ["Rehab Reserve", "Medical Reserve", "Indemnity Reserve", "Expense Reserve"]
MONEY_COLS = PAID_COLS + RESERVE_COLS + ["Period Paid", "Total Outstanding Reserves", "Total Incurred"]
DATE_COLS = ["Date Of Injury", "Entry Date", "FROI Received Date", "Status Date", "Hire Date", "Closure Date"]

# Unused columns: near-empty or uninformative (see CLAUDE.md / README).
# Date of Loss always equals Date Of Injury.
DROP_COLS = ["Body Part", "Claim Type", "Date Reported", "Date of Loss"]

CLOSED_STATUSES = {"Closed", "Re-Open/Closed"}

DIGIT_RUN = re.compile(r"\d{6,}")
MASK = "xxxx"
ROOT = Path(__file__).resolve().parents[1]
# The identifier mask list is claim-specific, so the real one is local only (data/ is
# gitignored). The tracked example has the same structure and no entries.
DEFAULT_MASKS_PATH = ROOT / "data" / "identifier_masks.yaml"
EXAMPLE_MASKS_PATH = ROOT / "config" / "identifier_masks.example.yaml"

# Formats that are identifying by nature. These are masked wherever they appear in text.
# Bare digit runs are NOT masked by pattern; legitimate long codes are kept exactly.
IDENTIFYING_PATTERNS = {
    "ssn_dashed": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    "phone_formatted": re.compile(r"(?:\(\d{3}\)\s?|\b\d{3}[-. ])\d{3}[-.]\d{4}\b"),
    "email": re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+"),
}
LOSS_AGENT = re.compile(r"\s*Loss_Agent:\s*(?P<agent>.*?)\s*$", re.DOTALL)

# Test-claim detection. Descriptions that consist only of "test" plus filler words, or
# short descriptions made mostly of non-dictionary letter strings (keyboard mashing).
TEST_FILLER = {
    "test", "testing", "tested", "tests", "claim", "claims", "only", "do", "not", "use",
    "please", "delete", "ignore", "this", "is", "a", "the", "for", "new", "dummy", "sample",
    "demo", "fake", "training", "xxxx", "no", "data", "entry", "system", "again", "one",
    "two", "another",
}
DICTIONARY_PATH = Path("/usr/share/dict/words")


@dataclass
class CleanReport:
    raw_rows: int = 0
    raw_claims: int = 0
    claims_without_financials: int = 0
    test_claims_dropped: int = 0
    test_rule_counts: dict = field(default_factory=dict)
    identifier_masks_applied: int = 0
    identifier_masks_by_status: dict = field(default_factory=dict)
    identifier_masks_not_found: int = 0
    pattern_masks_applied: dict = field(default_factory=dict)
    digit_runs_for_review: int = 0
    claims_out: int = 0
    diary_tasks_out: int = 0
    gibberish_check: str = "on"

    def lines(self) -> list[str]:
        return [f"{k}: {v}" for k, v in self.__dict__.items()]


def read_raw(path: str | Path) -> pd.DataFrame:
    return pd.read_csv(path, dtype=str, keep_default_na=False, na_values=[""])


def merge_xy(df: pd.DataFrame) -> pd.DataFrame:
    """Merge <name>_x / <name>_y pairs into <name>, preferring _x and falling back to _y."""
    df = df.copy()
    bases = {c[:-2] for c in df.columns if c.endswith("_x")}
    for base in sorted(bases):
        x, y = f"{base}_x", f"{base}_y"
        if y in df.columns:
            df[base] = df[x].combine_first(df[y])
            df = df.drop(columns=[x, y])
        else:
            df = df.rename(columns={x: base})
    return df


def split_loss_agent(desc: pd.Series) -> tuple[pd.Series, pd.Series]:
    """Split a trailing 'Loss_Agent: <code> - <name>' off the accident description."""
    agent = desc.str.extract(LOSS_AGENT)["agent"].replace("", pd.NA)
    core = desc.str.replace(LOSS_AGENT, "", regex=True).str.strip().replace("", pd.NA)
    return core, agent


def _load_dictionary() -> set[str] | None:
    if DICTIONARY_PATH.exists():
        return {w.strip().lower() for w in DICTIONARY_PATH.read_text().splitlines()}
    return None


def _non_dictionary(word: str, words: set[str]) -> bool:
    if word == "xxxx" or len(word) <= 2 or word in words:
        return False
    for suf in ("s", "es", "ed", "ing", "ly", "er"):
        if word.endswith(suf) and word[: -len(suf)] in words:
            return False
    return True


def flag_test_claims(desc: pd.Series, words: set[str] | None) -> pd.Series:
    """Return a Series of rule names ('' when not a test claim)."""
    toks = desc.fillna("").str.lower().str.findall(r"[a-z]+")
    test_only = toks.apply(
        lambda t: bool(t) and any(w.startswith("test") for w in t) and all(w in TEST_FILLER for w in t)
    )
    rule = pd.Series("", index=desc.index)
    rule[test_only] = "test_only"
    if words is not None:
        gib = toks.apply(
            lambda t: 0 < len(t) <= 4 and sum(_non_dictionary(w, words) for w in t) / len(t) >= 0.5
        )
        rule[gib & ~test_only] = "gibberish"
    return rule


def _text_columns(df: pd.DataFrame) -> list[str]:
    return [c for c in df.columns
            if pd.api.types.is_object_dtype(df[c]) or pd.api.types.is_string_dtype(df[c])]


def load_masks(path: str | Path = DEFAULT_MASKS_PATH) -> list[dict]:
    """Targeted identifier masks, by default from the local data/identifier_masks.yaml."""
    path = Path(path)
    if not path.is_file():
        raise FileNotFoundError(
            f"identifier mask list not found: {path}. The real list is local only (never in git): "
            f"get it from an authorized teammate through the same approved channel as the data "
            f"extract and save it at data/identifier_masks.yaml, or pass --masks PATH. Format: "
            f"config/identifier_masks.example.yaml. See README, Identifier masks.")
    entries = (yaml.safe_load(path.read_text()) or {}).get("masks") or []
    for e in entries:
        missing = {"claim", "column", "occurrence", "length", "status"} - set(e)
        if missing:
            raise ValueError(f"identifier mask entry missing {sorted(missing)}")
    return entries


def apply_identifier_masks(df: pd.DataFrame, masks: list[dict]) -> tuple[pd.DataFrame, dict, int]:
    """Mask the listed digit runs only. Returns (df, applied-by-status, not-found count).

    Raises if a listed run is present but its length differs, so a person reviews it rather
    than a possibly identifying value passing through.
    """
    df = df.copy()
    applied: dict[str, int] = {}
    not_found = 0
    by_cell: dict[tuple[str, str], list[dict]] = {}
    for m in masks:
        by_cell.setdefault((m["claim"], m["column"]), []).append(m)
    for (claim, col), entries in by_cell.items():
        rows = df.index[df["ClaimNum"] == claim]
        if col not in df.columns or len(rows) == 0 or pd.isna(df.at[rows[0], col]):
            not_found += len(entries)
            log.warning("identifier mask target not present (%s, %s)", claim, col)
            continue
        text = str(df.at[rows[0], col])
        runs = list(DIGIT_RUN.finditer(text))
        spans = []
        for e in entries:
            k = int(e["occurrence"]) - 1
            if k >= len(runs):
                not_found += 1
                log.warning("identifier mask occurrence %s not found (%s, %s)", e["occurrence"], claim, col)
                continue
            if len(runs[k].group()) != int(e["length"]):
                raise ValueError(f"identifier mask length mismatch for ({claim}, {col}, occurrence "
                                 f"{e['occurrence']}); review the local mask list (data/identifier_masks.yaml)")
            spans.append(runs[k].span())
            applied[e["status"]] = applied.get(e["status"], 0) + 1
        for start, end in sorted(spans, reverse=True):
            text = text[:start] + MASK + text[end:]
        df.at[rows[0], col] = text
    return df, applied, not_found


def mask_identifying_patterns(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Mask SSN, formatted phone and email patterns in every text column."""
    df = df.copy()
    counts: dict[str, int] = {}
    for col in _text_columns(df):
        s = df[col].astype("string")
        for name, pat in IDENTIFYING_PATTERNS.items():
            n = int(s.str.count(pat.pattern).fillna(0).sum())
            if n:
                counts[name] = counts.get(name, 0) + n
                s = s.str.replace(pat.pattern, MASK, regex=True)
        df[col] = s
    return df, counts


def digit_runs_for_review(df: pd.DataFrame, table: str) -> pd.DataFrame:
    """Locations (no values) of remaining 6+ digit runs, kept as-is but listed for review."""
    out = []
    for col in _text_columns(df):
        s = df[col].astype("string")
        hit = s.str.contains(DIGIT_RUN.pattern, na=False)
        for idx in df.index[hit]:
            for k, m in enumerate(DIGIT_RUN.finditer(str(s.at[idx])), start=1):
                out.append({"table": table, "ClaimNum": df.at[idx, "ClaimNum"], "column": col,
                            "occurrence": k, "length": len(m.group())})
    return pd.DataFrame(out, columns=["table", "ClaimNum", "column", "occurrence", "length"])


def clean(raw: pd.DataFrame, masks: list[dict], use_dictionary: bool = True
          ) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame, CleanReport]:
    """Return (claims, diary_tasks, dropped_test_claims, digit_runs_for_review, report).

    ``masks`` is the targeted identifier mask list (format: config/identifier_masks.example.yaml).
    """
    rep = CleanReport(raw_rows=len(raw), raw_claims=raw["ClaimNum"].nunique())

    # --- diary tasks: one row per task ---
    diary = raw.loc[raw["Task Number"].notna(), ["ClaimNum"] + DIARY_COLS].rename(columns=DIARY_RENAME)
    diary = diary.drop_duplicates()
    diary["Due Date"] = pd.to_datetime(diary["Due Date"], format="mixed", errors="coerce")

    # --- claims: dedupe to one row per ClaimNum ---
    claim_cols = [c for c in raw.columns if c not in DIARY_COLS]
    claims = raw[claim_cols].drop_duplicates("ClaimNum").reset_index(drop=True)
    claims["has_financials"] = claims["Claimant_y"].notna()
    rep.claims_without_financials = int((~claims["has_financials"]).sum())
    claims = merge_xy(claims)
    claims = claims.drop(columns=[c for c in DROP_COLS if c in claims.columns])

    # targeted masks first, on the merged text (occurrences are counted on the full description)
    claims, applied, not_found = apply_identifier_masks(claims, masks)
    rep.identifier_masks_applied = sum(applied.values())
    rep.identifier_masks_by_status = applied
    rep.identifier_masks_not_found = not_found

    # types
    for c in DATE_COLS:
        claims[c] = pd.to_datetime(claims[c], errors="coerce")
    for c in MONEY_COLS:
        claims[c] = pd.to_numeric(claims[c].str.replace(r"[$,]", "", regex=True), errors="coerce")
    claims["is_closed"] = claims["Status"].isin(CLOSED_STATUSES)

    # loss agent
    desc, agent = split_loss_agent(claims["Accident Description"])
    claims["Accident Description"] = desc
    claims["Loss Agent"] = agent

    # test claims
    words = _load_dictionary() if use_dictionary else None
    if words is None:
        rep.gibberish_check = "off (no dictionary available)"
    rule = flag_test_claims(claims["Accident Description"], words)
    is_test = rule != ""
    dropped = pd.DataFrame({"ClaimNum": claims.loc[is_test, "ClaimNum"], "rule": rule[is_test]})
    rep.test_claims_dropped = int(is_test.sum())
    rep.test_rule_counts = rule[is_test].value_counts().to_dict()
    claims = claims.loc[~is_test].reset_index(drop=True)
    diary = diary[diary["ClaimNum"].isin(claims["ClaimNum"])].reset_index(drop=True)

    # identifying formats (SSN, formatted phone, email) in every text column
    claims, p1 = mask_identifying_patterns(claims)
    diary, p2 = mask_identifying_patterns(diary)
    rep.pattern_masks_applied = {k: p1.get(k, 0) + p2.get(k, 0) for k in set(p1) | set(p2)}

    # remaining long digit runs are kept exactly, and their locations listed for review
    review = pd.concat([digit_runs_for_review(claims, "claims"), digit_runs_for_review(diary, "diary_tasks")],
                       ignore_index=True)
    rep.digit_runs_for_review = len(review)
    if len(review):
        log.warning("%d digit runs of 6+ kept unmasked; listed for review", len(review))

    rep.claims_out, rep.diary_tasks_out = len(claims), len(diary)
    assert claims["ClaimNum"].is_unique
    return claims, diary, dropped, review, rep


def run(raw_path: str | Path, out_dir: str | Path, masks_path: str | Path = DEFAULT_MASKS_PATH) -> CleanReport:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    claims, diary, dropped, review, rep = clean(read_raw(raw_path), load_masks(masks_path))
    claims.to_parquet(out / "claims.parquet", index=False)
    diary.to_parquet(out / "diary_tasks.parquet", index=False)
    # audits with locations only, no text (gitignored under data/)
    dropped.to_csv(out / "dropped_test_claims.csv", index=False)
    review.to_csv(out / "digit_runs_for_review.csv", index=False)
    for line in rep.lines():
        log.info(line)
    return rep
