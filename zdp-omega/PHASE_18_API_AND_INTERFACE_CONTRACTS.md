# PHASE 18 — API & INTERFACE CONTRACTS
> An API is a promise. Every promise is versioned, machine-checkable, backward-compatible until deliberately broken, and safe under retry, replay, and evolution.

**Lead standards:** OpenAPI 3.x / AsyncAPI 3.x / JSON Schema / Protobuf / GraphQL schema (interface description), ISO/IEC 27034 (application security controls at interfaces), ISO/IEC/IEEE 29148 (external interface requirements), IETF standards for HTTP/URI/JSON, IEEE 828 (interface change control).
**SIL depth:** SIL3/4 public APIs get strict contract tests + deprecation policy + consumer contracts. **Inputs:** boundaries (P01), contracts (P04), security rules (P10), effects/idempotency (P07).

## 18.1 MISSION
Every external interface (HTTP/REST, GraphQL, RPC, webhook, message topic, WebSocket, file/format import/export, CLI) has a **machine-readable schema**, a documented **versioning policy**, a **deprecation policy**, tested backward compatibility, and safe semantics under retry/replay/reorder.

## 18.2 FALSIFICATION PROCEDURES — RUN AS THE RIVAL

> **Mind: THE RIVAL.** Hostile, no benefit of the doubt, no courtesy notice. Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.1.

- **Schema-vs-impl diff:** generate types from the schema; feed real prod-shaped payloads; any mismatch = drift finding.
- **Compat matrix:** run the previous minor's client against the current server (and vice versa). Break = compat regression.
- **Retry-replay attack:** send the same request twice / three times (with & without an idempotency key) — the server side effect must not multiply.
- **Weird-webhook attack:** send out-of-order, duplicate, delayed, and signature-invalid webhooks; server behavior must be safe and specified.
- **Break-glass evolution probe:** try renaming/removing/retyping a field with no notice; the process must refuse in CI (crosses to P23 gates).

## 18.3 EXHAUSTIVE RULES

### Schemas & contracts
- **R18.1** Every external interface has a machine-readable schema in-repo (OpenAPI / AsyncAPI / JSON Schema / Protobuf / GraphQL SDL). Schema is the source of truth; server + clients generated from or validated against it.
- **R18.2** Requests and responses validated against schema at the boundary (crosses to R04.5 parse-don't-validate); unknown fields policy explicit per interface (strict-reject for input, permissive-preserve for forward-compat on output where designed).
- **R18.3** Error contract: uniform error shape (code, message, correlation ID, details); machine-parseable codes documented; no leaking internals (crosses to R10.32).

### Versioning & compatibility
- **R18.4** Versioning strategy documented: URI segment (`/v1/`), media type, header, or GraphQL federation approach — pick one and be consistent.
- **R18.5** **Backward-compatible changes only** within a major version: additive fields with defaults, optional fields, new enum values only if consumers documented to tolerate them. Breaking changes require major version bump + parallel operation window.
- **R18.6** **Deprecation policy:** deprecations announced with a sunset date; monitored usage before removal; consumers migrated; `Sunset`/`Deprecation` headers on HTTP (RFC 8594 / RFC 9745).
- **R18.7** **Consumer-driven contract tests** (Pact-style) for interfaces you own with known consumers — you can't regress what you're contract-tested against.

### HTTP correctness (where applicable)
- **R18.8** Verbs used semantically: GET is safe + idempotent; PUT/DELETE idempotent; POST for create/side-effect; PATCH per RFC 5789/7396/6902 as documented.
- **R18.9** Status codes precise: 2xx success (200 vs 201 vs 204 chosen correctly), 3xx redirect (permanent vs temporary), 4xx client (401 vs 403 vs 404 vs 409 vs 410 vs 422 vs 429), 5xx server; retry-relevant codes signal `Retry-After`.
- **R18.10** Headers: `Content-Type`, `Content-Encoding`, `Cache-Control`, `ETag`/`If-None-Match`, `Vary`, `Content-Language`, security headers (crosses to R10.7).
- **R18.11** Pagination consistent (cursor preferred for large/mutating sets — ties R06.5); filtering, sorting, sparse-field selection have documented conventions.
- **R18.12** URIs are stable, opaque to clients, safely encoded; no PII in URLs (crosses to R11.5).

### Idempotency, ordering, delivery
- **R18.13 Idempotency:** unsafe write endpoints accept an `Idempotency-Key` (or equivalent) header; server dedupes within a documented window; documented across public-facing APIs (crosses to R07.7).
- **R18.14 Webhooks:** signed with a rotatable secret; timestamped with a **short verification window** to prevent replay; retry policy documented (backoff, max attempts, DLQ); at-least-once delivery assumed by consumers (they must be idempotent).
- **R18.15 Message topics (queues/streams):** schema versioned; keys chosen for ordering guarantees where required; poison-message handling defined; DLQ + replay tested (crosses to R09.10).

### GraphQL specifics (if used)
- **R18.16** Query complexity + depth limits enforced; persisted queries preferred for public clients; introspection restricted in prod; field-level authorization; N+1 solved with dataloader-class batching.
- **R18.17** Schema evolution follows the same additive-only rule; deprecations use `@deprecated`.

### Real-time (WebSocket / SSE)
- **R18.18** Auth verified on connect and re-verified on token expiry; heartbeat + reconnect strategy; message schema versioned; backpressure story.

### File & format interfaces
- **R18.19** Import/export formats fully specified (with a formal schema when possible); large-file streaming; charset declared (UTF-8 default); explicit newline / decimal-separator / date-format conventions.
- **R18.20** CLI: stable output (machine-parseable format available); stable exit codes; help complete; option parsing predictable; long options mirror short options.

### Observability of interfaces
- **R18.21** Every interface emits usage metrics per version + consumer (or auth principal) — deprecation decisions are data-driven.
- **R18.22** SLA / rate-limit headers exposed where relevant (`X-RateLimit-*`, `Retry-After`).

### Documentation
- **R18.23** Docs generated from schema — never a separate hand-maintained truth that drifts. Examples for every endpoint; error catalog; changelog per version.
- **R18.24** SDKs (if provided) generated or tested against the schema; version-matched.

## 18.4 EXIT GATE — JUDGED AS THE PRINCIPAL

> **Mind: THE PRINCIPAL.** Guilty until the evidence tier matches; no gate closes on "mostly." Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.2.

- [ ] Every interface has a machine-readable schema in-repo; server/clients validate against it. **Evidence:** schema files + validation config.
- [ ] Compat matrix run: previous-minor client × current server. **Evidence:** matrix results.
- [ ] Retry/replay/webhook-signature tests pass. **Evidence:** test suite.
- [ ] Versioning + deprecation policy documented; sunset headers where applicable. **Evidence:** policy doc.
- [ ] Consumer-driven contracts in place for known consumers. **Evidence:** contract test set.
- [ ] HTTP semantics audit clean (verbs, codes, headers, pagination). **Evidence:** audit table.
- [ ] Docs generated from schema; changelog current. **Evidence:** doc build + changelog.
- [ ] Usage metrics per version emitting. **Evidence:** dashboard.

## 18.5 ARTIFACTS OUT
Interface schemas; versioning + deprecation policy; consumer contract tests; compat matrix report; interface metrics dashboards; generated docs.

> Next: `PHASE_19_TEST_SUITE_FORENSICS.md`.
