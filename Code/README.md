# Claim Complexity: cleaning, features and baseline estimates

For each workers' compensation claim this repo produces two **separate** estimates. They are
never combined into one number.

- **Complexity score** (0–100): how hard the claim is to manage.
- **Cost estimate**: a dollar range (low / median / high) with a confidence level (0–100).

This stage (prompt 1A) covers data cleaning, features and lookup-table baselines. Storage, the
API and dashboards come later.

> The data is confidential. Keep it on this machine under `data/` (gitignored). See `CLAUDE.md`.

## Local setup

Requires Python 3.11 or newer.

```bash
python3.12 -m venv .venv          # or python3.11 / python3.13
.venv/bin/pip install -r requirements.txt
# place the extract at data/raw/CombinedData.csv
# place the identifier mask list at data/identifier_masks.yaml (see "Identifier masks")
```

## Identifier masks (local only)

The mask list names specific claims, so it is confidential and is never committed. `clean`
reads `data/identifier_masks.yaml` (gitignored). `config/identifier_masks.example.yaml` is the
tracked template: same structure, no entries.

For authorized teammates:
1. Get the current list from the data owner through the same approved channel as the extract.
   Never share it through GitHub, issues, PRs, chat or docs.
2. Save it as `data/identifier_masks.yaml`, or keep it elsewhere and pass `--masks PATH` to
   `cli.py clean`.
3. Run `cli.py clean`. If the list is missing, cleaning stops before writing any output.
4. To add or release an entry, edit only your local copy (format in the example file), then share
   the updated list the same way. Never add entries to the example.

Start from a copy of the example (an empty list) only if you know the extract has no listed
sequences; otherwise known identifiers would not be masked.

## Command order

```bash
.venv/bin/python cli.py clean            # -> data/clean/claims.parquet, diary_tasks.parquet
.venv/bin/python cli.py features         # -> data/clean/features.parquet
.venv/bin/python cli.py build-baseline   # -> data/clean/baseline_tables.parquet, holdout_metrics.json
.venv/bin/python cli.py score            # -> data/clean/estimates.parquet
.venv/bin/python cli.py all              # all four, in order
.venv/bin/pytest                         # synthetic tests; never reads the real file
```

`clean` also writes two audit files with locations only, no text:
`data/clean/dropped_test_claims.csv` (ClaimNum and the rule that fired) and
`data/clean/digit_runs_for_review.csv` (long digit runs that were kept unmasked).

## What each step does

**Cleaning (`pipeline/clean.py`)**
- Dedupes to one row per ClaimNum before any money math. Diary tasks go in their own table.
- Merges `_x`/`_y` duplicates (prefers `_x`, falls back to `_y`). `Status_y` is the diary task
  status, so it becomes `Task Status` in the diary table and is not merged.
- Drops unused columns: Body Part, Claim Type, Date Reported, and Date of Loss (which always
  equals Date Of Injury).
- Converts dates and money to proper types. Parses diary Due Date with mixed formats.
- Splits a trailing `Loss_Agent: <code> - <name>` from the description into `Loss Agent`.
- Drops test claims: descriptions made only of "test" and filler words, or short descriptions
  that are mostly non-dictionary strings. The second check uses `/usr/share/dict/words` and is
  skipped (and logged) if that file is missing.
- Identifier protection, with no blanket digit masking. Long numeric codes are kept exactly as
  provided.
  - Sequences listed in the local `data/identifier_masks.yaml` are replaced with `xxxx`. That
    file stores claim, column, occurrence and length only, never the value. Entries are
    `confirmed_identifying` or `unresolved` (masked until reviewed).
  - Formats that are identifying by nature (dashed SSN, formatted phone number, email) are
    masked in every text column.
  - Any other run of 6+ digits is kept, and its location (no value) is written to
    `data/clean/digit_runs_for_review.csv`. Review new entries and add any that could identify
    someone to the mask list.

**Features (`pipeline/features.py`)**: reporting lag, tenure at injury, prior claims by the same
claimant, days to close (closed claims only), time-loss flag (Indemnity Paid > 0), legal flag
(a diary task name or type mentions legal / BIIA / attorney), and injury year. No feature
counts diary tasks or examiner activity, because examiner touch points must not count as
complexity.

**Baseline (`models/baseline.py`)**
- Groups claims by intake fields: Loss Type, Loss Cause and Loss Nature. A claim uses the finest
  group with at least 30 closed claims, falling back to Type + Cause, then Type, then all claims.
- **Cost**: from the group's closed claims, the median Total Incurred plus the p10–p90 range,
  inflation-adjusted to the as-of year. Confidence is 0–100 and combines group size with range
  tightness.
- **Complexity**: four sub-scores (duration, medical intensity, time loss, legal). Each one is
  the group's value as a 0–100 percentile across groups. The overall score is their weighted
  average, using weights read from `config/weights.yaml` when scoring.
- **Reason codes**: the top 3 weighted contributors, for example "Strain: long time to close".
- **Holdout check**: tables are built from claims injured before 2025 and tested on closed
  claims injured in 2025 or later. The metrics go to `holdout_metrics.json`.

## Configuration (`config/weights.yaml`)

Every entry has `value`, `source` and `approved_by`. All entries are placeholders
(`baseline placeholder` / `pending Penser`) until Penser approves them.
- Changing **complexity weights** only needs `score` to be rerun.
- Changing **inflation rate, percentiles, minimum group size or confidence parameters** needs
  `build-baseline` and then `score`. This takes seconds and involves no training.

## Adding diary notes

Sanitized diary notes will arrive later and will join on ClaimNum.

1. Put the notes file under `data/raw/` (gitignored).
2. Create a new module, for example `pipeline/notes_features.py`, with a function
   `notes_features(claims, diary) -> DataFrame` that loads the notes and returns **one row per
   ClaimNum**: a `ClaimNum` column plus new feature columns. Decorate it with
   `@register` from `pipeline.features`.
3. Import that module in `pipeline/features.py` (or before calling `build_features`) so it is
   registered. `build_features` left-joins every registered group, and it rejects duplicate
   ClaimNums and column clashes.
4. Cleaning and scoring code do not change. To feed a note feature into complexity, add a
   sub-score entry in `models/baseline.py` (`SUBSCORES`) and a weight in `config/weights.yaml`.

Do not create features that count notes or tasks per claim. Examiner touch points are not
complexity.

## Backend (local database and API)

The backend runs locally only. Data stays in `data/estimates.db` (gitignored).

```bash
.venv/bin/pip install -r requirements.txt
.venv/bin/python cli.py init-db   # claims + initial estimates from data/clean/*.parquet; safe to rerun
.venv/bin/python cli.py serve     # http://127.0.0.1:8000  (interactive docs at /docs)
```

- The server binds to 127.0.0.1 only. CORS allows only `http://localhost:5173` and
  `http://127.0.0.1:5173`. There is no authentication yet, so don't expose it.
- **`claims` table**: one row per ClaimNum, with only the fields needed for search, filters,
  workload, analytics and baseline reference statistics. No descriptions, diary notes,
  claimant or birth-date tokens. A claim with no financial record has NULL money fields, not $0.
- **`estimates` table**: append-only history. Database triggers block UPDATE and DELETE.
  - The latest estimate is the highest `id` per claim.
  - Each row stores `weights_version` and a UTC `created_at`.
  - The initial import is tagged `initial_import` and is unique per claim, so rerunning
    `init-db` never duplicates it.

| Endpoint | Purpose |
|---|---|
| `GET /claims` | Paginated list (`page`, `page_size` ≤ 200). Search with `search` (ClaimNum contains). Filter with `status`, `loss_type`, `adjuster`, `employer`. Sort with `sort_by` = complexity, cost or injury_date, plus `order`. |
| `GET /claims/{claim_number}` | Claim info, then separate `complexity` and `cost` objects, reasons, latest estimate date, and previous estimates newest first. |
| `GET /claims` extras | `status` may repeat (e.g. Open and Reopened); `unassigned=true`; items include `subscores`. |
| `POST /estimate` | `{"claim_number": ...}`. Recalculates with the current settings and appends a record. |
| `POST /estimate/batch` | `{"claim_numbers": [...]}`. Returns `results` and claim-level `errors`. |
| `GET /workload` | Open and Reopened claims grouped by adjuster. Optional read-only `w_duration`, `w_medical_intensity`, `w_time_loss`, `w_legal` preview weights (no writes). Thresholds come from `config/workload.yaml` (placeholders pending Penser). |
| `GET /analytics?group_by=employer\|tier_2\|loss_cause\|injury_year` | One row per claim. Incurred to date is kept separate from final cost (closed claims). |
| `GET /filters` | Distinct statuses, loss types, adjusters and employers for the filter controls (read-only). |
| `GET /weights` / `PUT /weights` | Read settings, or change the four complexity weights and the annual inflation rate. |

How `PUT /weights` works:

1. It validates the input:
   - weights must be at least 0 and must not sum to 0;
   - inflation must be between 0 and 0.25;
   - unknown fields are rejected, so the cost percentiles can't be changed here.
2. It normalises the weights to sum to 1.
3. It marks changed entries `approved_by: pending Penser` and increments `version`.
4. It recalculates every Open and Reopened claim in memory, appends all the new records in one
   transaction, and then atomically replaces `weights.yaml`. If any step fails before that
   replacement, nothing changes.

Changing weights changes only complexity. Changing inflation rebuilds the cost reference tables
with the existing baseline logic. No model is retrained.

Estimation leakage guard: the claim being estimated contributes only its intake fields (Loss
Type, Loss Cause, Loss Nature, injury year, status). Reference statistics come from closed
claims in the database. A closed claim's own outcome is part of its group's history, the same
way as in prompt 1A.

## Frontend (React dashboard)

Stack: React 18, TypeScript 5.9, Vite 7, Tailwind CSS 3 and Tremor 3. Tremor 3 requires React 18 and Tailwind 3. Requires Node 20.19 or newer.

```bash
# terminal 1: backend
.venv/bin/python cli.py init-db    # once
.venv/bin/python cli.py serve      # http://127.0.0.1:8000

# terminal 2: frontend
cd web
npm install
npm run dev                        # http://127.0.0.1:5173
```

- **Environment:**
  - `VITE_API_BASE_URL` (default `http://127.0.0.1:8000`).
  - Copy `web/.env.example` to `web/.env.local` to override it. `.env.local` is gitignored.
- **Connection:**
  - All requests go through `web/src/services/api.ts`, straight to the local backend.
  - The backend allows only `localhost:5173` and `127.0.0.1:5173`.
  - No other network requests or analytics are made. If the backend is down, the UI shows a
    connection error.
- **Checks:** `npm run typecheck`, `npm run lint`, `npm test` (synthetic fixtures only),
  `npm run build`.

### Dashboards

| Page | What it does |
|---|---|
| Claim Scorer | Server-side search, filters (options from `GET /filters`), sorting and pagination. Claim detail shows separate complexity and cost estimates, plus estimate history. |
| Workload Board | Open and Reopened claims by adjuster (`GET /workload`): claim count beside total complexity, average, high-complexity count, warnings, Unassigned row. Clicking an adjuster (or Unassigned) opens a slide-out panel on the right with their totals, claims (complexity and cost range) and a simulated reassignment. |
| Cost & Risk Insights | `GET /analytics` grouped by employer, Tier 2, loss cause or injury year: summary cards, cost and complexity charts (top 12 groups), a full sortable table, the injury-year trends and an illustrative inflation comparison. Lazy-loaded. |
| Model Settings | Current settings, plus the weights editor. The editor also opens from **Model weights** in the header on every dashboard. |

**Adjuster panel.** Opens in view without scrolling; full width on small screens. Close or Escape
closes it and returns focus to the adjuster; clicking another adjuster updates it in place. It is
non-modal, so the board stays usable behind it.

**Simulated reassignment.** In the panel, pick a claim and a destination adjuster to see
before-and-after claim counts, totals and warnings. The warning rules mirror `GET /workload`, using
its thresholds. Nothing is sent to the backend: no assignment changes and no database writes.
Reset (in the panel, or **Reset simulation** above the board) clears it, and a new preview or save
also discards it. The board marks simulated rows until then.

**Injury-year trends.** The cost trend and inflation charts open on **Recent years**: the six most
recent injury years in the data (`RECENT_INJURY_YEARS` in `web/src/lib/config.ts`). **All years**
shows every year, including the oldest. Only the view changes: no records are removed, and the
summary table (group by injury year) always lists every year. Missing money is a gap or "—",
never $0; groups with no financial records are marked "No financial data", and recorded $0 shows
as $0.

**Cost labels.** "Predicted median (sum)" adds up baseline median estimates; "Incurred to date" is
recorded paid plus reserves; "Final cost (closed)" covers closed claims only. They measure
different things and are not a model-accuracy comparison. Short definitions are in the ⓘ tooltips.

**Weight changes.**
- Each weight is shown as its share of the complexity score (the shares total 100%). Raw slider
  values are under **Technical details**.
- Moving a slider changes only a local preview:
  - claim scores are recomputed in the browser from the four stored sub-scores, with the
    backend's formula, `sum(w × s) / sum(w)`;
  - workload and analytics call `GET /workload` / `GET /analytics` with read-only `w_*`
    preview parameters.
- Moving a slider never sends `PUT` and never adds estimate history. **Reset** returns to the last
  saved settings and discards the preview.
- **Save** asks for confirmation, then calls `PUT /weights`. That updates `config/weights.yaml`,
  appends new estimates for Open and Reopened claims, and refreshes the dashboards.
- Complexity weights never change cost. Inflation changes cost estimates only after Save and is
  not previewed.
- The inflation chart on Insights uses its own illustrative rate and never changes the model.

**Still pending Penser approval:**
- all four complexity weights, the annual inflation rate (0%), the cost range (P10–P90) and the
  confidence formula, in `config/weights.yaml`;
- the workload thresholds (high ≥ 75, 1.25 × team median, 15 high claims), in
  `config/workload.yaml`;
- the UI complexity bands (Low < 40, Medium 40–74, High ≥ 75), in `web/src/lib/config.ts`. High
  must equal the workload threshold in `config/workload.yaml`; a frontend test checks that they
  match, so change both together.

**Current limitations.**
- Estimates are preliminary lookup-table baselines, not trained or validated models. Claims in the
  same baseline group share the same scores and cost ranges. Diary-note data is not included yet.
- Cost confidence is a baseline heuristic (group size and spread), not a validated probability.
- Workload warnings are caseload indicators using placeholder thresholds, not performance measures.
- A save recalculates only Open and Reopened claims (as designed in 1B). Closed claims keep
  older-version estimates, so after a save analytics can mix settings versions; Insights says so.
- Some claims, and some older injury years, have no financial records.
- Incurred to date includes reserves on open claims, so recent injury years are not final.
- The inflation comparison compounds by injury year, which is a simplification: payments happen
  over several years.
- Bands use the unrounded score, as the workload board does: 74.6 shows as 75 but is Medium. The
  badge's hover text gives the exact score.
- Claim-list sorting uses saved scores while a preview is active, and reason codes always come
  from the saved estimate.
