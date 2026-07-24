# APPENDIX B — SEVERITY & DEFECT CLASSIFICATION
> The rubric that turns every finding into a decision. Anchored to **IEEE 1044** (anomaly classification) and cross-mapped to **Orthogonal Defect Classification (ODC)** so patterns are visible across time.

---

## B.0 THE FINDING RECORD (canonical schema)
Every entry in `FINDINGS.md` uses this schema — no exceptions.

```yaml
- id: FND-2026-0142
  opened_at: 2026-07-05T09:12:00Z         # ISO 8601 UTC
  phase_found: PHASE_10_SECURITY_DEEP_AUDIT
  status: OPEN                             # OPEN | IN_PROGRESS | FIXED | VERIFIED | WAIVED | REOPENED | DUPLICATE | WONT_FIX
  severity: P0                             # P0 | P1 | P2 | P3
  sourced_by_mind: RIVAL                   # RIVAL | PRINCIPAL_REVIEW | STANDARD | null — see APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE §E.4
  ieee_1044_class:                         # IEEE 1044 classification (see §B.4)
    activity: SecurityAudit
    phase_inserted: Design                 # where the defect was introduced
    phase_detected: SecurityAudit          # where we caught it
    trigger: BoundaryProbe                 # what surfaced it
    impact: ConfidentialityLoss
    urgency: Immediate
    resolution: FixInCode
    disposition: Accepted                  # Accepted | Rejected | Deferred
  odc_attributes:                          # ODC cross-map (see §B.5)
    activity: CodeInspection
    trigger: SecurityTesting
    type: Interface/Messages
    qualifier: Wrong                       # Missing | Incorrect | Extraneous
    impact: Security
    target: Code
    age: Base                              # New | Rewritten | Refixed | Base
    source: InternalCode
  cwe: CWE-89                              # if security
  asvs: v5.0.0-1.2.2                       # if security
  wcag: SC-2.5.8                           # if a11y
  file_refs:
    - src/orders/query.ts:142-158
  timeline_refs:
    - REQ-0034                             # what requirement this violates
    - INV-0012
  sil_of_affected_component: SIL4
  attack_or_repro:                         # step-by-step
    - "POST /orders with body { id: 1 OR 1=1 }"
    - "Response includes rows for user_id != authenticated user"
  root_cause: |
    Direct string concatenation in query builder for orders.list;
    boundary parsing skipped for this endpoint due to a legacy path.
  blast_radius: |
    Every list endpoint using the same builder (3 endpoints); cross-tenant read.
  proposed_fix: |
    Migrate to parameterized query; remove legacy builder; add regression test.
  fix_commit: null                          # set when FIXED
  regression_test: null                     # set when FIXED — must exist
  verifier: null                            # who verified
  closed_at: null
  waiver:                                   # only if WAIVED
    owner: null
    reason: null
    compensating_control: null
    expires_at: null
  links:
    fnd_parent: null                        # if this is one instance of a class
    fnd_children: []                        # if this is a parent
    adr: null                               # if a design decision was needed
    pir: null                               # post-incident review if P0 in prod
```

---

## B.1 SEVERITY RUBRIC (P0–P3, unambiguous)

Severity answers **one question**: *what happens if this is not fixed before the next release?* Use the **highest matching row**.

### P0 — CATASTROPHIC (pipeline halts)
Any of:
- **Security:** confirmed exploitable vulnerability enabling unauthorized access/modification/exfiltration of data or code execution; matches an active CWE Top 25 with a working PoC; or a KEV-class dependency in production.
- **Data:** confirmed loss, corruption, or cross-tenant leakage of production data or PII.
- **Availability:** confirmed crash/hang/deadlock reachable from a normal user path; total unavailability > threshold; irrecoverable state.
- **Correctness (SIL3/4):** wrong result in money-movement, safety, auth, or irreversible action paths.
- **Compliance:** confirmed violation of a jurisdictional obligation actively binding on the product (WCAG AA where legally mandated, GDPR/CCPA, HIPAA, etc.).
- **TIMELINE:** violation of any ACTIVE `INV` or SIL-4 `REQ`.
- **Protocol:** ledger integrity broken (unmapped edit landed, TIMELINE edited-not-superseded, gate bypassed without ADR+2p-auth).

**Action:** freeze feature work, jump to Phase 22, fix path. **ZDS = 0 while any P0 open.**

### P1 — CORRECTNESS / HIGH
Any of:
- **Concurrency edge:** race, TOCTOU, lost update, deadlock topology, non-idempotent retry with observable duplication.
- **Contract violation:** function/API returns undefined or divergent behavior for values within its declared domain (SIL2+).
- **Recovery failure:** documented recovery path (retry, rollback, saga compensation) is broken or absent.
- **Silent failure:** error swallowed; corrupted state proceeds; log-and-continue past invariant violation.
- **Requirement drift:** ACTIVE non-SIL4 `REQ` violated but not yet reaching a user, OR PROPOSED requirement silently altered by code.
- **Auth/AuthZ weakness** short of full exploit (e.g., missing rate-limit on sensitive endpoint, weak session invalidation).
- **A11y block:** WCAG SC failure at the required level blocking a core user flow.
- **Perf SLO breach** on a critical journey at p75.

**Action:** must fix before next release; waiver only with ≤30-day expiry + compensating control.

### P2 — EFFICIENCY / ROBUSTNESS
Any of:
- **Leak:** memory/fd/connection leak that requires a soak to reveal (not immediate crash).
- **Complexity:** O(n²) or worse on data that could grow; missing index causing hot query scan; N+1 loops.
- **Robustness:** brittle handling of nasty inputs (encoding, DST, extreme sizes) — degrades but doesn't corrupt.
- **Structural smell:** god-module, circular hint, hidden global, high cyclomatic complexity above threshold.
- **Observability gap:** important signal missing (alert with no runbook; metric absent for a hot path).
- **Duplication:** structural clone ≥ 10 lines; parallel implementations of one rule that don't yet disagree.

**Action:** scheduled remediation; ratcheted metric tracks it.

### P3 — DEBT / MINOR
Any of:
- **Stale:** dead code, outdated comment, zombie feature flag, obsolete TODO.
- **Style/consistency:** minor deviation from style guide, non-token literal that doesn't break theme/RTL, inconsistent naming.
- **Doc drift** on non-critical pages, missing example, small a11y-AAA gap.
- **Test quality:** over-mocked, weak assertion, snapshot-without-review.

**Action:** batch cleanup; never bumped in isolation unless dependency of a higher-severity fix.

---

## B.2 SEVERITY ARBITRATION RULES
- **Ambiguity → round up.** If P0 vs P1 is unclear, treat as P0 until proven otherwise.
- **SIL amplifies severity.** A "P2 leak" in a SIL4 component with a 30-day production life is a P1. Record the SIL-adjusted severity.
- **Repeatability amplifies severity.** A P1 pattern found in 5 places is a *parent* P0 for the class + 5 child P1s (fix the pattern, not the instances).
- **Blast radius amplifies severity.** A defect touching money movement, PII exposure, or cross-tenant boundaries lifts one level.
- **User-observed defects auto-log at ≥ P1** until proven otherwise.
- **Protocol violations (ledger integrity)** are always P0 — the *audit* has broken.

---

## B.3 LIFECYCLE STATE MACHINE
```
        ┌──────────────────────────────────────────┐
        │                                          │
        v                                          │
   [OPEN] ──> [IN_PROGRESS] ──> [FIXED] ──> [VERIFIED] ──> (CLOSED)
        │                          │            │
        │                          │            └──> [REOPENED] ─┐
        │                          v                              │
        │                     [DUPLICATE] ──> (linked to parent)  │
        │                                                          │
        └──> [WAIVED (expires_at)] ──auto-expiry──> [REOPENED] ────┘
        └──> [WONT_FIX] (rare, requires ADR)
```

Rules:
- **OPEN → IN_PROGRESS** the moment a fix is attempted; blocks parallel work on the same FND.
- **FIXED → VERIFIED** requires: fix commit + regression test present + Regression Guard pass + peer review at SIL-appropriate depth.
- **WAIVED** requires: owner, reason, compensating control (or "risk accepted" with signature), expiry ≤ 90 days. On expiry → **REOPENED** automatically.
- **DUPLICATE** always links to the primary; do not silently close.
- **WONT_FIX** requires an ADR justifying the decision + a note in ASSURANCE.md caveats.

---

## B.4 IEEE 1044 CLASSIFICATION (fields on every FND)

IEEE 1044 gives a controlled vocabulary so trends are analyzable across time and audits. Each FND records:

- **Activity** — what audit activity found it (RequirementsReview / DesignReview / CodeInspection / UnitTest / IntegrationTest / SystemTest / SecurityAudit / A11yAudit / PerfTest / ChaosExperiment / ProductionIncident / UserReport).
- **Phase inserted** — where the defect was *introduced* (Requirements / Architecture / Design / Code / Integration / Deployment / Documentation / Data). *This is the highest-leverage field for prevention* — the goal is to shift-left where insertions are happening.
- **Phase detected** — where we caught it (same enumeration).
- **Trigger** — what surfaced it (Boundary probe / Property test / Fuzz / MC-DC test / Chaos experiment / User action / Static analysis / Peer review / Formal method / Monitoring alert).
- **Impact** — what property is at risk (Availability / Confidentiality / Integrity / Correctness / Performance / Usability / Accessibility / Compliance / Maintainability / SafetyOfPerson).
- **Urgency** — Immediate / High / Medium / Low.
- **Resolution** — FixInCode / FixInDesign / FixInRequirements / FixInDocumentation / FixInConfiguration / FixInData / DeferForRelease.
- **Disposition** — Accepted / Rejected / Deferred / Duplicate.

**The "phase-inserted vs phase-detected" gap is the audit's headline learning signal** (§B.7).

---

## B.5 ORTHOGONAL DEFECT CLASSIFICATION (ODC) CROSS-MAP
ODC is complementary to IEEE 1044 and drives *causal* pattern-finding.

- **Activity** — Design / CodeInspection / UnitTest / FunctionTest / SystemTest.
- **Trigger** — DesignConformance / LogicFlow / BackwardCompatibility / LateralCompat / ConcurrentExecution / RareSituation / SecurityTesting / A11yTesting / Workload/Stress / RecoveryException / StartupRestart.
- **Type** — Assignment / Checking / Algorithm / Timing/Serialization / Interface/Messages / Function/ClassObject / Relationship / Documentation / Build/Package.
- **Qualifier** — Missing / Incorrect / Extraneous.
- **Impact** — Reliability / Performance / Security / Serviceability / Usability / Installability / Documentation / Compliance / SafetyOfPerson / Capability.
- **Target** — Requirements / Design / Code / Build/Package / Documentation / Information.
- **Age** — New / Rewritten / Refixed / Base.
- **Source** — InternalCode / VendorCode / OpenSource / GenAIGeneratedCode.

**Note the addition of `GenAIGeneratedCode` as an ODC `Source`** — necessary for vibe-coding forensics. If your assistant wrote it, track it separately: causal patterns for AI-authored code differ from human-authored (e.g., hallucinated APIs → `Type: Interface/Messages, Qualifier: Extraneous, Source: GenAIGeneratedCode`).

---

## B.6 THE VIBE-CODING TAXONOMY (specialized triggers to hunt for)
AI-assisted code has repeatable failure signatures. When an FND matches one, tag it in `odc.trigger` for pattern-tracking.

| Tag | Symptom | Where to catch |
|---|---|---|
| `V-HallucinatedAPI` | Call to a function/library that doesn't exist or has a different signature | P05, P10, P19 (build/type/tests) |
| `V-ContextRotDrift` | Behavior diverges from an earlier requirement no longer in the AI's context window | P02 Regression Guard |
| `V-DuplicateReimpl` | Same rule/utility implemented parallel to an existing one | P03 R03.10, P05 R05.13 |
| `V-SilentRequirementLoss` | Constraint from TIMELINE quietly dropped in the new code | P02, Regression Guard |
| `V-PatternGrafting` | Framework/pattern from one stack pasted into another where it doesn't fit | P03, P04 |
| `V-OverconfidentEdit` | Large refactor with no accompanying test change | P22 R22.3 |
| `V-BoundaryElided` | Trust-boundary parse skipped ("input is already validated somewhere") | P04, P10 |
| `V-DeadFlagLitter` | Feature flag added, decision never followed through to removal | P05 R05.12 |
| `V-PseudoDocs` | Comment/docstring describing intent that the code doesn't actually implement | P24 doc-vs-code drift |
| `V-SecretInPromptLog` | Secrets/PII leaked into prompt logs or model context | P10, P11, P21 |

Every vibe-tag has a **prevention target**: what change to the process, gate, or type system makes that pattern unrepresentable next time (feeds P25 systemic learning).

---

## B.7 THE LEARNING METRICS
Compute per audit + longitudinally in METRICS.md:

- **Phase-shift-left gap:** median `(phase_detected − phase_inserted)` in life-cycle position. Trend down = prevention winning.
- **Insertion distribution:** % of defects inserted at Requirements / Design / Code / etc. High Requirements share → invest in P02 rigor; high Code share → invest in P04 typing, gates.
- **AI-authored defect rate:** FND count with `odc.source: GenAIGeneratedCode` / total AI-authored LOC changed. Trend guides how much scrutiny AI-authored PRs need.
- **Escape rate:** FNDs found in production / total. Every escape becomes a permanent gate (P25 R25.10).
- **Fix half-life** by severity: median time from OPEN to VERIFIED.
- **Waiver debt:** count + oldest expiry of ACTIVE waivers.
- **Reopen rate:** FIXED-then-REOPENED as % of FIXED. High rate → fixes are shallow; strengthen P22 root-cause discipline.
- **Rival yield:** % of FNDs tagged `sourced_by_mind: RIVAL` vs found by plain rule-checking. A number trending toward zero over time means the adversarial pass is under-exercised, not that the code got cleaner — investigate before believing it (APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE §E.4).
- **Principal catch rate:** % of FNDs tagged `sourced_by_mind: PRINCIPAL_REVIEW` — defects that survived the falsification pass and only died at gate review. Healthy when non-trivial; a rate that's always zero is the same red flag as a suspiciously quiet phase (same appendix, rule PR.9).

---

## B.8 THE INSPECTION CHECKLIST (peer review of an FND record itself)
Before an FND leaves OPEN, verify:
- [ ] Repro exists and is deterministic (or explicitly `Speculative` in status).
- [ ] Root cause chased past first-symptom (5-whys visible).
- [ ] Blast radius enumerated.
- [ ] TIMELINE + SIL + CWE/ASVS/WCAG references filled where applicable.
- [ ] Severity assigned per §B.1 with SIL-adjustment.
- [ ] IEEE 1044 + ODC + vibe-tags populated.
- [ ] Parent/child links set if class-instance relationship exists.
- [ ] File refs precise (file:line ranges).

An incomplete FND record is itself a P3 finding — audit-of-the-audit.

> This appendix is the **taxonomy backbone**. Phases produce findings; this appendix says exactly what a finding *is*, how severe, how to route, and how to learn from the pattern.
