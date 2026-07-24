# PHASE 00 — GENESIS: LEDGER INITIALIZATION
> Stand up the memory of the system. Nothing else may proceed until the ledgers exist and the initial TIMELINE is extracted. **This is the anti-amnesia foundation.**

**Lead standards:** ISO/IEC/IEEE 29148 (requirements), IEEE 828 + ISO 10007 (configuration management & traceability), ISO/IEC/IEEE 12207 (life-cycle process), ISO/IEC/IEEE 24765 (vocabulary — so terms are used precisely).
**SIL depth:** N/A (setup). **Inputs:** the codebase, any docs/issues/PRDs/chat logs the user provides.

---

## 0.1 MISSION
Create every ledger file, define the schemas, and perform the **first-pass requirements extraction** so the audit has a source of truth to trace against. Leaving this phase, the agent has a skeleton TIMELINE, empty-but-structured ledgers, and a recorded understanding of what the software is *supposed* to do.

## 0.2 FETCH & GROUND (do this first)
Consult APPENDIX_STANDARDS_REGISTER and fetch/verify current guidance for: 29148 (requirement characteristics — necessary, unambiguous, testable, feasible, traceable), 828 (configuration identification & status accounting), 24765 (definitions). Record versions consulted in `METRICS.md → StandardsConsulted`.

## 0.3 PROCEDURE

### Step 1 — Create the ledger tree
Create `/audit/` with: `TIMELINE.md`, `AUDIT_LEDGER.md`, `FINDINGS.md`, `TRACE_MATRIX.md`, `DECISIONS.md`, `ASSUMPTIONS.md`, `EXCEPTIONS.md`, `METRICS.md`, `ASSURANCE.md`. Use the exact schemas in APPENDIX_TEMPLATES. Also detect/normalize agent-context files (`CLAUDE.md`, `GEMINI.md`, `.cursorrules`, `AGENTS.md`) — these must point to `/audit/AGENT_BOOT.md` and must be **lean** (no stale experiment notes; that causes context bleed — Phase 01 cleans them).

### Step 2 — Requirements archaeology (build the initial TIMELINE)
Excavate requirements from **every** available source, in priority order, and append each as a TIMELINE entry:
1. **Explicit user statements / PRDs / tickets / chat history** the user provides → `REQ`.
2. **Business rules embedded in code** (validation, pricing, permissions, state machines) → `RULE`/`INV`. *(Beware Hyrum's Law — Phase 02 handles observable-behavior-as-contract; here just capture.)*
3. **Implicit constraints** — hunt for and make explicit every: unit (kg vs lb, ms vs s), numeric range/precision, currency (record ISO 4217 code), time & zone handling (record ISO 8601 expectations), locale/encoding (default to UTF-8), size/rate limits, ordering guarantees → `CON`.
4. **Non-functionals** — any stated or clearly implied target for performance, availability, security posture, accessibility level (e.g., "WCAG 2.2 AA"), data residency → `NFR`.
5. **Named external contracts** — APIs consumed/exposed, file formats, schemas → `REQ`/`CON`.

For anything ambiguous or missing, create the entry with `Status: PROPOSED` and add an item to the **Human Checkpoint** list (0.6). **Never invent intent** — mark it PROPOSED and ask.

### Step 3 — Seed the trace matrix
For each TIMELINE entry, create a TRACE_MATRIX row with the requirement ID and empty (to-be-filled) columns for design/code/test/evidence. Phase 02 completes it.

### Step 4 — Snapshot baselines
Record in METRICS.md the starting state you can measure now (LOC, file count, test count if any, existing coverage if reported, dependency count, known open issues). These are the "before" numbers the final assurance case compares against.

### Step 5 — Record the state machine start
In AUDIT_LEDGER.md set `CURRENT_PHASE: 00 → closing`, `NEXT_PHASE: 01`, and write the first `NEXT_ACTIONS` block.

## 0.4 EXHAUSTIVE RULES (the ledgers must satisfy all)
- **R00.1** Every ledger file exists and matches the template schema exactly.
- **R00.2** TIMELINE has an `## INDEX` table and at least one entry per requirement source that exists. An empty TIMELINE on a non-trivial app is itself a P1 finding ("requirements undocumented").
- **R00.3** Every TIMELINE entry has: unique ID, kind, ISO-8601 timestamp, statement, rationale, at least a draft acceptance criterion, status, and (if applicable) `Supersedes`.
- **R00.4** Every implicit constraint discovered is written as a `CON` — no constraint lives only in someone's head or a magic number.
- **R00.5** Agent-context files are lean and route to the bootloader; oversized/stale ones are flagged for Phase 01 cleanup.
- **R00.6** Every ambiguity is a PROPOSED entry + a Human Checkpoint item; zero silent guesses.
- **R00.7** Baseline metrics captured.

## 0.5 EXIT GATE — JUDGED AS THE PRINCIPAL (all must be green)

> **Mind: THE PRINCIPAL.** Guilty until the evidence tier matches; no gate closes on "mostly." Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.2.

- [ ] All nine ledgers created, schema-valid. **Evidence:** file list + schema check.
- [ ] Initial TIMELINE populated from all provided sources; INDEX built. **Evidence:** entry count by kind; source coverage note.
- [ ] All implicit constraints (units/ranges/currency/time/locale/limits) captured as CON entries. **Evidence:** CON list.
- [ ] TRACE_MATRIX seeded with one row per entry. **Evidence:** row count == entry count.
- [ ] Baselines recorded in METRICS. **Evidence:** METRICS baseline block.
- [ ] Human Checkpoint list emitted for every PROPOSED/ambiguous item. **Evidence:** checkpoint list.
- [ ] No P0 in the ledger setup itself.

## 0.6 HUMAN CHECKPOINT (pause and ask)
Present to the owner: the list of PROPOSED requirements, every ambiguity, and every implicit constraint you *inferred* (so they can confirm units/currency/limits). Do not proceed to Phase 01's deep work on contested requirements until the owner resolves or explicitly says "proceed with assumptions" (which you then log as ASSUMPTIONS entries with violation tests).

## 0.7 ARTIFACTS OUT
Populated `/audit/` tree; initial `TIMELINE.md`; seeded `TRACE_MATRIX.md`; baseline `METRICS.md`; Human Checkpoint list; first `NEXT_ACTIONS`.

> Next: `PHASE_01_RECON_AND_BOUNDARY.md`.
