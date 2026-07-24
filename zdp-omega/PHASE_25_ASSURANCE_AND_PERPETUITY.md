# PHASE 25 — ASSURANCE & PERPETUITY
> Assemble the evidence into a formal assurance case, reconcile it against the TIMELINE, publish the honest ZDS, and put the system on a treadmill so entropy does not undo the work.

**Lead standards:** **ISO/IEC/IEEE 15026** parts 1–4 (systems and software assurance — assurance cases with Claims–Arguments–Evidence, integrity levels), IEEE 730 (SQA plans), ISO/IEC/IEEE 90003 (applying ISO 9001 to software), ISO/IEC/IEEE 12207 & 15288 (life-cycle continuity), IEEE 828 (config management continuity).
**Applicability:** every audit closes here. **Inputs:** every prior phase's artifacts.

## 25.1 MISSION
Produce the artifact that answers "how do we *know* this system is safe/correct/secure/accessible/available enough for its declared purpose?" and set up the mechanisms that will keep the answer true.

## 25.2 THE ASSURANCE CASE (ISO/IEC/IEEE 15026)

Write `ASSURANCE.md` as a **Claims–Arguments–Evidence** structure:

### Structure
- **Top claim** — the property the system asserts, phrased as a testable, bounded statement (e.g., "System S, at release R, satisfies its TIMELINE requirements at SIL-appropriate rigor, meets its published SLOs and WCAG 2.2 AA conformance, and contains no known P0 defect.").
- **Sub-claims** — one per attribute area: correctness, security, privacy, accessibility, performance, reliability, supply-chain integrity, operational readiness, AI safety (if applicable).
- **Arguments** — the logical decomposition: *because* the phases below produced these results, *therefore* the sub-claim holds. Include argument type (deductive coverage / inductive sampling / analogical), assumptions relied on (link to ASSUMPTIONS.md), and confidence.
- **Evidence** — links to concrete artifacts: TRACE_MATRIX, test reports, ASVS checklist results, WCAG conformance matrix, chaos experiment reports, formal-spec results, SBOM + attestation, drill reports, RUM dashboards, ADRs, waivers.
- **Defeaters** — the ways this argument could be wrong; how the audit addressed each; what residual risk remains.

### The honesty clauses
- **Explicitly enumerate what we did NOT verify** (BLOCKED items, environments we lacked, standards we couldn't fetch). No "assumed clean."
- **Explicitly enumerate open EXCEPTIONS** (waived items with expiry) — the case is conditional on their compensating controls.
- **Version-stamp every standard consulted** (from METRICS StandardsConsulted). Standards drift; the case is anchored to what was current at audit time.

## 25.3 TIMELINE RECONCILIATION
- **R25.1** For every ACTIVE TIMELINE entry, show: acceptance test(s), evidence tier, verdict, links. Coverage = 100% ACTIVE with a PASS or waived; anything else is a gate failure of Phase 25.
- **R25.2** For SUPERSEDED entries, confirm the supersede is followed through in code, docs, and tests.
- **R25.3** For PROPOSED entries left unresolved, list them explicitly and route to the owner — the audit ends with an open item, not silence.

## 25.4 THE ZERO-DEFECT SCORE (published)
- **R25.4** Compute the ZDS per MASTER §5: SIL-weighted mean of phase pass rates; **any open P0 forces ZDS = 0**.
- **R25.5** Publish the ZDS *with* the FINDINGS ledger and the assurance case. The number without the ledger is meaningless.
- **R25.6** Include a **residual-risk narrative**: what could still go wrong, how likely, how it would be caught, what recovery looks like.

## 25.5 PERPETUITY — KEEPING IT TRUE
An audit is a photograph; entropy is a movie. Install the mechanisms that keep the result alive:

- **R25.7 Re-audit cadence** by SIL: SIL4 quarterly light + annual full; SIL3 semi-annual light + biennial full; SIL1/2 annual; **plus** on trigger events: major architecture change, new compliance regime, first P0 in production, dependency-major upgrade, model retrain (P21).
- **R25.8 Living ledgers:** TIMELINE, FINDINGS, TRACE_MATRIX, ADRs remain the day-to-day source of truth — not archives.
- **R25.9 Continuous gates from P23** keep enforcing every rule; **ratchets** keep metrics moving in the good direction.
- **R25.10 Systemic learning:** every escaped defect that reaches production becomes: (a) a post-mortem, (b) a permanent gate/test, (c) an update to the relevant phase document so the next audit catches the class. This document evolves.
- **R25.11 Standard version tracking:** subscribe to updates for the standards listed in APPENDIX_STANDARDS_REGISTER; when a normative version changes, open a re-audit ticket for the affected phase(s).
- **R25.12 The Bootloader guarantee:** every new AI session (or new engineer) starts at `AGENT_BOOT.md`; the ledgers are the memory; the state machine is the process. Nothing important lives only in someone's head.

## 25.6 PUBLICATION
- **R25.13 Internal:** the full assurance case + FINDINGS + ZDS is available to any engineer/reviewer.
- **R25.14 External (as appropriate):** summary claims (e.g., "WCAG 2.2 AA conformance", "SLSA L3 provenance", "ASVS 5.0 L2 verified") published with links to the artifacts a reviewer can inspect (SBOM URL, ACR/VPAT, security.txt).
- **R25.15** Nothing overclaimed. If you can't back a claim with evidence at the required tier, drop the claim, not the honesty.

## 25.7 THE PERPETUAL META-LOOP (Phase 25 restarts Phase 00)
```
Time passes  →  code, requirements, standards drift
             →  ratchet/gate alarms fire OR cadence trigger
             →  re-audit ticket opens
             →  agent boots from AGENT_BOOT.md
             →  Phase 00: reconcile ledgers with new realities
             →  scoped or full run of subsequent phases
             →  updated assurance case supersedes prior
             →  ZDS re-published
```

## 25.8 EXIT GATE — JUDGED AS THE PRINCIPAL

> **Mind: THE PRINCIPAL.** Guilty until the evidence tier matches; no gate closes on "mostly." Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.2.

- [ ] `ASSURANCE.md` complete: top claim, sub-claims, arguments, evidence, defeaters, honesty clauses. **Evidence:** the file.
- [ ] TIMELINE reconciliation: 100% ACTIVE covered; SUPERSEDED closed; PROPOSED escalated. **Evidence:** reconciliation table.
- [ ] Zero open P0; open P1 counts + waiver expiries recorded. **Evidence:** FINDINGS snapshot.
- [ ] ZDS computed, published, with FINDINGS + residual-risk narrative. **Evidence:** ZDS artifact.
- [ ] Re-audit schedule + triggers set. **Evidence:** schedule.
- [ ] Standards-version watchlist configured. **Evidence:** watchlist.
- [ ] Post-mortems → permanent-test loop policy documented and running. **Evidence:** policy + example conversions.
- [ ] External claims (if any) backed by pointer to artifacts. **Evidence:** public statement.

## 25.9 ARTIFACTS OUT
`ASSURANCE.md` (claims–arguments–evidence + defeaters + honesty); TIMELINE reconciliation report; ZDS + residual risk narrative; re-audit schedule + watchlist; public conformance statements (where applicable); a signed audit-close entry in AUDIT_LEDGER.

## 25.10 THE FINAL WORD (for the agent)
You began at `AGENT_BOOT.md`. You end here, having:
- Turned vibe into invariant (TIMELINE).
- Made whole defect classes unrepresentable (P04, P07, P21).
- Detected the rest with adversarial rigor (P10, P14, P19, P20).
- Sealed the door behind you with gates and ratchets (P23).
- Told the truth about what you don't know (BLOCKED, PROPOSED, EXCEPTIONS).

That is what god-tier means here: not perfection, but a system that **cannot silently rot**, whose claims are **backed by evidence**, and whose next auditor — human or AI — inherits **a mind (the ledgers), a process (the phases), and a proof (the assurance case)**.

> End of audit. Loop restarts at trigger. Bootloader awaits.
