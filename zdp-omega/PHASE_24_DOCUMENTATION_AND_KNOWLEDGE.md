# PHASE 24 — DOCUMENTATION & KNOWLEDGE
> Undocumented software is unmaintainable software. Prove the docs match the code, cover every audience, and survive the person who wrote them leaving.

**Lead standards:** ISO/IEC/IEEE 26511 (managing documentation), **26512** (acquiring documentation), **26513** (testing user documentation), **26514** (designing user documentation), **26515** (documentation in agile), **26531** (managing content for reuse), IEEE 1063 (user documentation), ISO/IEC/IEEE 23026 (websites lifecycle), ISO/IEC/IEEE 90003 (applying ISO 9001 to software).
**SIL depth:** SIL3/4 features require complete audience-coverage doc; SIL1/2 minimally require reference + operator notes. **Inputs:** every prior phase's artifacts; TIMELINE; TRACE_MATRIX.

## 24.1 MISSION
For every audience — end-user, admin/operator, developer, integrator, on-call, security/compliance — the docs are accurate, complete, current, findable, and generated-from-code where possible.

## 24.2 FALSIFICATION PROCEDURES — RUN AS THE RIVAL

> **Mind: THE RIVAL.** Hostile, no benefit of the doubt, no courtesy notice. Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.1.

- **Onboarding cold-run:** a fresh contributor follows the developer docs from clone → first passing test → first shipped fix. Every stumble = doc bug.
- **Task-based user check:** pick top 5 user tasks; can a new user find and complete each via docs alone? Missing/wrong = FND.
- **On-call cold-read:** hand a runbook to a fresh on-call; execute the top 5 alerts (crosses to R17.10). Any gap = FND.
- **Doc-vs-code drift:** for docs describing behavior, sample 20 claims; verify each against code/tests. Every drift = FND.
- **Broken-link scan:** all internal + external links checked; 404s and moved anchors = FND.

## 24.3 EXHAUSTIVE RULES

### Audience coverage (each must exist and be current)
- **R24.1 End-user documentation:** task-based ("how do I …"), reference (feature list, glossary), tutorials (first-run), and troubleshooting. Screenshots dated; localized per supported locale; searchable; version-marked.
- **R24.2 Administrator / operator docs:** installation, configuration (every option documented — feeds R08.11), upgrade/migration, backup/restore, capacity, monitoring, incident response links, hardening guide.
- **R24.3 Developer docs:** architecture overview (P03 views), local dev setup, coding standards, testing guide (P19), release process, contribution guide, decision log (ADRs — DECISIONS.md), API reference (generated from schemas — R18.23), how-to add a feature end-to-end.
- **R24.4 Integrator / API consumer docs:** getting started, auth, all endpoints/events with examples, versioning + deprecation policy (P18), rate limits, SDK availability, changelog.
- **R24.5 Security / compliance docs:** threat model summary (P10), STRIDE artifacts, SBOM location + how to consume (P12), disclosure policy + `security.txt` (R10.39), privacy notice reconciliation (R11.24), audit trail spec (R11.23), assurance case pointer (P25).
- **R24.6 Operator runbooks:** one per paging alert (R17.10); playbooks for top failure modes (R17.11); DR drill records (R09.14).

### Generation & sourcing
- **R24.7 Generate what you can:** API docs from schema (P18); config docs from schema (P08); metrics/alerts docs from telemetry-as-code (P17); glossary items linked from TIMELINE; changelog auto-derived from commit metadata where reliable.
- **R24.8 Single source of truth:** each fact lives in exactly one place; other pages transclude/link. Duplicated facts drift.
- **R24.9 Reuse per ISO/IEC/IEEE 26531:** shared snippets (warnings, prerequisites, glossary terms) are components, not copy-paste.

### Quality & governance
- **R24.10 Documentation is code:** in-repo, code-reviewed, versioned with the software, tested (broken-link/lint checks in CI — P23).
- **R24.11 Ownership:** every doc has an owner (CODEOWNERS covers doc paths); stale-doc alerts at N months.
- **R24.12 Change control:** doc changes accompany code changes for the same behavior — no code-only PRs shipping user-visible changes.
- **R24.13 Testability of docs (per ISO/IEC/IEEE 26513):** procedures are step-checked; example code runs in CI where feasible.
- **R24.14 Findability:** navigation structure task-oriented; search works; canonical URLs stable; versioned docs archive prior versions.

### Style, i18n, and accessibility of docs
- **R24.15 Plain language:** target reading level appropriate to audience; jargon defined on first use; active voice; short paragraphs.
- **R24.16 Accessibility of docs:** docs pass Phase 14 rules too — headings semantic, images alt-texted, code blocks screen-reader-friendly, contrast met.
- **R24.17 Localization:** where user locales are supported by the product, docs are translated (or clearly labeled English-only with a plan); RTL languages render correctly (crosses to R13.20-23).
- **R24.18 Screenshots policy:** kept minimal (they age fast); labeled with product version; automated screenshotting where possible.

### Onboarding & knowledge continuity
- **R24.19 New contributor path** documented and tested per §24.2; first-issue labels curated.
- **R24.20 Post-mortems (R17.17) published** (redacted for privacy) so patterns survive turnover.
- **R24.21 Assumption transparency:** ASSUMPTIONS.md excerpts summarized in developer docs — future maintainers see the load-bearing beliefs.

### Traceability of docs
- **R24.22** Every user-visible feature in TIMELINE has ≥ 1 doc entry mapped in TRACE_MATRIX; every doc page traces back to at least one REQ/RULE it documents (or a category); doc coverage becomes a metric.

## 24.4 EXIT GATE — JUDGED AS THE PRINCIPAL

> **Mind: THE PRINCIPAL.** Guilty until the evidence tier matches; no gate closes on "mostly." Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.2.

- [ ] All six audience-coverage buckets exist, current, owner-assigned. **Evidence:** doc index + owners.
- [ ] Doc-vs-code drift audit clean on sampled claims. **Evidence:** audit sample.
- [ ] Onboarding cold-run completed by a fresh reader; issues fixed. **Evidence:** run notes.
- [ ] Runbook cold-read completed for top alerts. **Evidence:** run notes.
- [ ] Broken-link + example-code CI checks green. **Evidence:** CI results.
- [ ] Docs accessibility conforms to target level (crosses to P14). **Evidence:** conformance check.
- [ ] TRACE_MATRIX shows doc coverage per user-visible REQ/RULE. **Evidence:** matrix.
- [ ] Localization state matches TIMELINE scope. **Evidence:** localization report.

## 24.5 ARTIFACTS OUT
Complete doc set across audiences; doc coverage entries in TRACE_MATRIX; doc CI checks; onboarding + runbook cold-read reports.

> Next: `PHASE_25_ASSURANCE_AND_PERPETUITY.md`.
