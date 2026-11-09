# Kanban Board – Claim Complexity Algorithm

Sprint deadlines: Sprint 1 – Oct 5, Sprint 2 – Nov 5, Sprint 3 – Dec 5.
Card format: `[ID] Task` · *requirement tags* · **P0/P1** where known.

## Board Rules

1. **Flow:** Backlog → To Do → In Progress → In Review → Done. Move cards left to right only (a card sent back from Review returns to In Progress).
2. **To Do holds only ready work.** A card may enter To Do only when its dependencies are Done, its inputs (data, decisions, approvals) are in hand, and it fits the current sprint. Anything else stays in Backlog.
3. **WIP limits:** In Progress ≤ 4 cards, In Review ≤ 3, To Do ≤ 10. Finish work before starting new work.
4. **Backlog is tiered** (Next Up → Later → Icebox), and every card carries a `Needs:` note saying what unblocks it. At each sprint planning, pull from Next Up into To Do.
5. **Recurring tasks** live in their own lane below the board so they never clog the columns.
6. **Definition of Done:** the output exists, a teammate reviewed it, and any related requirement or spec text is updated.

---

## 📥 Backlog (not ready – do not work on these yet)

### Next Up – Sprint 2 (pull into To Do as blockers clear)

| ID | Task | Needs |
|----|------|-------|
| 2.4 | Verify notes are sanitized and tokenized *(NFR-3)* | Dataset received (2.3) |
| 2.5 | Exploratory data analysis: industry coverage, distributions, missing values *(FR-1)* | Dataset received (2.3) |
| 2.6 | Data cleaning and preprocessing pipeline, train/validation/held-out split *(FR-1)* | EDA (2.5) |
| 2.7 | Identify closed claims with known final costs as anchors *(FR-3, FR-5)* | Dataset received (2.3) |
| 2.8 | Map tokenized diary-note features to readable categories *(FR-4)* | Dataset received (2.3) |
| 3.2 | Define complexity sub-scores *(FR-2, FR-3)* | Column review (2.2), TBD resolution (1.7) |
| 3.3 | Define starting sub-score weights using closed claims *(FR-3)* | 3.2, 2.7 |
| 3.4 | Define complexity score scale *(FR-2)* | 3.2 |
| 3.5 | Design safeguard so examiner touch points aren't used alone as complexity *(FR-3)* | 3.2 |
| 3.6 | Choose confidence/uncertainty estimation method *(FR-6)* | Model approach (3.1) |
| 3.7 | Choose explainability method *(FR-4)* | Model approach (3.1) |
| 3.8 | Define fairness/bias evaluation metrics and thresholds *(NIST AI RMF, ACM)* | Model approach (3.1) |
| 3.9 | Write system architecture/design doc *(NFR-6)* | Model approach (3.1) |
| 3.10 | Propose Sprint 1 findings and model approach to Penser for approval | 3.1–3.9 drafted |
| 7.1 | Design database schema | Architecture doc (3.9) |
| 7.2 | Set up local database (e.g., PostgreSQL) and migrations | Schema (7.1) |
| 7.4 | Define API endpoints and data formats; write API spec *(FR-7)* | Architecture doc (3.9) |
| 8.1 | Design UI wireframes/mockups | Architecture doc (3.9) |
| 4.1 | Feature engineering for structured claim fields *(FR-2)* | Clean data (2.6), sub-scores (3.2) |
| 4.2 | NLP/feature extraction for sanitized diary notes *(FR-2)* | Clean data (2.6), 2.8 |
| 4.3 | Train sub-score models *(FR-3)* | 4.1, 4.2, Penser approval (3.10) |
| 4.4 | Weighted-average combination into overall complexity score *(FR-2)* | 4.3, weights (3.3) |
| 4.5 | Configurable sub-score weights without code changes *(FR-3, NFR-6)* | 4.4 |
| 5.1 | Cost-estimation model using closed claims as reference *(FR-5)* | Clean data (2.6), anchors (2.7) |
| 5.2 | Identify claim characteristics associated with cost *(FR-5)* | 5.1 |
| 7.3 | Backend service wrapping the ML models (inference endpoint) *(FR-7)* | 4.4, 5.1, 7.4 |
| 7.8 | Authentication/authorization with AWS Cognito *(FR-7, NFR-3)* | Architecture doc (3.9), AWS access |

### Later – Sprint 3

| ID | Task | Needs |
|----|------|-------|
| 4.6 | Evaluate complexity model on held-out data; document metrics *(FR-2)* | Trained model (4.4) |
| 4.7 | Check complexity score for bias (touch-point leakage, industry/examiner effects) *(FR-3)* | 4.4, bias metrics (3.8) |
| 5.3 | Inflation adjustment with weighted inflation adjustments *(FR-9, **P1**)* | Cost model (5.1) |
| 5.4 | Make inflation weight tunable alongside other weights *(FR-9)* | 5.3, 4.5 |
| 5.6 | Evaluate cost model on held-out data *(FR-5)* | 5.1 |
| 5.7 | Ensure cost is produced alongside complexity for every claim *(FR-5)* | 4.4, 5.1 |
| 6.1 | Confidence calculation per prediction *(FR-6)* | Method chosen (3.6), models trained |
| 6.2 | Convert confidence to 0–100% for examiners *(FR-6)* | 6.1 |
| 6.3 | Confidence range data for graphical display *(FR-6)* | 6.1 |
| 6.4 | Complexity explanation: top contributing sub-scores and characteristics *(FR-4)* | Method chosen (3.7), 4.4 |
| 6.5 | Translate note-derived factors to readable categories in explanations *(FR-4)* | 6.4, 2.8 |
| 6.6 | Validate explanations with domain users at Penser *(FR-4, NFR-2)* | 6.4, 6.5 |
| 7.5 | Claim submission endpoint with validation (list missing info) *(UC-1, US-1, US-3, US-4)* | API spec (7.4), DB (7.2) |
| 7.6 | Analysis-results endpoint *(UC-3, FR-7)* | 7.3, 7.4 |
| 7.7 | Clear error responses for invalid API requests *(US-4)* | 7.4 |
| 7.9 | Role-based access (customers, employees, admins) *(NFR-3)* | Cognito (7.8) |
| 7.10 | Enforce HTTPS/TLS between UI, API and backend *(NIST CSF)* | Deployed environment |
| 7.11 | Decide encryption-at-rest and data-retention settings *(NIST CSF)* | Schema (7.1) |
| 7.12 | Separate ML models, web UI and API into independently updatable components *(NFR-4, NFR-6)* | Architecture doc (3.9) |
| 8.2 | Login / authenticated session flow *(FR-7)* | Cognito (7.8), wireframes (8.1) |
| 8.3 | Claim submission form with validation messages *(UC-1, US-1)* | 8.1, 7.5 |
| 8.4 | Claim analysis results view *(UC-2, US-2, NFR-2)* | 8.1, 7.6 |
| 8.5 | Graphical confidence-range visualization *(FR-6, NFR-2)* | 6.3, 8.4 |
| 8.6 | "Analysis unavailable" message *(US-2)* | 8.4 |
| 8.7 | Leadership/engineering dashboard (claim types, job classes, industries) | 7.6, 8.1 |
| 8.8 | Employer/broker insight views | 8.7 |
| 8.9 | WCAG 2.2 AA: contrast, labels, keyboard navigation, readable text | UI built (8.2–8.8) |
| 8.10 | Accessibility testing before deployment | 8.9 |
| 9.1 | Data-loading pipeline for updated claim data *(UC-4, FR-8)* | Pipeline (2.6) |
| 9.2 | Retraining pipeline for all models *(FR-8, **P1**)* | Models (4.4, 5.1), 9.1 |
| 9.3 | Validate updated models against held-out data before deploying *(UC-4)* | 9.2 |
| 9.4 | Deploy updated models without replacing existing ones on failure; report invalid data *(US-5)* | 9.3 |
| 9.5 | Admin-only retraining trigger (UI or CLI) *(UC-4, US-5)* | 9.2, 7.9 |
| 9.6 | Document retraining schedule (~6 months) and inflation re-evaluation *(FR-8)* | 9.2 |
| 9.7 | Retraining approach and cost estimate proposal for Penser *(FR-8)* | 9.6 |
| 10.1 | Performance test: ~1 claim/min normal, 3 claims/min peak *(NFR-1)* | Working API (7.6) |
| 10.2 | Verify inference time well under 10-minute ceiling *(NFR-1)* | 7.3 |
| 10.3 | Unit tests for scoring, weights, inflation adjustment *(FR-2, FR-3, FR-9)* | 4.4, 5.3 |
| 10.4 | Integration tests for API and UI flows (UC-1 to UC-4) | 7.x, 8.x |
| 10.5 | Test exceptional conditions in user stories (US-1–US-5) | 10.4 |
| 10.6 | Security testing (auth, role access, API security) *(NFR-3)* | 7.9 |
| 10.7 | Model validation and bias evaluation report *(NIST AI RMF, ACM)* | 4.7, 5.6 |
| 10.8 | Verify traceability: each FR/NFR covered by tests | 10.3–10.6 |
| 10.9 | User acceptance review with Penser examiners/leadership | System working end to end |
| 2.9 | Assess dataset sufficiency/diversity; request older claims (1990s) if needed *(FR-8)* | Models evaluated (4.6, 5.6) |
| 11.2 | Evaluate AWS vs SageMaker hosting options and estimate costs *(NFR-5, NFR-6)* | Architecture doc (3.9) |
| 11.3 | Configure Cognito, networking, secrets management *(FR-7, NFR-3)* | 11.2 |
| 11.5 | Ensure Washington State-first design is extensible to other states | Architecture doc (3.9) |
| 12.2 | API documentation *(FR-7, NFR-4)* | API spec (7.4) |
| 12.3 | User guide for examiners; admin guide for retraining/weights *(NFR-6)* | UI + retraining built |
| 12.4 | Model documentation (approach, features, weights, evaluation, limitations) | Models evaluated |
| 12.5 | Final report/presentation (AI/ML, dashboard, backend, database) | Everything else |

### Icebox (conditional – only if the trigger happens)

| ID | Task | Trigger |
|----|------|---------|
| 11.4 | Deploy to cloud within budget (~$100–$300 AWS credits) *(NFR-5)* | Penser approves cloud deployment |
| 5.5 | Handle historical cost differences for 1990s claims *(FR-9)* | Older claims are added (2.9) |

---

## 📋 To Do (ready now – everything here is unblocked)

| ID | Task | Sprint |
|----|------|--------|
| 1.2 | Sign NDAs for all team members (data has legal/medical info) | 1 |
| 1.3 | Confirm Claude access with Ritvik Sharma | 1 |
| 1.7 | Resolve TBD items in requirements (sub-scores, weights, fields, API endpoints, auth, confidence method, explanation layout) *(FR-2, FR-3, FR-4, FR-6, FR-7)* | 1 |
| 2.1 | Obtain column headers from Penser (Keno Peck) *(FR-1)* | 1 |
| 2.3 | Obtain ~10,000-claim, 5-year dataset (~7 MB) and sanitized diary notes (expected early October) *(FR-1)* | 1 |
| 2.10 | Define secure data handling/storage (access control, no PII in logs or outputs) *(NFR-3)* | 1 |
| 3.1 | Research candidate ML approaches (tabular, NLP on notes, interpretable) and select one | 1 |
| 11.1 | Set up local development environment *(NFR-6)* | 1 |

## 🔧 In Progress (limit 4)

| ID | Task | Owner |
|----|------|-------|
| 2.2 | Review column headers and document each field *(FR-1)* | |

## 🔍 In Review (limit 3)

*(empty)*

## ✅ Done

| ID | Task |
|----|------|
| 1.1 | Set up Kanban board and sprint structure (this file) |

---

## 🧪 Sprint 2 prototype coverage (status as of Nov 7, 2026)

PR #96 "Claims dashboard demo" (merged Nov 3, 2026) added a baseline prototype. It has **no linked
issues, no review, and no real data** (tests use synthetic fixtures only). So these cards are **not Done**
under the Definition of Done (needs a teammate review and updated spec text). They stay in their lanes
below until reviewed. "Covered" means the prototype implements it with placeholder logic.
Card numbers match the GitHub issue titles.

| ID | What the prototype covers | Gap before Done |
|----|---------------------------|-----------------|
| 2.6 | `pipeline/clean.py`: de-dupe, types, test-claim drop, identifier masking | Not run on real data; no train/validation split yet |
| 3.2, 3.4 | Four sub-scores (duration, medical intensity, time loss, legal); 0–100 scale | Placeholder; Penser has not approved |
| 3.5 | No feature counts diary tasks or examiner activity | Needs review against Penser's definition |
| 3.9 | Architecture decisions in Solution Approach, section V | Not yet proposed to Penser (3.10) |
| 4.1 | `pipeline/features.py` structured features | No diary-note features (4.2) |
| 4.4, 4.5 | Weighted average; weights in `config/weights.yaml`, `PUT /weights` | Weights are placeholders |
| 5.1 | Lookup-table cost median and P10–P90 range | Not a trained model (design calls for quantile regression) |
| 5.3, 5.4 | Inflation parameter (0%) and tunable from the UI | Placeholder rate; not validated |
| 5.7 | Complexity and cost produced together, shown separately | None for baseline |
| 6.1–6.4 | Heuristic confidence (0–100); top-3 reason codes | Not validated; no note-derived factors |
| 7.1, 7.2 | SQLite schema, append-only estimates | Design calls for PostgreSQL |
| 7.3, 7.4, 7.6 | FastAPI endpoints (`/claims`, `/estimate`, `/workload`, `/analytics`, `/weights`) | No Cognito, no async requests, local only |
| 8.4, 8.7, 8.8 | Claim Scorer, Workload Board, Cost & Risk Insights | No login, no claim submission form (8.3), no accessibility testing (8.9, 8.10) |

Still blocked by missing data (not started): 2.1 and 2.3 (data not delivered), 2.2, 2.4, 2.5, 2.7, 2.8,
4.2, 4.3, 5.2 and complexity label generation with Claude.

---

## 🔁 Recurring Tasks (not on the board; handle on their cadence)

| ID | Task | Cadence |
|----|------|---------|
| 1.4 | Weekly online meeting with Penser; attend sprint stand-ups offered by Joell Parks | Weekly |
| 1.5 | Track AWS/Claude spending against $300–$500 budget; notify Joell Parks when approaching $500 *(NFR-5)* | Weekly |
| 1.6 | Write sprint report and documents | End of each sprint (Oct 5, Nov 5, Dec 5) |
| 12.1 | Update Requirements and Specification as TBDs are resolved | After each decision |
