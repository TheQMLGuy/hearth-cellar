# APPENDIX C — TEMPLATES
> Copy-paste the exact schemas the agent uses for every ledger and record. If the file doesn't match, the agent creates it fresh from these templates.

---

## C.1 `/audit/TIMELINE.md` — the append-only requirements ledger (SUPREME LAW)

```markdown
# TIMELINE — Requirements Ledger
> Append-only. Chronologically ordered. Every code change traces to an ID here.
> To change a requirement: append a new entry that `Supersedes:` the old one; mark the old `Status: SUPERSEDED`. **Never edit past entries' meaning.**

## INDEX
| ID | Kind | Title | Status | SIL | Owner | Superseded-by |
|---|---|---|---|---|---|---|
| REQ-0001 | REQ | User can log in with email + password | ACTIVE | SIL4 | @owner | — |
| INV-0002 | INV | Account balance is never negative | ACTIVE | SIL4 | @owner | — |
| CON-0003 | CON | All monetary amounts in minor units, ISO 4217 currency code | ACTIVE | SIL4 | @owner | — |
| ...

---

## ENTRIES

### REQ-0001
- **Kind:** REQ                                # REQ | INV | CON | RULE | NFR | DEC | DROP
- **Timestamp (created):** 2026-07-05T08:00:00Z # ISO 8601 UTC
- **Status:** ACTIVE                            # DRAFT | PROPOSED | ACTIVE | SUPERSEDED | VIOLATED | DROPPED
- **SIL:** SIL4
- **Owner:** @owner
- **Source:** PRD §3.2 / conversation 2026-07-01
- **Statement:** The system SHALL allow a registered user to authenticate using their email address and a password.
- **Rationale:** Primary auth path for account access.
- **Acceptance criteria:**
  1. Given a registered user with correct credentials, when they POST /auth/login, the response is 200 with a valid session token.
  2. Given wrong credentials, the response is 401 with a generic error message (no user-enumeration).
  3. Rate-limited per §NFR-0042.
- **Depends on:** —
- **Superseded by:** —
- **Change log:**
  - 2026-07-05 created.

### INV-0002
- **Kind:** INV
- **Timestamp:** 2026-07-05T08:05:00Z
- **Status:** ACTIVE
- **SIL:** SIL4
- **Owner:** @owner
- **Statement:** For all accounts A at all times t, balance(A, t) ≥ 0.
- **Rationale:** Business rule; overdraft not offered.
- **Acceptance criteria:**
  1. No successful transaction leaves any account with balance < 0 (property test).
  2. DB CHECK constraint enforces balance >= 0.
- **Test refs:** TEST-INV-0002-A (property), TEST-INV-0002-B (DB constraint).

### CON-0003
- **Kind:** CON (implicit constraint made explicit)
- **Timestamp:** 2026-07-05T08:07:00Z
- **Status:** ACTIVE
- **SIL:** SIL4
- **Statement:** All monetary values are stored and computed as integer minor units. Every amount is paired with an ISO 4217 currency code. No floating-point arithmetic on money at any layer.
- **Acceptance criteria:**
  1. No `float`/`double`/decimal-imprecise types used on monetary code paths (P05 grep).
  2. Property test: `roundtrip(display(amount)) == amount` for all amounts.
  3. Currency code required at every persistence and API boundary carrying an amount.

### NFR-0042
- **Kind:** NFR
- **Timestamp:** 2026-07-05T09:00:00Z
- **Status:** ACTIVE
- **SIL:** SIL4
- **Statement:** Authentication endpoints tolerate ≤ 5 failed attempts / account / 15 min before rate-limiting; total server capacity supports 500 RPS auth traffic at p99 ≤ 250 ms.
- **Acceptance criteria:** load test + rate-limit unit test.

### DEC-0100
- **Kind:** DEC (points to an ADR)
- **Timestamp:** 2026-07-06T10:00:00Z
- **Status:** ACTIVE
- **Statement:** Postgres chosen as primary transactional store (see DECISIONS.md ADR-0007).
- **Superseded by:** —

### DROP-0201 (example supersession)
- **Kind:** DROP
- **Timestamp:** 2026-07-10T14:00:00Z
- **Supersedes:** REQ-0032
- **Statement:** REQ-0032 (support anonymous checkout) is dropped: not aligned with KYC obligations.
- **Owner sign-off:** @owner
- **Ripple:** remove /checkout/anon endpoint; update docs; retire tests TEST-REQ-0032-*.
```

**Rules recap:** every entry has an ID, timestamp, kind, status, SIL, owner, statement, rationale, acceptance criteria. Never edit past meaning; supersede via new entries. The INDEX must always be in sync with the ENTRIES section.

---

## C.2 `/audit/AUDIT_LEDGER.md` — the phase state machine + file audit ledger

```markdown
# AUDIT LEDGER
> The state of the audit. Phase progression, file coverage, gate records, next actions.

## STATE
- **CURRENT_PHASE:** PHASE_10_SECURITY_DEEP_AUDIT
- **PHASE_STATUS:** IN_PROGRESS
- **NEXT_PHASE:** PHASE_11_PRIVACY_AND_DATA_PROTECTION
- **AUDIT_ID:** ZDP-Ω-2026Q3-01
- **STARTED_AT:** 2026-07-05T07:30:00Z
- **LAST_CHECKPOINT_AT:** 2026-07-06T22:41:00Z

## NEXT_ACTIONS  (context checkpoint — the future-you handoff)
- File to resume with: `src/orders/query.ts`
- Next check: R10.1 injection sweep on remaining ORM raw queries
- Open questions: confirm w/ owner whether legacy /orders/export is in scope
- Blocked on: staging DB creds not present in environment
- Do NOT touch: anything under `src/billing/*` until P07 concurrency review complete

## PHASE_LOG
| Phase | Opened | Closed | Verdict | ZDS contribution | Notes |
|---|---|---|---|---|---|
| PHASE_00 | 2026-07-05 07:30 | 2026-07-05 09:00 | CLOSED | — | ledgers created |
| PHASE_01 | 2026-07-05 09:00 | 2026-07-05 18:20 | CLOSED | 100% | SIL map assigned; 2 cycles noted |
| PHASE_02 | ... | ... | CLOSED | 95% | 3 NEEDS-TEST outstanding |
| PHASE_10 | 2026-07-06 08:00 | — | IN_PROGRESS | — | 3 findings so far (1 P0, 2 P1) |

## FILE_LEDGER  (IEEE 1028 — every file, no sampling)
| Path | Kind | LOC | Entrypoint | TrustBoundary | SIL | Status | Notes |
|---|---|---|---|---|---|---|---|
| src/auth/login.ts | src | 214 | HTTP POST /auth/login | yes | SIL4 | audited | 2 FND (P0, P1) |
| src/orders/query.ts | src | 486 | HTTP GET /orders | yes | SIL4 | issues | R10.1 violation |
| src/lib/date-utils.ts | src | 89 | — | no | SIL2 | verified | UTC discipline OK |
| vendor/parser-x/... | vendored | — | — | — | (per use) | audited | SBOM cross-ref |
| ... | ... | ... | ... | ... | ... | ... | ... |

## VIEWS  (Phase 01 links)
- Module view: docs/arch/module-view.md
- Dependency view: docs/arch/dep-graph.md (cycles: 0)
- Data-flow view: docs/arch/data-flow.md
- Trust-boundary view: docs/arch/trust-boundaries.md
- Deployment view: docs/arch/deployment.md

## SIL_MAP  (Phase 01 output, unchanged unless architecture changes)
| Component | SIL | Justification |
|---|---|---|
| Auth service | SIL4 | Credentials + session issuance; irreversible token grant |
| Ledger / balance | SIL4 | Money; INV-0002 must hold |
| Reporting | SIL2 | Read-only; consequences bounded |
| Marketing site | SIL1 | Cosmetic |

## GATE_RECORDS
| Phase | Gate item | Verdict | Evidence | Date |
|---|---|---|---|---|
| 01 | FILE_LEDGER 100% audited | PASS | ledger count == fs count | 2026-07-05 |
| 01 | SIL assigned all components | PASS | SIL_MAP filled | 2026-07-05 |
| 10 | ASVS 5.0 Ch.1 all reqs verified | IN_PROGRESS | 27/34 done | 2026-07-06 |

## STANDARDS_CONSULTED (fetch protocol A.0)
| Standard | Version | Fetched | Source | Clauses verified |
|---|---|---|---|---|
| OWASP ASVS | 5.0.0 | 2026-07-06 | owasp.org | Ch.1 §1.2 fully |
| WCAG | 2.2 | 2026-07-05 | w3.org | SC 2.5.8, 2.4.11, 3.3.8 |
| ISO/IEC 5055 | 2021 | 2026-07-05 | iso.org summary | concurrency class only |
```

---

## C.3 `/audit/FINDINGS.md` — every defect (schema per Appendix B.0)

```markdown
# FINDINGS
> Every defect: opened, classified, tracked to closure. Schema per APPENDIX_SEVERITY_AND_DEFECTS §B.0.

## INDEX
| ID | Sev | Phase | Status | CWE/ASVS/WCAG | Component (SIL) | Opened | Closed |
|---|---|---|---|---|---|---|---|
| FND-2026-0142 | P0 | PHASE_10 | OPEN | CWE-89 / v5.0.0-1.2.2 | orders (SIL4) | 2026-07-06 | — |
| FND-2026-0141 | P1 | PHASE_07 | VERIFIED | — | balance (SIL4) | 2026-07-06 | 2026-07-06 |
| ... | | | | | | | |

## ENTRIES

### FND-2026-0142
```yaml
id: FND-2026-0142
opened_at: 2026-07-06T09:12:00Z
phase_found: PHASE_10_SECURITY_DEEP_AUDIT
status: OPEN
severity: P0
sourced_by_mind: RIVAL          # RIVAL | PRINCIPAL_REVIEW | STANDARD | null
ieee_1044_class:
  activity: SecurityAudit
  phase_inserted: Code
  phase_detected: SecurityAudit
  trigger: BoundaryProbe
  impact: ConfidentialityLoss
  urgency: Immediate
  resolution: FixInCode
  disposition: Accepted
odc_attributes:
  activity: CodeInspection
  trigger: SecurityTesting
  type: Interface/Messages
  qualifier: Incorrect
  impact: Security
  target: Code
  age: Base
  source: GenAIGeneratedCode       # vibe-coding provenance tracked
vibe_tags: [V-BoundaryElided, V-OverconfidentEdit]
cwe: CWE-89
asvs: v5.0.0-1.2.2
wcag: null
file_refs:
  - src/orders/query.ts:142-158
timeline_refs:
  - INV-0011
  - REQ-0034
sil_of_affected_component: SIL4
attack_or_repro:
  - "Authenticate as user A"
  - "GET /orders?filter=id%20OR%201%3D1"
  - "Observe rows belonging to user B in response"
root_cause: |
  Legacy string-built query bypassed the parameterized boundary. Introduced
  during a refactor where the AI assistant "unified" two paths without
  preserving the parameterization discipline (V-OverconfidentEdit).
blast_radius: |
  All 3 endpoints using orders.buildQuery(); cross-tenant read; audit trail
  gap because no per-row auth check re-verified.
proposed_fix: |
  1. Migrate to parameterized query builder.
  2. Add per-row authz check independent of filter.
  3. Regression test: cross-user probe returns 403/empty.
  4. Delete legacy buildQuery function (V-DuplicateReimpl candidate).
fix_commit: null
regression_test: null
verifier: null
closed_at: null
waiver: null
links:
  fnd_parent: null
  fnd_children: []
  adr: null
  pir: null
```

### FND-2026-0141
```yaml
# ...verified example...
```
```

---

## C.4 `/audit/TRACE_MATRIX.md` — bidirectional traceability

```markdown
# TRACE MATRIX
> Every requirement → design → code → test → evidence. Bidirectional: from a file, find its requirements.

## REQ → CODE + TEST
| REQ ID | Design ref (ADR/view) | Code refs | Test refs | Evidence tier | Status |
|---|---|---|---|---|---|
| REQ-0001 | ADR-0003 (auth model) | src/auth/login.ts:1-120 | TEST-REQ-0001-A, -B, -C | property + example | GREEN |
| INV-0002 | ADR-0007 (Postgres) | src/ledger/apply.ts:*, migrations/0007_balance_check.sql | TEST-INV-0002-A (property), TEST-INV-0002-B (constraint) | property + DB constraint | GREEN |
| CON-0003 | — | (universal) | TEST-CON-0003-* (property, DB, boundary) | property | GREEN |
| NFR-0042 | ADR-0011 (rate limiting) | src/mw/rate-limit.ts | TEST-NFR-0042-A (unit), TEST-NFR-0042-LOAD | measurement | GREEN |
| REQ-0034 | — | src/orders/query.ts | — | — | NEEDS-TEST → FND-2026-0142 |

## CODE → REQ  (reverse index)
| Path | Serves REQ/INV | Notes |
|---|---|---|
| src/auth/login.ts | REQ-0001, NFR-0042 | Owner: @auth-team |
| src/ledger/apply.ts | INV-0002, REQ-0018, CON-0003 | Owner: @ledger-team |
| src/orders/query.ts | REQ-0034 | Currently VIOLATING (FND-2026-0142) |
| src/lib/date-utils.ts | CON-0004 (time policy) | — |
| src/legacy/tempExport.ts | (none found) | UNJUSTIFIED — candidate deletion (P02 §2.3 orphan-code probe) |
```

---

## C.5 `/audit/DECISIONS.md` — ADRs

```markdown
# DECISIONS (ADRs)

## INDEX
| ID | Title | Status | Date | Supersedes |
|---|---|---|---|---|
| ADR-0007 | Postgres as primary transactional store | ACCEPTED | 2026-07-05 | — |
| ADR-0011 | Rate-limiting strategy | ACCEPTED | 2026-07-06 | — |

## ADR-0007  Postgres as primary transactional store
- **Status:** ACCEPTED
- **Date:** 2026-07-05
- **Context:** Need ACID transactions for INV-0002 (non-negative balance) and CON-0003 (money integrity); expect < 5k RPS write.
- **Options considered:**
  - Postgres — mature, strong constraints, JSONB flexibility.
  - MySQL — comparable; team unfamiliarity.
  - DynamoDB — scaling story but transactional model weaker for cross-entity constraints.
- **Decision:** Postgres.
- **Consequences:** Strong constraints in DB (INV-0002 enforced by CHECK). Ops burden: single-writer bottleneck accepted at current scale; scale-out via read replicas (P16).
- **Traces:** INV-0002, CON-0003, DEC-0100.
```

---

## C.6 `/audit/ASSUMPTIONS.md` — inherited beliefs with violation tests

```markdown
# ASSUMPTIONS
> Every inherited/implicit belief the system relies on, with a test that fires if the belief becomes false.

## ENTRIES

### ASM-0001
- **Assumption:** Upstream identity provider returns `sub` claim as an opaque string ≤ 255 chars.
- **Origin:** Vendor docs, retrieved 2026-07-05.
- **What breaks if false:** session lookup fails silently; users can't log in.
- **Violation test:** TEST-ASM-0001 — validate `sub` shape at boundary; error explicitly if malformed.
- **Owner:** @auth-team.
- **Review date:** 2027-01-05.

### ASM-0002  (Ariane-5 class)
- **Assumption:** Order quantity fits in int32 (< 2^31).
- **Origin:** Legacy from B2C context; now used for B2B bulk.
- **Risk:** Overflow / silent wrap on very large orders.
- **Violation test:** property test on order-total path with quantities up to declared max.
- **Status:** VIOLATED (see FND-2026-0138); fix in progress.
```

---

## C.7 `/audit/EXCEPTIONS.md` — waivers with expiry

```markdown
# EXCEPTIONS
> Waivers. Each has owner + expiry ≤ 90 days. Auto-reopens on expiry.

| ID | FND ID / Gate | Owner | Reason | Compensating control | Expires | Renewed | Status |
|---|---|---|---|---|---|---|---|
| WVR-0001 | FND-2026-0107 (P2 leak in reporting) | @reporting-team | Fix requires vendor patch (ETA Q4) | Process restart every 24h via cron | 2026-09-15 | — | ACTIVE |
| WVR-0002 | GATE G-E1 bundle budget on /admin | @frontend-team | Legacy admin not in critical CWV scope | — | 2026-08-01 | — | ACTIVE |
```

---

## C.8 `/audit/METRICS.md` — baselines, ratchets, before/after

```markdown
# METRICS
> Numbers over anecdotes. Baselines, current values, and ratcheted floors/ceilings.

## StandardsConsulted
(see AUDIT_LEDGER.md → STANDARDS_CONSULTED for the fetch-and-verify record)

## BASELINE (start of audit)
| Metric | Value | Captured |
|---|---|---|
| LOC | 128,441 | 2026-07-05 |
| Files | 1,204 | 2026-07-05 |
| Test count | 342 | 2026-07-05 |
| Line coverage | 47% | 2026-07-05 |
| Mutation score | (unknown — not measured before) | 2026-07-05 |
| Cyclomatic max | 62 | 2026-07-05 |
| Functions > 10 CCN | 173 | 2026-07-05 |
| Known open issues | 47 (severity unclassified) | 2026-07-05 |
| Dependency count (direct + transitive) | 2,145 | 2026-07-05 |
| Known vulns (SCA) | 18 (of which 3 KEV) | 2026-07-05 |
| Bundle size (main route, parsed) | 812 KB | 2026-07-05 |
| Field p75 LCP | 3.4 s | 2026-07-05 |
| Field p75 INP | 340 ms | 2026-07-05 |
| Field p75 CLS | 0.18 | 2026-07-05 |
| Open FND count by severity | P0: 0, P1: 0, P2: 0, P3: 0 (pre-audit) | 2026-07-05 |

## RATCHETS (one-way; enforced in P23)
| Metric | Floor/Ceiling | Direction | Current | Ratchet history |
|---|---|---|---|---|
| Line coverage | ≥ 80% | up-only | 82.4% | 47 → 68 → 82.4 |
| Branch coverage | ≥ 70% | up-only | 71.1% | — → 71.1 |
| Mutation score (SIL3+ modules) | ≥ 70% | up-only | 72.6% | — → 72.6 |
| Cyclomatic max | ≤ 15 | down-only | 14 | 62 → 24 → 14 |
| Functions > 10 CCN | ≤ 40 | down-only | 38 | 173 → 92 → 38 |
| Known vulns (any severity) | 0 KEV, ≤ 3 High | down-only | 0 KEV, 2 High | 3 KEV → 0 KEV |
| Bundle main-route parsed | ≤ 500 KB | down-only | 484 KB | 812 → 484 |
| Field p75 LCP | ≤ 2.5 s | down-only | 2.2 s | 3.4 → 2.2 |
| Field p75 INP | ≤ 200 ms | down-only | 178 ms | 340 → 178 |
| Field p75 CLS | ≤ 0.10 | down-only | 0.06 | 0.18 → 0.06 |
| Open P1 FNDs | 0 | down-only | 0 | — |
| Waiver debt (count of ACTIVE) | ≤ 5 | down-only | 2 | — |

## LEARNING METRICS (per APPENDIX B.7)
| Metric | Value | Trend |
|---|---|---|
| Median (phase_detected − phase_inserted) | 2.4 phases | -0.6 vs last audit |
| Insertion by phase — Code | 58% | -12pp |
| Insertion by phase — Design | 22% | +6pp |
| Insertion by phase — Requirements | 15% | +6pp |
| Insertion by phase — Docs/Config | 5% | flat |
| AI-authored defect rate | 4.3 FND / kLOC changed | -1.1 vs last audit |
| Escape rate (found in prod) | 0.7% of FND | flat |
| Reopen rate (FIXED → REOPENED) | 3.1% | -1.5pp |
| Fix half-life P0 | 6 h | -2h |
| Fix half-life P1 | 3 d | -1d |
```

---

## C.9 `/audit/ASSURANCE.md` — the final Claims–Arguments–Evidence case (Phase 25)

```markdown
# ASSURANCE CASE (ISO/IEC/IEEE 15026)
> Version: v1.0 · Audit: ZDP-Ω-2026Q3-01 · Closed: 2026-08-12

## TOP CLAIM
System S at release R2026.08 satisfies its TIMELINE requirements at SIL-appropriate rigor;
meets published SLOs and WCAG 2.2 AA conformance across supported user journeys;
contains no known P0 defect at closure; and its supply chain, privacy, and AI/ML components
have been verified against ZDP-Ω Phases 00–25.

**Zero-Defect Score:** 0.94 (SIL-weighted; see §ZDS).
**Open P0:** 0.
**Open P1 (waived w/ expiry):** 2.
**Open P1 (unwaived):** 0.

## SUB-CLAIMS
1. **Correctness** — every ACTIVE TIMELINE `REQ`/`INV`/`RULE` has a passing acceptance check.
2. **Security** — verified against OWASP ASVS 5.0 L2 (SIL3/4 modules include selected L3);
   CWE Top 25 sweep clean; no known KEV in production dependencies.
3. **Privacy** — ISO/IEC 29100 principles satisfied; DSR endpoints functional; erasure
   propagates verified; audit trail immutable; privacy notice reconciled to code.
4. **Accessibility** — WCAG 2.2 AA conformance for supported routes and locales, with
   AT-support matrix executed on 2026-08-05.
5. **Performance** — Core Web Vitals within targets at p75 field for last 28 days on all
   critical routes; backend SLOs green for last 28 days.
6. **Reliability** — resilience matrix filled; fault-injection experiments executed;
   DR drill completed 2026-07-30 with RTO 42 min (target ≤ 60), RPO 5 min (target ≤ 10).
7. **Supply chain** — SLSA L3 provenance on production releases; SBOM published; license
   inventory clean.
8. **Operational readiness** — SLO/error-budget policy live; runbooks + on-call rehearsed;
   auto-rollback tested.
9. **AI/ML safety** — model cards + datasheets current; drift monitors live; LLM tool
   sandbox enforced; prompt-injection tests pass.

## ARGUMENTS (one per sub-claim, deductive from phase gates + evidence)
### Argument for §1 Correctness
Because Phase 02 established testable acceptance criteria for every ACTIVE requirement,
Phase 19 verified the tests exist and pass with ≥ 70% mutation score on SIL3+ modules
(72.6% actual), Phase 20 model-checked the ledger and payment protocols (specs LEDGER.tla
and PAY.tla — both properties PASS on bounded model), and the Regression Guard has run
green across the last 143 commits — the Correctness sub-claim holds.
Assumptions: ASM-0001, ASM-0007 (see ASSUMPTIONS.md).
Confidence: HIGH.

### Argument for §4 Accessibility
...

## EVIDENCE  (each item is a link to the concrete artifact)
- TRACE_MATRIX.md (green)
- FINDINGS.md (P0: 0, P1: 0 unwaived)
- Test reports (coverage, mutation, property, fuzz corpora)
- ASVS 5.0 completed checklist
- WCAG 2.2 conformance matrix + AT support matrix + ACR
- Chaos experiment reports
- Formal specs + model-check reports
- SBOM + provenance attestations
- SLO dashboards + last-28-days summary
- DR drill report 2026-07-30
- AI model cards, datasheets, drift-monitor spec, LLM safety tests

## DEFEATERS (how this argument could be wrong; and how we addressed each)
1. **Fetched standards may have updated since audit close.** *Mitigation:* watchlist in
   §Perpetuity opens re-audit tickets on change.
2. **Fuzz corpora may miss undiscovered classes.** *Mitigation:* nightly extended runs;
   escape-rate metric monitors reality; new corpora added on escape.
3. **AI-authored code retains higher latent-defect risk.** *Mitigation:* separate
   AI-authored defect metric + stricter review at SIL3/4 (P22 R22.3).
4. **Third-party service behavior may change.** *Mitigation:* contract tests + drift
   monitors; degradation matrix designed for four-horsemen failure modes.

## HONESTY CLAUSES
- **Not verified in this environment:** production key rotation drill (BLOCKED — no
   prod access at audit time; scheduled 2026-09-01).
- **Standards paywalled / not fetched:** ISO/IEC 27001:2022 Annex A control texts
   verified via OWASP CRE cross-map, not the ISO document.
- **Open waivers with expiry:** WVR-0001 (2026-09-15), WVR-0002 (2026-08-01).
- **PROPOSED TIMELINE entries unresolved:** REQ-0089 (offline mode scope) — owner review pending.

## ZDS
Formula: SIL-weighted mean of phase pass rates, forcing 0 on any open P0.
- Phase 00 100% × w0 …
- Phase 25 100% × w25.
- **Total: 0.94.**

## RESIDUAL RISK
- Highest residual risk: (1) potential for undetected prompt-injection paths in the
  agentic workflow (P21) — mitigated by tool allowlist and side-effect confirmation;
  (2) upstream identity provider API change (ASM-0001) — mitigated by boundary parse
  and violation test.

## RE-AUDIT
- SIL4 components: light re-audit quarterly (next: 2026-11); full: annual (next: 2027-08).
- Trigger events: major arch change, new compliance regime, first prod P0, dep-major
  upgrade, model retrain.

Signed / Verified: @owner · @security-lead · @privacy-lead · @a11y-lead · @sre-lead
```

---

## C.10 Optional file: `/audit/CONTRACTS.md` (Phase 04 output — if not kept in code doc-comments)

```markdown
# CONTRACTS

## src/ledger/apply.ts :: applyTransfer(from, to, amount, currency, idem)
- **TIMELINE:** INV-0002, CON-0003, REQ-0018
- **Pre:**
  - from, to are non-null AccountId newtypes; from ≠ to
  - amount is a positive integer (minor units); currency is a valid ISO 4217 code
  - idem is a non-empty IdempotencyKey; each key is unique within a 24h window per caller
  - balance(from) ≥ amount at the isolation level of the enclosing transaction
- **Post:**
  - balance(from) decreases by amount atomically; balance(to) increases by amount
  - INV-0002 holds throughout and after
  - a TransferRecord row is written with the provided idem key
- **Invariants:**
  - Σ balances (in same currency) unchanged
  - no interleaving of concurrent applyTransfer produces a lost update (P07 R07.2)
- **Errors (typed):**
  - InsufficientFunds — from balance would drop below 0 (INV-0002)
  - CurrencyMismatch — from/to different currency without an explicit conversion step
  - DuplicateIdempotency — the key was used within the dedupe window (return original result)
- **Effects:** DB write within caller transaction; no I/O beyond DB.
- **Perf class:** O(1); target p99 ≤ 8 ms at target QPS.
- **Concurrency class:** thread-safe; safe under retry (idempotency-keyed).
```

---

## C.11 Directory template (Phase 00 creates this)

```
/audit/
├─ AGENT_BOOT.md                                # never overwritten; symlink to this system's copy
├─ TIMELINE.md
├─ AUDIT_LEDGER.md
├─ FINDINGS.md
├─ TRACE_MATRIX.md
├─ DECISIONS.md
├─ ASSUMPTIONS.md
├─ EXCEPTIONS.md
├─ METRICS.md
├─ ASSURANCE.md                                # populated in Phase 25
├─ CONTRACTS.md                                # optional, Phase 04
└─ artifacts/                                  # heavy outputs land here
   ├─ views/                                   # architecture diagrams
   ├─ specs/                                   # TLA+/Alloy specs (Phase 20)
   ├─ chaos/                                   # experiment reports
   ├─ perf/                                    # load/soak/spike reports
   ├─ sbom/                                    # SBOMs + attestations
   ├─ a11y/                                    # WCAG evidence
   └─ ai/                                      # model cards, datasheets, eval reports
```

---

## C.12 The one-page COMMIT MESSAGE template (Phase 22 discipline)

```
<type>: <short imperative summary, ≤ 72 chars>

Fixes: FND-YYYY-####
TIMELINE: REQ-####, INV-####     # every requirement this change touches
SIL: SIL#                         # of affected component(s)

Why:
- (root cause in one paragraph, past the symptom)

What changed:
- (bullet the minimal-safe change)
- (contract/schema/doc updates if any)

Regression test:
- (test ID + one-line description; MUST exist for fix commits)

Regression Guard:
- Ran against affected ACTIVE requirements; all green.

Ratchets touched (if any):
- <metric>: <before> → <after>

Reviewer(s):
- @reviewer1  (SIL4 requires 2nd reviewer)
```

`<type> ∈ {fix, refactor, feat, docs, chore, perf, security, a11y, test, revert}`. Refactor commits: **no `Fixes:` allowed** and behavior tests must pass unchanged.

---

> These templates make the whole system executable. Copy, adapt to the project's naming, and the agent has structured memory from day one.
