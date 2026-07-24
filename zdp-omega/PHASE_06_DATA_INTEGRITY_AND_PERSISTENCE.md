# PHASE 06 — DATA INTEGRITY & PERSISTENCE
> Data outlives code. Constraints live **in the store**, mutations are atomic, migrations are rehearsed, and money/time/text are handled with zero folklore.

**Lead standards:** ISO/IEC 25012 (data quality model), ISO/IEC 5055 (data-related weaknesses), ISO 4217 (currency), ISO 8601 + IANA tz (time), Unicode/UTF-8 (Unicode Consortium), IETF BCP 47 (locales).
**SIL depth:** money/PII/irreversible data = SIL4 rules mandatory. **Inputs:** data-flow view, TIMELINE CON entries.

## 6.1 MISSION
Prove that stored and in-flight data cannot silently become wrong: constraints enforced at the source of truth, transactions atomic, migrations safe, and the classic minefields (money, time, text, floats, IDs) governed by explicit policy.

## 6.2 FETCH & GROUND
Fetch/verify: ISO 25012 characteristics (accuracy, completeness, consistency, credibility, currentness + system-dependent ones); current IANA tz notes; ISO 4217 minor-unit table for currencies in scope. Record versions.

## 6.3 FALSIFICATION PROCEDURES — RUN AS THE RIVAL

> **Mind: THE RIVAL.** Hostile, no benefit of the doubt, no courtesy notice. Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.1.

- **Constraint-bypass probe:** try to create invalid rows through *every* write path (API, admin, job, migration, direct import). If app-only validation guards it, the DB will eventually hold garbage → finding.
- **Partial-write probe:** kill (conceptually or via test) each multi-step mutation midway; is any observable state half-done? 
- **Round-trip probe:** serialize→store→read→serialize every core entity; any loss (precision, timezone, encoding, unknown fields) = finding.
- **Nasty-input corpus:** run boundary data through the stack: emoji + combining marks, RTL text, 1e15+1 integers via JSON, NaN/Infinity, 0.1+0.2 sums, `2025-02-29`-style invalid dates, DST-transition timestamps, mixed-currency ops.

## 6.4 EXHAUSTIVE RULES
### Constraints & transactions
- **R06.1** Integrity constraints (NOT NULL, UNIQUE, FK, CHECK/range, enum) live **in the database/store**; application validation mirrors but never replaces them. Every TIMELINE INV about data has a store-level enforcement or a documented compensating control.
- **R06.2** Multi-step mutations are wrapped in transactions with full rollback; isolation level chosen consciously (documented per hot path); no observable intermediate states.
- **R06.3** Cross-service "transactions" use sagas/outbox with compensations (details P07); orphan-detection/reconciliation jobs exist where FKs can't.
- **R06.4** Uniqueness under concurrency enforced by the store (unique index), not check-then-insert (TOCTOU — P07).

### Queries & access
- **R06.5** No unbounded reads: every list query paginated; **cursor/keyset pagination** for large or mutating sets (offset drifts). Limits enforced server-side.
- **R06.6** `SELECT *`-style fetch-everything banned in code paths (schema drift + overfetch); explicit columns/fields.
- **R06.7** N+1 census across all list-render/loop-query paths; batched or joined. Indexes match WHERE/JOIN/ORDER BY of hot queries (deep perf in P16).
- **R06.8** Long-lock patterns flagged: no user-facing request holds a transaction across external I/O.

### Migrations
- **R06.9** Expand-contract only: add-new → dual-write/backfill → switch-read → remove-old; every step backward-compatible for one deploy window.
- **R06.10** Migrations rehearsed on production-like data volume; lock behavior assessed; reversible or explicit roll-forward plan; data migrations idempotent and resumable.

### Money (SIL4 by default)
- **R06.11** Monetary values = integer minor units **or** exact decimal type; binary floating point never touches money (P0 on money paths).
- **R06.12** Currency code (ISO 4217) travels with every amount; cross-currency arithmetic without explicit conversion = P0; minor-unit exponent per currency respected (not all are 2).
- **R06.13** Rounding policy centralized + documented (e.g., half-even at display/tax points); allocation/split algorithms conserve the total (sum of parts == whole, remainder assigned deterministically).

### Time
- **R06.14** Store/compute in UTC; convert at edges using IANA zone IDs (never fixed offsets); user-facing times carry zone context.
- **R06.15** Durations/timeouts measured with **monotonic clocks**, never wall-clock subtraction.
- **R06.16** DST-safe: "add 1 day" vs "add 24h" distinguished; tests include DST transitions; recurring schedules zone-anchored.
- **R06.17** Serialization is ISO 8601 with offset/zone; epoch units (s vs ms) fixed per interface and named; leap-second tolerance noted for high-precision domains.

### Text & encoding
- **R06.18** UTF-8 end-to-end (declared at every boundary: DB, files, HTTP); no default-platform-encoding reliance.
- **R06.19** Unicode normalization policy (e.g., NFC) applied at boundaries for identity-relevant strings (usernames, dedup keys); confusable/bidi-control handling where security-relevant (feeds P10).
- **R06.20** Length limits defined in the right unit (bytes vs code points vs grapheme clusters — pick per field, document); truncation never splits a grapheme.
- **R06.21** Collation/sorting locale-aware where user-facing (BCP 47), byte-order only where specified.

### Numbers, IDs, serialization
- **R06.22** Float equality banned; comparison epsilon documented; float never used where exactness is required (counts, money, versions).
- **R06.23** Overflow/underflow behavior known per arithmetic hot spot; division-by-zero and empty-aggregate (avg of none) guarded.
- **R06.24** JSON/serialization edges handled: big integers beyond IEEE-754 safe range transported as strings or capped; NaN/Infinity policy explicit; unknown-field policy (ignore vs reject) per interface; schemas versioned; round-trip property tested (P20).
- **R06.25** Identifiers: collision-safe generation; opaque + non-enumerable where exposure is security-relevant (P10 IDOR); never reused after deletion; type-wrapped (R04.9).
- **R06.26** Data lifecycle per entity: created → archived → deleted rules stated (feeds P11 retention); soft-delete semantics (filtered everywhere?) audited.

## 6.5 EXIT GATE — JUDGED AS THE PRINCIPAL

> **Mind: THE PRINCIPAL.** Guilty until the evidence tier matches; no gate closes on "mostly." Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.2.

- [ ] Every data INV enforced at the store (or compensating control documented). **Evidence:** constraint map.
- [ ] Partial-write probe clean on all multi-step mutations. **Evidence:** tests/analysis.
- [ ] Pagination/N+1/SELECT-* scans clean or filed. **Evidence:** scan outputs.
- [ ] Migration playbook (expand-contract) adopted; pending risky migrations flagged. **Evidence:** playbook + list.
- [ ] Money/time/text policies documented and nasty-input corpus passes. **Evidence:** policy docs + test run.
- [ ] Round-trip integrity proven for core entities. **Evidence:** test refs.

## 6.6 ARTIFACTS OUT
Constraint map; money/time/text policy docs; migration playbook; nasty-input corpus (reused by P19/P20); findings.

> Next: `PHASE_07_CONCURRENCY_AND_DISTRIBUTION.md`.
