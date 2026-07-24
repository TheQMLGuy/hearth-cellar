# 00 — MASTER PROTOCOL
## Zero-Defect Protocol Omega (ZDP-Ω) · Universal, Stack-Independent, Standards-Anchored
> A god-tier audit-and-remediation system that drives an AI coding agent to transform a defect-prone codebase into a hardened, traceable, verifiable, near-zero-defect system — and keep it there.
>
> **Version:** Ω-1.0 · **Applicability:** any language, any framework, any stack · **Operator:** an autonomous or semi-autonomous AI coding agent supervised by a human owner.

---

## §0. HOW TO READ THIS SYSTEM

This is **not** a report. It is an **operating protocol**. It ships as a set of documents:

- `AGENT_BOOT.md` — the 1-page bootloader the agent reads first, every session.
- `00_MASTER_PROTOCOL.md` — **this file**: philosophy, invariants, the ledger law, the phase state machine, the scoring model, the meta-loop.
- `PHASE_00 … PHASE_25` — one self-contained document per phase. Each is directly executable.
- `APPENDIX_STANDARDS_REGISTER.md` — every standard the system references, what to pull from it, and a fetch protocol.
- `APPENDIX_SEVERITY_AND_DEFECTS.md` — IEEE 1044 classification, P0–P3 rubric, defect taxonomy.
- `APPENDIX_TEMPLATES.md` — copy-paste schemas for every ledger file and record type.
- `APPENDIX_VIBE_CODING_PLAYBOOK.md` — how the agent behaves while writing code, session to session.
- `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` — the dual-mindset overlay: THE RIVAL runs every falsification pass, THE PRINCIPAL runs every exit-gate review.

**Design intent (why this beats a checklist):** checklists rot because they don't force *evidence*, don't *sequence* work, don't *gate*, and don't *persist state* across an AI's amnesiac sessions. ZDP-Ω fixes all four: every phase has an **exit gate**, every claim needs **evidence**, work is **strictly ordered**, and **ledger files are the memory**.

---

## §1. THE PHILOSOPHY (six pillars)

1. **Zero-defect is a direction, not a boast.** "No bugs at all" is unprovable in general (Rice's theorem, halting problem). What *is* achievable: (a) make whole *classes* of defects **structurally impossible** (Phase 04, 05, 21 — parse-don't-validate, illegal-states-unrepresentable, typed boundaries); (b) **detect** the rest with adversarial, property-based, and formal methods; (c) **prevent regression** with gates and ratchets. ZDP-Ω is honest: it drives defect density toward zero and *proves how far it got*.

2. **Prevention ≫ detection ≫ correction.** Cheapest defect is the one the type system/architecture made unrepresentable. Next cheapest is caught by a gate. Most expensive is found in production. Every phase pushes work leftward.

3. **The ledger is the mind.** An AI agent's working memory is volatile and lossy ("context rot"). The system externalizes *all* durable state into append-only, human-readable ledgers. The agent becomes stateless and restartable; the ledgers are the brain.

4. **Falsification, not confirmation — waged by an adversary, judged by an owner.** Confirmation bias is the auditor's cardinal sin, and a *neutral* auditor is only half-immune to it. Every falsification pass runs as the most capable adversary and rival this codebase will ever face (`APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md`, Mind One: THE RIVAL); every exit gate is judged by the person who financed the system and would have built it alone rather than accept less (Mind Two: THE PRINCIPAL). A PASS is "I tried, with everything to gain from your failure, to prove this wrong — and failed."

5. **Traceability is non-optional.** Every line of code exists to satisfy a requirement. If you can't trace code → requirement, either the requirement is undocumented (fix the ledger) or the code is unjustified (candidate for deletion). This is the core anti-vibe-coding mechanism.

6. **Standards are leverage, not liturgy.** We anchor to ISO/IEC/IEEE and adjacent standards because they encode decades of hard-won failure knowledge — but we apply the *substance*, stack-independently, and we tell the agent to *fetch and verify* rather than trust memory. Standards are cited to justify rules, never to bloat them.

---

## §2. THE TIMELINE LEDGER — SUPREME LAW
*(Full schema in Phase 00 and APPENDIX_TEMPLATES. This section is the constitution.)*

`TIMELINE.md` is an **append-only, chronologically ordered ledger** of everything the software must be true to. It is the single source of truth for user requirements, business rules, design invariants, and implicit constraints. It exists because **when vibe-coding with an AI, requirements evaporate** — the agent forgets what the user asked three prompts ago, silently drops constraints, and re-implements things differently. The TIMELINE makes forgetting impossible.

**What lives in it (entry kinds):**
- `REQ` — a user/functional/business requirement.
- `INV` — a domain invariant that must hold at all times (e.g., "account balance never negative").
- `CON` — an implicit constraint: units, ranges, currency (ISO 4217), time/zones (ISO 8601), locale, precision, limits.
- `RULE` — a business rule / policy.
- `NFR` — a non-functional requirement (perf, security, a11y, availability target).
- `DEC` — a decision that constrains future work (pointer into DECISIONS.md).
- `DROP` — an explicit, dated removal/supersession of a prior entry (entries are never deleted; they are superseded).

**The Four Laws of the TIMELINE:**
1. **Append-only.** You never edit or delete an entry's meaning. To change a requirement, append a new entry that `Supersedes:` the old ID; mark the old one `Status: SUPERSEDED`.
2. **Every entry is atomic, testable, and IDed.** If you can't write an acceptance test for it, it's not done being specified.
3. **Consult before you cut.** Before ANY code change: read the relevant TIMELINE entries. After: confirm none are violated (Regression Guard, §4).
4. **Bidirectional trace.** Every entry links forward to the code/tests that satisfy it; every code module links back to the entries it serves (TRACE_MATRIX.md).

**Anti-drift mechanic (the point of the whole thing):** at the start of each phase and before each remediation commit, the agent diffs *current behavior* against the TIMELINE and raises a `VIOLATED` finding for any drift. This catches the #1 vibe-coding failure: silent requirement loss.

> Anchored to: ISO/IEC/IEEE 29148 (requirements), IEEE 828 & ISO 10007 (configuration mgmt / traceability), ISO/IEC/IEEE 12207 & 15288 (life-cycle process framing). Applied stack-independently.

---

## §3. EVIDENCE MODEL (what "PASS" is allowed to mean)

Every check resolves to exactly one **verdict** and MUST carry **evidence**:

| Verdict | Meaning | Evidence required |
|---|---|---|
| **PASS** | Falsification attempt failed | pointer(s): file:line, test ID, command+output hash, measurement, or artifact ref |
| **FAIL** | Defect found | a `FND-*` in FINDINGS.md with repro + severity |
| **BLOCKED** | Cannot verify here | exactly what a human/tool must run to resolve |
| **N/A** | Not applicable to this system | one-line justification |
| **UNKNOWN** | Not yet examined | never allowed at a gate |

**Evidence tiers (strongest first):** ① machine proof / model-check result → ② passing property-based or MC/DC test → ③ passing example test → ④ static-analysis clean result → ⑤ reproduced measurement → ⑥ manual code-trace with file:line → ⑦ reasoned argument (weakest; only for design-level claims, never for "it works").

**Rule:** a gate item's verdict may not rest on a weaker tier than the phase document specifies for that item.

---

## §4. THE REGRESSION GUARD (runs continuously)

Before applying any change, the agent programmatically checks that the edit does not violate or omit any historical, still-ACTIVE requirement:
1. Identify TIMELINE entries in the blast radius (by module trace + keyword).
2. For each, confirm an acceptance check exists and currently passes.
3. Apply change.
4. Re-run those acceptance checks + the phase's regression set.
5. If any ACTIVE entry now fails → **revert**, open a P0/P1 finding, do not proceed.
6. Record the guard run (IDs checked, result) in AUDIT_LEDGER.md.

> Anchored to: IEEE 1012 (V&V), ISO/IEC/IEEE 29119 (test process), IEEE 828 (config integrity).

---

## §5. SEVERITY & SCORING

**Severity (full rubric in APPENDIX_SEVERITY_AND_DEFECTS):**
- **P0 Catastrophic** — security breach class (CWE Top 25), data loss/corruption, crash/hang, or **violation of a core TIMELINE requirement**. Halts the pipeline.
- **P1 Correctness** — wrong results under some inputs, concurrency/edge failures, broken recovery, contract violations.
- **P2 Efficiency/Robustness** — leaks, O(n²) on unbounded input, missing indexes, degraded resilience.
- **P3 Debt** — dead code, drift, stale docs, style, minor smells.

**Integrity-Level Tailoring (IEEE 1012 SIL 1–4).** Not every module deserves equal rigor. In Phase 01 you assign each component a **Software Integrity Level** from consequence-of-failure:
- **SIL 4 (Catastrophic):** money movement, auth, safety, irreversible actions, PII stores → *maximum* rigor: formal methods (P20), MC/DC (P19), full contracts (P04), 2-person-equivalent review.
- **SIL 3 (Critical):** core business logic, data mutations → property-based tests, full contracts, deep review.
- **SIL 2 (Marginal):** standard features → checklist + example tests.
- **SIL 1 (Negligible):** cosmetic/internal tooling → lightweight pass.
Each phase says how its depth scales with SIL. **Rigor is spent where failure hurts.**

**The Zero-Defect Score (ZDS).** A transparency instrument, not a vanity badge. Per phase, compute `phase_score = green_gate_items / total_gate_items`, weighted by SIL of the components touched. Overall ZDS is the SIL-weighted mean across phases, with **any open P0 forcing ZDS = 0** (a system with a catastrophic defect is not "95% god-tier"; it's broken). Publish ZDS + the full FINDINGS ledger. Honesty is the feature.

---

## §6. THE PHASE STATE MACHINE

Phases run in order. Each has: **Mission · Standards to fetch · Inputs · Falsification procedures · Exhaustive rules · Exit gate · Artifacts.** A phase is `OPEN → IN_PROGRESS → GATED (attempting exit) → CLOSED`. You may not open Phase N+1 until Phase N is CLOSED **or** its incompletes are explicitly deferred in EXCEPTIONS.md with the owner's sign-off.

**Loopbacks (mandatory triggers):**
- Any new `REQ`/`INV` discovered mid-audit → append to TIMELINE, loop to Phase 02 to re-baseline trace, then resume.
- Any P0 found in a later phase → freeze, jump to Phase 22 remediation for that P0, then resume.
- Architecture change during remediation → loop to Phase 03 to update views/ADRs.
- Any gate reopened by a regression → the phase returns to IN_PROGRESS.

**The 26 phases (foundations → hardening → assurance):**

| # | Phase | Mission in one line | Lead standards |
|---|---|---|---|
| 00 | Genesis / Ledger Init | Stand up the ledgers; extract the initial TIMELINE | 29148, 828, 10007 |
| 01 | Reconnaissance & Boundary | Inventory every file; map trust/module boundaries; assign SIL | 1028, 42010, 1012 |
| 02 | Requirements & Traceability | Turn needs into testable invariants; build the trace matrix | 29148, 24765 |
| 03 | Architecture Integrity | Views, coupling, dependency direction, ADRs, fitness functions | 42010, 42020, 42030 |
| 04 | Contracts & Boundary Typing | Pre/post/invariants; parse-don't-validate; illegal states unrepresentable | 15026, 29148, DbC |
| 05 | Control Flow & State | Exhaustive branch/state audit; dead code; total functions | 5055, 29119-4 |
| 06 | Data Integrity & Persistence | Transactions, constraints-in-DB, migrations, N+1, pagination | 25012, 5055 |
| 07 | Concurrency & Distribution | Races, TOCTOU, deadlocks, idempotency, ordering, consistency | 5055, 15026 |
| 08 | Resources & Lifecycle | Leak-freedom on all paths, bounded caches, atomic writes, shutdown | 5055, 25010(reliab.) |
| 09 | Resilience & Failure | Timeouts, backoff+jitter, circuit breakers, bulkheads, DLQs, chaos | 25010, 1633, SRE |
| 10 | Security Deep Audit | Injection, authN/Z, IDOR, secrets, crypto, SSRF — ASVS-driven | 27001/2, 15408, ASVS, CWE |
| 11 | Privacy & Data Protection | PII inventory, minimization, erasure, consent, audit trails | 29100, 27701, 31700 |
| 12 | Supply Chain & Build | SBOM, lockfile integrity, provenance, vuln remediation, licenses | SLSA, 5962/SPDX, 5230 |
| 13 | Frontend Layout & Visual | Grid/spacing/type scales, responsive, overflow, RTL, visual regression | 9241-125/-112, design-sys |
| 14 | Accessibility | WCAG 2.2 A/AA(/AAA), keyboard, focus, ARIA, contrast, targets | WCAG 2.2, EN 301 549, ATAG |
| 15 | Frontend Performance | Core Web Vitals (LCP/INP/CLS), bundle, render, network waterfall | Web Vitals, 25010(perf) |
| 16 | Backend Performance | Complexity budgets, hotpaths, query plans, load & soak tests | 25023, 14756, 29119 |
| 17 | Observability & Ops | Structured logs, metrics, traces, SLO/SLI/error budgets, runbooks | 32675/2675, SRE |
| 18 | API & Interface Contracts | HTTP/semantic correctness, versioning, webhooks, idempotency, schemas | 27034, 29148 |
| 19 | Test Suite Forensics | Coverage truth, MC/DC on SIL3/4, mutation score, flake hunt | 29119-1..5, 25051 |
| 20 | Formal & Adversarial | Model-check critical state; property/fuzz/metamorphic; fault injection | 15026, 13568(Z), 29119 |
| 21 | AI/ML Components | Data quality, eval, robustness, bias, drift, model/data cards, guardrails | 42001, 23894, 25059, 5259 |
| 22 | Remediation | Fix P0→P3, one change per commit, each with a regression test | 1044, 14764, 1028 |
| 23 | CI/CD Prevention | Convert every rule into a blocking gate; ratchets; prevent recurrence | 2675/32675, 730 |
| 24 | Documentation & Knowledge | User/dev/operator docs, ADR completeness, onboarding truth | 26512-15, 1063 |
| 25 | Assurance & Perpetuity | Build the assurance case; reconcile TIMELINE; schedule re-audit | 15026, 730, 90003 |

Phases 13–15 are the explicitly-mandated **frontend coverage** (layout, accessibility, performance) — a first-class citizen, not an afterthought.

---

## §7. THE META-LOOP (how the agent runs the whole thing)

```
BOOT (AGENT_BOOT.md)
  └─> Ensure ledgers exist ......................... else Phase 00
       └─> LOOP over phases 00..25 in order:
             ├─ Load phase doc
             ├─ Confirm inputs from prior phases present in ledgers
             ├─ [MIND: THE RIVAL] Run FALSIFICATION procedures (try to break it, steal it, beat it)
             ├─ Apply exhaustive RULES as checks → verdict + evidence each
             ├─ Log every FAIL as an IEEE-1044-classified FND (P0..P3)
             ├─ (P0 found?) → freeze, Phase 22 fix-path, regression-guard, resume
             ├─ [MIND: THE RIVAL] Adversarial self-review of a 10% PASS sample
             ├─ [MIND: THE PRINCIPAL] Attempt EXIT GATE:
             │     ├─ all items green, full evidence tier, zero hedging? ─ yes ─> CLOSE phase, write METRICS delta
             │     └─ no ─> defer to EXCEPTIONS (owner+expiry, Principal-approved) or stay OPEN
             └─ Context checkpoint → NEXT_ACTIONS in AUDIT_LEDGER
  └─> After Phase 25: emit ASSURANCE.md (claims–arguments–evidence),
       publish ZDS, schedule perpetual re-audit (Phase 25 §Perpetuity).
```

**Two-pass doctrine.** Pass 1 (Phases 01–21) is *breadth*: find everything, fix nothing but P0s. Pass 2 (Phase 22) is *depth*: remediate in severity order with regression tests. This prevents the classic failure of fixing symptoms while the map is still blank.

**Human-in-the-loop checkpoints (agent must pause and ask):** (a) any TIMELINE conflict/ambiguity in user intent; (b) any change to a SIL-4 component's public contract; (c) any P0 whose fix alters requirements; (d) anything BLOCKED needing infra the agent lacks (device lab, prod data, secrets vault). The agent proposes; the human disposes.

---

## §8. WHAT THIS SYSTEM HONESTLY CANNOT DO (read this)

- It cannot *prove* total absence of bugs (undecidable). It can make classes impossible, detect the rest hard, and quantify residual risk.
- It cannot verify what it cannot run. No runtime/device/prod access → those items are BLOCKED, not PASS.
- It cannot invent the user's intent. Ambiguity is escalated, never guessed.
- It is only as current as the standards you fetch. **Standards versions and clause numbers drift — always fetch and verify** (APPENDIX_STANDARDS_REGISTER §Fetch Protocol). Some standards are paywalled; use official summaries + open equivalents (e.g., NIST, OWASP, W3C) and record what you couldn't access.
- It will not turn a fundamentally wrong architecture into a good one by itself — it will *surface* that and route to Phase 03/22 with an ADR.

Honesty about limits is what separates a god-tier system from a snake-oil one.

---

## §9. GLOSSARY (fast reference)
- **SIL** — Software Integrity Level (1–4), consequence-of-failure tier (IEEE 1012).
- **REQ/INV/CON/RULE/NFR/DEC/DROP** — TIMELINE entry kinds (§2).
- **FND** — a finding (defect) in FINDINGS.md.
- **Regression Guard** — the continuous ACTIVE-requirement re-check (§4).
- **Ratchet** — a metric threshold that may only move in the good direction (Phase 23).
- **Falsification procedure** — a scripted attempt to break the code (per phase).
- **Exit gate** — the hard, evidence-backed condition to close a phase.
- **ZDS** — Zero-Defect Score (§5); any open P0 ⇒ ZDS 0.

> Proceed to `PHASE_00_GENESIS_LEDGER_INIT.md`.
