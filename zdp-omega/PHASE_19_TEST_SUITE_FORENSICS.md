# PHASE 19 — TEST SUITE FORENSICS
> Coverage is a floor, not a ceiling; **mutation score** is the truth serum. Rebuild the test suite so it actually **catches breakage** and reliably runs green when green means green.

**Lead standards:** ISO/IEC/IEEE 29119-1..5 (test process, docs, techniques — including 29119-4 structure-based techniques: statement/branch/decision/MC/DC), ISO/IEC 25051 (test-relevant quality), IEEE 730 (SQA plans), industry practice for mutation testing, property-based testing, contract testing, snapshot testing.
**SIL depth:** SIL1 → statement + example tests; SIL2 → branch + example + smoke; SIL3 → decision + property + mutation; **SIL4 → MC/DC coverage on decisions + property + mutation + formal spec (P20)**. **Inputs:** trace matrix + NEEDS-TEST (P02), findings so far, hot paths (P16).

## 19.1 MISSION
Every requirement is verified by tests at a coverage tier commensurate with its SIL; the suite runs in a stable order in a bounded time, with near-zero flake; false-green (passing while wrong) is hunted with **mutation testing**; adversarial techniques (property/fuzz/metamorphic) turn up bugs example tests can't imagine.

## 19.2 FALSIFICATION PROCEDURES — RUN AS THE RIVAL

> **Mind: THE RIVAL.** Hostile, no benefit of the doubt, no courtesy notice. Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.1.

- **Coverage lie detector:** produce line/branch/decision/MC/DC (per SIL) reports; **inspect uncovered slices** by hand — most are the highest-risk paths.
- **Mutation attack:** inject small semantic mutations (`>`→`>=`, `+`→`−`, `true`→`false`, off-by-one, drop conditions); rerun the suite; **surviving mutants = false-green**. Target ≥ 70% killed on SIL3, ≥ 85% on SIL4 (thresholds ratchet up).
- **Flake hunt:** run the whole suite N times back-to-back; any non-deterministic pass/fail = flake; quarantine, fix root cause (time, network, ordering, hidden global), do not skip.
- **Test-of-tests:** for each critical requirement, delete the code that satisfies it; do the tests fail? If not, the requirement isn't tested — however green the badge looks.

## 19.3 EXHAUSTIVE RULES

### Test taxonomy (know what each layer does)
- **R19.1** **Unit** tests exercise a single unit's contract (P04); pure, fast, deterministic, no I/O.
- **R19.2** **Integration** tests exercise real adapters against real (or high-fidelity fake) dependencies (DB in a container, real HTTP surface). Contract tests (P18) live here.
- **R19.3** **End-to-end / system** tests exercise complete user journeys through the deployed system; expensive; kept small in count, high in signal.
- **R19.4** Layer boundaries are **respected** — don't mock what you own; don't hit prod-like things in unit tests.

### Coverage — but honestly
- **R19.5** Line/statement + **branch** coverage collected everywhere; **decision** coverage on SIL3+; **MC/DC** on SIL4 decisions (each condition independently affects the outcome).
- **R19.6** Coverage numbers are inputs to *judgment*, not certificates. A file at 100% line coverage with a mutation score of 30% is worse than one at 80%/85%. **Both metrics** published.
- **R19.7** No lowering of coverage/mutation thresholds without an ADR (ratchet is one-way — P23).

### Structure-based techniques (ISO 29119-4)
- **R19.8** **Equivalence partitioning** + **boundary value analysis** used for every input-domain-heavy function (money math, dates, ranges, IDs).
- **R19.9** **Decision tables** for functions with multiple boolean conditions; every rule tested.
- **R19.10** **State-transition tests** for every state machine (crosses to R05.7) including illegal transitions (must be rejected loudly).
- **R19.11** **Pairwise / combinatorial** testing where input dimensions explode; reduces N^k combinations to O(N²) coverage.

### Adversarial techniques (behavior-based)
- **R19.12** **Property-based testing** for pure functions and invariants; shrinker-driven minimal counterexamples committed as regression tests. Standard properties: round-trip (`decode(encode(x)) == x`), identity/associativity/commutativity where applicable, idempotence of retry-safe operations (R07.7), monotonicity, conservation (sum-of-parts == whole for allocations — R06.13).
- **R19.13** **Fuzz testing** on parsers, deserializers, and boundary decoders (crosses to R04.5). Coverage-guided where available; corpora committed; crashes/timeouts triaged and fixed.
- **R19.14** **Metamorphic testing** where no oracle exists (ML outputs, complex calculations): assert relations that must hold across transformations (e.g., translation invariance, monotonic input → monotonic output).
- **R19.15** **Snapshot / golden** tests only where deltas require human review; snapshots are curated, not blindly regenerated.

### Determinism & speed
- **R19.16** Tests are deterministic: no wall-clock, no network unless controlled, no random unless seeded, no order-dependent shared state. Time/random/UUID/clock injected.
- **R19.17** Test data managed: builders/factories over fixtures; each test isolated (DB transaction rollback or ephemeral schema); no shared mutable state between tests.
- **R19.18** Whole-suite runtime bounded (documented target); parallelism safe; slow tests tagged and separated (nightly vs PR).
- **R19.19** **Flaky-test policy:** flake → quarantine within 24h, fix within N days or delete. No `retry-until-green` in CI.

### Cross-cutting suites
- **R19.20** **Security tests** from Phase 10 findings become permanent regression tests (auth-swap, injection sinks, misconfig).
- **R19.21** **Accessibility tests** (P14) automated where possible + curated manual-test recordings archived.
- **R19.22** **Perf tests** (P15/P16) run per PR at throttled/known-load; failures block.
- **R19.23** **Chaos/fault-injection** hypotheses (P09/P20) executed on schedule (not just once).
- **R19.24** **Data migration** tests: forward + rollback under load (crosses to R06.9-10).

### Traceability
- **R19.25** Every test tagged with its requirement ID(s) from TIMELINE; TRACE_MATRIX now shows evidence tier per row (crosses to P02); a test whose requirement is dropped/superseded is retired.

### Test quality itself
- **R19.26** No test asserts implementation details it doesn't need to; no over-mocking that couples tests to internals; test names describe behavior in the domain, not method calls.

## 19.4 EXIT GATE — JUDGED AS THE PRINCIPAL

> **Mind: THE PRINCIPAL.** Guilty until the evidence tier matches; no gate closes on "mostly." Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.2.

- [ ] Coverage report at required tiers per SIL (statement/branch/decision/MC/DC); uncovered slices reviewed. **Evidence:** reports.
- [ ] Mutation score meets thresholds per SIL. **Evidence:** report.
- [ ] Property/fuzz/metamorphic suites in place for applicable modules. **Evidence:** suites + corpora.
- [ ] Zero known flakes in active suite; quarantine tracked with fix ETAs. **Evidence:** flake ledger.
- [ ] Every ACTIVE requirement traces to ≥1 test in TRACE_MATRIX; NEEDS-TEST list empty (or excepted). **Evidence:** matrix.
- [ ] Security + a11y + perf + chaos suites wired into CI. **Evidence:** CI config.
- [ ] Suite runtime under target; parallelism safe. **Evidence:** timing report.

## 19.5 ARTIFACTS OUT
Coverage + mutation reports; property/fuzz corpora; flake ledger; requirement-to-test matrix; consolidated CI test config.

> Next: `PHASE_20_FORMAL_AND_ADVERSARIAL.md`.
