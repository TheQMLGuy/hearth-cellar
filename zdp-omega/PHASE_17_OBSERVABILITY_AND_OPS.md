# PHASE 17 — OBSERVABILITY & OPERATIONS
> If you can't see it, you can't operate it. Structured logs, metrics, traces, SLOs, error budgets, alerts that mean something, and runbooks that work at 3 a.m.

**Lead standards:** ISO/IEC/IEEE 32675 (DevOps international standard) & IEEE 2675 (DevOps deploy/build integrity), ISO/IEC 20000 / ITIL 4 (IT service management), SRE canon (Google SRE workbook), **OpenTelemetry** (industry-consensus telemetry standard), ISO/IEC 25010 reliability + maintainability crossover.
**SIL depth:** SIL3+ services have SLOs, error budgets, and paging alerts; SIL1/2 have at minimum health + rate/latency/error dashboards. **Inputs:** boundaries + entry points (P01), degradation matrix (P09), SLOs (P16).

## 17.1 MISSION
Every service is *observable* (logs, metrics, traces correlate via IDs); every SLO has a live measurement + burn-rate alert; every alert has a runbook that a fresh on-call can execute; every deploy is reversible.

## 17.2 FALSIFICATION PROCEDURES — RUN AS THE RIVAL

> **Mind: THE RIVAL.** Hostile, no benefit of the doubt, no courtesy notice. Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.1.

- **Blindfolded incident:** pick a recent (or hypothetical) incident. Can you, using only current telemetry, answer: *what broke, where, when it started, blast radius, likely cause*? Blank spots = observability gaps.
- **Alert audit:** for every paging alert, ask: (a) is it actionable? (b) does it map to a user-visible SLO breach or precursor? (c) what's its false-positive rate? Non-actionable alerts train the team to ignore alerts (alert fatigue → real incidents missed).
- **Runbook cold-read:** hand a runbook to someone unfamiliar; can they execute it start-to-finish? Where they stumble = gap.
- **Rollback drill:** on staging, deploy → immediately roll back. Time it. Verify no data-loss / no incompatibility (crosses to R06.9 expand-contract migrations).

## 17.3 EXHAUSTIVE RULES

### The three signals (structured, correlated)
- **R17.1 Logs:** structured (JSON or equivalent), one event per record, with **trace/request/correlation IDs**, service, version/commit, environment, tenant (if applicable), severity, event name. Free-text messages allowed but keyed. PII scrubbing at emit (crosses to R11.5).
- **R17.2 Metrics:** RED (Rate, Errors, Duration) for services; USE (Utilization, Saturation, Errors) for resources; business metrics named and tracked (sign-ups, orders, revenue) so tech incidents visible in business terms.
- **R17.3 Traces:** distributed tracing across service boundaries with propagation of context (W3C Trace Context); sampled with head/tail policy; slow-request retention for diagnosis.
- **R17.4 OpenTelemetry** (or equivalent) as the collection API; vendor-neutral; correlation IDs bridge all three signals for one request/session.

### SLOs & error budgets
- **R17.5 SLOs** stated per critical user journey (availability + latency + correctness), measured continuously; error budget = 1 − SLO target; **burn-rate alerts** at multi-window thresholds (fast burn = paging; slow burn = ticketing).
- **R17.6 Error budget policy:** when budget is burned, freeze risky change, prioritize reliability work — a *policy*, not a suggestion.

### Alerts
- **R17.7 Every paging alert:** is user-impact-relevant (SLO breach or leading indicator), actionable, and linked to a runbook. Non-actionable alerts demoted to logs or removed.
- **R17.8 Alert routing:** on-call rotations documented, escalation paths, quiet hours, follow-the-sun (if applicable).
- **R17.9 Symptom > cause alerts:** page on user pain (increased error rate, saturation, SLO burn), not on every CPU spike; cause-alerts feed dashboards.

### Runbooks
- **R17.10 Runbook per paging alert:** symptoms, diagnosis steps (queries/dashboards linked), mitigation steps (with commands where applicable, safety notes), escalation, rollback. Runbooks in-repo and version-controlled.
- **R17.11 Playbooks for top failure modes** (DB down, cache down, upstream 5xx storm, deploy gone bad, key compromised) exist and are tabletop-tested per cadence.

### Deploy safety
- **R17.12 Blue-green / canary / progressive rollout** with automated health checks; auto-rollback on SLO burn / error-rate spike; kill switches / feature flags per risky change (with cleanup ownership so they don't zombify — crosses to R05.12).
- **R17.13 Readiness vs liveness probes** distinguished; readiness reflects true dependency health (feeds R09.13); orchestrator behavior on failure understood and tested.
- **R17.14 Config changes** treated like code deploys (reviewed, versioned, rollback-able).

### Incident response
- **R17.15 Severity ladder** documented; declaration criteria; comms plan (status page, users, execs, regulators for privacy/security).
- **R17.16 Incident command:** IC, comms, ops roles; timeline tooling captures actions & decisions.
- **R17.17 Blameless post-mortems** for all P0/P1 incidents; each generates action items with owners and dates (crosses to Phase 25 continuous learning).

### Cost & operations
- **R17.18 Cost telemetry** (per service / tenant / feature) so architectural decisions can be evaluated against $ (not only ms). Cost regressions treated like perf regressions.
- **R17.19 Environment parity:** staging closely mirrors prod topology (or documented deltas) so tests are predictive.

### The forgotten stuff
- **R17.20 Retention of telemetry** balanced against PII risk (P11) and cost; audit trails (P11 R11.23) kept longer than routine logs; hot vs cold storage tiers.
- **R17.21 Dashboards are code:** dashboards & alerts stored as artifacts in-repo (as-code), reviewed like everything else.

## 17.4 EXIT GATE — JUDGED AS THE PRINCIPAL

> **Mind: THE PRINCIPAL.** Guilty until the evidence tier matches; no gate closes on "mostly." Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.2.

- [ ] Structured logs + correlation IDs across services + PII scrubbed. **Evidence:** log samples.
- [ ] RED + USE metrics + business KPIs; dashboards published. **Evidence:** dashboards.
- [ ] Distributed traces working end-to-end on critical paths. **Evidence:** trace samples.
- [ ] SLOs + error budget + burn-rate alerts live. **Evidence:** SLO doc + alert configs.
- [ ] Every paging alert has a runbook; alert-actionability audit clean. **Evidence:** audit + runbook index.
- [ ] Blue-green/canary + auto-rollback rehearsed with dated evidence. **Evidence:** drill notes.
- [ ] Blameless post-mortem template + last-N-incidents' action items tracked. **Evidence:** action-item ledger.
- [ ] Cost telemetry live (SIL3+). **Evidence:** cost dashboard.

## 17.5 ARTIFACTS OUT
Telemetry schema; SLO/error-budget doc; alert catalog with runbooks; incident response plan; deploy playbook; post-mortem template; dashboards-as-code repo path.

> Next: `PHASE_18_API_AND_INTERFACE_CONTRACTS.md`.
