# Sprint 2 Report (October 12 – November 8)

## YouTube Link of Sprint 2 Video
https://youtu.be/tuG2QdYFncg

## What's New (User Facing)

- **Claim Scorer dashboard (demo):** Examiners can search, filter, sort and page through claims, and open a claim to see its complexity score (0–100) and its cost estimate (low / median / high with a 0–100 confidence). The two estimates are always shown separately and never merged. Each score comes with the top three reason codes (for example, "Strain: long time to close") and the claim's earlier estimates.
- **Workload Board (demo):** Open and Reopened claims grouped by adjuster, with claim counts, total and average complexity, high-complexity counts and warnings. A slide-out panel lets a user simulate reassigning a claim to another adjuster. The simulation is a preview only and changes no data.
- **Cost & Risk Insights (demo):** Charts and tables of costs and complexity grouped by employer, Tier 2, loss cause or injury year. Incurred-to-date is kept separate from final cost on closed claims.
- **Adjustable weights (demo):** Users can move the four complexity weights and see the effect as a preview before saving. Saving asks for confirmation and recalculates Open and Reopened claims. Previewing never writes anything.
- **Local backend API (demo):** A REST API for listing claims, getting one claim, requesting estimates (single and batch), workload, analytics, filters and weights. Estimates are stored as an append-only history, so earlier estimates are never overwritten.
- **Data cleaning pipeline:** One command cleans the raw claims extract (de-duplication, type conversion, test-claim removal, masking of identifying formats) and builds the features the baseline uses. Claimant-identifying numbers are masked using a local-only list that is never committed.
- **Important caveat:** All of the above is a **preliminary baseline demo**. It produces lookup-table estimates, not trained machine-learning predictions. All weights and thresholds are placeholders pending approval by Penser.

## Work Summary (Developer Facing)

This sprint had two parts: turning the Sprint 1 research into architecture design decisions, and building a working demo that follows those decisions as closely as possible with only partial data. On the design side, the team chose a four-layer architecture (presentation, application, analysis, data) because it keeps the ML models separate from the web interface and API, lets a retrained model be swapped in without changing the interface, and supports the planned move from local development to AWS. We decomposed the system into six subsystems (data ingestion and preprocessing, complexity label generation, model training and benchmarking, inference and scoring, backend API and authentication, and web dashboard) that communicate only through a small set of interfaces. We also made the main technology choices: Claude-generated complexity labels with a fixed rubric (because Penser data has no human-assigned complexity scores), Industry-BERT-Insurance as the leading candidate model (small enough to retrain within the $300–$500 budget), quantile regression for the cost range, a PostgreSQL data layer, AWS Cognito for authentication, and a React dashboard. On the implementation side, we built a local demo of the pipeline from raw data through to the dashboard. Because we have received only about half of the data columns, and the other half (the more important half) has never been seen, and we have no sanitized diary notes, the ML parts of the design (Claude labeling, BERT fine-tuning, quantile regression) could not be built or benchmarked. Instead the demo uses lookup-table baselines grouped by intake fields (Loss Type, Loss Cause, Loss Nature), which gives the same outputs (separate complexity score with sub-scores, cost range, confidence, reason codes) so the backend and dashboard could be built and tested now and the model swapped in later. The main barrier was data access. Penser's new claims system launched late, which delayed the data extract, and then our mentor Keno, who works directly with us on the data, was in a car accident. Penser has sent about half of the data columns so far, and the more important half has still not arrived; we expect to receive it soon. Without it we are stuck on data inspection, label generation, model training and benchmarking, and there is little more we can do on those until it arrives. Claude access has been granted this sprint, so label generation can start once the data and Penser's approval to send it to the API are in place. AWS access has not been granted yet. We used the time to build the parts that do not depend on real data and to test them with synthetic fixtures generated inside the tests. Key learnings: designing the system so the model sits behind a stable interface let us make real progress on the backend and dashboard without data, and keeping the complexity score and cost estimate strictly separate (and excluding examiner touch points from complexity) needs to be enforced in code, not just in the documents.

## Unfinished Work

Most unfinished work is blocked by the missing data, not by lack of effort or time.

- **Data inspection and validation:** Only about half of the data columns have been received, and the important half has never been seen, so we cannot yet check the data's structure, quality or completeness, or whether about 10,000 claims is enough.
- **Complexity label generation (Claude API):** Not started. Claude access has now been granted, but label generation still needs the missing columns, Penser-approved sanitized diary notes and Penser's approval to send data to the API.
- **Model training and benchmarking:** Not started. The Industry-BERT-Insurance benchmark (regression layer only versus LoRA fine-tune), payout and complexity training, and the final-model choice all need the real data and the generated labels.
- **Cost range and confidence from the real model:** The demo uses a placeholder heuristic (group size and spread of the P10–P90 range). The planned quantile-regression approach and the confidence method are not built.
- **Diary-note features:** Not included. The pipeline has a registered extension point so note features can be added when the sanitized notes arrive.
- **Design-versus-demo gaps:** The demo uses a local SQLite database and a local FastAPI app with no authentication. The design calls for PostgreSQL, AWS Cognito, a model registry with versioned models, and asynchronous request handling for the 10-minute inference limit. These are deferred until the models exist and AWS access is available. AWS access has not been granted yet.
- **Penser approvals:** All complexity weights, the inflation rate, the cost percentiles, the confidence formula, the workload thresholds and the complexity bands are placeholders awaiting Penser approval.
- **Demo to Penser:** The demo has not happened yet.
- **Examiner review of a sample of Claude-generated labels:** Planned in the design, but cannot start until labels exist.

## Completed Issues/User Stories

Here are links to the issues that we completed in this sprint:

On GitHub, **no issue was closed this sprint**, and no issue has a milestone or an assignee. The demo was merged in pull request [#96 "Claims dashboard demo"](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/pull/96) (merged Nov 3, 2026, 88 files), which has no linked issues and no reviews. The issues below were partly implemented by that PR as a baseline with placeholder logic. They are listed here because the work exists, but they should not be counted as closed until reviewed and checked against real data.

Base URL for issues: `https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/<number>`

- [#3 [2.6] Data cleaning and preprocessing pipeline](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/3): cleaning is built; no real-data run or train/validation split yet
- [#6 [3.2] Define complexity sub-scores](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/6) and [#8 [3.4] Complexity score scale](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/8): four placeholder sub-scores on a 0–100 scale
- [#9 [3.5] Touch-point safeguard](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/9): no feature counts diary tasks or examiner activity
- [#13 [3.9] System architecture/design doc](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/13): written in Solution Approach, section V
- [#19 [4.1] Feature engineering for structured fields](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/19)
- [#22 [4.4] Weighted-average complexity score](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/22) and [#23 [4.5] Configurable weights](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/23)
- [#24 [5.1] Cost estimation using closed claims](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/24): lookup-table baseline, not a trained model
- [#15 [7.1] Database schema](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/15) and [#16 [7.2] Local database](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/16): SQLite, not PostgreSQL
- [#17 [7.4] API endpoints](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/17), [#26 [7.3] Inference endpoint](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/26)
- Also started, and moved from `sprint-3` to `sprint-2` on Nov 7: [#30 [5.3] Inflation](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/30), [#31 [5.4]](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/31), [#33 [5.7]](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/33), [#34–#37 [6.1–6.4] confidence and reasons](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/34), [#41 [7.6]](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/41), [#49 [8.4]](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/49), [#52 [8.7]](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/52), [#53 [8.8]](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/53)

Closed earlier: [#91 [1.1] Set up Kanban board and sprint structure](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/91) (closed Oct 24, 2026).

## Incomplete Issues/User Stories

Here are links to issues we worked on but did not complete in this sprint:

- [#85 [2.1] Column headers](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/85), [#86 [2.3] Dataset and sanitized notes](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/86), [#90 [2.2] Column review](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/90): only about half of the data columns have been delivered, and the important half has not (Penser's new system launched late, and our mentor Keno was then in a car accident).
- [#1 [2.4]](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/1), [#2 [2.5]](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/2), [#4 [2.7]](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/4), [#5 [2.8]](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/5): sanitization check, exploratory analysis, closed-claim anchors and note mapping all need the dataset.
- [#20 [4.2] Diary-note features](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/20), [#21 [4.3] Train sub-score models](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/21), [#25 [5.2] Cost characteristics](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/25): blocked on the data and sanitized notes.
- [#83 [1.3] Confirm Claude access](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/83): Claude access has been granted, so the work is done and the issue can be closed.
- [#27 [7.8] AWS Cognito authentication](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/27): deferred because AWS access has not been granted yet.
- [#14 [3.10] Propose findings and model approach to Penser](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/14): the demo to Penser has not happened yet.
- [#97 [4.8] Complexity label generation with Claude API](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/issues/97): created Nov 7, 2026; Claude access is now granted; still blocked on the missing columns, sanitized notes and Penser approval to send data to the API.

## Code Files for Review

Please review the following code files, which were actively developed during this sprint, for quality:

Links point to the `main` branch of `penserna.ghe.com/Penser-Capstone/Claim-Complexity`, where the demo was merged in PR #96.

- [pipeline/clean.py](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/blob/main/pipeline/clean.py)
- [pipeline/features.py](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/blob/main/pipeline/features.py)
- [models/baseline.py](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/blob/main/models/baseline.py)
- [backend/api.py](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/blob/main/backend/api.py)
- [backend/service.py](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/blob/main/backend/service.py)
- [backend/db.py](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/blob/main/backend/db.py)
- [web/src/services/api.ts](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/blob/main/web/src/services/api.ts)
- [web/src/pages/WorkloadPage.tsx](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/blob/main/web/src/pages/WorkloadPage.tsx)
- [config/weights.yaml](https://penserna.ghe.com/Penser-Capstone/Claim-Complexity/blob/main/config/weights.yaml)

## Retrospective Summary

Here's what went well:

- **Design decisions were made and documented:** The layered architecture, six-subsystem decomposition, interfaces, data design and UI design are all documented, each with the alternatives we considered and why we chose what we did.
- **Progress without data:** By putting the estimator behind a stable interface, we built and tested the full path from cleaning to dashboard using synthetic test data, so only the model needs to change when data arrives.
- **Project rules enforced in code:** Complexity and cost stay separate, touch-point counts are excluded from complexity, estimates are append-only, and weight sliders only preview until a confirmed save.
- **Data confidentiality:** Everything stays local, tests use synthetic fixtures only, and the identifier-mask list is kept out of version control.
- **Easy to extend:** Weights, the inflation rate and thresholds are configurable and take effect in seconds with no retraining, and the diary-note features can be added through a registered feature group without touching cleaning or scoring.

Here's what we'd like to improve:

- **Data dependency risk:** Two sprints have been affected by data delays, and we have only half of the columns. We need a fallback plan, such as agreed sample values for the missing columns, so we are less exposed to a single delivery.
- **Escalation:** We should have escalated the data delay to Penser's other contacts sooner, instead of waiting for a single mentor.
- **Issue tracking:** Issues, milestones, pull requests, story points and before/after videos need to be kept up to date as work happens.
- **Gap between design and demo:** The demo uses a lookup-table baseline, SQLite and no authentication, while the design uses BERT, PostgreSQL and Cognito. We need to be clear about this in reports and demos so the demo is not mistaken for the final system.
- **Approvals:** Many parameters are still placeholders and need Penser's sign-off.

Here are changes we plan to implement in the next sprint:

- Get the missing columns (the important half), or an agreed fallback, as the top priority. Follow up with Penser's other contacts and confirm a delivery date.
- When the data arrives: inspect it, run the cleaning pipeline, review the flagged long digit runs, and confirm that the baseline works on the real columns.
- Start complexity label generation (fixed Claude rubric) now that Claude access is granted, once the missing columns, sanitized diary notes and Penser's approval to send data are in place. Track API spend against the $300–$500 budget and notify the mentor if costs approach $500.
- Benchmark Industry-BERT-Insurance (regression layer only, then LoRA fine-tune) against the lookup-table baseline, and check cost accuracy on a held-out set.
- Replace the placeholder confidence heuristic with the quantile-regression range and a confirmed confidence method.
- Give the demo to Penser.
- Request AWS access.
- Meet with the expert claims handler and ask Penser to approve the weights, thresholds and complexity bands.
- Move toward the designed stack as access allows: PostgreSQL, AWS Cognito, a model registry and asynchronous request handling.
- Update the GitHub issues, milestones and story points, and record the Sprint 3 demo video.
