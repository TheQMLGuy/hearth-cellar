# PHASE 02 — REQUIREMENTS & TRACEABILITY
> Turn fuzzy needs into **mathematically testable invariants**, then wire **bidirectional traceability** from every requirement to the code and tests that satisfy it. This is the engine that makes vibe-coding drift detectable.

**Lead standards:** ISO/IEC/IEEE 29148 (requirements engineering — characteristics, the SRS content), ISO/IEC/IEEE 24765 (precise vocabulary), IEEE 828 + ISO 10007 (traceability & configuration status accounting), ISO/IEC/IEEE 12207/15288 (process context).
**SIL depth:** SIL-4/3 requirements get formal acceptance criteria and (later) property/formal tests; SIL-2/1 get example-test criteria. **Inputs:** initial TIMELINE + FILE_LEDGER + views.

---

## 2.1 MISSION
Every requirement becomes (a) **atomic**, (b) **unambiguous**, (c) **testable**, (d) **traced** forward to design/code/test and backward from code. Undocumented behaviors are surfaced; unjustified code is flagged. Leaving here, TRACE_MATRIX is complete and the Regression Guard has real acceptance checks to run.

## 2.2 FETCH & GROUND
Fetch/verify 29148's requirement quality attributes (necessary, appropriate, unambiguous, complete, singular, feasible, verifiable, correct, conforming) and its guidance on requirement *sets* (consistent, non-redundant). Use 24765 to fix terminology so "shall" statements are precise. Record versions.

## 2.3 FALSIFICATION PROCEDURES — RUN AS THE RIVAL

> **Mind: THE RIVAL.** Hostile, no benefit of the doubt, no courtesy notice. Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.1.

- **Ambiguity attack:** for each requirement, generate two plausible contradictory interpretations. If you can, it's ambiguous → rewrite or escalate.
- **Untestability attack:** try to write a failing test that would catch a violation. If you can't express one, the requirement isn't specified enough.
- **Orphan-code attack:** for each nontrivial module, ask "which TIMELINE entry justifies this?" No answer → either a missing requirement (add PROPOSED) or dead/unjustified code (P2/P3 finding, candidate deletion in Phase 22).
- **Orphan-requirement attack:** for each TIMELINE entry, ask "where is this implemented and tested?" No implementation → gap; no test → the Regression Guard is blind here (fix).
- **Hyrum's Law probe:** identify observable behaviors that callers/users likely depend on even though never specified (default orderings, timing, error text, tolerant parsing). Capture as `CON`/`RULE` (PROPOSED) so a "cleanup" doesn't silently break consumers.
- **Ariane-5 probe:** identify assumptions inherited from a prior context that may no longer hold (reused module now fed different ranges/types/scale). Log each in ASSUMPTIONS.md with a concrete violation test.

## 2.4 PROCEDURE

### Step 1 — Refine every entry to testable form
Rewrite each TIMELINE `REQ/INV/CON/RULE/NFR` so it has a **precise statement** and a **formal-ish acceptance criterion**. Prefer the shape *"For all inputs X satisfying P, the system guarantees Q,"* with explicit bounds. Examples of turning vibe into invariant:
- Vibe: "handle money correctly" → `INV`: "All monetary values are represented as integer minor units in currency C (ISO 4217); no floating-point arithmetic touches money; rounding is half-even at display only." + acceptance test list.
- Vibe: "fast search" → `NFR`: "p95 search latency ≤ 300 ms at N=10⁶ rows under load profile L." + how measured.
- Vibe: "users can't see others' data" → `INV`: "For all users u and resources r, read/write(u,r) ⇒ owner(r)=u ∨ granted(u,r)." (Phase 10 IDOR tests this.)

### Step 2 — Build bidirectional traceability (TRACE_MATRIX)
Complete every row: `REQ-ID | requirement | design ref (ADR/view) | code refs (file:symbol) | test refs (IDs) | evidence tier | status`. **Bidirectional** means: from a requirement you can find its code+tests; from a file (in FILE_LEDGER) you can find the requirements it serves. Fill both directions. Anything with no test gets a `NEEDS-TEST` flag routed to Phase 19.

### Step 3 — Consistency & completeness of the set
Check the requirement *set*: no two ACTIVE entries contradict; no redundant duplicates (merge with supersede); coverage spans all entry points and user-visible features found in Phase 01. Gaps → PROPOSED entries + Human Checkpoint.

### Step 4 — Lock the Regression Guard baseline
For every ACTIVE requirement with an acceptance check, ensure that check exists (or is flagged NEEDS-TEST). The set of ACTIVE acceptance checks *is* the Regression Guard's baseline for all later phases.

## 2.5 EXHAUSTIVE RULES
- **R02.1** Every ACTIVE requirement is atomic, unambiguous, and testable (has an acceptance criterion).
- **R02.2** Every requirement traces forward to code+test (or is flagged as a gap/NEEDS-TEST).
- **R02.3** Every nontrivial code module traces back to ≥1 requirement (or is flagged unjustified).
- **R02.4** The requirement set is internally consistent and non-redundant.
- **R02.5** All implicit constraints (units/currency/time/locale/limits) have explicit, bounded acceptance criteria.
- **R02.6** Hyrum's-Law observable behaviors are captured before any cleanup touches them.
- **R02.7** Inherited assumptions are in ASSUMPTIONS.md, each with a violation test.
- **R02.8** No requirement changed by editing history — changes are supersede-appends.

## 2.6 EXIT GATE — JUDGED AS THE PRINCIPAL

> **Mind: THE PRINCIPAL.** Guilty until the evidence tier matches; no gate closes on "mostly." Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.2.

- [ ] 100% of ACTIVE requirements are testable with acceptance criteria. **Evidence:** per-entry criteria.
- [ ] TRACE_MATRIX complete both directions; gaps/NEEDS-TEST flagged. **Evidence:** matrix + flag counts.
- [ ] Requirement set consistent & non-redundant. **Evidence:** contradiction/duplicate scan result.
- [ ] Assumptions logged with violation tests. **Evidence:** ASSUMPTIONS entries.
- [ ] Regression Guard baseline set (ACTIVE acceptance checks identified). **Evidence:** the baseline list.
- [ ] Human Checkpoint issued for all remaining PROPOSED/ambiguous. **Evidence:** checkpoint list.

## 2.7 HUMAN CHECKPOINT
Confirm superseded/ambiguous requirements and any inferred invariants (esp. money, auth, data-ownership, units). Get sign-off on the acceptance criteria for all SIL-4 requirements.

## 2.8 ARTIFACTS OUT
Refined TIMELINE (testable); complete TRACE_MATRIX; ASSUMPTIONS ledger; Regression Guard baseline; NEEDS-TEST list for Phase 19.

> Next: `PHASE_03_ARCHITECTURE_INTEGRITY.md`.
