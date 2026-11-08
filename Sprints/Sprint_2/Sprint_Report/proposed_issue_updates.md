# Proposed GitHub issue updates (NOT applied — for the team to apply manually)

Source: read-only `gh` inspection on Nov 7, 2026. The repo rule says issues are read-only for Claude, so none of this has been posted.

## What the board looks like now
- 95 issues (#1–#95); only **#91** (set up Kanban board) is closed. No issue has a milestone or an assignee.
- Sprint is tracked by labels only: `sprint-1`, `sprint-2` (+ `next-up`), `sprint-3` (+ `later`).
- PR #96 "Claims dashboard demo" merged Nov 3 by Kevin Herrera. It has no linked issues and no reviews.

## 1. Housekeeping on every issue
- Create milestones Sprint 1 / 2 / 3 and assign each issue (the reminders in the report template require it).
- Assign team members and add story-point labels. **[MISSING: points and who worked on what.]**

## 2. Link PR #96 and comment on issues it partly covers
Suggested comment: "Partly implemented as a baseline in PR #96 (placeholder logic, synthetic test data only). Remaining: <gap>." Do NOT close these until reviewed and checked against real data.

| Issue | Gap |
|---|---|
| #3 [2.6] cleaning pipeline | Not run on real data; no train/validation/held-out split |
| #6 [3.2], #8 [3.4] sub-scores, scale | Placeholder, awaiting Penser approval |
| #9 [3.5] touch-point safeguard | Review against Penser's definition |
| #13 [3.9] architecture doc | Written in Solution Approach V; propose to Penser (#14) |
| #19 [4.1] structured features | No note features (#20) |
| #22 [4.4], #23 [4.5] weighted average, configurable weights | Placeholder weights |
| #24 [5.1] cost estimate | Lookup table, not a trained model |
| #30 [5.3], #31 [5.4] inflation | Placeholder 0%; labeled sprint-3 but started |
| #33 [5.7] cost alongside complexity | Baseline only |
| #34–#37 [6.1–6.4] confidence, reasons | Heuristic, not validated |
| #15 [7.1], #16 [7.2] schema, local DB | SQLite instead of PostgreSQL |
| #17 [7.4], #26 [7.3], #41 [7.6] API | No Cognito/async; local only |
| #49 [8.4], #52 [8.7], #53 [8.8] views | No login, no submission form |

Consider moving #30, #31, #33, #34–#37, #41, #49, #52, #53 from `sprint-3` to `sprint-2`, since they were started this sprint.

## 3. Blocked issues — add a comment explaining why
Suggested wording: "Blocked: Penser's data has not been delivered (delayed new-system launch, then the mentor's accident). Expected soon. Moving to Sprint 3 if not received by <date>."
- #85 [2.1] headers, #86 [2.3] dataset, #90 [2.2] column review
- #1, #2, #4, #5 [2.4, 2.5, 2.7, 2.8]
- #20 [4.2], #21 [4.3], #25 [5.2]
- #83 [1.3] Claude access — **[MISSING: current status]**
- #27 [7.8] Cognito — **[MISSING: AWS access status]**

## 4. Sprint 1 issues still open with the `sprint-1` label
#82, #83, #84, #85, #86, #87, #88, #89 — decide whether each is done (for example #88 and #89 look done given the design and the working local environment) and close or carry forward with a comment. **[MISSING: team confirmation.]**

## 5. Issue to add
There is no issue for complexity label generation with Claude (the design's subsystem V.2.2); a new one is suggested. Also consider an issue for Penser approval of weights and thresholds.

## 6. Recurring issues
#92–#95 (meetings, budget, sprint report, spec updates): comment with this sprint's status. #94 is this report.
