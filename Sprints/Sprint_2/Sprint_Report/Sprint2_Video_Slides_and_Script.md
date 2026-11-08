# Sprint 2 Video: Slide Text and Script

Organized by the sections of "Sprint 2 Rubrics-3.pdf" (the rubric has two sections numbered 9, so they are 9a and 9b here). Each section has the words for the slide, then the script. Anything the team still has to fill in is marked **[MISSING: …]**.

Facts come from the Sprint 2 report, the README, `CLAUDE.md` and the GitHub issues. Where the team must confirm something, it is flagged. Do not show claim data, identifiers or free text on screen.

**[MISSING: speaker for each section, video length limit, and the demo date.]** Speakers are written as [Speaker 1/2/3]. The team is Kevin Herrera (team lead), Brian Leung and Ishaan Joshi.

---

## 1. Introduction

### Slide

**Claim Complexity Algorithm**
Sprint 2 | Penser North America | WSU Capstone

- Kevin Herrera, Team Lead: **[MISSING: his Sprint 2 role]**
- Brian Leung: **[MISSING: his Sprint 2 role]**
- Ishaan Joshi: **[MISSING: his Sprint 2 role]**

What we are building: an AI-assisted tool for Washington workers' compensation claims that gives each claim

- a **complexity score** (0–100): how hard the claim is to manage
- a **cost estimate**: low / median / high, with a 0–100 confidence

Two separate numbers. Never combined.

### Script

[Speaker 1] "Hi, we're the WSU capstone team working with Penser North America, a Washington workers' compensation third-party administrator. I'm Kevin Herrera, the team lead. With me are Brian Leung and Ishaan Joshi. [Each member: one sentence on their role.] Today we're presenting Sprint 2.

Our project helps claims examiners. For each claim, our system produces two separate results: a complexity score from zero to one hundred, which says how hard the claim is to manage, and a cost estimate with a low, median and high range and a confidence level. We keep them separate on purpose, and examiner activity like diary task counts is never used to measure complexity, because Penser told us touch points are not complexity."

---

## 2. Sprint Objectives

### Slide

**Sprint 2 goals**

1. Make the architecture design decisions
2. Build a working demo: data cleaning → baseline estimates → API → dashboard
3. Get the data and access needed for model work (data, Claude, AWS)
4. Document the design and the test approach

Reality check: goal 3 is only partly met (see Challenges).

### Script

[Speaker 1] "In Sprint 2 we had four objectives. First, make the key architecture decisions we put off in Sprint 1. Second, build a working demo that goes from raw claim data, through baseline estimates and an API, to a dashboard. Third, get the data and access we need to start model work, which means the claims data, Claude access and AWS access. And fourth, document the design and how we test it. I'll be upfront that the third objective is only partly met, and I'll explain why in the challenges section."

---

## 3. Feature Implementation

Each team member should present at least one feature with a demo and a before-and-after. Assign them below.

**[MISSING: which team member built and will present each feature. The merged demo is one pull request (#96, merged by Kevin Herrera), so individual contributions are not visible on GitHub. The three splits below are suggestions; adjust to match who actually did the work.]**

### Slide 3a: Claim Scorer, Weights and Backend API **[MISSING: presenter]**

**Before:** Complexity is judged subjectively, and no one view shows complexity and cost together.
**After:**

- Search, filter, sort and page through claims
- Complexity score (0–100) and cost range with confidence, shown separately
- Top 3 reason codes per score, estimate history
- Weight sliders preview a change locally; only a confirmed Save changes data
- Local REST API; estimates stored append-only

**Testing:** pytest backend tests and frontend tests, synthetic data only. **[MISSING: pass counts and test results to show.]**

### Slide 3b: Workload Board **[MISSING: presenter]**

**Before:** No quick way to see how much complex work each adjuster holds.
**After:**

- Open and Reopened claims grouped by adjuster
- Claim counts, total and average complexity, high-complexity counts, warnings
- Side panel with a "what if" reassignment: preview only, nothing saved
- Thresholds are placeholders pending Penser approval

### Slide 3c: Cost & Risk Insights and Data Pipeline **[MISSING: presenter]**

**Before:** Leadership has no view of which claim groups drive cost.
**After:**

- Costs and complexity by employer, Tier 2, loss cause or injury year
- Incurred to date kept separate from final cost on closed claims
- Cleaning pipeline: de-duplication, test-claim removal, identifier masking; local only

**Alignment with client needs:** every feature maps to a stated need: complexity score, separate cost estimate, confidence, explanations, adjustable weights, leadership views (FR-2 to FR-6, FR-9).

**Important:** this is a baseline demo using lookup tables built from intake fields. It is not the machine-learning model. Weights and thresholds are placeholders pending Penser approval.

### Script

[Speaker 1] "Now the features. Each of us built part of the demo. **[MISSING: confirm who built what.]**

[Speaker 1, Claim Scorer] Before this, examiners judged complexity by feel and had no single view of complexity and cost. Now (screen demo) you can search and filter claims, open one, and see the complexity score and the cost range with its confidence, shown as two separate numbers. Each score has its top three reasons. The weight sliders only preview changes locally. Nothing is saved until you confirm. We tested this with automated backend and frontend tests built on synthetic data, and never on real claims. **[MISSING: say test counts.]**

[Speaker 2, Workload Board] Before, there was no quick way to see how much complex work each adjuster is carrying. Now (demo) the board groups open claims by adjuster and shows totals, averages and warnings. If you click an adjuster, a panel lets you simulate moving a claim to someone else and see the effect. It's only a preview, and nothing is saved. The warning thresholds are placeholders until Penser approves them.

[Speaker 3, Insights and pipeline] Before, leadership couldn't see which groups of claims drive cost. Now (demo) the Insights page shows cost and complexity by employer, loss cause or injury year, and keeps cost incurred so far separate from final cost on closed claims. Behind it, the cleaning pipeline removes test claims and masks identifying information, and everything stays on our machines.

One honest note: these estimates come from lookup tables, not from the trained machine-learning model in our design. We built it this way so the backend and dashboard are ready, and the model can be swapped in when the data arrives."

---

## 4. Figma Prototype and Client Feedback

### Slide

**Figma prototype and client feedback**

**[MISSING: confirm whether a Figma prototype or wireframes exist. The GitHub issue for wireframes (#18, "Design UI wireframes/mockups") is still open, and I found no Figma files.]**

If none exists, state it:

- Not applicable this sprint: we built the dashboard directly in React instead of prototyping in Figma first.
- Screen designs are described in the Solution Approach (section VII): sign-in, claim analysis, leadership overview, administration.
- **[MISSING: any client feedback received on the demo or screens.]** The demo to Penser has not happened yet, so there is no client feedback on the UI to show.
- Next sprint: collect Penser's feedback after the demo and record the changes made.

### Script

[Speaker] "On Figma: **[MISSING: confirm.]** We did not create a separate Figma prototype this sprint. We built the dashboard directly in React so we could connect it to the backend, and the screens follow the layout in our Solution Approach document. Because we haven't yet given the demo to Penser, we don't have client feedback on the interface yet. That's a next step, and we'll record any changes we make from it."

---

## 5. Kanban Overview and Team Contributions

### Slide

**Kanban and issues** (screen share the GitHub board)

- 97 issues, grouped by epic (project management, data, research, ML, backend, UI, retraining, testing, deployment, documentation), labeled by sprint
- Sprint 2 now has 30 open issues
- Moved 11 started issues from Sprint 3 to Sprint 2
- Added #97: Claude label generation
- Demo merged in PR #96
- Nothing closed yet: issues are only partly done until reviewed and tested on real data

**Individual contributions:** **[MISSING: who did what. Issues have no assignees, no milestones and no story points, and PR #96 has no linked issues. Add these before recording.]**

| Member        | Issues / work | Story points  |
| ------------- | ------------- | ------------- |
| Kevin Herrera | **[MISSING]** | **[MISSING]** |
| Brian Leung   | **[MISSING]** | **[MISSING]** |
| Ishaan Joshi  | **[MISSING]** | **[MISSING]** |

### Script

[Speaker] "Here's our board. We have 97 issues, grouped by epic and labeled by sprint. This sprint we moved eleven issues that we had already started from Sprint 3 into Sprint 2, and we added a new issue for generating complexity labels with Claude. The demo went in as one pull request. We haven't closed the related issues yet, because they're only partly done until they're reviewed and checked against real data. **[MISSING: walk through each member's issues and points.]**"

---

## 6. Website Development (Wix, WordPress or similar)

### Slide

**Website platform: not applicable**

- Our front end is a custom React + TypeScript dashboard (Vite, Tailwind, Tremor), not a Wix or WordPress site.
- It is covered under Feature Implementation.

### Script

[Speaker] "This section doesn't apply to us. We're not using Wix, WordPress or a similar tool. Our interface is a custom React dashboard, which we covered in the feature section."

---

## 7. Documentation: Architecture, Database, UI and Testing Plan

### Slide 7a: System architecture

**Four layers, six subsystems**

- Presentation: React web dashboard
- Application: Python REST API + authentication (planned: AWS Cognito)
- Analysis: data ingestion and preprocessing, complexity label generation (Claude), model training and benchmarking, inference and scoring
- Data: PostgreSQL (planned) + model registry

Why layered: separates ML from UI/API, a retrained model can be swapped in, and each layer can move to AWS separately. Subsystems talk only through small interfaces (Claim Analysis API, Score Claim, Publish Model Version, Prepare Claim Features, Load Training Dataset, Generate Complexity Labels).

Show: Figure 2 (layered architecture) and Figure 3 (component diagram) from the Solution Approach.

**Key decisions:** Claude-generated labels using a fixed rubric (no human-labeled complexity exists); Industry-BERT-Insurance as top candidate model (fits the $300–$500 budget); quantile regression for the cost range; weights stored outside the model so they change without retraining.

**Demo vs. design:** the demo uses lookup tables, SQLite and no authentication; the design uses BERT, PostgreSQL and Cognito.

### Slide 7b: Database

- Designed tables: claims, diary_notes, complexity_labels, predictions, sub_scores, weights_config, model_versions, analysis_requests
- Demo database (SQLite): one row per claim with only the fields needed for search and analytics (no descriptions, notes or claimant details); append-only estimates table, enforced by database triggers; every estimate stores its weights version and time
- **[MISSING: ER diagram, relationships, and indexing/normalization strategy. None has been drawn or documented. Either create one or say it is planned.]**

### Slide 7c: User interface

- Screens: Claim Scorer, Claim detail, Workload Board (with side panel), Cost & Risk Insights, Model Settings
- Design basics: accessible layout (WCAG 2.2 AA is a goal, not yet tested), separate views for examiners and leadership
- Wireframes: **[MISSING: see section 4]**
- Client feedback adjustments: **[MISSING: none yet, demo not given]**

### Slide 7d: Testing plan

- **Unit:** Python tests for the pipeline and backend; frontend tests for logic, formatting and thresholds. All use synthetic fixtures generated in the tests, never the real file.
- **Checks:** `npm run typecheck`, `lint`, `test` and `build` for the front end; `pytest` for the back end.
- **Done so far:** unit-level tests above. **[MISSING: test results.]**
- **Planned (Sprint 3):** integration tests for the API and UI flows, exceptional conditions, performance (about 1 claim/min normal, 3/min peak, under 10 minutes), security testing, bias and model validation, requirements traceability, user acceptance with Penser.
- **Tools:** pytest, Vitest-style frontend tests **[MISSING: confirm the frontend test runner]**.
- Safeguards in tests: a frontend test checks that the UI "High" complexity band matches the backend workload threshold.

### Script

[Speaker 3] "Documentation. For architecture, we chose a four-layer design: a React dashboard on top, a Python API below it, an analysis layer that holds the machine-learning work, and a data layer. We chose layers for three reasons. They keep the models separate from the interface, so we can retrain every six months and swap in a new model without redesigning anything. And they let us move from local development to AWS one layer at a time. Inside the analysis layer we split the work into four subsystems, and they talk only through small interfaces, shown here in the component diagram.

The big design decisions: because Penser has no human-assigned complexity scores, we'll have Claude generate labels using a fixed rubric, then train a model to learn them. We'll check those labels against simple signals and ask Penser examiners to review a sample. Our top model candidate is Industry-BERT-Insurance, because it's small enough to retrain within our three-to-five-hundred-dollar budget. For cost ranges we plan quantile regression. And the weights live outside the model, so they can be changed without retraining.

The demo doesn't use all of that yet. It uses lookup tables, a local SQLite database and no login, so we could build and test the whole path before the data arrived.

For the database, we designed tables for claims, notes, labels, predictions, sub-scores, weights and model versions. The demo database keeps only the fields it needs and stores estimates as an append-only history, enforced by database triggers. **[MISSING: we don't have an ER diagram or an indexing plan yet. Say that, or create one before recording.]**

For the interface, these are the screens. **[MISSING: wireframes and client feedback, see section 4.]**

For testing, so far we have unit tests for the pipeline and backend and for the frontend, all using synthetic data. We also run type checks and linting. In Sprint 3 we plan integration tests, performance tests against the one-per-minute and ten-minute limits, security tests, a bias evaluation, and an acceptance review with Penser."

---

## 8. Sprint Achievements and Challenges

### Slide

**Sprint 1 → Sprint 2: progress**

| Sprint 1                                   | Sprint 2                                                                                  |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Requirements, research, no code            | Architecture decided and documented; working demo (cleaning, baseline, API, 3 dashboards) |
| No access to data, GitHub org, Claude, AWS | GitHub board set up with 97 issues; **Claude access granted**                             |
| No data                                    | About half of the data columns received                                                   |

**Challenges and what we did**

- _Data delays:_ Penser's new system launched late, then our mentor Keno was in a car accident. Still waiting on the **important half of the columns**. → Built what doesn't need real data; tested with synthetic fixtures; designed so the model can be swapped in.
- _AWS access not granted._ → Deferred Cognito and cloud hosting; developed locally.
- _No complexity labels in the data._ → Chose Claude-generated labels with a fixed rubric and a human review sample.
- _Privacy of claim data._ → Everything local, identifiers masked, tests synthetic.

**Stuck without the data:** there is not much more we can do on training and benchmarking until the data arrives.

### Script

[Speaker] "Here's how we progressed. In Sprint 1 we had requirements and research, but no code, and we were waiting on data and access. In Sprint 2 we made and documented our architecture decisions, built a working demo with cleaning, baseline estimates, an API and three dashboards, set up our GitHub board, and got Claude access.

Our biggest challenge was data. Penser's new claims system launched late, which delayed the extract, and then our mentor Keno, who works with us on the data, was in a car accident. We've now received about half of the data columns, but the important half hasn't arrived. We're stuck on data inspection, label generation and training until it does, and we expect it soon. What we did in the meantime was build everything that doesn't depend on it: we tested with synthetic data and designed the system so the real model can be swapped in later.

AWS access is also still pending, so we deferred authentication and cloud hosting. And since there are no human complexity labels, we chose Claude-generated labels with a fixed rubric and human review. All of this was done keeping the claim data private, local and masked."

---

## 9a. Next Steps and Sprint Retrospective

### Slide

**Went well**

- Architecture decisions documented with alternatives considered
- Progress without data: stable interface lets the model be swapped in later
- Project rules enforced in code (separate estimates, no touch-point features, append-only history)
- Data stayed confidential and local

**To improve**

- Data dependency: have a fallback for missing columns; escalate delays to more Penser contacts sooner
- Keep issues, milestones, story points, assignees and PR links up to date as we go
- Be clear that the demo is a baseline, not the final model
- Get Penser's approval on placeholder weights and thresholds

**Next sprint**

- Get the missing columns; inspect and clean the real data
- Start Claude label generation (after Penser approves sending data) and track the budget against $300–$500
- Benchmark Industry-BERT-Insurance against the baseline; quantile-regression cost range and confidence
- Give the demo to Penser and act on their feedback **[MISSING: demo date]**
- Request AWS access; move toward PostgreSQL and Cognito
- Meet the expert claims handler **[MISSING: date]**
- Integration, performance, security and bias testing

### Script

[Speaker] "What went well: we documented our architecture decisions with the alternatives we considered, we made progress without data by putting the model behind a stable interface, we enforced our project rules in code, and we kept the data private.

What we'd improve: we're too exposed to one data delivery, so we want a fallback and to escalate delays to more contacts earlier. We also need to keep our issues, points and pull requests up to date as we work. And we need to be clear that this demo is a baseline.

Next sprint: get the missing columns and run our pipeline on the real data, start generating labels with Claude once Penser approves, benchmark the BERT model against our baseline, give the demo to Penser and use their feedback, request AWS access, meet an expert claims handler, and begin integration, performance, security and bias testing."

---

## 9b. Responsible Use of Generative AI

### Slide

**How we used GenAI**

- Claude (Claude Code) **[MISSING: confirm which tools each member used, e.g. other assistants]**: **[MISSING: confirm tasks]**. Likely: code for the pipeline, backend and dashboard; tests; documentation and this report; kanban and issue drafting.
- Project rules written for the AI in `CLAUDE.md`: no real data sent anywhere, no raw rows printed, tests use synthetic data, no git commits or pushes by the AI, issues only updated when we ask
- Claude is also part of the _system design_: generating complexity labels from sanitized notes approved by Penser

**Benefits:** faster documentation and issue triage, test support, more complete tests and code checks
**Documented in:** `CLAUDE.md`, README, reports **[MISSING: MoMs / commit messages that mention AI use]**

**Limitations and our accountability**

- AI output can be wrong or overconfident, so the team reviews it. The demo was merged with no review, so **we plan to review it**.
- Bias risk: labels made by Claude may copy its mistakes. Mitigation: fixed rubric, compare to proxy signals, examiner review sample.
- Privacy: confidential claim data never goes to AI tools without Penser's approval.
- The team, not the AI, is accountable for the work.

### Script

[Speaker] "We used generative AI, mainly Claude Code, **[MISSING: confirm tools and tasks, and who used them]** to help write code and tests, draft documentation and organize our issues. We set rules for it in a file in the repository: it may not send claim data anywhere, print raw rows, or make git commits, and it may only change GitHub issues when we ask. That kept our use transparent and documented.

It helped us move faster on documentation, tests and the dashboard. But it can be wrong, so we review its work. In fact our demo went in without a review, and we plan to fix that. In our design, Claude also creates complexity labels, which can copy its mistakes or biases, so we'll use a fixed rubric, compare against other signals, and have Penser examiners check a sample. Only sanitized data that Penser approves will ever be sent. The team is responsible for everything we deliver."

---

## 10. Conclusion

### Slide

**Thank you**

- Penser North America: Joell Parks, Keno Peck, Ritvik Sharma
- We wish Keno a full recovery
- Where we are: design decided, baseline demo working
- What's next: real data → Claude labels → trained model → Penser feedback
- Questions?

### Script

[Speaker 1] "To wrap up: in Sprint 2 we decided our architecture, built a working baseline demo, and got Claude access. Our next step is the rest of the data, so we can create labels, train the model and replace the baseline. Thank you to Joell, Keno and Ritvik at Penser for their guidance and support, and we're wishing Keno a full recovery. Thanks for watching, and we're happy to take any questions."

---

## Missing information summary

1. Speaker assignments, each member's role, and the video length limit.
2. Which member built which feature; per-member issues and story points; assignees and milestones on GitHub.
3. Whether a Figma prototype or wireframes exist; any client feedback.
4. ER diagram, relationships and indexing/normalization strategy for the database.
5. Test results (counts) and the frontend test runner name.
6. Demo date, claims-handler meeting date, expected delivery date for the missing data columns.
7. Which GenAI tools each member used and for what; any MoMs or commits that document it.
8. Whether Penser approves your wording about Keno's accident (consider checking that you are comfortable sharing it).
