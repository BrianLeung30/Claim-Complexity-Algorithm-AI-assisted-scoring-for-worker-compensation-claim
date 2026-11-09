# Sprint 2 Report (October 12 – November 8)

## YouTube Link of Sprint 2 Video

## What's New (User Facing)

- **Claim Scorer dashboard (demo):** Examiners can search, filter, sort and page through claims, and open a claim to see its complexity score (0–100) and its cost estimate (low / median / high with a 0–100 confidence). The two estimates are always shown separately and never merged. Each score comes with the top three reason codes (for example, "Strain: long time to close") and the claim's earlier estimates.
- **Workload Board (demo):** Open and Reopened claims grouped by adjuster, with claim counts, total and average complexity, high-complexity counts and warnings. A slide-out panel lets a user simulate reassigning a claim to another adjuster. The simulation is a preview only and changes no data.
- **Cost & Risk Insights (demo):** Charts and tables of costs and complexity grouped by employer, Tier 2, loss cause or injury year. Incurred-to-date is kept separate from final cost on closed claims.
- **Adjustable weights (demo):** Users can move the four complexity weights and see the effect as a preview before saving. Saving asks for confirmation and recalculates Open and Reopened claims. Previewing never writes anything.
- **Local backend API (demo):** A REST API for listing claims, getting one claim, requesting estimates (single and batch), workload, analytics, filters and weights. Estimates are stored as an append-only history, so earlier estimates are never overwritten.
- **Data cleaning pipeline:** One command cleans the raw claims extract (de-duplication, type conversion, test-claim removal, masking of identifying formats) and builds the features the baseline uses. Claimant-identifying numbers are masked using a local-only list that is never committed.
- **Important caveat:** All of the above is a **preliminary baseline demo**. It produces lookup-table estimates, not trained machine-learning predictions. All weights and thresholds are placeholders pending approval by Penser.

## Work Summary (Developer Facing)

This sprint had two parts: turning the Sprint 1 research into architecture design decisions, and building a working demo that follows those decisions as closely as possible with only partial data. On the design side, the team chose a four-layer architecture (presentation, application, analysis, data) because it keeps the ML models separate from the web interface and API, lets a retrained model be swapped in without changing the interface, and supports the planned move from local development to AWS. We decomposed the system into six subsystems (data ingestion and preprocessing, complexity label generation, model training and benchmarking, inference and scoring, backend API and authentication, and web dashboard) that communicate only through a small set of interfaces. We also made the main technology choices: Claude-generated complexity labels with a fixed rubric (because Penser data has no human-assigned complexity scores), Industry-BERT-Insurance as the leading candidate model (small enough to retrain within the $300–$500 budget), quantile regression for the cost range, a PostgreSQL data layer, AWS Cognito for authentication, and a React dashboard. The team selected the model architecture together. On the implementation side, Kevin built a local demo of the pipeline from raw data through to the dashboard, which we will present to Penser for feedback. Because we have received only about half of the data columns, and the other half (the more important half) has never been seen, and we have no sanitized diary notes, the ML parts of the design (Claude labeling, BERT fine-tuning, quantile regression) could not be built or benchmarked. Instead the demo uses lookup-table baselines grouped by intake fields (Loss Type, Loss Cause, Loss Nature), which gives the same outputs (separate complexity score with sub-scores, cost range, confidence, reason codes) so the backend and dashboard could be built and tested now and the model swapped in later. The main barrier was data access. Penser's new claims system launched late, which delayed the data extract, and then our mentor Keno, who works directly with us on the data, was in a car accident. Penser has sent about half of the data columns so far, and the more important half has still not arrived; we expect to receive it soon. Without it we are stuck on data inspection, label generation, model training and benchmarking, and there is little more we can do on those until it arrives. Claude access has been granted this sprint, so label generation can start once the data and Penser's approval to send it to the API are in place. AWS access has not been granted yet. We used the time to build the parts that do not depend on real data and to test them with synthetic fixtures generated inside the tests: 83 automated test cases in total (33 for the Claim Scorer, weights and backend API, 12 for the Workload Board, 14 for Cost & Risk Insights and 24 for the data pipeline). Key learnings: designing the system so the model sits behind a stable interface let us make real progress on the backend and dashboard without data, and keeping the complexity score and cost estimate strictly separate (and excluding examiner touch points from complexity) needs to be enforced in code, not just in the documents.

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

Here are links to the issues that we completed in this sprint (the "Done" column of the [Kanban board](https://github.com/users/BrianLeung30/projects/2)):

- [#1 Set up KanBan Board](https://github.com/BrianLeung30/Claim-Complexity-Algorithm-AI-assisted-scoring-for-worker-compensation-claim/issues/1) (assigned to Brian Leung)
- [#3 Set up Claude Team Account](https://github.com/BrianLeung30/Claim-Complexity-Algorithm-AI-assisted-scoring-for-worker-compensation-claim/issues/3): Claude access has been granted
- [#4 Sign NDAs](https://github.com/BrianLeung30/Claim-Complexity-Algorithm-AI-assisted-scoring-for-worker-compensation-claim/issues/4)
- [#5 Research ML approaches](https://github.com/BrianLeung30/Claim-Complexity-Algorithm-AI-assisted-scoring-for-worker-compensation-claim/issues/5)

In review (work done, awaiting team review):

- [#6 Select Model Architecture](https://github.com/BrianLeung30/Claim-Complexity-Algorithm-AI-assisted-scoring-for-worker-compensation-claim/issues/6): decisions are written up in the Solution Approach, section V (four-layer architecture, six subsystems, Claude-generated labels, Industry-BERT-Insurance as top candidate)
- [#7 Create Demo UI](https://github.com/BrianLeung30/Claim-Complexity-Algorithm-AI-assisted-scoring-for-worker-compensation-claim/issues/7): the baseline demo (Claim Scorer, Workload Board, Cost & Risk Insights, adjustable weights, local backend API and data pipeline). Per the sprint slides, Kevin created it. The code is in the `Code/` folder of the team repository.

## Incomplete Issues/User Stories

Here are links to issues we worked on but did not complete in this sprint:

- [#8 Receive Dataset](https://github.com/BrianLeung30/Claim-Complexity-Algorithm-AI-assisted-scoring-for-worker-compensation-claim/issues/8) (In progress): only about half of the data columns have been delivered, and the important half has not (Penser's new system launched late, and our mentor Keno was then in a car accident).
- [#2 Set up AWS account](https://github.com/BrianLeung30/Claim-Complexity-Algorithm-AI-assisted-scoring-for-worker-compensation-claim/issues/2) (Ready): AWS access has not been granted yet. Cognito authentication, PostgreSQL and cloud hosting are deferred until it is.
- [#9 Clean Data](https://github.com/BrianLeung30/Claim-Complexity-Algorithm-AI-assisted-scoring-for-worker-compensation-claim/issues/9) (Backlog): a cleaning pipeline exists in the demo, but it has not been run on the real data.
- [#10 Exploratory Data Analysis](https://github.com/BrianLeung30/Claim-Complexity-Algorithm-AI-assisted-scoring-for-worker-compensation-claim/issues/10) (Backlog): needs the full dataset.
- [#13 Feature Engineering](https://github.com/BrianLeung30/Claim-Complexity-Algorithm-AI-assisted-scoring-for-worker-compensation-claim/issues/13) (Backlog): structured-field features exist in the demo; diary-note features need the sanitized notes.
- [#12 Generate Training Labels](https://github.com/BrianLeung30/Claim-Complexity-Algorithm-AI-assisted-scoring-for-worker-compensation-claim/issues/12) (Backlog): Claude access is now granted; still blocked on the missing columns, sanitized notes and Penser's approval to send data to the API.
- [#11 Train Baseline Model](https://github.com/BrianLeung30/Claim-Complexity-Algorithm-AI-assisted-scoring-for-worker-compensation-claim/issues/11) (Backlog): the demo uses a lookup-table baseline, not a trained model; training needs the data and labels.

Not on the board yet: the demo to Penser (not held yet) and the meeting with an expert claims handler.

## Code Files for Review

Please review the following code files, which were actively developed during this sprint, for quality:

Links point to the `main` branch of the team repository.

- [Code/pipeline/clean.py](https://github.com/BrianLeung30/Claim-Complexity-Algorithm-AI-assisted-scoring-for-worker-compensation-claim/blob/main/Code/pipeline/clean.py)
- [Code/pipeline/features.py](https://github.com/BrianLeung30/Claim-Complexity-Algorithm-AI-assisted-scoring-for-worker-compensation-claim/blob/main/Code/pipeline/features.py)
- [Code/models/baseline.py](https://github.com/BrianLeung30/Claim-Complexity-Algorithm-AI-assisted-scoring-for-worker-compensation-claim/blob/main/Code/models/baseline.py)
- [Code/backend/api.py](https://github.com/BrianLeung30/Claim-Complexity-Algorithm-AI-assisted-scoring-for-worker-compensation-claim/blob/main/Code/backend/api.py)
- [Code/backend/service.py](https://github.com/BrianLeung30/Claim-Complexity-Algorithm-AI-assisted-scoring-for-worker-compensation-claim/blob/main/Code/backend/service.py)
- [Code/backend/db.py](https://github.com/BrianLeung30/Claim-Complexity-Algorithm-AI-assisted-scoring-for-worker-compensation-claim/blob/main/Code/backend/db.py)
- [Code/web/src/services/api.ts](https://github.com/BrianLeung30/Claim-Complexity-Algorithm-AI-assisted-scoring-for-worker-compensation-claim/blob/main/Code/web/src/services/api.ts)
- [Code/web/src/pages/WorkloadPage.tsx](https://github.com/BrianLeung30/Claim-Complexity-Algorithm-AI-assisted-scoring-for-worker-compensation-claim/blob/main/Code/web/src/pages/WorkloadPage.tsx)
- [Code/config/weights.yaml](https://github.com/BrianLeung30/Claim-Complexity-Algorithm-AI-assisted-scoring-for-worker-compensation-claim/blob/main/Code/config/weights.yaml)

## Retrospective Summary

Here's what went well:

- **Design decisions were made and documented:** The layered architecture, six-subsystem decomposition, interfaces, data design and UI design are all documented, each with the alternatives we considered and why we chose what we did.
- **Progress without data:** By putting the estimator behind a stable interface, we built and tested the full path from cleaning to dashboard using synthetic test data, so only the model needs to change when data arrives.
- **Project rules enforced in code:** Complexity and cost stay separate, touch-point counts are excluded from complexity, estimates are append-only, and weight sliders only preview until a confirmed save.
- **Testing:** 83 automated test cases on synthetic data cover the scorer, workload board, insights and data pipeline.
- **Data confidentiality:** Everything stays local, tests use synthetic fixtures only, and the identifier-mask list is kept out of version control.
- **Easy to extend:** Weights, the inflation rate and thresholds are configurable and take effect in seconds with no retraining, and the diary-note features can be added through a registered feature group without touching cleaning or scoring.

Here's what we'd like to improve:

- **Data dependency risk:** Two sprints have been affected by data delays, and we have only half of the columns. We need a fallback plan, such as agreed sample values for the missing columns, so we are less exposed to a single delivery.
- **Escalation:** We should have escalated the data delay to Penser's other contacts sooner, instead of waiting for a single mentor.
- **Issue tracking:** The Kanban board has 13 issues; only one has an assignee, none has a milestone or story points, and the demo code is not linked to any issue. These need to be kept up to date as work happens, and the board needs more issues so each task and each member's contribution is visible.
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
- Add issues for the remaining tasks (including the demo to Penser and the claims handler meeting), assign members, milestones and story points, and record the Sprint 3 demo video.
