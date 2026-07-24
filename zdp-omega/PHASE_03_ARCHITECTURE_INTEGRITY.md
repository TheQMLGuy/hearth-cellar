# PHASE 03 — ARCHITECTURE INTEGRITY
> Verify the skeleton before auditing the flesh. Dependency direction, module boundaries, decision records, and **fitness functions** that keep the architecture honest forever.

**Lead standards:** ISO/IEC/IEEE 42010 (architecture description), 42020 (architecture processes), 42030 (architecture evaluation); open methods: ATAM, C4, arc42, Dependency Structure Matrix (DSM).
**SIL depth:** SIL-4 components get full evaluation scenarios; SIL-1 a structural pass. **Inputs:** Phase 01 views, Phase 02 NFRs.

## 3.1 MISSION
Prove the structure supports the requirements: dependencies flow the right way, boundaries are real, decisions are recorded, and every architectural rule is expressible as an automatable **fitness function** (implemented as gates in Phase 23).

## 3.2 FETCH & GROUND
Fetch/verify: 42010 concepts (stakeholder/concern/viewpoint/view/rationale), 42030 evaluation factors, ATAM scenario format (stimulus–environment–response). Record versions.

## 3.3 FALSIFICATION PROCEDURES — RUN AS THE RIVAL

> **Mind: THE RIVAL.** Hostile, no benefit of the doubt, no courtesy notice. Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.1.

- **Cycle hunt:** compute the module dependency graph; any strongly-connected component >1 = cycle (CWE-1047 class) → P1.
- **Layer-breach probe:** pick 10 "should-be-forbidden" imports (UI→DB direct, domain→framework, low-level→high-level) and grep for them.
- **Change-cost probe:** simulate 3 common changes from TIMELINE (e.g., "add a field end-to-end"). Count files touched. Shotgun surgery (>N files for a local concept) = coupling finding.
- **God-module probe:** rank modules by fan-in×fan-out and LOC; top outliers reviewed for single-responsibility violations.
- **Hidden-coupling probe:** hunt shared mutable globals, ambient singletons, reach-into-internals imports, and "utility" dumping grounds.

## 3.4 EXHAUSTIVE RULES
- **R03.1 Dependency direction:** dependencies point from volatile → stable; business/domain logic depends on **abstractions**, never on concrete infrastructure/framework details (dependency inversion at boundaries).
- **R03.2 Zero cycles** at module/package level. Existing cycles are findings with a break plan (interface extraction).
- **R03.3 Layering honored:** no reach-arounds (presentation calling persistence directly); each layer talks only to adjacent abstractions.
- **R03.4 Explicit boundaries:** modules expose intentional interfaces; internal symbols not importable/exported; boundary data crosses as DTO/domain types, not internal structures.
- **R03.5 No hidden globals:** shared state and singletons inventoried; dependencies **injected** (constructor/parameter), not ambient.
- **R03.6 God components decomposed** or justified by ADR; single responsibility per module statable in one sentence.
- **R03.7 ADR coverage:** every major structural decision (storage choice, sync-vs-async, multi-tenancy model, authz model, caching strategy) has an ADR in DECISIONS.md: context → options → decision → consequences. Backfill missing ones now.
- **R03.8 NFR scenarios (ATAM-lite):** for each top NFR from TIMELINE, write a scenario (stimulus, environment, expected response+measure) and name the architectural tactic that satisfies it. No tactic = architecture gap finding.
- **R03.9 Fitness functions defined:** every rule above becomes a machine-checkable assertion spec (e.g., "no import from layer A to C", "no cycle", "module X has no dependency on vendor Y"). Phase 23 wires them into CI.
- **R03.10 Duplication of purpose:** two modules doing the same job (parallel implementations from vibe-coding sessions) merged or one deprecated via ADR.
- **R03.11 Configuration architecture:** one coherent config layer; no scattered env reads deep in domain code.
- **R03.12 Extension points intentional:** plugin/hook mechanisms documented; no "modify core to extend" patterns for anticipated variation (per TIMELINE roadmap entries).

## 3.5 EXIT GATE — JUDGED AS THE PRINCIPAL

> **Mind: THE PRINCIPAL.** Guilty until the evidence tier matches; no gate closes on "mostly." Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.2.

- [ ] Dependency graph computed; cycles = 0 or each has FND + break plan. **Evidence:** graph + SCC list.
- [ ] Layer rules stated + breach scan clean (or findings filed). **Evidence:** rule list + scan output.
- [ ] ADR coverage complete for major decisions. **Evidence:** ADR index vs decision list.
- [ ] NFR scenarios written with tactics for all top NFRs. **Evidence:** scenario table.
- [ ] Fitness-function spec list complete (1 per rule). **Evidence:** the spec list handed to Phase 23.
- [ ] God-module/hidden-global findings filed. **Evidence:** FND refs.

## 3.6 ARTIFACTS OUT
Dependency graph + DSM; ADR set; NFR scenario table; fitness-function specs; architecture findings.

> Next: `PHASE_04_CONTRACTS_AND_BOUNDARY_TYPING.md`.
