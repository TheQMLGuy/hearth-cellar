# PHASE 21 — AI/ML & LLM COMPONENTS
> If the system decides, predicts, ranks, generates, or agentically acts using a model, it is subject to standards you didn't use to think about — data quality, robustness, drift, bias, transparency, model governance, and (for LLM agents) prompt/tool safety.

**Lead standards:**
- **ISO/IEC 42001** — AI management system (organizational governance for AI).
- **ISO/IEC 23894** — AI risk management (aligns with ISO 31000).
- **ISO/IEC 25059** — quality model for AI systems (extends 25010 with AI-specific characteristics).
- **ISO/IEC 5338** — AI system life cycle processes (extends 12207/15288 for AI).
- **ISO/IEC 5259** series — data quality for analytics and ML.
- **ISO/IEC TR 24028** — trustworthiness in AI (overview).
- **ISO/IEC 24029** series — robustness of neural networks.
- **NIST AI RMF 1.0** & Generative-AI Profile — practical risk-management taxonomy.
- **IEEE 7000** series — ethically aligned design; **7001** (transparency), **7002** (data privacy), **7003** (algorithmic bias).
- **EU AI Act** technical/organizational obligations (for jurisdictional applicability).
- **OWASP Top 10 for LLM Applications** — direct security threats for LLM-based systems.
- **Model Cards** (Mitchell et al.) and **Datasheets for Datasets** (Gebru et al.) as the transparency artifacts.

**Applicability:** any classifier / regressor / recommender / ranker / generative model / LLM chain or agent / embeddings pipeline / RAG / fine-tune. **SIL:** models that decide anything materially consequential = SIL3+; models in irreversible/regulated actions (money, hiring, credit, safety, health, freedom) = SIL4. **Inputs:** TIMELINE REQ/RULE relating to model behavior; data-flow view (P01); privacy inventory (P11).

## 21.1 MISSION
Bring every model and prompt into the same rigor as code: documented purpose and scope, data quality provenance, versioned model + prompt artifacts, offline and online evaluation, robustness/bias/safety tests, drift monitors, governance decisions on record, and for agents — a hard, testable safety envelope.

## 21.2 FALSIFICATION PROCEDURES — RUN AS THE RIVAL

> **Mind: THE RIVAL.** Hostile, no benefit of the doubt, no courtesy notice. Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.1.

- **Distribution attack:** feed the model inputs from the tail — rare classes, out-of-distribution, adversarial perturbations, corrupted encodings, non-target locales. Does it degrade gracefully or fail catastrophically silently?
- **Bias/fairness probe:** slice metrics by protected/relevant subgroups; disparity thresholds tested against TIMELINE ethics NFRs.
- **Prompt-injection attack** (LLM): embed adversarial instructions in tool outputs / retrieved docs / user content ("ignore previous instructions", "exfiltrate…", "call tool X with…"). Any successful escape = P0.
- **Tool-abuse probe** (agents): can the model be induced to call tools outside the sanctioned set or with unsafe args? Any success = P0.
- **Data-leakage probe:** does the model regurgitate training data / secrets on crafted prompts? Any secret/PII in output = P0 (crosses to R11.5).
- **Drift probe:** compare live input distribution to training/eval distribution windows; large divergence without an alert = observability gap.

## 21.3 EXHAUSTIVE RULES

### Purpose & governance
- **R21.1** Every model has a **model card**: intended use, out-of-scope uses, training data provenance/date, evaluation metrics, subgroup breakdowns, ethical considerations, caveats. Traced to TIMELINE.
- **R21.2** Every dataset used has a **datasheet**: source, collection method, labels/annotators, consent/legal basis (crosses to R11.1–R11.9), known limitations.
- **R21.3** Governance body (per ISO 42001 — could be a role) approves material changes; risk register (ISO 23894) tracks AI-specific risks; DPIA / algorithmic impact assessment for high-risk uses.

### Data quality (ISO/IEC 5259)
- **R21.4** Training/eval data quality characteristics measured: accuracy, completeness, consistency, timeliness, representativeness (per relevant subgroups), balance, provenance, and label quality (inter-annotator agreement where applicable).
- **R21.5** No PII in training data without a documented lawful basis + minimization (crosses to P11); test-time telemetry scrubbed at emit.
- **R21.6** Data leakage between train / val / test prevented (temporal splits where sequence matters); test-set contamination checked against training data hashes; retraining triggers re-check.
- **R21.7** Data versioning: datasets are hashed/immutable; every experiment references dataset version + preprocessing pipeline version.

### Evaluation (offline)
- **R21.8** Metrics chosen fit the task and *stated business goal* (not defaulted); include headline + calibration + subgroup + robustness metrics.
- **R21.9** Baselines are honest (a simple heuristic or previous version), and the model must beat them meaningfully.
- **R21.10** Confidence intervals reported; statistical significance where claimed.
- **R21.11** **Subgroup evaluation** by relevant protected/business slices; disparity thresholds (from TIMELINE NFR) enforced; any regression = release-blocker.
- **R21.12** **Robustness evaluation**: adversarial perturbations, OOD samples, common corruptions, prompt paraphrases (LLM). Degradation curves tracked.
- **R21.13** **Calibration** measured (expected calibration error / reliability diagrams); recalibration if consequential decisions rely on scores.

### Evaluation (online)
- **R21.14** Shadow / canary / A-B rollout with automated stop-conditions on adverse metrics (crosses to R17.12).
- **R21.15** Feedback loop safety: users' recorded outcomes feed retraining only via a documented pipeline; supervised drift correction, not blind self-reinforcement.

### Runtime safety envelope
- **R21.16 Input validation** for models: type, range, size; adversarial input detectors where risk-justified.
- **R21.17 Output validation:** schema-validate any structured model output (LLM function calls, JSON); refuse invalid outputs rather than pass through.
- **R21.18 Confidence-aware behavior:** low-confidence outputs escalate/decline; consequential actions require a threshold; humans-in-the-loop for high-stakes decisions (per ISO 23894 controls).
- **R21.19 Rate limits** on inference; abuse-prevention on prompt/completion endpoints (crosses to R10.34).
- **R21.20 Timeouts + fallbacks** for model calls (crosses to R09.1) — a stuck LLM is a broken system.

### LLM & agent-specific (crosses to OWASP LLM Top 10)
- **R21.21 System vs user separation:** system prompts not user-editable; content boundaries labeled inside prompts (e.g., unambiguous tags), and the model is trained/prompted to treat retrieved content as data, not instructions.
- **R21.22 Retrieval hygiene** (RAG): retrieved chunks scanned/sanitized; source labeled to the user (transparency); **prompt-injection filter** on retrieved / tool-output content; suspicious payloads dropped or quarantined.
- **R21.23 Tool sandbox for agents:** tools registered with typed schemas; **allowlist** of tools per role; arguments validated (crosses to R04.5); side-effect tools require idempotency keys (R07.7) or user confirmation for irreversible operations; **least privilege** for tool credentials.
- **R21.24 No secret exfil:** the model cannot see system secrets; prompt/response logs PII-scrubbed at emit (R11.5).
- **R21.25 Output-in-code paths** (code interpreters, SQL runners, browser control): sandboxed, resource-capped, network-restricted, and audited; anything with side effects requires explicit user grant per session.
- **R21.26 Model & prompt versioning:** prompts are code (in-repo, code-reviewed, versioned); every user-visible response traceable to a `(model_id, prompt_version, retrieval_snapshot)` tuple.
- **R21.27 Content safety:** categories relevant to product (harm, hate, sexual, self-harm, illegal, PII) filtered at input and output; safety metrics part of eval; escalation path for red-team-discovered gaps.
- **R21.28 Hallucination controls:** cite-your-sources where the product supports it; abstain over fabricate for factual claims when confidence low; guardrails on tool arguments (a made-up SKU is worse than "I don't know").

### Drift & lifecycle
- **R21.29 Drift monitors** on input distributions, output distributions, and outcome metrics; alarms + retrain triggers (crosses to R17.7).
- **R21.30 Retraining policy** documented: cadence, freshness requirements, rollback plan, human review for materially different behavior; A/B before flipping traffic.
- **R21.31 Deprecation:** old models retirable; versioned APIs (P18) — clients can pin.

### Transparency & user-facing
- **R21.32 Disclosure:** users are told when they're interacting with AI where the product context requires it (regulation/UX/ethics).
- **R21.33 Explanations:** for consequential decisions (credit, hiring, moderation), provide reason codes / SHAP-style summaries appropriate to the audience; log the rationale (immutable audit trail per R11.23).
- **R21.34 Redress:** a human-review pathway for decisions materially affecting a person (EU AI Act echoes; general good practice).

### Reproducibility
- **R21.35** Training/eval reproducible: pinned dependencies, seeds, dataset hashes, hardware notes; artifacts (checkpoint, tokenizer, preprocessor) signed and versioned (crosses to P12).

## 21.4 EXIT GATE — JUDGED AS THE PRINCIPAL

> **Mind: THE PRINCIPAL.** Guilty until the evidence tier matches; no gate closes on "mostly." Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.2.

- [ ] Model card + datasheet exist and are current per model/dataset. **Evidence:** cards + sheets.
- [ ] Data quality assessment passing thresholds. **Evidence:** report.
- [ ] Offline eval: headline + subgroup + robustness + calibration meets NFRs. **Evidence:** eval report.
- [ ] Drift monitors live; retrain triggers wired. **Evidence:** monitor config.
- [ ] Runtime envelope: input/output validation, rate limits, timeouts, fallbacks in place. **Evidence:** code + config.
- [ ] LLM: prompt-injection tests pass; tool allowlist enforced; secret-exfil probe clean. **Evidence:** tests + config.
- [ ] Prompt/model versions in-repo with reviews; response traceability tuple emitted. **Evidence:** repo + log samples.
- [ ] Disclosure + redress paths implemented where applicable. **Evidence:** UX + policy.
- [ ] AI risk register + governance approvals current. **Evidence:** register.

## 21.5 ARTIFACTS OUT
Model cards; datasheets; data-quality report; offline + online eval reports; drift-monitor spec; LLM safety test suite; prompt-versioning setup; AI risk register.

> Next: `PHASE_22_REMEDIATION.md`.
