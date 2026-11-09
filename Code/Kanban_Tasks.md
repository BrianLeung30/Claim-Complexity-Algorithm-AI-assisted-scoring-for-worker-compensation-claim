# Kanban Board Tasks – Claim Complexity Algorithm

Sources: Project Description, Requirements and Specification (Sep 30, 2026).
Sprint deadlines: Sprint 1 – Oct 5, Sprint 2 – Nov 5, Sprint 3 – Dec 5.
Priority: P0 = Level 0 (must have), P1 = Level 1. Tags show related requirements.

Suggested columns: Backlog | Ready | In Progress | In Review | Done

---

## Epic 1: Project Management & Communication
- [ ] Set up Kanban board and sprint structure (Sprint 1/2/3) [Sprint 1]
- [ ] Hold weekly online meeting with Penser; attend sprint stand-ups offered by Joell Parks [Ongoing]
- [ ] Sign NDAs for all team members (data has legal/medical info) [Sprint 1]
- [ ] Confirm Claude access with Ritvik Sharma [Sprint 1]
- [ ] Track AWS/Claude spending against $300–$500 budget; notify Joell Parks when approaching $500 [NFR-5, Ongoing]
- [ ] Write sprint reports and documents for Sprints 1, 2, 3 [Ongoing]
- [ ] Resolve TBD items in requirements (sub-scores, weights, fields, API endpoints, auth details, confidence method, explanation layout) [FR-2, FR-3, FR-4, FR-6, FR-7]

## Epic 2: Data Acquisition & Preparation
- [ ] Obtain column headers from Penser (Keno Peck) [FR-1, Sprint 1]
- [ ] Review column headers and document each field (examiner-entered fields, claim start date, actual cost, etc.) [FR-1, Sprint 1]
- [ ] Obtain ~10,000-claim, 5-year dataset (~7 MB) and sanitized diary notes (expected early October) [FR-1]
- [ ] Verify notes are sanitized and tokenized (identifying info removed, dictionary words tokenized) [NFR-3]
- [ ] Exploratory data analysis: industry coverage (agriculture, construction, police, fire, maritime), distributions, missing values [FR-1]
- [ ] Data cleaning and preprocessing pipeline (train/validation/held-out test split) [FR-1]
- [ ] Identify closed claims with known final costs to serve as anchors [FR-3, FR-5]
- [ ] Map tokenized diary-note features back to readable categories [FR-4]
- [ ] Assess dataset sufficiency/diversity; request older claims (back to 1990s) from Penser if needed [FR-8, Sprint 3]
- [ ] Define secure data handling/storage (access control, no PII in logs or outputs) [NFR-3]

## Epic 3: Research & Model Design (Sprint 1)
- [ ] Research candidate ML approaches (tabular models, NLP on notes, interpretable models) and select one [Sprint 1, System Evolution]
- [ ] Define complexity sub-scores (litigation chance, medical involvement, return-to-work, vocational rehab, time loss, permanent partial disability, settlement, total claim cost, other complications) [FR-2, FR-3]
- [ ] Define starting sub-score weights using closed claims with known costs [FR-3]
- [ ] Define complexity score scale [FR-2]
- [ ] Design safeguard so examiner touch points are not used alone as complexity (avoid examiner bias) [FR-3]
- [ ] Choose confidence/uncertainty estimation method [FR-6]
- [ ] Choose explainability method (e.g., feature attribution) [FR-4]
- [ ] Define fairness/bias evaluation metrics and thresholds [NIST AI RMF, ACM Ethics]
- [ ] Write system architecture/design doc (separate ML model, web UI, API, DB) [NFR-6]
- [ ] Propose Sprint 1 findings and model approach to Penser for approval [Sprint 1]

## Epic 4: Machine Learning – Complexity Score
- [ ] Build feature engineering for structured claim fields [FR-2]
- [ ] Build NLP/feature extraction for sanitized diary notes [FR-2]
- [ ] Train sub-score models (litigation, medical, RTW, rehab, etc.) [FR-3, Sprint 2]
- [ ] Implement weighted-average combination into overall complexity score [FR-2]
- [ ] Make sub-score weights configurable without code changes (config file/admin setting) [FR-3, NFR-6]
- [ ] Evaluate model on held-out data; document metrics [FR-2, Sprint 2]
- [ ] Check complexity score against bias (e.g., touch-point leakage, industry/examiner effects) [FR-3]

## Epic 5: Machine Learning – Cost Score
- [ ] Build cost-estimation model using closed claims with known final costs as reference [FR-5, Sprint 2]
- [ ] Identify which claim characteristics are associated with cost [FR-5]
- [ ] Implement inflation adjustment using weighted inflation adjustments [FR-9, P1]
- [ ] Make inflation weight tunable alongside other weights [FR-9]
- [ ] Handle historical cost differences if 1990s claims are added [FR-9]
- [ ] Evaluate cost model on held-out data [FR-5]
- [ ] Ensure cost produced alongside complexity score for every claim [FR-5]

## Epic 6: Confidence & Explainability
- [ ] Implement confidence calculation per prediction [FR-6]
- [ ] Convert confidence to 0–100% value for examiners [FR-6]
- [ ] Produce confidence range data for graphical display (cost and other predictions) [FR-6]
- [ ] Implement complexity explanation: top contributing sub-scores and claim characteristics [FR-4]
- [ ] Translate note-derived factors to human-readable categories in explanations [FR-4]
- [ ] Validate explanations make sense to domain users (review with Penser) [FR-4, NFR-2]

## Epic 7: Backend, Database & API
- [ ] Design database schema (claims, scores, sub-scores, confidence, explanations, model versions, users) [Database deliverable]
- [ ] Set up local database (e.g., PostgreSQL) and migrations [Sprint 2]
- [ ] Build backend service wrapping the ML models (inference endpoint) [FR-7]
- [ ] Define API endpoints and data formats; write API spec [FR-7]
- [ ] Implement claim submission endpoint with validation (reject incomplete/invalid claims, list missing info) [UC-1, US-1, US-3, US-4]
- [ ] Implement analysis-results endpoint (complexity score, sub-scores, cost, confidence, explanation) [UC-3, FR-7]
- [ ] Return clear error responses for invalid API requests [US-4]
- [ ] Implement authentication/authorization with AWS Cognito for web UI and API [FR-7, NFR-3]
- [ ] Role-based access (customers see only own claims; employees see role-appropriate claims; admins) [NIST CSF, NFR-3]
- [ ] Enforce HTTPS/TLS between UI, API and backend services [NIST CSF]
- [ ] Decide encryption-at-rest and data-retention settings [NIST CSF]
- [ ] Separate ML models, web interface and API into independently updatable components [NFR-6, NFR-4]

## Epic 8: Web Interface & Dashboard
- [ ] Design UI wireframes/mockups [Sprint 2]
- [ ] Build login/authenticated session flow [FR-7]
- [ ] Build claim submission form with validation messages [UC-1, US-1]
- [ ] Build claim analysis results view: complexity score, sub-scores, expected payout, confidence %, explanation [UC-2, US-2, NFR-2]
- [ ] Build graphical confidence-range visualization [FR-6, NFR-2]
- [ ] Show "analysis unavailable" message when analysis cannot be completed [US-2]
- [ ] Build leadership/engineering dashboard with visualizations (claim types, job classifications, industries driving complexity) [Dashboard deliverable]
- [ ] Add views for employers/brokers insights (claim type, job class, industry) [Intended users]
- [ ] WCAG 2.2 Level AA: contrast, labels, keyboard navigation, readable text [Standards]
- [ ] Accessibility testing before deployment [Standards]

## Epic 9: Model Retraining
- [ ] Build data-loading pipeline for updated claim data [UC-4, FR-8]
- [ ] Build retraining pipeline for all models [FR-8, P1]
- [ ] Validate updated models against held-out data before deploying [UC-4]
- [ ] Deploy updated models without replacing the existing models on failure; report problem when data invalid/unavailable [US-5]
- [ ] Admin-only retraining trigger (UI or CLI) [UC-4, US-5]
- [ ] Document retraining schedule (~every 6 months) and re-evaluation for inflation/data changes [FR-8]
- [ ] Prepare retraining approach and cost estimate proposal for Penser [FR-8, Sprint 3]

## Epic 10: Performance, Testing & Quality
- [ ] Performance test: ~1 claim/min normal, 3 claims/min peak [NFR-1]
- [ ] Verify inference time well under 10-minute ceiling [NFR-1]
- [ ] Unit tests for scoring, weights, inflation adjustment [FR-2, FR-3, FR-9]
- [ ] Integration tests for API and UI flows (UC-1 to UC-4) [UC-1–UC-4]
- [ ] Test exceptional conditions in user stories (invalid input, unavailable analysis, bad training data) [US-1–US-5]
- [ ] Security testing (auth, role access, API security) [NFR-3]
- [ ] Model validation and bias evaluation report [NIST AI RMF, ACM]
- [ ] Verify traceability: each FR/NFR covered by tests [Traceability Matrix]
- [ ] User acceptance review with Penser examiners/leadership [Sprint 3]

## Epic 11: Deployment & Hosting
- [ ] Set up local development environment [NFR-6]
- [ ] Evaluate AWS vs SageMaker hosting options and estimate costs [NFR-6, NFR-5]
- [ ] Deploy to cloud (if approved) within budget (~$100–$300 AWS credits) [NFR-5]
- [ ] Configure Cognito, networking, secrets management [FR-7, NFR-3]
- [ ] Ensure Washington State-first design is extensible to other states [Project Goal]

## Epic 12: Documentation & Deliverables
- [ ] Update Requirements and Specification as TBDs are resolved [Ongoing]
- [ ] API documentation [FR-7, NFR-4]
- [ ] User guide for examiners and admin guide for retraining/weights [NFR-6]
- [ ] Model documentation (approach, features, weights, evaluation, limitations) [NIST AI RMF]
- [ ] Final report/presentation covering AI/ML integration, dashboard, backend, database [Sprint 3]

---

## Sprint Mapping (suggested)
- **Sprint 1 (due Oct 5):** Epics 1, 2 (headers, NDA), 3 (research, model selection).
- **Sprint 2 (due Nov 5):** Epics 2 (full data), 4, 5, 6, 7 (core), 8 (initial UI), initial model training.
- **Sprint 3 (due Dec 5):** Epics 9, 10, 11, 12, dataset sufficiency evaluation, retraining/evaluation, final polish.
