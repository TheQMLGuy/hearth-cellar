# PHASE 04 — CONTRACTS & BOUNDARY TYPING
> Make wrong code **unwritable**. Every module gets a written contract; every trust boundary parses raw input into rich domain types **once**; illegal states become unrepresentable.

**Lead standards:** ISO/IEC/IEEE 15026 (assurance claims), 29148 (verifiable requirements → contracts), Design-by-Contract discipline (Meyer/Eiffel heritage, applied language-agnostically), ISO 80000 (quantities & units).
**SIL depth:** SIL-3/4 contracts are *enforced* (assertions/tests), SIL-2 documented+tested, SIL-1 documented. **Inputs:** TIMELINE INV/CON entries, Phase 01 boundary map.

## 4.1 MISSION
Every public function/module has explicit **preconditions, postconditions, invariants, failure modes**; every boundary converts untrusted bytes → validated domain values exactly once; the type structure makes whole defect classes impossible.

## 4.2 FALSIFICATION PROCEDURES — RUN AS THE RIVAL

> **Mind: THE RIVAL.** Hostile, no benefit of the doubt, no courtesy notice. Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.1.

- **Garbage-in probe:** for each public entry, mentally (or via test) feed: null/absent, empty, max-size+1, negative, NaN/Inf, wrong type, malformed encoding, boundary dates, duplicate IDs. Undefined behavior anywhere = contract hole.
- **Misuse probe:** try to call the API wrong (swapped params of same primitive type, missed init step, double-close, reuse-after-finish). If the type system/API shape permits it silently → finding.
- **Invalid-state probe:** try to construct domain objects in impossible states (order shipped-but-unpaid, end<start). Constructible = finding.
- **Re-validation probe:** count how many places re-check the same input. >1 = boundary isn't parsing once (drift risk between checks).

## 4.3 EXHAUSTIVE RULES
### Contracts
- **R04.1** Every public function/method/endpoint has a written contract: **Pre** (caller obligations, input bounds), **Post** (guarantees on success), **Inv** (what stays true throughout), **Errors** (each failure mode: condition → typed error/exception → caller expectation), **Effects** (I/O, mutation, idempotency class), **Perf class** (O(?) and blocking?), **Concurrency class** (thread-safe? reentrant?). Live in doc-comments or `CONTRACTS.md`, traced to TIMELINE INV IDs.
- **R04.2 Totality:** each function is defined over its **entire declared input domain** — either handle every value, or **narrow the type** so bad values can't arrive, or enforce the precondition loudly (assert/guard). Silent partial functions = P1.
- **R04.3 Expected vs programmer errors distinguished:** operational failures (network, not-found, validation) are typed results/exceptions callers must handle; contract violations (bug) fail fast and loud — never swallowed into the same channel.
- **R04.4 SIL-3/4 enforcement:** contracts checked at runtime (assertions/guards) or by exhaustive tests; violation → immediate loud failure, never limp-on.

### Boundary typing (Parse, don't validate)
- **R04.5** Every trust-boundary input (HTTP body/params, files, queue messages, env/config, DB rows from other services, LLM output) is **parsed once** at the boundary into a rich domain type. Interior code accepts **only** domain types — no raw strings/maps/JSON blobs travel inward.
- **R04.6** Parsing is schema-driven (declared shape, bounds, enums); unknown-field policy explicit; failure produces a precise, typed error (feeds P18 error contract).
- **R04.7 No re-validation inland:** interior re-checks of already-parsed data are removed (or converted to assertions) — one source of truth for validity.

### Type structure (make illegal states unrepresentable)
- **R04.8 Sum types over flag soup:** mutually exclusive states are modeled as tagged unions/enums (or the language's closest equivalent — sealed hierarchies, tagged structs), **never** as combinations of booleans/nullable fields that permit impossible mixes.
- **R04.9 Newtypes for identity & quantity:** distinct wrapper types for `UserId` vs `OrderId` vs raw string; quantities carry units in the type or name (per ISO 80000 spirit) — `durationMs`, `Money{amount minor units, currency}`. Bare primitives don't cross module boundaries for domain concepts. (Ariane-5/Mars-Climate-Orbiter class prevention.)
- **R04.10 Construction = validation:** objects cannot exist invalid — invariants enforced in constructors/factories; no setters that can break invariants; prefer **immutable value objects**, mutation confined to aggregates that re-check invariants.
- **R04.11 Absence is explicit:** a documented null/absent policy — optional types or explicit nullable-with-meaning; sentinel values (-1, "", 0-as-missing) banned for domain meaning.
- **R04.12 Exhaustive consumption:** consumers of sum types handle every variant explicitly (ties Phase 05 exhaustiveness).
- **R04.13 Misuse-resistant APIs:** required params not silently defaulted; step-ordering enforced by types (builder returns next-stage type) where sequencing matters; units/timezone in names when not in types.

## 4.4 EXIT GATE — JUDGED AS THE PRINCIPAL

> **Mind: THE PRINCIPAL.** Guilty until the evidence tier matches; no gate closes on "mostly." Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.2.

- [ ] 100% of public surface has contracts (SIL-weighted priority; SIL4 first). **Evidence:** contract coverage count.
- [ ] Every boundary input parsed-once into domain types; raw-data-inland scan clean. **Evidence:** boundary list + scan.
- [ ] Illegal-state probe: no constructible invalid domain object (SIL3/4). **Evidence:** probe results/tests.
- [ ] Newtype coverage for all domain IDs + unit-bearing quantities. **Evidence:** type inventory.
- [ ] Null/absence policy documented + sentinel scan clean. **Evidence:** policy + scan.
- [ ] SIL3/4 contracts enforced (assertion or test per clause). **Evidence:** enforcement map.
- [ ] All contract holes filed as findings with severity. **Evidence:** FND refs.

## 4.5 ARTIFACTS OUT
CONTRACTS.md (or doc-comment corpus) traced to TIMELINE; boundary parser inventory; domain type inventory; findings.

> Next: `PHASE_05_CONTROL_FLOW_AND_STATE.md`.
