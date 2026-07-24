# PHASE 10 — SECURITY DEEP AUDIT
> Assume the attacker has your source, your logs, your ex-employee's laptop, and a grudge. Verify against a structured, testable standard — **OWASP ASVS 5.0** — anchored to ISO controls and CWE weaknesses.

**Lead standards:**
- **OWASP ASVS v5.0.0** (May 2025) — 17 chapters, ~350 requirements, Levels L1/L2/L3. **This is the primary verification checklist.** The agent SHALL fetch the current standard and drive verification requirement-by-requirement, citing IDs as `v5.0.0-<chapter>.<section>.<req>` (e.g., `v5.0.0-1.2.5`).
- **OWASP Top 10 (Web + API + LLM)** — awareness / risk framing.
- **CWE Top 25** — weakness taxonomy; every FND tagged with a CWE ID.
- **ISO/IEC 27001:2022 + 27002:2022** — organizational/technical control anchors.
- **ISO/IEC 27034** — application security controls in the SDLC.
- **ISO/IEC 15408 (Common Criteria) / 18045** — evaluation-assurance framing where applicable.
- **NIST SP 800-218 (SSDF)** — secure development framework tie-in.
- **ISO/IEC 29147** (vulnerability disclosure) & **30111** (vuln handling) — process.

**SIL depth:** SIL2 → ASVS L1 minimum; SIL3 → L2 minimum; SIL4 → L2 mandatory + selected L3 (auth, crypto, sensitive data). **Inputs:** trust-boundary view (P01), boundary parsers (P04), data-flow view + PII paths (P01/P11).

---

## 10.1 MISSION
Verify the system against ASVS 5.0 at the level demanded by SIL, close every open weakness class in CWE Top 25, and produce a security-verified snapshot with every check citing an ASVS ID + CWE + evidence.

## 10.2 FETCH & GROUND (mandatory, this session)
1. Fetch **OWASP ASVS v5.0.0** (owasp.org / GitHub). Confirm 17 chapters. Load the CSV/checklist form so every requirement can be marked PASS/FAIL/N-A with evidence.
2. Fetch current **OWASP Top 10** (Web), **OWASP API Security Top 10**, **OWASP Top 10 for LLM Applications** (if any AI/LLM components — routes to P21 too).
3. Fetch **CWE Top 25** for the current year.
4. Confirm **ISO/IEC 27001:2022** control set (Annex A ~93 controls, four themes). Record versions in METRICS → StandardsConsulted.
5. If any AI/LLM code paths exist, also pre-load OWASP LLM Top 10 categories (prompt injection, insecure output handling, data leakage, model theft, etc.) for P10 + P21 crossover.

## 10.3 FALSIFICATION PROCEDURES — RUN AS THE RIVAL (think like an attacker)

> **Mind: THE RIVAL.** Hostile, no benefit of the doubt, no courtesy notice. Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.1.

- **Threat model (STRIDE per boundary):** for every trust boundary from P01, enumerate **S**poofing, **T**ampering, **R**epudiation, **I**nformation disclosure, **D**enial of service, **E**levation of privilege. Every empty cell is either "N/A because…" or a target.
- **Abuse-case suite:** for each core user story, write its evil twin ("as an attacker, I want to…"). Fail each in the code or file a finding.
- **Auth swap:** logged in as user A, replace IDs (path, body, query, headers, cookies, JWT sub) with user B's. Any success at reading/writing = IDOR (CWE-639) → P0.
- **Injection sweep:** for every string that flows into a query/command/template/URL/header/logger/HTML, verify a parameterized/encoded path — no string-built execution anywhere.
- **Token & session probe:** revoke, expire, rotate, replay, side-channel steal. What still works? What shouldn't?
- **Secrets sweep of history:** scan the full git history + logs + docs for credentials, tokens, keys, private URLs. History rewrites don't unbleed a leak — assume leaked = rotated.
- **Supply-chain probe:** verify lockfile integrity + provenance for every third-party artifact (details in P12).

## 10.4 EXHAUSTIVE RULES (universal; drive line-by-line via ASVS 5.0 checklist)

### A. Encoding, sanitization, injection prevention (ASVS Ch. 1)
- **R10.1** Every dynamic query/command/template built via **parameterized APIs or context-aware output encoding** — never string concatenation. Applies to SQL/NoSQL, ORMs' raw modes, shell/OS calls, LDAP, XML/XPath, template engines, log messages (log-injection), URL builders, header setters, HTML/DOM sinks, mail headers, and serialization formats. String-built execution anywhere = P0 (CWE-89/77/78/94/611/643).
- **R10.2** Output encoding is **context-correct** at the sink (HTML text vs attribute vs URL vs JS-string vs CSS vs JSON); one universal encoder does not exist. HTML sanitizer libraries are used; hand-rolled allowlists banned for HTML.
- **R10.3** Deserialization of untrusted data is either forbidden or uses a schema-restricted, non-code-executing format (CWE-502).

### B. Input, business logic, files (ASVS Ch. 2)
- **R10.4** Input validation exists but is **defense-in-depth**, not the last line — encoding at the sink is. All boundary inputs are parse-once-to-domain-types (R04.5) with strict schemas: types, ranges, lengths, enums, regex where required (linear-time only — no catastrophic backtracking / ReDoS, CWE-1333).
- **R10.5** Business-logic guards enforced server-side (never trusting the client): sequence, quantity, time-of-day, rate, and monetary limits per TIMELINE RULEs. Client-side checks are UX only.
- **R10.6** File upload/download: MIME sniffing on server, extension allowlist, content magic-byte check, size cap, storage outside webroot with generated names, virus/malware scan hook, image re-encoding to strip metadata/exploits, `Content-Disposition: attachment` for untrusted downloads; no path elements from user input in filenames (CWE-434, CWE-22).

### C. Frontend security (ASVS Ch. 3 — new in 5.0)
- **R10.7** Strong **Content-Security-Policy** (nonce/hash-based; no `unsafe-inline` / `unsafe-eval`), plus `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security` (HSTS w/ long max-age + preload where appropriate). CSP is *actually enforced*, not `report-only` forever.
- **R10.8** Cookies: `Secure`, `HttpOnly`, `SameSite` (Strict/Lax as risk-appropriate), scoped `Path`/`Domain`, `__Host-` prefix for session; no session in localStorage.
- **R10.9** Anti-CSRF for state-changing requests on cookie-auth flows (double-submit + SameSite, or synchronizer token). CORS allowlist explicit; wildcard + credentials = P0 misconfiguration.
- **R10.10** DOM sinks (innerHTML, document.write, eval, dangerous URL schemes) inventoried; each has a safe alternative or sanitizer.

### D. API and web service (ASVS Ch. 4)
- **R10.11** REST/GraphQL/RPC surface enforces authN & authZ **at the API layer** — not just the UI. Every endpoint has a documented AuthZ rule tied to a TIMELINE RULE.
- **R10.12** GraphQL: query depth + complexity limits, disabled introspection in prod (or auth-gated), field-level auth. Batch/N+1 auth checks (per-row, not per-request) where applicable.
- **R10.13** Mass-assignment protection: explicit allowlists on writeable fields per role (CWE-915).
- **R10.14** HTTP semantics correct: verbs (GET has no side effects), status codes (401 vs 403 vs 404 chosen not to leak), response headers safe.

### E. File handling / resource access (ASVS Ch. 5)
- **R10.15** **Path canonicalization before validation** (resolve `..`, symlinks, unicode homoglyphs) then verify inside allowed root (CWE-22).
- **R10.16** **SSRF defense** (CWE-918): outbound URLs allowlisted or resolved-and-checked against private/link-local/metadata (169.254.169.254, ::1, cloud IMDS) ranges *after DNS resolution and before connect*; block redirects to disallowed hosts; disable dangerous URL schemes; timeouts + size caps.
- **R10.17** XXE disabled on any XML parser (CWE-611); external entity resolution off by default.

### F. Authentication (ASVS Ch. 6) + tokens/OIDC (Ch. 9, 10)
- **R10.18** Passwords: NIST SP 800-63B alignment — min length, breach-list check, no forced periodic rotation, no composition rules; hashed with a modern memory-hard KDF (Argon2id or bcrypt/scrypt with sane params) + per-user salt.
- **R10.19** MFA offered/required per risk; recovery flows resist enumeration & takeover; account lockout / rate limiting with attacker-vs-legit user tradeoffs documented.
- **R10.20** Auth timing: constant-time credential compare; no user-enumeration via response differences (timing, messages, status).
- **R10.21** Session tokens: high-entropy, server-side revocable, rotated on privilege change, invalidated on logout everywhere; absolute + idle expiration.
- **R10.22** JWT / self-contained tokens (Ch. 9): algorithm allowlist (no `none`, no alg-confusion), `kid` handled safely, audience+issuer verified, short lifetime + refresh with rotation, key rotation supported, revocation strategy stated.
- **R10.23** OAuth2/OIDC (Ch. 10): PKCE for public clients, `state` and `nonce` verified, redirect URI exact-match allowlist, tokens transported/stored safely, no token in URLs/logs.

### G. Authorization (ASVS Ch. 8)
- **R10.24** Authorization model documented (RBAC/ABAC/ReBAC) with a single policy point per resource type; policy decisions logged (P17).
- **R10.25** IDOR (CWE-639) covered: every object access re-checks ownership/permission server-side, regardless of how the ID arrived; opaque non-enumerable IDs where enumeration is a risk.
- **R10.26** Privilege boundaries: no privilege inheritance by accident (impersonation, delegated tokens, admin masquerade) without explicit, logged flows.

### H. Sensitive data & cryptography (ASVS Ch. 11, 12, 13)
- **R10.27** **In transit:** TLS 1.2+ (prefer 1.3) with modern cipher suites, HSTS, cert pinning where risk-justified; mTLS on service-to-service where possible.
- **R10.28** **At rest:** authenticated encryption (AES-256-GCM, ChaCha20-Poly1305) for sensitive data; per-tenant keys where isolation matters; keys in a **KMS/vault**, rotatable, never in code/repo/env-committed files.
- **R10.29** **No home-grown crypto.** Use vetted libraries; deprecated algorithms (MD5, SHA-1 for security, DES, RC4, RSA<2048, ECB) banned. Randomness from a CSPRNG only.
- **R10.30** Secrets management: zero secrets in source (verified by history scan — gitleaks-class), env, or logs; loaded from vault/KMS; rotation cadence + emergency revocation runbook exist.
- **R10.31** **Post-quantum readiness (per ASVS 5.0 modernization):** crypto agility documented; long-lived signatures/keys have a PQ-migration note (traced to a TIMELINE DEC).

### I. Errors, logging, secure operations (ASVS Ch. 15, 16)
- **R10.32** Errors returned to clients are non-leaky (no stack traces, no internal identifiers) but uniquely correlatable to server logs (request/trace ID).
- **R10.33** **Security-relevant events logged**: authN success/failure, authZ denials, privilege changes, admin actions, secret access, deletion, export/download of PII, config changes. Logs are **append-only / tamper-resistant** (P11 audit trail) and PII-scrubbed at emit (P11).
- **R10.34** Rate limiting on auth, sensitive endpoints, and expensive queries; per-account and per-IP; 429 with backoff hints.

### J. WebRTC (Ch. 17) — apply if used
- **R10.35** DTLS-SRTP, TURN over TLS, identity assertion, ICE candidate filtering, per-session key rotation.

### K. Cross-cutting (Ch. 7 Business logic-adjacent + Ch. 14 Config)
- **R10.36** No security-by-obscurity; hardcoded defaults for admin/debug/test disabled in prod; debug flags and diagnostic endpoints unreachable externally.
- **R10.37** Multi-tenancy: tenant ID is a **required, server-derived** field on every query; row-level filtering enforced at the persistence layer; cross-tenant probe (auth swap across tenants) passes.
- **R10.38** LLM/AI code paths (if any): prompt injection resistance (system-user separation, tool allowlists, output validation, sandboxed execution), data-exfil resistance (least-privilege for the model), no untrusted content becomes tool arguments unfiltered. Feeds P21.

### L. Vulnerability process (organizational)
- **R10.39** **security.txt** published; vulnerability disclosure process (ISO/IEC 29147) documented; vuln handling (ISO/IEC 30111) has owner + SLAs.
- **R10.40** Incident response runbook exists (containment, eradication, recovery, PIR); notification obligations mapped (privacy in P11).

## 10.5 FINDINGS ENRICHMENT (every P10 finding carries)
`FND-ID | ASVS ID (v5.0.0-…) | CWE ID | severity (P0–P3) | attack narrative | repro | fix approach | trace to TIMELINE`.

## 10.6 EXIT GATE — JUDGED AS THE PRINCIPAL

> **Mind: THE PRINCIPAL.** Guilty until the evidence tier matches; no gate closes on "mostly." Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.2.

- [ ] STRIDE completed per boundary; abuse cases written; results tests-or-FNDs. **Evidence:** STRIDE table + abuse suite.
- [ ] ASVS 5.0 checklist run at required level per SIL; every requirement PASS/FAIL/N-A with evidence. **Evidence:** completed checklist.
- [ ] CWE Top 25 sweep clean or filed. **Evidence:** sweep table.
- [ ] Auth-swap / IDOR probes clean (cross-user AND cross-tenant). **Evidence:** probe results.
- [ ] Injection sweep clean at every sink. **Evidence:** sink inventory + tests.
- [ ] Secrets history scan clean; any historical leak → rotated + logged. **Evidence:** scan output + rotation ledger.
- [ ] Headers/cookies/CSP configuration verified (enforced, not report-only). **Evidence:** config + response snapshots.
- [ ] TLS/crypto inventory clean; no banned algos; keys in vault. **Evidence:** inventory.
- [ ] Rate limiting + security logging in place on sensitive paths. **Evidence:** config + log samples (scrubbed).
- [ ] security.txt + VDP + IR runbook exist. **Evidence:** files.
- [ ] Zero open P0 in security. **P0 open ⇒ gate closed.**

## 10.7 ARTIFACTS OUT
STRIDE table; abuse-case suite; completed ASVS 5.0 checklist; CWE-tagged findings; crypto/secrets inventory; header/cookie/CSP config; VDP + IR runbook; queue of security regression tests for P19.

> Next: `PHASE_11_PRIVACY_AND_DATA_PROTECTION.md`.
