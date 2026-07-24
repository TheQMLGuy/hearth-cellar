# PHASE 11 — PRIVACY & DATA PROTECTION
> Personal data is a liability, not an asset. Minimize it, know exactly where it lives, control who touches it, and prove you can delete it.

**Lead standards:**
- **ISO/IEC 29100** — privacy framework (11 privacy principles).
- **ISO/IEC 27701** — privacy information management (extends 27001/27002).
- **ISO/IEC 27018** — PII protection in public clouds.
- **ISO 31700-1/-2** — consumer-product privacy by design.
- **ISO/IEC 27555** — deletion of PII guidance.
- Regulatory anchors (as applicable per TIMELINE): GDPR (EU), CCPA/CPRA (CA), PIPEDA, LGPD, DPDP (IN), HIPAA (health, US), COPPA (children, US).
- **NIST Privacy Framework** — cross-map where useful.

**SIL depth:** any store/flow touching PII/PHI/financial identifiers = SIL3+ by default; children's data / special-category data (health, biometric, precise location, sexuality, religion, political, immigration) = SIL4. **Inputs:** Phase 01 data-flow view (PII paths), TIMELINE CON/NFR entries with legal basis.

## 11.1 MISSION
Establish the **personal-data inventory**, prove data minimization, enforce purpose limitation, implement the data-subject rights (access/rectify/erase/portability/object), keep audit trails that survive a subpoena, and cover cross-border and vendor obligations.

## 11.2 FALSIFICATION PROCEDURES — RUN AS THE RIVAL

> **Mind: THE RIVAL.** Hostile, no benefit of the doubt, no courtesy notice. Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.1.

- **PII archaeology:** grep the entire data model, logs, telemetry events, analytics payloads, error reports, backups, exports, and third-party requests for personal-data fields. Anything found undocumented = P1 finding.
- **Purpose-drift probe:** for every collected field, ask "which consent/legal basis + purpose from TIMELINE authorizes each use?" Any use outside the recorded purpose = P0/P1.
- **Retention-lie probe:** compare stated retention with the oldest actual row/log/backup. Older? P1.
- **Erasure probe:** initiate a deletion for a test subject; enumerate every store, cache, index, replica, backup, downstream vendor, log stream, and analytics warehouse. Anywhere the data survives = finding.
- **Re-identification probe:** for "anonymized" datasets, attempt re-identification via join with likely auxiliary data. Success or plausibility = P1.

## 11.3 EXHAUSTIVE RULES

### Inventory & mapping
- **R11.1 Personal-data inventory** (RoPA-style): for every PII element — field name, category (identifier / contact / financial / device / precise location / behavioral / biometric / **special category**), source, legal basis, purpose, retention, storage location(s), access roles, downstream flows (systems + vendors + regions). Traced to TIMELINE and P01 data-flow view.
- **R11.2** **Special-category data** flagged and treated with heightened controls (explicit consent or narrow legal basis, encryption at rest with per-record or per-tenant keys, restricted logging, mandatory reviews for new uses).
- **R11.3** **Children's data:** age-gating strategy documented; if applicable, parental consent + minimized collection + no behavioral advertising.

### Minimization & purpose limitation
- **R11.4** Every collected field justified by a documented purpose; fields with no justification queued for removal (P22).
- **R11.5** No PII in **logs, metrics, traces, analytics, error reports, or LLM prompts** — enforced by field-level scrubbing at the emitter, not "we'll grep later" (CWE-532). Structured logs pass through a redaction layer; free-text fields (search queries, comments) pseudonymized or redacted before leaving the tier.
- **R11.6** Pseudonymization/tokenization used where feasible; join-back keys stored separately with tighter ACLs.
- **R11.7** Anonymization claims are **tested** (k-anonymity/l-diversity/differential privacy budget) — never "we removed the name so it's anonymous."

### Consent & lawful basis
- **R11.8** Consent (where the basis) captured with proof: what was shown, when, granular purpose, version, withdrawal path. Withdrawal is as easy as granting. Prior consent respected across sessions/devices where identifiable.
- **R11.9** Dark-pattern audit: no forced continuous, pre-ticked, or bundled consent; equal prominence for accept/reject; refusal never punished with degraded UX beyond what the purpose logically requires.

### Data-subject rights (mechanized, not manual)
- **R11.10** Access (portability): export in a **structured, machine-readable, commonly used format** (JSON/CSV) covering every store where the subject's data lives.
- **R11.11** Rectification: user-driven correction paths for user-controllable data; process for administrator-mediated correction for the rest, with audit.
- **R11.12** **Erasure (right to be forgotten):** deletion propagates to primary stores, replicas, caches, search indexes, warehouses/lakes, backups (with a documented backup-cycle window), and **downstream processors/vendors**. A per-subject erasure runbook exists and is tested.
- **R11.13** Objection / restriction of processing: opt-out flags respected everywhere; a single source of truth for consent state; downstream jobs honor it on the next run.
- **R11.14** Automated-decision transparency: any decision materially affecting the subject that is fully automated has an explanation path and a human-review path (feeds P21 AI/ML).

### Retention, deletion, backups
- **R11.15** Retention schedule per data category, enforced by automated jobs (not tickets); "we delete on request" is not retention.
- **R11.16** Backup lifecycle: deletion honored on the next backup rotation ≤ documented window; documented in the privacy notice.
- **R11.17** Deletion is **irreversible** for the primary path (crypto-erase for keyed stores where physical wipe is impractical).

### Transfers, vendors, borders
- **R11.18** Vendor register: every processor/sub-processor listed with purpose, data categories, location, DPA on file, security assessment date.
- **R11.19** Cross-border transfers: transfer mechanism recorded (adequacy, SCC, BCR, etc.); data residency requirements from TIMELINE enforced technically (storage location, replica scope).
- **R11.20** Vendor-off-boarding runbook: data return/deletion attested.

### Governance & response
- **R11.21** **Privacy-by-design** review: every new feature or data field passes a lightweight PIA/DPIA gate (documented in DECISIONS.md); high-risk changes trigger a full DPIA.
- **R11.22** Breach detection + notification runbook: detection signals, containment, subject/authority notification with timelines matching applicable law (e.g., 72h under GDPR when applicable); tabletop-tested.
- **R11.23** **Immutable/append-only audit trail** for privacy-relevant admin/data actions: view/export of PII, deletion, consent changes, DSR fulfillment. Trail integrity protected (hash-chained/WORM); retained per policy; itself PII-minimized.
- **R11.24** Privacy notice matches reality: what the code does == what the notice says. If they diverge, code or notice is wrong — file a finding.

## 11.4 EXIT GATE — JUDGED AS THE PRINCIPAL

> **Mind: THE PRINCIPAL.** Guilty until the evidence tier matches; no gate closes on "mostly." Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.2.

- [ ] Complete personal-data inventory linked to data-flow view + TIMELINE. **Evidence:** inventory.
- [ ] Log/telemetry/analytics scrubbing enforced at emit; PII-in-logs scan clean. **Evidence:** config + scan.
- [ ] Retention jobs implemented and running; oldest-row audit within policy. **Evidence:** audit report.
- [ ] End-to-end erasure test succeeded across primary/replica/cache/index/warehouse/backup-window/vendors. **Evidence:** test log.
- [ ] Consent proof captured & withdrawal path parity verified. **Evidence:** consent schema + samples.
- [ ] DSR endpoints functional (access, rectify, erase, port, object). **Evidence:** test results.
- [ ] Vendor register + DPA/transfer mechanisms recorded. **Evidence:** register.
- [ ] Immutable audit trail live for privacy-relevant actions. **Evidence:** trail + integrity check.
- [ ] Breach runbook exists and tabletop-tested. **Evidence:** runbook + exercise notes.
- [ ] Privacy notice matches implementation (reconciliation). **Evidence:** reconciliation doc.

## 11.5 ARTIFACTS OUT
Personal-data inventory (RoPA); consent schema; retention & erasure runbooks; vendor register; DPIA log; audit-trail spec; privacy-notice reconciliation.

> Next: `PHASE_12_SUPPLY_CHAIN_AND_BUILD.md`.
