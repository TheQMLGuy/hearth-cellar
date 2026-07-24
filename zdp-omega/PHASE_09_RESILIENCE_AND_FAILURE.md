# PHASE 09 — RESILIENCE & FAILURE ENGINEERING
> Every dependency **will** fail — down, slow, erroring, or lying. The system's response to each is designed, bounded, and rehearsed. Hope is not a strategy; the degradation matrix is.

**Lead standards:** ISO/IEC 25010:2023 (reliability: fault tolerance, recoverability; availability), IEEE 1633 (software reliability engineering), SRE canon (error budgets, graceful degradation) applied stack-independently.
**SIL depth:** SIL3/4 paths require fault-injection evidence (executed in Phase 20). **Inputs:** dependency inventory (P01), effect table (P07).

## 9.1 MISSION
For every external dependency and every failure mode, a designed response exists: timeouts everywhere, retries only where safe, breakers and bulkheads containing blast radius, fallbacks tested, and disaster recovery **drilled, not assumed**.

## 9.2 FALSIFICATION PROCEDURES — RUN AS THE RIVAL

> **Mind: THE RIVAL.** Hostile, no benefit of the doubt, no courtesy notice. Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.1.

- **Four-horsemen table:** for each dependency D, fill the row: D is **down** / **slow (10× latency)** / **erroring (5xx/exceptions)** / **lying (200 + garbage/stale)** → what does the user experience? Empty cell = unhandled failure mode.
- **Retry-amplification math:** multiply retry counts across call chain layers (client×gateway×service×driver). Product >~10 on any chain = retry storm risk.
- **Timeout-chain audit:** verify each caller's timeout > callee budget is FALSE (callers must time out *before* or *with* their own callers' budgets — deadline shrinks downstream, never grows).
- **Backup lie-detector:** when was the last successful **restore** (not backup)? No dated restore evidence = the backups are Schrödinger's data.

## 9.3 EXHAUSTIVE RULES
### Timeouts (the universal law)
- **R09.1** 100% of network/IPC/external calls have explicit timeouts (connect + read/total); library "defaults" are verified, not trusted; infinite waits banned.
- **R09.2** Timeout values are *justified* (from SLO math or dependency p99), recorded, and **deadline-propagated**: downstream budget = remaining upstream budget − safety margin.
- **R09.3** User-facing operations have an end-to-end deadline; slow paths degrade or async-ify rather than hang.

### Retries
- **R09.4** Retry **only idempotent** effects (P07 table is the authority); non-idempotent retries require an idempotency key first.
- **R09.5** Exponential backoff **with full jitter**; max attempts + per-caller retry budget; honor server backoff signals (e.g., Retry-After); no retry inside a retry (amplification math per 9.2).
- **R09.6** Distinguish retryable (transient: timeout, 5xx, connection) from non-retryable (4xx-class validation/auth) — retrying a 400 forever = finding.

### Containment
- **R09.7** Circuit breakers on every remote dependency: trip thresholds, half-open probing, per-dependency state, metrics exported (P17).
- **R09.8** Bulkheads: resource pools isolated per dependency (and per tenant where fairness is a REQ) so one sick dependency can't exhaust shared threads/connections.
- **R09.9** Load shedding before collapse: on overload, reject early with proper signals (429/503 + retry hint) and prioritized shedding (protect SIL4 flows); brownout beats blackout.
- **R09.10** Queues: max-receive/poison handling → **DLQ** with alerting and a written, tested **replay runbook**; DLQ growth alarms.

### Degradation & fallbacks
- **R09.11** The **degradation matrix**: rows = features, columns = each dependency-down scenario, cells = designed behavior (cached, read-only, hidden, queued, error-with-guidance). Every cell filled and traced to TIMELINE (users' minimum viable experience is a requirement).
- **R09.12** Fallbacks are **tested** code paths, not comments; stale-cache fallbacks label staleness; queued-for-later effects surface status to the user.
- **R09.13** Startup resilience: process boots (possibly degraded) when non-critical dependencies are down; only genuinely fatal dependencies block readiness (ties R08.13, P17 probes).

### Disaster recovery
- **R09.14** Backups: scheduled, encrypted, access-controlled, **restore-drilled** on a cadence with dated evidence; RTO/RPO stated as TIMELINE NFRs and *measured* by the drill.
- **R09.15** Single-point-of-failure census (instance, zone, region, the-one-cron-box, the-one-API-key) with accepted-risk or mitigation per item.
- **R09.16** Incident readiness: top failure modes have runbooks (P17), and the fault-injection hypotheses for Phase 20 are written here: steady-state metric, injected fault, expected degraded behavior, abort condition, blast radius.

## 9.4 EXIT GATE — JUDGED AS THE PRINCIPAL

> **Mind: THE PRINCIPAL.** Guilty until the evidence tier matches; no gate closes on "mostly." Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.2.

- [ ] Four-horsemen table complete for every dependency; no empty cells. **Evidence:** the table.
- [ ] Timeout inventory: 100% coverage with justified values + deadline propagation. **Evidence:** inventory.
- [ ] Retry policy audit: idempotent-only, backoff+jitter, budgets; amplification ≤ threshold. **Evidence:** policy map + math.
- [ ] Breakers + bulkheads on all remote deps. **Evidence:** config/code refs.
- [ ] Degradation matrix filled and traced. **Evidence:** matrix.
- [ ] DLQ + replay runbook exist; poison test passes. **Evidence:** runbook + test.
- [ ] Restore drill evidence dated ≤ cadence; RTO/RPO measured vs NFR. **Evidence:** drill report.
- [ ] Fault-injection hypothesis list handed to Phase 20. **Evidence:** hypothesis list.

## 9.5 ARTIFACTS OUT
Four-horsemen table; timeout/retry inventories; degradation matrix; DR drill report; chaos hypotheses for P20; findings.

> Next: `PHASE_10_SECURITY_DEEP_AUDIT.md`.
