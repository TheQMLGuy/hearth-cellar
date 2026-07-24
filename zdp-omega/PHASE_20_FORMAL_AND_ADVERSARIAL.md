# PHASE 20 — FORMAL METHODS & ADVERSARIAL VERIFICATION
> For SIL4 protocols and money-touching state machines, tests are not enough. Model-check the design, prove the properties, then break the running system on purpose to prove the resilience wasn't fiction.

**Lead standards:** ISO/IEC/IEEE 15026 (systems and software assurance — claims, arguments, evidence), ISO/IEC 13568 (Z notation), academic canon around TLA+/Alloy/Event-B/refinement types/model checking; **chaos engineering** principles (steady state, hypothesis, blast radius, abort).
**SIL depth:** SIL4 mandatory; SIL3 selected components; SIL1/2 skip. **Inputs:** SIL4 modules list (P01), critical protocols from P07/P09.

## 20.1 MISSION
Convert the highest-consequence design properties into formal claims and either **prove** them (model check / theorem prove) or **exhaustively try to refute** them (bounded model check + property/fuzz + chaos). The output is an evidence tier upgrade for the assurance case (P25).

## 20.2 PROPERTIES WORTH FORMALIZING (typical high-value targets)
- **Safety** (nothing bad happens): no double-spend, no unauthorized access, no invariant violation.
- **Liveness** (something good eventually happens): every accepted job eventually terminates; every message eventually delivered under fair scheduling.
- **Consistency**: replicated state converges under the chosen model (linearizable / sequential / causal / eventual); reads never see impossible histories.
- **Isolation / concurrency**: no lost updates, no dirty reads at the promised isolation level.
- **Ordering**: FIFO/causal guarantees you claim actually hold.
- **Termination** & **decidability** of critical loops.

## 20.3 FALSIFICATION PROCEDURES — RUN AS THE RIVAL

> **Mind: THE RIVAL.** Hostile, no benefit of the doubt, no courtesy notice. Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.1.

- **Model-checker attack:** encode the protocol/state machine in a formal spec language; run exhaustive state-space exploration for a bounded model. Counterexample = design bug (not implementation bug — worse).
- **Property attack:** at the code level, formulate the property as a runnable property test (P19); shrinker delivers a minimal repro; commit as regression.
- **Fault-injection attack:** implement the P09 chaos hypotheses. Steady-state metric → inject → measured degradation → recovery time. Blast-radius limits enforced; abort conditions armed.
- **Concurrency stress:** run tools/harnesses that explore schedule interleavings for critical shared-state code (e.g., under a race detector, deterministic scheduler, or targeted concurrency stress harness).

## 20.4 EXHAUSTIVE RULES

### Spec-first for SIL4 state machines & distributed protocols
- **R20.1** Every SIL4 protocol (payments, auth issuance, ledger updates, distributed saga) has a **formal spec** using a modeling language capable of expressing concurrency/state (TLA+, Alloy, Event-B, or an equivalent). The spec is versioned in-repo and linked to the code.
- **R20.2** The spec declares the intended invariants + liveness properties explicitly; model checking runs at scales up to a documented bound; results (Pass / Counterexample+trace) committed as evidence.
- **R20.3** Where a spec–code gap can drift, extract runtime assertions from the spec (or use trace-checking) so violations at runtime are catchable.

### Design-by-Contract at runtime for SIL3/4
- **R20.4** Pre/post/invariants (P04) are **enforced** in SIL3/4 modules — at least in test/CI builds; violations abort loudly (`assert`-class behavior with rich context).
- **R20.5** Ghost/model variables permitted for testability; production removal is a conscious ADR.

### Property-based mathematics
- **R20.6** Every commutative/associative/idempotent claim in the code is a testable property; those properties are tested exhaustively over the input space up to bounded sizes (crosses to R19.12).
- **R20.7** For crypto/security-relevant math (nonce generation, key derivation, MAC verification): use only vetted primitives (R10.29) + test the *usage* properties (unique nonces, MAC-then-encrypt or AEAD, constant-time compare).

### Fuzzing at scale
- **R20.8** Coverage-guided fuzz targets exist for every boundary parser, serializer, and network-facing state machine; corpora + minimized crashes committed; fuzz duration budgeted (nightly + on-demand).
- **R20.9** **Differential fuzzing** where two implementations should agree (e.g., server ↔ SDK, encoder ↔ decoder, cache vs source).

### Chaos & fault injection (production or prod-like)
- **R20.10 Steady-state metric** defined per experiment; hypothesis explicit; abort condition armed and tested; blast radius bounded (tenant / percentage / region).
- **R20.11 Experiments** cover: dependency down, dependency slow (100–1000× latency), dependency erroring, dependency **lying** (bad payload/stale data), network partitions, packet loss, clock skew, disk full, kernel OOM, node kill, cert expiry, DNS failure, cache flush, region failover.
- **R20.12** Every experiment produces: pass/fail against hypothesis, MTTR, findings, and action items.
- **R20.13** Game days on the top failure modes at a cadence (SIL3/4: ≥ quarterly).

### Concurrency verification
- **R20.14** Race detectors / thread sanitizers run in CI where the platform supports them.
- **R20.15** Model-check or exhaustively enumerate small interleavings for critical shared-state code paths (e.g., the ledger update, the leader election, the two-phase commit-like flows).

### Where formality doesn't fit — write it down
- **R20.16** For SIL4 components that aren't practical to model-check (e.g., ML models, opaque third-party services), replace with **rigorous statistical bounds** and **runtime monitors**: acceptance regions, drift alarms, out-of-distribution detectors (crosses to P21).

## 20.5 EXIT GATE — JUDGED AS THE PRINCIPAL

> **Mind: THE PRINCIPAL.** Guilty until the evidence tier matches; no gate closes on "mostly." Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.2.

- [ ] All SIL4 protocols have committed formal specs + model-checking results. **Evidence:** specs + reports.
- [ ] Property tests for algebraic laws pass; corpora expanding. **Evidence:** suites.
- [ ] Fuzz corpora + no unresolved crash-class findings at policy severity. **Evidence:** corpora + FND status.
- [ ] Chaos experiments executed per plan; hypotheses met or FNDs filed. **Evidence:** experiment reports.
- [ ] Concurrency verification runs part of CI for critical modules. **Evidence:** CI logs.
- [ ] Runtime contract enforcement present in test/CI builds on SIL3/4. **Evidence:** config.

## 20.6 ARTIFACTS OUT
Formal specs + model-check reports; property + fuzz + differential fuzz suites; chaos experiment reports; runtime-monitor spec; contract-enforcement config.

> Next: `PHASE_21_AI_ML_COMPONENTS.md`.
