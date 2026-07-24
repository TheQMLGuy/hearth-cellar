# APPENDIX A — STANDARDS REGISTER
> The full catalogue of every standard ZDP-Ω anchors to, what to draw from each, where to fetch it, and the **honesty rules** for citing standards you have and have not verified.

---

## A.0 THE FETCH PROTOCOL (mandatory)
When a phase says "fetch and ground," the agent MUST:
1. Fetch the current, authoritative version from the standards body or its official mirror.
2. Record: `standard_id | title | version | fetched_at | source_url | verified_clauses` in `METRICS.md → StandardsConsulted`.
3. Cite at the **clause level** only for clauses actually read. For unread clauses, cite the standard *at document level* ("per ISO/IEC 5055") and never invent clause numbers.
4. If a standard is paywalled or unfetchable in the environment, use the **open equivalents** listed below (NIST, OWASP, W3C, ISO published summaries) and record what could not be accessed as a BLOCKED item — do not paraphrase memory as if verified.
5. When a standard has multiple current versions (e.g., WCAG 2.1 legally binding + 2.2 latest), verify against the newer *superset* by default and separately record conformance to the legally required one.

**Version drift is real.** Standards revise. Clause numbers move. A citation without a fetched_at date is a citation on trust — the ledger prevents that trust from silently going stale.

---

## A.1 CORE LIFE-CYCLE & CONFIG (foundation)

| ID | Title | Draw from it | Phase |
|---|---|---|---|
| ISO/IEC/IEEE **12207** | Software life cycle processes | Process framing for every phase; requirement→build→verify→release lineage | 00–25 |
| ISO/IEC/IEEE **15288** | System life cycle processes | Same but at system scale (dependencies, boundaries) | 00, 03 |
| ISO/IEC/IEEE **24765** | Systems and software vocabulary (SEVOCAB) | Precise term usage; TIMELINE wording | 00, 02 |
| ISO/IEC/IEEE **29148** | Requirements engineering | Requirement characteristics (necessary, unambiguous, testable, feasible, traceable, verifiable, correct); SRS content | 00, 02 |
| IEEE **828** | Configuration management plans | Traceability matrix; configuration identification/status accounting | 00, 02, 22 |
| ISO **10007** | Configuration management guidance | CM discipline for the ledgers | 00 |
| ISO/IEC/IEEE **90003** | ISO 9001 applied to software | QMS overlay onto software processes | 24, 25 |

## A.2 QUALITY MODELS & MEASUREMENT

| ID | Title | Draw from it | Phase |
|---|---|---|---|
| ISO/IEC **25010:2023** | Product quality model (SQuaRE) | Nine characteristics: functional suitability, performance efficiency, compatibility, interaction capability, reliability, security, maintainability, flexibility, safety | 05–09, 13–17 |
| ISO/IEC **25012** | Data quality model | Data quality characteristics | 06, 21 |
| ISO/IEC **25019** | Quality-in-use | Effectiveness/efficiency/satisfaction in context | 13–15, 24 |
| ISO/IEC **25023** | Measurement of system/software quality | Metrics definitions | 15, 16, 22 |
| ISO/IEC **25040** | Quality evaluation process | Structuring the evaluation | 25 |
| ISO/IEC **25051** | COTS & ready-to-use software | Test/quality expectations for delivered software | 19, 25 |
| ISO/IEC **25059** | Quality model for AI systems | Extends 25010 with AI-specific characteristics | 21 |
| ISO/IEC **5055** | Automated source code quality measures | CWE-based structural weaknesses (reliability, security, performance, maintainability) | 05–08 |
| CISQ measures | Industry consortium metrics (source of 5055) | Complexity thresholds, code-smell taxonomies | 05 |

## A.3 VERIFICATION, VALIDATION, REVIEWS, ASSURANCE

| ID | Title | Draw from it | Phase |
|---|---|---|---|
| IEEE **1012** | V&V | Software Integrity Levels (SIL 1–4); depth-scales-with-consequence rigor | 01, 25 |
| IEEE **1028** | Reviews & audits | Audit ledger discipline; management/technical/inspection/walkthrough | 01, 22 |
| ISO/IEC **20246** | Work-product reviews | Systematic peer-review workflow | 01, 22 |
| ISO/IEC/IEEE **15026** | Assurance | Assurance cases (Claims–Arguments–Evidence); integrity levels | 04, 20, 25 |
| IEEE **1044** | Anomaly classification | Defect taxonomy → P0–P3 severity model | 08, 22 |
| IEEE **730** | Software quality assurance plans | SQA activities, records, gates | 23, 25 |
| IEEE **1633** | Software reliability engineering | Reliability models, growth, prediction | 09, 16 |

## A.4 TESTING (ISO 29119 SERIES)

| ID | Title | Draw from it | Phase |
|---|---|---|---|
| ISO/IEC/IEEE **29119-1** | Concepts & vocabulary | Test terms + framework | 19 |
| **29119-2** | Test processes | Planning, monitoring, control | 19, 23 |
| **29119-3** | Test documentation | Test plans, cases, results | 19 |
| **29119-4** | Test techniques | **Structure-based**: statement/branch/decision/MC/DC; specification-based: equivalence partitioning, boundary values, decision tables, state transition, combinatorial/pairwise; experience-based: exploratory | 19 |
| **29119-5** | Keyword-driven testing | Reusable test design | 19 |

## A.5 SECURITY

| ID | Title | Draw from it | Phase |
|---|---|---|---|
| **OWASP ASVS 5.0** (May 2025) | App-security verification | 17 chapters, ~350 requirements, L1/L2/L3 — **the security checklist** | 10 |
| **OWASP Top 10** (Web/API/LLM) | Risk awareness | Framing threat context | 10, 21 |
| **CWE Top 25** | Common weaknesses | Every FND tagged with a CWE ID | 10 |
| **NIST SP 800-218 (SSDF)** | Secure software development framework | Practices anchoring P10/P12/P23 | 10, 12, 23 |
| **NIST SP 800-53** | Security controls (broad) | Where applicable | 10 |
| **NIST SP 800-63B/C** | Digital identity (auth) | Password/session/auth rules | 10 |
| ISO/IEC **27001:2022** | ISMS | Annex A ~93 controls in 4 themes | 10, 11 |
| ISO/IEC **27002:2022** | Controls guidance | Implementation for 27001 controls | 10, 11 |
| ISO/IEC **27034** | Application security | SDLC application-security controls | 10, 18 |
| ISO/IEC **15408** / **18045** | Common Criteria / evaluation methodology | EAL framing when applicable | 10, 25 |
| ISO/IEC **29147** | Vulnerability disclosure | VDP process | 10 |
| ISO/IEC **30111** | Vulnerability handling | Internal handling | 10 |
| **OWASP SAMM** | Maturity model | Program-level context | 25 |
| **OWASP DevSecOps** | DevSecOps guidance | Pipeline design | 23 |
| **OWASP LLM Top 10** | LLM app risks | Prompt injection, tool abuse, etc. | 10, 21 |

## A.6 PRIVACY

| ID | Title | Draw from it | Phase |
|---|---|---|---|
| ISO/IEC **29100** | Privacy framework | 11 privacy principles | 11 |
| ISO/IEC **27701** | Privacy information management | Extends 27001/27002 for privacy | 11 |
| ISO/IEC **27018** | PII in public clouds | Processor obligations | 11 |
| ISO **31700-1/-2** | Privacy by design for consumer products | Design principles + guidance | 11 |
| ISO/IEC **27555** | Deletion of PII | Erasure discipline | 11 |
| **NIST Privacy Framework** | Cross-mappable practices | Alternate frame where useful | 11 |

## A.7 USABILITY, ACCESSIBILITY, FRONTEND

| ID | Title | Draw from it | Phase |
|---|---|---|---|
| **W3C WCAG 2.2** | Web content accessibility | 86 SC across POUR; A/AA/AAA levels | 14 |
| **ISO/IEC 40500** (2025) | ISO adoption of WCAG 2.2 | Same content, formalized as ISO | 14 |
| **EN 301 549** | EU ICT accessibility | Legally binding in EU public sector; broader than web | 14 |
| **Section 508** (US) | US federal ICT | References WCAG 2.x | 14 |
| **ATAG 2.0** | Authoring tools accessibility | If your product creates content for others | 14 |
| **WAI-ARIA 1.2** + APG | Roles/states/properties + widget patterns | Custom widget correctness | 14 |
| ISO **9241-11** | Usability definitions | Effectiveness/efficiency/satisfaction | 13, 14 |
| ISO **9241-110** | Interaction principles | 7 principles governing UI design | 13 |
| ISO **9241-112** | Presentation of information | Legible, understandable, consistent, discriminable | 13 |
| ISO **9241-125** | Visual presentation | Typography, spacing, layout | 13 |
| ISO **9241-161** | Visual UI elements | Controls, forms, dialogs | 13 |
| ISO **9241-171** | Software accessibility | Broader software a11y | 14 |
| ISO **9241-210** | Human-centred design | Process for designing interactive systems | 13, 14 |
| ISO **30071-1** | Digital accessibility (org) | Program-level accessibility management | 14 |
| **W3C Web Perf specs** | Perf APIs | CWV measurement instrumentation | 15 |
| **Core Web Vitals** | Field targets | LCP, INP, CLS thresholds | 15 |
| Unicode / **UAX #9** | Bidi algorithm | RTL correctness | 13 |
| **W3C Internationalization** | i18n guidance | Text, dates, locales | 06, 13 |

## A.8 ARCHITECTURE

| ID | Title | Draw from it | Phase |
|---|---|---|---|
| ISO/IEC/IEEE **42010** | Architecture description | Stakeholder/concern/viewpoint/view/rationale | 01, 03 |
| ISO/IEC/IEEE **42020** | Architecture processes | Process framing | 03 |
| ISO/IEC/IEEE **42030** | Architecture evaluation | Evaluation methods (ATAM-family) | 03 |
| ATAM (SEI) | Architecture tradeoff analysis method | Scenario-driven evaluation | 03 |
| C4 model | Contexts/Containers/Components/Code | Practical view heuristic | 03 |
| arc42 | Architecture doc template | Practical template | 03, 24 |

## A.9 RESILIENCE & DEP-SAFETY (adjacent)

| ID | Title | Draw from it | Phase |
|---|---|---|---|
| IEC **61508** | Functional safety (SIL) | Safety integrity levels & lifecycle (for safety-adjacent contexts) | 09, 20 |
| ISO **26262** | Automotive (ASIL) | For automotive; excellent rigor patterns | 09, 20 |
| DO-**178C** | Airborne systems | DAL A–E, MC/DC coverage requirements | 19, 20 |
| IEC **62304** | Medical device software | Software safety classes A/B/C | 20 |
| ISO **31000** | Risk management | Enterprise risk process | 21, 25 |
| ISO/IEC **16085** | Risk in life cycle | Software risk practice | 21, 25 |
| ISO/IEC **38500** | IT governance | Governance framing | 25 |

## A.10 DEVOPS / OPERATIONS

| ID | Title | Draw from it | Phase |
|---|---|---|---|
| IEEE **2675** | DevOps deploy/build integrity | Continuous integrity gates | 12, 23 |
| ISO/IEC/IEEE **32675** | DevOps international standard | DevOps concepts | 17, 23 |
| ISO/IEC **20000** / ITIL 4 | IT service management | Ops discipline | 17 |
| **W3C Trace Context** | Trace propagation | Distributed tracing correlation | 17 |
| **OpenTelemetry** | Telemetry API/SDK | Vendor-neutral instrumentation | 17 |
| **Google SRE canon** | SLO/SLI/error budgets | Reliability discipline | 09, 16, 17 |

## A.11 SUPPLY CHAIN & LICENSING

| ID | Title | Draw from it | Phase |
|---|---|---|---|
| **SLSA** | Supply-chain Levels for Software Artifacts | Provenance levels L0–L3 | 12 |
| **SPDX (ISO/IEC 5962)** | SBOM format | SBOM data | 12 |
| **CycloneDX** | SBOM format | Alternative SBOM | 12 |
| ISO/IEC **5230 (OpenChain)** | License compliance | Program compliance | 12 |
| **NIST SP 800-161** | Supply chain risk | Practices | 12 |
| **in-toto / Sigstore** | Signing & attestation | Practical toolchain framing | 12 |

## A.12 AI / ML / GENERATIVE

| ID | Title | Draw from it | Phase |
|---|---|---|---|
| ISO/IEC **42001** | AI management system | Organizational governance | 21 |
| ISO/IEC **23894** | AI risk management | Extends ISO 31000 | 21 |
| ISO/IEC **5338** | AI system life cycle | Extends 12207/15288 | 21 |
| ISO/IEC **5259** series | Data quality for ML | Training/eval data quality | 21 |
| ISO/IEC TR **24028** | AI trustworthiness (overview) | Concepts | 21 |
| ISO/IEC **24029** series | Neural-network robustness | Robustness measurement | 21 |
| IEEE **7000** | Ethical design | Value elicitation | 21 |
| IEEE **7001** | Autonomous system transparency | Transparency requirements | 21 |
| IEEE **7002** | Data privacy for AI | Privacy discipline for AI systems | 21 |
| IEEE **7003** | Algorithmic bias considerations | Bias process | 21 |
| **NIST AI RMF** + Gen-AI profile | AI Risk Management Framework | Practical taxonomy | 21 |
| **EU AI Act** | Regulation | Applicability where in scope | 21 |
| **OWASP LLM Top 10** | LLM app threats | Prompt injection, data leakage, etc. | 21 |
| Model Cards / Datasheets | Transparency artifacts | Governance artifacts | 21 |

## A.13 FORMAL METHODS & VERIFICATION

| ID | Title | Draw from it | Phase |
|---|---|---|---|
| ISO/IEC **13568** | Z notation | Formal specification | 20 |
| TLA+ / Alloy / Event-B | Specification & model-checking languages | Practical formal verification | 20 |
| Design by Contract (Meyer) | Preconditions/postconditions/invariants | P04 discipline | 04, 20 |

## A.14 DOCUMENTATION

| ID | Title | Draw from it | Phase |
|---|---|---|---|
| ISO/IEC/IEEE **26511** | Managing doc | Doc governance | 24 |
| **26512** | Acquiring doc | Sourcing docs | 24 |
| **26513** | Testing user doc | Doc testability | 24 |
| **26514** | Designing user doc | Doc design | 24 |
| **26515** | Agile documentation | Doc in agile | 24 |
| **26531** | Content mgmt for reuse | Doc reuse | 24 |
| IEEE **1063** | User documentation | Content/format expectations | 24 |
| ISO/IEC/IEEE **23026** | Websites lifecycle | Web-specific doc practice | 24 |

## A.15 ISO CROSS-REFS FOR IMPLICIT CONSTRAINTS (used in P06 & TIMELINE `CON` entries)

| ID | Title | Draw from it |
|---|---|---|
| ISO **4217** | Currency codes + minor units | Money handling |
| ISO **8601** | Date/time representation | Time handling |
| ISO **80000** | Quantities & units (SI) | Physical quantities |
| ISO **639** | Language codes | Locales |
| ISO **3166** | Country codes | Regions/residency |
| IETF **BCP 47** | Language tags | Locale strings |
| Unicode Consortium | UTF-8, normalization, bidi | Text handling |

---

## A.16 CITATION HYGIENE
- ✅ "per ISO/IEC 5055 concurrency weakness class" — document-level, safe.
- ✅ "WCAG 2.2 SC 2.5.8 Target Size (Minimum) requires 24×24 CSS px (fetched YYYY-MM-DD from w3.org)" — verified.
- ❌ "per ISO 27001 clause 8.34" (unverified clause) — protocol violation.
- ❌ "the standard says…" (unnamed) — meaningless; delete or attribute.

## A.17 STANDARDS WATCHLIST (for Phase 25 R25.11)
Track update feeds for: WCAG, OWASP ASVS, OWASP LLM Top 10, CWE Top 25, NIST SP 800-218, SLSA, ISO/IEC 42001, ISO/IEC 25010, ISO/IEC/IEEE 29148, ISO/IEC 5055. On new versions, open a re-audit ticket scoped to the affected phase.

> This register is not exhaustive; adjacent standards apply per domain (medical, aviation, automotive, financial). The **fetch protocol (A.0)** is what turns "referenced" into "actually applied."
