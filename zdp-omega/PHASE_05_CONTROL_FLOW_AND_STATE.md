# PHASE 05 — CONTROL FLOW & STATE
> Every branch intended, every state legal, every loop provably terminating, every duplicate rule unified. This is where "it mostly works" dies.

**Lead standards:** ISO/IEC 5055 (maintainability/reliability weaknesses), ISO/IEC/IEEE 29119-4 (structure-based techniques feed Phase 19), McCabe cyclomatic + cognitive-complexity practice.
**SIL depth:** thresholds tighten with SIL (below). **Inputs:** FILE_LEDGER, Phase 04 contracts.

## 5.1 MISSION
Audit the shape of execution: complexity within budget, state machines explicit and total, no dead/duplicated/hidden control flow, error paths first-class.

## 5.2 FALSIFICATION PROCEDURES — RUN AS THE RIVAL

> **Mind: THE RIVAL.** Hostile, no benefit of the doubt, no courtesy notice. Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.1.

- **Branch walk:** for the top-SIL modules, walk every conditional and ask "what input reaches the ELSE, and is that behavior specified in TIMELINE?" Unspecified reachable branch = finding.
- **Illegal-transition probe:** for each stateful entity, attempt transitions outside the legal table (cancel a shipped order, pay twice). Accepted silently = P1.
- **Termination probe:** for every loop/recursion without an obvious decreasing measure, construct an input that could spin forever (unbounded retry-inside-loop, cursor that never advances on error).
- **Clone hunt:** search for the same business rule implemented twice (a classic vibe-coding artifact: the model re-implements instead of reusing). Divergent duplicates = P1.

## 5.3 EXHAUSTIVE RULES
### Complexity budgets (per function)
- **R05.1** Cyclomatic complexity: SIL1/2 warn >10, fail >15; SIL3/4 fail >10. Cognitive complexity fail >15 (all SIL). Nesting depth ≤4. Oversized functions decomposed (extract till each piece is obvious). Exceptions require an EXCEPTIONS entry.
- **R05.2** Function does one thing; length is a smell-signal, not a law — but >~60 lines demands justification.

### Branching & exhaustiveness
- **R05.3** Every enum/union/switch handles **all** variants explicitly; `default` is a **conscious decision** — for closed sets it fails loudly on the impossible, never silently absorbs new variants.
- **R05.4** Guard clauses / early returns over arrow-shaped nesting.
- **R05.5** No hidden control flow: exceptions are not routine flow-control; non-local jumps flagged; side effects inside condition expressions banned.
- **R05.6** Error paths are first-class: every error branch has *defined, tested* behavior (ties R04.3); no empty handlers, no "log and continue" past corrupted state.

### State machines
- **R05.7** Every entity with a lifecycle (order, job, session, document, subscription) has an **explicit state machine**: enumerated states (sum type per R04.8), a legal-transition table, illegal transitions **rejected loudly**, transition side-effects listed. Boolean-soup state (isActive+isPaid+isCancelled combos) = P1 refactor finding.
- **R05.8** State transitions are the only way state changes (no field-poking around the machine); concurrent transition safety noted (feeds P07).
- **R05.9** Transition table traced to TIMELINE RULEs; all transitions + representative illegal ones get tests (feeds P19 state-transition technique).

### Termination & liveness
- **R05.10** Every loop has a decreasing variant or documented hard bound (max iterations, deadline). Every recursion: base case + depth bound. Retry loops obey Phase 09 budgets — never unbounded.
- **R05.11** No busy-wait polling without sleep/backoff and an exit condition.

### Dead & duplicated logic
- **R05.12** Unreachable branches, unused exports/functions/params, commented-out code, and **zombie feature flags** (decided-but-never-removed) are findings (P3, P2 if they mislead).
- **R05.13** The same business rule may exist in exactly **one** place. Structural clones ≥10 lines = P2; *divergent* semantic duplicates of a TIMELINE RULE = P1 (they will disagree someday).
- **R05.14** Copy-paste-modify chains unified behind a parameterized function/strategy.

## 5.4 METRICS (record in METRICS.md)
Complexity distribution (max/p95), functions over threshold (count → ratcheted down in P23), clone count, dead-code count, state machines formalized vs total stateful entities.

## 5.5 EXIT GATE — JUDGED AS THE PRINCIPAL

> **Mind: THE PRINCIPAL.** Guilty until the evidence tier matches; no gate closes on "mostly." Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.2.

- [ ] Complexity budgets met or excepted; distribution recorded. **Evidence:** metric report.
- [ ] Exhaustiveness scan: no silent-default on closed unions (SIL3/4). **Evidence:** scan/tests.
- [ ] All stateful entities have explicit machines + transition tables traced to TIMELINE. **Evidence:** machine inventory.
- [ ] Illegal-transition probes rejected loudly (tests). **Evidence:** test refs.
- [ ] Termination argument recorded for every non-obvious loop/recursion. **Evidence:** annotations list.
- [ ] Clone + dead-code findings filed. **Evidence:** FND refs.

## 5.6 ARTIFACTS OUT
Complexity report; state-machine inventory + transition tables; clone/dead-code findings; test targets for Phase 19.

> Next: `PHASE_06_DATA_INTEGRITY_AND_PERSISTENCE.md`.
