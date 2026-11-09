# Project rules (Penser claims capstone)

Penser North America is a Washington workers' compensation TPA. This repo produces
per-claim estimates for examiners.

## Two separate estimates — never combine them
- **Complexity score**: 0–100, how hard the claim is to manage.
- **Cost estimate**: a dollar range (low / median / high) plus a confidence level 0–100.
- Never merge these into one number, and never let one feed the other.
- Examiner touch points (counts of diary tasks or examiner activity) must NOT be used as
  complexity features. Penser has said touch points are not complexity.

## Confidential data stays local
- The data is confidential and stays on this machine. Do not upload it, send it to any web
  service or API, or paste it into issues, PRs, chats or docs.
- Data lives under `data/` (gitignored). Never write data or derived outputs (parquet, csv,
  db) anywhere that could be committed.
- Never print raw rows or free text from the data. Report counts and aggregates only.
- Tests use synthetic fixtures generated inside the tests, never the real file.
- No blanket digit masking. Legitimate numeric codes are kept exactly. Sequences that could
  identify a person go in the local `data/identifier_masks.yaml` (gitignored; claim, column,
  occurrence and length only, never the value). Never put entries in the tracked
  `config/identifier_masks.example.yaml`. Review new rows in `data/clean/digit_runs_for_review.csv`.

## Version control
- Do not run `git add`, `git commit` or `git push`. The user handles all version control.
  Read-only git (`status`, `diff`, `log`) is fine.

## GitHub issues
- Reading issues with `gh` is fine
  (`gh issue list --repo penserna.ghe.com/Penser-Capstone/Claim-Complexity`).
- Updating existing issues is allowed when the user asks: edit, comment on, label, assign,
  set milestone, and close or reopen. Never put confidential data in an issue.
- Creating or deleting issues still needs the user's explicit request each time.

## When blocked
- If something can't be done, or an approach isn't working, stop and report what blocked
  you. Do not grind on workarounds.

## Layout
- `pipeline/clean.py`: raw CSV → `data/clean/claims.parquet`, `data/clean/diary_tasks.parquet`
- `pipeline/features.py`: modular, registered feature groups → `data/clean/features.parquet`
- `models/baseline.py`: lookup-table baselines → `data/clean/estimates.parquet`
- `config/weights.yaml`: all weights and parameters (each has value / source / approved_by)
- `cli.py`: `clean`, `features`, `build-baseline`, `score`, `all`, `init-db`, `serve`
- `backend/`: SQLite (`data/estimates.db`, append-only estimates) and the FastAPI app, local only
  (127.0.0.1, CORS for localhost:5173). `config/workload.yaml` holds placeholder workload thresholds.
- `web/`: React + TypeScript + Vite + Tailwind 3 + Tremor 3 frontend (local only, talks to the
  backend via `web/src/services/api.ts`). Frontend tests use synthetic fixtures only.
- Weight sliders are a local/read-only preview; only an explicitly confirmed Save calls `PUT /weights`.
  Never run `PUT /weights` against the real database during development or tests.
- Python 3.11+, virtual env in `.venv/`, run tests with `.venv/bin/pytest`; frontend checks with
  `npm run typecheck && npm run lint && npm test && npm run build` in `web/`.
