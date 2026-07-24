# PHASE 01 — RECONNAISSANCE & BOUNDARY PROTOCOL
> Know the territory before you touch it. Inventory **every** file, map trust and module boundaries, and assign each component a Software Integrity Level. **Sampling is forbidden — traverse file by file.**

**Lead standards:** IEEE 1028 (reviews & audits — the audit ledger discipline), ISO/IEC/IEEE 42010 (architecture description — stakeholders, concerns, viewpoints, views), IEEE 1012 (V&V — Software Integrity Levels), SWEBOK v4 (knowledge-area framing).
**SIL depth:** this phase *assigns* SIL. **Inputs:** ledgers + TIMELINE from Phase 00.

---

## 1.1 MISSION
Produce a complete, evidence-backed map of the system: what every file is, how modules depend on each other, where data enters/exits, where trust boundaries lie, and how critical each component is. This map scopes the rigor of all later phases.

## 1.2 FETCH & GROUND
Fetch/verify: IEEE 1028 audit process (entry/exit, roles, the "examine everything" principle), 42010 (what a *view* and *viewpoint* are; stakeholder/concern mapping), IEEE 1012 SIL definitions. Record versions in METRICS.

## 1.3 FALSIFICATION PROCEDURES — RUN AS THE RIVAL (try to prove the map wrong)

> **Mind: THE RIVAL.** Hostile, no benefit of the doubt, no courtesy notice. Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.1.

- **Orphan hunt:** find files reachable by no entry point and referenced by nothing → candidate dead code (log, don't delete yet).
- **Hidden entry hunt:** search for *all* execution entry points (mains, handlers, routes, cron/schedulers, event/queue consumers, CLI commands, webhooks, serverless functions, DB triggers, init hooks, signal handlers). Assume there are more than you think.
- **Boundary leak probe:** for each trust boundary, ask "what crosses it unvalidated?" Every crossing is a future Phase 04/10 target.
- **Config sprawl probe:** locate every configuration source (files, env, flags, remote config, secrets). Unvalidated config is a Phase 08 finding.

## 1.4 PROCEDURE

### Step 1 — The Audit File Ledger (IEEE 1028)
Enumerate **every** file in the repo. For each, record in AUDIT_LEDGER.md → `## FILE_LEDGER`: `path | kind | LOC | entrypoint? | trust-boundary? | SIL | status`. `status ∈ {pending, audited, issues, fixed, verified}`; everything starts `pending`. **The recon is complete only when every file is at least `audited`. No sampling — every file is walked.** For generated/vendored files, mark kind=vendored/generated and SIL by what they touch, but still list them.

### Step 2 — Architecture mapping (42010 views)
Produce, in DECISIONS.md (or a linked `ARCHITECTURE.md`), these **views**:
- **Module/Component view** — the real modules and their responsibilities.
- **Dependency view** — who imports/calls whom; direction of dependencies; detect cycles (Phase 03 will forbid them).
- **Data-flow view** — how data moves from every entry point through the system to every sink (DB, network, disk, UI). Mark where PII flows (feeds Phase 11).
- **Trust-boundary view** — draw the lines between: untrusted input (users, network, files, third parties) and trusted core; between privilege levels; between tenants; between your code and external services. **Every arrow crossing a boundary is a security/validation obligation.**
- **Deployment/runtime view** — processes, services, datastores, queues, external dependencies, and the network between them.
Capture each as text + (optionally) a diagram. Record the **stakeholders and their concerns** (owner, users, ops, security, compliance) so later phases know whose requirements they're protecting.

### Step 3 — Assign Software Integrity Levels (IEEE 1012)
For every component, assign **SIL 1–4** by consequence of failure (see MASTER §5). Money, auth, safety, irreversible actions, and PII stores are SIL 4 by default. Record the SIL and the one-line justification in the FILE_LEDGER and a `## SIL_MAP` block. This is the single most important output of the phase: it tells every later phase where to spend maximum effort.

### Step 4 — Context hygiene
Clean agent-context files (`CLAUDE.md`/`.cursorrules`/etc.): remove stale experiment notes, contradictory instructions, and dead links that cause "context bleed." Keep them lean and pointed at AGENT_BOOT. Log removals.

### Step 5 — Reconnaissance report
Summarize: system purpose (from TIMELINE), the views, the SIL map, entry points, trust boundaries, external dependencies, and the top risk areas to watch. Write it to AUDIT_LEDGER `## RECON_SUMMARY`.

## 1.5 EXHAUSTIVE RULES
- **R01.1** Every file appears in FILE_LEDGER with a status; none omitted; none merely sampled.
- **R01.2** Every execution entry point is enumerated (list them explicitly; missing one is a P1 finding later).
- **R01.3** Every trust boundary is drawn and every crossing noted as a validation/authorization obligation.
- **R01.4** Every component has a SIL with justification.
- **R01.5** Dependency cycles are detected and listed (not yet fixed).
- **R01.6** Every configuration/secret source is located and listed.
- **R01.7** Data-flow view marks all PII paths.
- **R01.8** Context files are lean and correct.
- **R01.9** External dependencies (services, libraries, APIs) are inventoried (feeds Phase 12).

## 1.6 EXIT GATE — JUDGED AS THE PRINCIPAL

> **Mind: THE PRINCIPAL.** Guilty until the evidence tier matches; no gate closes on "mostly." Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.2.

- [ ] FILE_LEDGER complete; 100% of files ≥ `audited`. **Evidence:** counts (total vs audited).
- [ ] All five architecture views recorded. **Evidence:** view artifacts.
- [ ] SIL assigned to every component with justification. **Evidence:** SIL_MAP.
- [ ] Entry points, trust boundaries, config sources, external deps all enumerated. **Evidence:** the lists.
- [ ] Dependency cycles listed. **Evidence:** cycle list (possibly empty, with proof).
- [ ] Context files cleaned. **Evidence:** diff of removals.
- [ ] RECON_SUMMARY written. **Evidence:** the summary.

## 1.7 ARTIFACTS OUT
FILE_LEDGER; architecture views (5); SIL_MAP; entry-point/boundary/config/dependency inventories; RECON_SUMMARY; cleaned context files.

> Next: `PHASE_02_REQUIREMENTS_AND_TRACEABILITY.md`.
