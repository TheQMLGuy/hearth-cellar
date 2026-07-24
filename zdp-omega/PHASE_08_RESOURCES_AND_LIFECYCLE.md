# PHASE 08 — RESOURCES & LIFECYCLE
> Nothing leaks, nothing grows unbounded, startup screams on bad config, shutdown drains gracefully, and a `kill -9` at any instant leaves a recoverable system. **Crash-only thinking.**

**Lead standards:** ISO/IEC 5055 (resource weaknesses), ISO/IEC 25010:2023 reliability sub-characteristics (fault tolerance, recoverability, availability).
**SIL depth:** long-running/SIL3+ processes require soak evidence. **Inputs:** runtime view, Phase 07 task inventory.

## 8.1 MISSION
Every acquired resource is released on **all** paths; every buffer/cache/queue is bounded; the process lifecycle (start → run → stop → crash) is explicit, validated, and tested.

## 8.2 FALSIFICATION PROCEDURES — RUN AS THE RIVAL

> **Mind: THE RIVAL.** Hostile, no benefit of the doubt, no courtesy notice. Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.1.

- **Exit-path walk:** for each acquire (file, socket, connection, thread, timer, listener, cursor, temp file, native handle), trace **every** exit path — success, each error, early return, timeout, cancellation. Any path skipping release = leak finding.
- **Growth hunt:** find every collection that only ever grows (append-only lists, maps keyed by user input, subscriber sets, in-memory "caches" without eviction). Unbounded = P1/P2 by exposure.
- **Config-lies probe:** start the system with missing/typo'd/out-of-range config values. Silent defaulting or a crash 20 minutes later instead of at boot = finding.
- **Kill-drill (design-level):** enumerate what's in flight at an arbitrary kill instant (requests, writes, queue messages, temp files, locks). For each: recovered how, by whom, when? No answer = finding.

## 8.3 EXHAUSTIVE RULES
### Acquire/Release
- **R08.1** Every resource acquisition pairs with a **structurally guaranteed** release (scope-bound/finally-equivalent construct of the language), covering error and cancellation paths — not just the happy path.
- **R08.2** Leak categories swept explicitly: descriptors, sockets, DB connections/cursors, threads/workers, timers/intervals, event listeners/subscriptions/watchers, temp files, memory-mapped/native handles, child processes.
- **R08.3** Pools (connections, threads, workers): bounded with **sized-by-arithmetic** capacity (expected concurrency × hold time, documented), health-checked, and leak-detected (checkout-without-return alarms); exhaustion behavior explicit (queue with cap + timeout, then shed).
- **R08.4** Ownership is unambiguous: exactly one owner responsible for each resource's release; shared ownership uses counted/managed semantics, never "someone will close it."

### Bounded memory & caches
- **R08.5** Every cache is bounded (LRU/size/TTL) **and** has a written invalidation story; cache ≠ source of truth; stampede protection (single-flight/lock) on expensive misses.
- **R08.6** No collection keyed by unbounded external input without eviction; queues/buffers bounded (ties R07.13); large payloads streamed, not slurped, past a documented size threshold.
- **R08.7** Long-running processes have **soak evidence** (hours-scale run: flat memory/fd/thread counts) — SIL3+ mandatory (executed via P16/P20 harnesses).

### Filesystem & durability
- **R08.8** Atomic write pattern for anything that must never be half-written: write temp → fsync → rename; directory fsync where the platform requires it for durability.
- **R08.9** fsync/durability policy explicit per data class (what may be lost on power cut?) and traced to a TIMELINE decision.
- **R08.10** Disk-full and permission-denied behaviors defined and tested for every write path; temp/scratch files cleaned on **all** exits (including crash — startup sweep).

### Startup
- **R08.11** All configuration is schema-validated at boot: types, ranges, required keys, cross-field consistency; **fail fast with a precise message**; silent fallback defaults banned for anything critical (a default is a documented decision, not an accident).
- **R08.12** Secrets/config sources logged by *name* (never value); effective non-secret config dumpable for debugging (P17).
- **R08.13** Startup order explicit: dependencies probed; the service does not report ready until actually ready (ties P17 readiness).
- **R08.14** Version/build/commit stamped into logs and health output.

### Shutdown & crash
- **R08.15** Termination signals handled: stop intake → drain in-flight within a deadline → flush logs/metrics/buffers → close pools → exit with meaningful code; shutdown is idempotent (double-signal safe).
- **R08.16** **Crash-only compatibility:** the system tolerates abrupt death at any instant — recovery relies on the durable state discipline of P06/P07 (transactions, idempotency, atomic files), not on shutdown having run. Recovery paths are tested (P20 fault injection).
- **R08.17** In-flight work at crash is either recoverable (journal/queue/outbox) or explicitly droppable per a TIMELINE decision — never silently ambiguous.

## 8.4 EXIT GATE — JUDGED AS THE PRINCIPAL

> **Mind: THE PRINCIPAL.** Guilty until the evidence tier matches; no gate closes on "mostly." Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.2.

- [ ] Exit-path walk complete for all acquire sites; leaks fixed/filed. **Evidence:** walk log + FNDs.
- [ ] All caches/queues/collections bounded with policy; growth hunt clean. **Evidence:** bounds inventory.
- [ ] Config validation fails fast on the config-lies probe. **Evidence:** probe transcript.
- [ ] Atomic-write + durability policy in place for critical writes. **Evidence:** policy + code refs.
- [ ] Shutdown sequence implemented + documented; kill-drill enumeration answered for all in-flight classes. **Evidence:** sequence doc + table.
- [ ] Soak evidence scheduled/attached for SIL3+ long-runners. **Evidence:** soak plan/report.

## 8.5 ARTIFACTS OUT
Resource inventory + bounds table; config schema; durability policy; shutdown/recovery doc; findings.

> Next: `PHASE_09_RESILIENCE_AND_FAILURE.md`.
