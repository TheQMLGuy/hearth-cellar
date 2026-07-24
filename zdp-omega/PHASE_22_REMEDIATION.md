# PHASE 22 — REMEDIATION
> All previous phases were *finding*. This phase is *fixing* — in strict severity order, one change per commit, each with a regression test, without breaking anything that was working. This is where the ledger becomes green.

**Lead standards:** IEEE 1044 (anomaly classification — used throughout), ISO/IEC/IEEE 14764 (software maintenance), IEEE 1028 (review of fixes), IEEE 828 (change control), IEEE 730 (SQA discipline).
**SIL depth:** SIL4 fixes require peer review + full contract re-verification; SIL3 require peer review + regression test at ≥ property level; SIL1/2 require regression test at example level. **Inputs:** FINDINGS.md (all P0–P3), TIMELINE (unchanged unless intentionally superseded), TRACE_MATRIX.

## 22.1 MISSION
Close findings in severity order — **P0 → P1 → P2 → P3** — each closure carrying: a minimal fix, an explanation, a regression test, a Regression Guard run, an updated TRACE_MATRIX, and a ratchet in METRICS. Ship no drive-by refactors in fix commits. Ship no behavior changes in refactor commits.

## 22.2 THE ONLY ORDER YOU'RE ALLOWED TO WORK IN
1. **All open P0s first.** No P2 work while a P0 is open, no matter how tempting.
2. **P1s next**, grouped by system slice for shared reviewer context.
3. **P2s** as capacity permits and risk warrants.
4. **P3s** batched into low-risk cleanup PRs.

**Exceptions:** two — (a) a P2/P3 that must be fixed as a *dependency* of a P0/P1 fix (record the dependency link in the FND), (b) a P3 whose fix demonstrably reduces the surface area for repeat findings (worth it if approved in EXCEPTIONS.md with rationale).

## 22.3 THE COMMIT DISCIPLINE (non-negotiable)
- **R22.1 Smallest safe change.** One logical fix per commit. Do not "improve while you're in there" — separate refactor PRs.
- **R22.2 Every fix commit contains:** the fix + at least one failing-before / passing-after regression test + `Fixes: FND-…` in the message + `TIMELINE: REQ-…` reference.
- **R22.3 Every refactor commit** changes **no observable behavior** — proven by the pre-existing test suite passing, and where feasible, a differential run showing byte-identical outputs on a fixture set. Refactor + fix in one commit = protocol violation.
- **R22.4 Public contracts (P04, P18) are stable across fix commits** unless the fix requires a contract change, which itself is an ADR (crosses to R03.7) with a versioned migration path (crosses to R18.5).
- **R22.5 Regression Guard runs on every commit** (crosses to §4 of MASTER). No commit lands if any ACTIVE requirement is violated.
- **R22.6** No `TODO`/`FIXME`/`XXX` left behind — they become FND entries or they're removed.

## 22.4 THE PER-FINDING WORKFLOW
For each FND, execute in order — do not skip:

1. **Restate the defect** in one sentence: what's wrong, where, under what conditions, consequence.
2. **Reproduce it.** A test that fails today, deterministically. If you cannot reproduce, the fix is speculation — either write a probe test, or downgrade the FND with a note.
3. **Root cause.** Chase past the symptom (5-whys). Fixing symptoms is P3 debt; fix the cause.
4. **Blast radius.** What else does the cause touch? Enumerate — those places get their own FNDs or an expanded fix scope.
5. **Design the fix.** Prefer prevention-by-construction (P04/P07/P21 patterns) over point patches. If a type/architecture change makes the whole class disappear, do that — with an ADR.
6. **Consult TIMELINE.** Any ACTIVE requirement this fix touches. If the fix requires a requirement change → propose a supersede entry to the owner (Human Checkpoint).
7. **Implement the fix.** Smallest safe change.
8. **Add the regression test.** Ideally property-based (R19.12) or model-checked (P20) for SIL3/4 causes.
9. **Update contracts / schemas / docs** if the surface changed.
10. **Run the Regression Guard** — the fix must not violate any ACTIVE requirement.
11. **Peer review** at the depth SIL demands (SIL4: two-reviewer equivalence for correctness + security).
12. **Merge & measure.** Move the fix's metric (leak count, complexity, coverage, mutation, perf) in METRICS.md; **ratchet the threshold** if the improvement is durable (crosses to P23).
13. **Update the ledger:** FND status VERIFIED with links to commit/test/PR; TRACE_MATRIX updated; if applicable, ASSUMPTIONS updated (an assumption might now be provably true).
14. **Retire adjacent debt** discovered en route as new FNDs, not silent fixes.

## 22.5 SPECIAL CASES

### P0 fix under time pressure
- Do the **minimum durable** fix that removes the P0 (not a hack: hacks become the next P0). If a true fix takes days, deploy a **mitigation** (feature flag off, rate limit, disabled endpoint) explicitly labeled temporary, with a follow-up FND for the real fix + a hard-deadline entry in EXCEPTIONS.md.
- **Post-mortem** (crosses to R17.17) within the incident window.

### Requirement changed to justify a fix
- Not allowed unless owner-approved. If accepted, **append** a superseding TIMELINE entry (Four Laws of the TIMELINE — R02.8) with rationale + acceptance criteria; mark the old entry SUPERSEDED; ripple through TRACE_MATRIX and re-run affected acceptance checks.

### The fix reveals a deeper class of bug
- Open a "**parent**" FND for the class + child FNDs for instances found; work parent-first with a structural fix.

### Waivers
- Any decision not to fix goes to EXCEPTIONS.md with: rationale, owner, expiry ≤ 90 days, compensating control if any. Waivers **auto-expire** and reopen the finding (P23 ratchet).

## 22.6 EXIT GATE — JUDGED AS THE PRINCIPAL

> **Mind: THE PRINCIPAL.** Guilty until the evidence tier matches; no gate closes on "mostly." Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.2.

- [ ] **Zero open P0s.** (Hard gate.) **Evidence:** FINDINGS.md P0 == 0.
- [ ] All P1 findings either fixed or waived-with-expiry ≤ 30 days. **Evidence:** FND status.
- [ ] All fix commits have regression tests + `Fixes:` + `TIMELINE:` refs. **Evidence:** commit audit.
- [ ] Regression Guard clean for all ACTIVE requirements. **Evidence:** guard runs.
- [ ] Metrics: complexity down (or held), coverage/mutation up (or held), leak/duplicate counts down. **Evidence:** METRICS deltas.
- [ ] TRACE_MATRIX current for every fix. **Evidence:** matrix.
- [ ] Contract/schema/docs updates included in each fix that changed a surface. **Evidence:** diffs.
- [ ] Post-mortems on file for each P0 remediated. **Evidence:** PIRs.

## 22.7 ARTIFACTS OUT
Fix commits + regression tests; updated FINDINGS with lifecycle traces; METRICS deltas; ADRs for any structural fixes; post-mortems for P0s; a "clean baseline" tag for P23 ratchets.

> Next: `PHASE_23_CI_CD_PREVENTION.md`.
