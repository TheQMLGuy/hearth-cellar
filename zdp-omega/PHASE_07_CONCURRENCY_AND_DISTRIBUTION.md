# PHASE 07 — CONCURRENCY & DISTRIBUTION
> The hardest bugs live here. Inventory every piece of shared mutable state, kill every race window, and accept the physics of distributed systems: **exactly-once delivery does not exist — exactly-once *effect* is engineered.**

**Lead standards:** ISO/IEC 5055 (concurrency weakness classes: races, deadlocks, TOCTOU), ISO/IEC/IEEE 15026 (assurance for critical properties); distributed-systems canon applied stack-independently (idempotency, outbox, fencing, logical clocks).
**SIL depth:** any shared mutable state or cross-service money/state flow = SIL3+ rules mandatory; SIL4 gets Phase 20 model checking. **Inputs:** Phase 01 runtime view, Phase 05 state machines.

## 7.1 MISSION
Zero unguarded shared mutability, zero check-then-act windows, zero deadlock topologies, and distributed effects that are idempotent, ordered-where-claimed, and safe under retry, crash, and clock skew.

## 7.2 FALSIFICATION PROCEDURES — RUN AS THE RIVAL

> **Mind: THE RIVAL.** Hostile, no benefit of the doubt, no courtesy notice. Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.1.

- **Interleaving attack:** for each shared-state operation, write the 2-thread/2-request interleaving that corrupts it (read-modify-write splits, double-submit, concurrent transition on one entity). If you can write it, it will happen.
- **Crash-at-arrow attack:** in every multi-step effect (DB write → publish → notify), place a crash between each arrow. Enumerate the resulting states; any unrecoverable/duplicating state = finding.
- **Retry storm attack:** replay every externally-triggered effect twice (client retry, queue redelivery, timeout-then-success). Duplicate side effects (double charge, double email) = P0/P1.
- **Clock-skew attack:** shift node clocks ±5 min conceptually; anything that orders events by wall-clock timestamps across machines breaks = finding.
- **Lock-graph attack:** draw the lock acquisition graph; any cycle = deadlock topology.

## 7.3 EXHAUSTIVE RULES
### Shared-state discipline (in-process)
- **R07.1** Inventory: every shared mutable datum listed with its **guard** — one of: lock, atomic primitive, single-writer confinement, message-passing, or immutability. Unguarded shared mutability = P0 (SIL3/4) / P1.
- **R07.2** Read-modify-write on shared state is atomic (CAS/lock around the whole RMW); counters, balances, toggles included.
- **R07.3** Check-then-act (TOCTOU) eliminated — including filesystem (exclusive-create instead of exists-then-create) and DB (unique index instead of select-then-insert, per R06.4).
- **R07.4** Lock ordering documented globally; acquisitions follow it; hold-time minimized; no I/O or callbacks while holding locks; lock-acquisition timeouts where the platform supports them.
- **R07.5** Publication safety: objects fully constructed before visible to other threads; cross-thread visibility uses proper synchronization primitives (no folk "it probably flushes" reasoning); double-checked patterns treated as guilty until proven correct on the platform memory model.
- **R07.6** Async/cooperative runtimes: **no blocking calls on the scheduler/event loop**; every await/async op has a timeout; **cancellation propagates** and releases resources; no orphaned fire-and-forget tasks (all tasks owned, awaited, or supervised — structured concurrency preferred); callback/promise error paths always handled (no silently-dropped rejections).

### Distributed effects
- **R07.7 The Idempotency Law:** every effect that can be retried (client retries, queue redelivery, cron overlap, timeout-ambiguity) carries an **idempotency key** and the consumer deduplicates within a defined window. "We hope it's delivered once" = P1.
- **R07.8 No dual writes:** writing a DB **and** publishing an event/message as two separate steps is banned — use transactional **outbox** (or CDC) so state change and message are atomic.
- **R07.9 Distributed locks:** always TTL-bounded **and** fencing-token-checked at the resource (a lock without fencing only *reduces* concurrency, never guarantees it); lock-holder crash is a designed-for case.
- **R07.10 Ordering:** cross-node wall-clock timestamps never establish order; where order matters use sequence numbers/log offsets/logical clocks; consumers tolerate reordering + duplicates unless the transport contractually guarantees otherwise (verify the guarantee, don't assume).
- **R07.11 Sagas:** multi-service workflows enumerate every partial-failure state and define a **compensation** for each committed step; compensations are themselves idempotent; the saga state machine is explicit (R05.7) and — for SIL4 — model-checked in Phase 20.
- **R07.12 Timeout-ambiguity handled:** a timed-out call may have succeeded; callers must reconcile (query status / idempotent retry), never assume failure.
- **R07.13 Backpressure end-to-end:** every producer→consumer link is **bounded** (queue caps, pool caps); overflow policy explicit (block, shed, drop-oldest) and traced to a TIMELINE decision; unbounded in-memory buffering = P1.
- **R07.14 Concurrent entity transitions:** two actors transitioning one entity (R05.7 machines) resolve via optimistic versioning or store-level locking — last-write-wins only if TIMELINE explicitly accepts it.
- **R07.15 At-most-once vs at-least-once chosen per effect** and written down; "exactly-once" claims in docs/comments corrected to at-least-once + idempotent consumer.

## 7.4 EXIT GATE — JUDGED AS THE PRINCIPAL

> **Mind: THE PRINCIPAL.** Guilty until the evidence tier matches; no gate closes on "mostly." Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.2.

- [ ] Shared-state inventory complete; 100% guarded. **Evidence:** inventory table.
- [ ] TOCTOU/RMW scan clean (code + DB + filesystem patterns). **Evidence:** scan + fixes/FNDs.
- [ ] Lock graph acyclic; ordering documented. **Evidence:** graph.
- [ ] Every retryable effect idempotent (key + dedupe) — retry-storm probe clean. **Evidence:** effect table + tests.
- [ ] No dual-write paths (outbox/CDC in place or FND filed). **Evidence:** write-path audit.
- [ ] Crash-at-arrow enumeration done for all multi-step effects; recovery defined for each state. **Evidence:** state tables.
- [ ] Backpressure bounds on all links. **Evidence:** bounds list.
- [ ] SIL4 protocols queued for Phase 20 model check. **Evidence:** queue list.

## 7.5 ARTIFACTS OUT
Shared-state inventory; lock graph; effect/idempotency table; crash-state enumerations; model-check queue for P20; findings.

> Next: `PHASE_08_RESOURCES_AND_LIFECYCLE.md`.
