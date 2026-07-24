# PHASE 16 — BACKEND PERFORMANCE & SCALE
> Big-O in the small, capacity in the large. Prove behavior under load, soak, spike, and quota-exhaustion — not just under happy-path pytest.

**Lead standards:** ISO/IEC 25010 (performance efficiency: time behavior, resource utilization, capacity), ISO/IEC 25023 (measurement), ISO/IEC 14756 (throughput measurement heritage), ISO/IEC/IEEE 29119 (dynamic testing framing).
**SIL depth:** SIL3/4 hot paths get load + soak + spike evidence; every write path budgeted. **Inputs:** hotpath list from P05/P06, degradation matrix (P09).

## 16.1 MISSION
Every hot path has a documented complexity budget and a measured p99 within SLO on production-like data; the system's failure mode under overload is designed, not discovered.

## 16.2 FALSIFICATION PROCEDURES — RUN AS THE RIVAL

> **Mind: THE RIVAL.** Hostile, no benefit of the doubt, no courtesy notice. Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.1.

- **Complexity ceiling:** for each hot path, cap N (rows/items/tokens) at 10× today's production p99 and prove sub-quadratic behavior; O(n²) on unbounded data = P1 (crosses to R05.10 termination).
- **Load-shape battery:** run **load** (steady RPS at target), **spike** (10× RPS burst), **soak** (target RPS × N hours), and **stress** (ramp to break). Record where the knee is.
- **Query-plan audit:** collect `EXPLAIN` (or equivalent) for every hot query at production data size; scans on large tables, missing indexes, wrong join order = FND.
- **Contention audit:** measure lock waits, connection-pool starvation, GC pauses / stop-the-world events under load.
- **Quota exhaustion probe:** consume connections/threads/file handles up to the pool cap; behavior must be graceful shed, not collapse.

## 16.3 EXHAUSTIVE RULES

### Complexity and code paths
- **R16.1 Complexity budgets** documented per hot path (time and space); implementations that exceed budget must be rewritten or the budget renegotiated with an ADR (traced to TIMELINE).
- **R16.2 Hot-path allocation discipline:** no per-request allocations in tight loops for high-QPS paths where a language/runtime makes it costly; pooled buffers where appropriate; algorithmic clarity wins over micro-opts elsewhere.
- **R16.3 Caching layers** justified by measurement, not folklore; every cache has: capacity, eviction, TTL, invalidation, stampede protection (ties R08.5); write-through vs write-back chosen explicitly.
- **R16.4 Batching** for RPCs/queries; single-item loops calling remote services = P1.

### Data layer
- **R16.5 Indexes** cover WHERE/JOIN/ORDER BY predicates on hot queries; unused indexes removed (their cost is write amplification).
- **R16.6 Query patterns** avoid full scans, cross-partition scatter-gather at scale, and unbounded IN clauses.
- **R16.7 Read replicas / caches** used with explicit staleness contracts documented and traced to TIMELINE (users must know when they see slightly stale data).
- **R16.8 Sharding / partitioning** decisions have ADRs; hot-partition risks quantified (ties P07 backpressure).

### Concurrency budget
- **R16.9 Concurrency limits** per endpoint / worker; overload → 429/503 with `Retry-After`; queue length bounded (ties R07.13 / R09.9).
- **R16.10 Deadlines propagated** end-to-end (crosses to R09.2); slow callers can't drain the pool for everyone.
- **R16.11 CPU / memory limits** per process; GC / allocator tuned per observed workload; profile-guided decisions preferred to guesses.

### SLOs and budgets
- **R16.12** Latency **SLOs** stated as p50 / p95 / p99 per endpoint class (query / write / analytical / long-running) with error budgets (ties P17).
- **R16.13** Throughput (RPS / events/sec / bytes/sec) targets documented; scale-out story per component (horizontal, sharded, or explicit limit).
- **R16.14** Capacity model: current headroom = capacity − p99 demand at forecast; alerting at documented headroom fraction.

### Test evidence
- **R16.15** Load tests reproduce realistic mixes (workload profile from analytics), not uniform-hot-key toys.
- **R16.16** Soak tests ≥ N hours (SIL3/4) with flat resource curves; leaks (memory, fds, connections) flagged (crosses to P08).
- **R16.17** Spike tests validate autoscaling kicks in and settles without oscillation; cold-start behavior documented for serverless.
- **R16.18** Stress-to-break identifies the failure mode (graceful shed vs cascade) before production does.

### Async / batch pipelines
- **R16.19** Backpressure across pipelines end-to-end; lag SLOs stated; DLQ + replay rehearsed (ties R09.10).
- **R16.20** Batch/cron jobs sized for the target window; idempotent; resumable from checkpoints; monitored for run-time drift.

## 16.4 EXIT GATE — JUDGED AS THE PRINCIPAL

> **Mind: THE PRINCIPAL.** Guilty until the evidence tier matches; no gate closes on "mostly." Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.2.

- [ ] Complexity budgets defined and met (or ADR'd) per hot path. **Evidence:** budget table + tests.
- [ ] Query plans collected + acceptable for hot queries at production size. **Evidence:** plans.
- [ ] Load/spike/soak/stress test reports on file for SIL3/4 flows. **Evidence:** reports.
- [ ] SLOs published + monitored + tied to error budgets. **Evidence:** SLO doc + dashboards.
- [ ] Capacity model with headroom + scale plan. **Evidence:** model doc.
- [ ] Overload behavior tested: shed gracefully, no cascade. **Evidence:** stress transcripts.
- [ ] No unresolved P0/P1 perf findings on user-facing critical paths. **Evidence:** FND status.

## 16.5 ARTIFACTS OUT
Complexity budget table; query-plan corpus; load/spike/soak/stress reports; SLO document; capacity model; findings.

> Next: `PHASE_17_OBSERVABILITY_AND_OPS.md`.
