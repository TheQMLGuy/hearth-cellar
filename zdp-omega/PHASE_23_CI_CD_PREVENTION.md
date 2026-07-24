# PHASE 23 — CI/CD PREVENTION & RATCHETS
> Every rule this system enforced by hand must become a **blocking gate**. Every metric that improved must become a **ratchet** that can only move in the good direction. Regression must be impossible to merge silently.

**Lead standards:** ISO/IEC/IEEE 32675 (DevOps) & IEEE 2675 (DevOps deploy integrity), IEEE 730 (SQA plans), OWASP DevSecOps guidance, SLSA (P12 crossover).
**SIL depth:** SIL3/4 changes require the full gate set to pass; SIL1/2 may run a lighter subset with explicit ADR justification. **Inputs:** every phase's checks, ratchet-eligible metrics, fitness-function specs (P03).

## 23.1 MISSION
Codify every human-executed rule from Phases 01–22 into an automated, blocking pipeline gate; convert every measured improvement into a ratcheted floor/ceiling; make it structurally impossible to lower the bar without an ADR + owner sign-off.

## 23.2 THE GATE STACK (in typical order — parallel where possible)

Stage the pipeline so cheap checks fail early and expensive ones run last. Each stage has a clear owner and a runbook link on failure.

### Stage A — Fast static checks (seconds)
- **G-A1** Lint / formatter — auto-apply and re-run on failure.
- **G-A2** Type check (where a checker exists) at strict settings.
- **G-A3** Secret scan (gitleaks-class) on the diff + a full-history baseline.
- **G-A4** License / SBOM diff — new deps checked against license policy (P12).
- **G-A5** Commit hygiene — `Fixes:` and `TIMELINE:` refs present for fix commits (P22); ADR required for architectural diffs.
- **G-A6** File-ledger drift — new files must appear with SIL and status pending in AUDIT_LEDGER (P01 discipline preserved).

### Stage B — Structural fitness functions (seconds → minutes)
- **G-B1** Dependency direction rules (P03 R03.1) — imports across forbidden layers fail.
- **G-B2** No cycles at module/package level (P03 R03.2).
- **G-B3** No banned imports/APIs — dangerous primitives (eval-class, unsafe deserialization, raw crypto, deprecated algos) fail unless explicitly allowlisted with justification.
- **G-B4** Complexity budgets (P05 R05.1) — new/changed functions checked against per-SIL thresholds; ratchet global max downward.
- **G-B5** Duplicate-code detector — new clones ≥ threshold fail.
- **G-B6** Ownership file (CODEOWNERS) coverage — every path has an owner.

### Stage C — Test gates (minutes)
- **G-C1** Unit + integration tests — deterministic; zero-flake policy (P19 R19.19).
- **G-C2** Coverage floors per SIL tier — statement/branch/decision/MC/DC per P19 R19.5; **cannot decrease**.
- **G-C3** Mutation score floor per SIL (P19 R19.6) — **cannot decrease**.
- **G-C4** Property/fuzz smoke — short deterministic runs on the required corpora; nightly extended runs.
- **G-C5** Contract tests (P18) — schema-vs-impl diff, compat matrix, consumer-driven contracts.
- **G-C6** Regression Guard — all ACTIVE TIMELINE acceptance checks pass.

### Stage D — Security gates (minutes)
- **G-D1** SAST (rules aligned with P10 R10.x + CWE Top 25) — new criticals fail.
- **G-D2** SCA (dependency vuln scan) — no policy-violating vulns; no known-exploited CVEs.
- **G-D3** IaC scan (if infrastructure-as-code present) — misconfig fails.
- **G-D4** Container/image scan — base + user layers; user is non-root; no secrets in image.
- **G-D5** ASVS regression — Phase 10 findings promoted to auto-tested where feasible.
- **G-D6** DAST smoke against a staging deployment (nightly + release).

### Stage E — Frontend gates (minutes)
- **G-E1** Bundle budgets per route (P15 R15.15) — over-budget fails.
- **G-E2** Visual regression suite (P13 R13.31) — deltas require review; auto-approve banned on SIL3/4 flows.
- **G-E3** Accessibility linter (axe-class) + curated manual tests re-run on PR; **known WCAG 2.2 SC violations cannot be introduced** (P14 gate).
- **G-E4** Perf lab test on critical routes vs baseline (P15 R15.22); breach fails.

### Stage F — Data & migrations (minutes)
- **G-F1** Migration dry-run + rollback on shadow DB with prod-like size (P06 R06.10).
- **G-F2** Backward-compat schema check (expand-contract).
- **G-F3** PII scrubbing rules verified against log/event schemas (P11 R11.5).

### Stage G — Build & supply chain (P12 crossover, minutes)
- **G-G1** Lockfile integrity + tamper test.
- **G-G2** SBOM generation + attestation signing (SLSA target level).
- **G-G3** Reproducibility spot check (nightly).
- **G-G4** Hermetic build enforced (no unpinned network fetches).

### Stage H — Deploy safety
- **G-H1** Progressive rollout with automated rollback on SLO burn (P17 R17.12).
- **G-H2** Feature-flag ownership + expiry checked (no zombie flags).
- **G-H3** Config-change treated like code (reviewed, versioned, revertible).

### Stage I — Post-deploy (continuous)
- **G-I1** SLO burn-rate alerts (P17 R17.5) — long-window burns block risky changes (error-budget policy).
- **G-I2** Waiver expiry monitor — EXCEPTIONS entries auto-reopen on expiry.
- **G-I3** Drift monitor for AI/ML (P21 R21.29); privacy audit trail integrity checks (P11 R11.23).

## 23.3 THE RATCHET LAW
Every metric that improved during the audit becomes a **one-way ratchet**:

- **R23.1** Ratcheted metrics recorded in METRICS.md with current floor/ceiling and history: max complexity, functions-over-threshold count, coverage %, mutation %, bundle size, CWV p75, error budget, open FND counts by severity, dependency-vuln counts, dead-code count.
- **R23.2** A change that would breach a ratchet **fails the pipeline** — override requires an ADR + owner sign-off + expiry (EXCEPTIONS).
- **R23.3** When a metric improves durably (7 consecutive days), CI proposes a new floor/ceiling — reviewed and adopted or deferred.
- **R23.4** Waivers auto-expire per §22.5; on expiry the corresponding gate goes red until fixed or renewed.

## 23.4 THE ADR OVERRIDE (only allowed lever)
Any gate can be temporarily loosened only via:
1. A merged **ADR** in DECISIONS.md explaining context / options / decision / consequences.
2. An **EXCEPTIONS.md** entry: owner, scope, expiry ≤ 90 days, compensating control.
3. Notification into AUDIT_LEDGER and (for SIL3/4) into ASSURANCE.md as a caveat.
Anything else that lowers a gate is a **P0 protocol violation** and reverts.

## 23.5 EXHAUSTIVE RULES

- **R23.5 Gates as code, in-repo.** No "the CI admin adjusted it" — the pipeline definition is version-controlled and code-reviewed.
- **R23.6 Least-privilege runners** with short-lived OIDC-federated credentials (crosses to R12.11).
- **R23.7 Cache safety:** build caches are content-addressed; poisoning is treated as a P0.
- **R23.8 Reproducible builds** targeted; divergences recorded (crosses to R12.9).
- **R23.9 Nightly / weekly extended gates:** long fuzz runs, deep SBOM diff, dependency freshness, DR restore drill spot check, chaos game day.
- **R23.10 Gate-failure UX:** every failure message links to the phase rule and a fix hint (docs in-repo). Frustrated devs disable gates — good failure messages prevent it.
- **R23.11 Coverage gaming forbidden:** no test that exercises a line without asserting behavior; PR review rule.
- **R23.12 Time & size limits:** each pipeline stage has a runtime budget; regressions in pipeline time treated as findings.
- **R23.13 Kill-switch:** in a genuine emergency (production down, gate broken), gates can be bypassed only by two-person authorization; every bypass is a P1 FND for post-mortem review.

## 23.6 EXIT GATE — JUDGED AS THE PRINCIPAL

> **Mind: THE PRINCIPAL.** Guilty until the evidence tier matches; no gate closes on "mostly." Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.2.

- [ ] Every rule from P01–P22 that can be automated is a blocking gate (or a documented BLOCKED with plan). **Evidence:** rule-to-gate mapping.
- [ ] All ratchet metrics with current floors/ceilings recorded and enforced. **Evidence:** METRICS + pipeline config.
- [ ] EXCEPTIONS ledger has no expired waivers; monitor active. **Evidence:** monitor + ledger.
- [ ] Nightly/weekly extended gates scheduled and green. **Evidence:** schedule + last runs.
- [ ] Two-person kill-switch documented and tested (drill). **Evidence:** drill record.
- [ ] Pipeline runtime within budget; test flake rate below policy. **Evidence:** timing + flake reports.

## 23.7 ARTIFACTS OUT
Pipeline-as-code definitions; rule-to-gate mapping; ratchet policy + current values; waiver-expiry monitor; extended-gate schedule; gate-failure playbook.

> Next: `PHASE_24_DOCUMENTATION_AND_KNOWLEDGE.md`.
