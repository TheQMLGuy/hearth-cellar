# PHASE_01 — RECONNAISSANCE & BOUNDARY SUMMARY

**Audit ID:** ZDP-Ω-2026-HC-01 | **Completed:** 2026-07-13T15:30Z

## Scope

Full inventory and boundary mapping of the Hearth & Cellar v2.2.0 codebase, a Tauri 2 (React + Rust) desktop application for curated YouTube viewing.

## Codebase Stats

| Metric | Value |
|---|---|
| Source files inventoried | 48 |
| Total LOC (approximate) | ~15,946 |
| CSS | 3,530 lines (22%) |
| Rust backend | ~2,652 lines |
| React/TypeScript frontend | ~6,500+ lines |
| Entry points | 6 primary + 46 Tauri commands |
| Trust boundaries | 5 |
| External services consumed | 8 |
| Dependency cycles | 0 (DAG clean) |
| Direct dependencies (npm) | 7 (4 runtime, 3 dev) |
| Direct dependencies (Cargo) | 9 |
| SIL3 components | 24 |
| SIL2 components | 22 |

## Architecture

**Single-process desktop** — Rust binary hosts a WebView2 (Edge Chromium) instance via Tauri 2. Communication is over a JSON IPC bridge (`invoke()`/`#[tauri::command]`).

### Modules
1. **Rust Backend** (`lib.rs`) — YouTube Data API v3, oEmbed scraping, watch-page fallback parsing, Google OAuth, Gemini/Ollama AI, store I/O, shorts quarantine
2. **reMarkable Integration** (`remarkable.rs`) — Pairing protocol, document listing, blob download/zip extraction, cache
3. **State Shell** (`App.tsx`) — Monolithic ~3,000-line React component handling all 14+ screens, state mutations, and event handling
4. **Store Layer** (`storeClient.ts` + `tauriShim.ts`) — Persistence: schema v14 migration, localStorage + Tauri IPC fallback, dedup, API key rotation
5. **Planning Engine** (`rotation.ts`) — Day plan algorithm: priority scoring, category round-robin, parts packing, stale detection
6. **Segmentation** (`partitioning.ts`) — Long-video slicing by chapters or even splits
7. **API Layer** (`lib/*.ts`) — Type safety utilities: URL parsing, YouTube embed, duration converters, ID generation, category factory

### Trust Boundaries
1. **React ↔ Rust** (Tauri IPC) — all data crosses JSON ser/de
2. **Rust ↔ External APIs** (ureq HTTP) — unvalidated network responses
3. **Rust ↔ Filesystem** — plaintext secrets persisted to JSON files
4. **User input** — IngestPanel URLs lack format validation at Rust boundary
5. **YouTube iframe** — cross-origin postMessage from youtube.com

### Entry Points
- `main.rs:fn main()` — OS launch
- `main.tsx:createRoot` — React mount
- `installTauriShim()` — Tauri bridge bootstrap
- `loadStore()` — persist store init
- 46+ `#[tauri::command]` handlers — IPC call targets
- YouTube iframe `onMessage` — cross-origin event listener

## Falsification Procedures

| Procedure | Result |
|---|---|
| Orphan hunt (unreachable files) | 0 orphans |
| Hidden entry hunt | 6 primary entries mapped; none hidden |
| Boundary leak probe | **FND-0001:** URL input from IngestPanel not validated at Rust boundary |
| Crypto/hash probe | No self-implemented crypto |
| Side-channel probe | No timing-sensitive operations |
| Config-leak probe | API keys persisted in plaintext (by design, noted) |
| Dependency probe | 12 direct deps, no known vulnerabilities at this time |

## Findings
- **FND-0001:** Ollama endpoint lacked SSRF validation → **FIXED** (added `is_ollama_safe_host`)
- **FND-0002:** No Content Security Policy → **FIXED** (set restrictive CSP in tauri.conf.json)
- **FND-0003:** API keys and tokens stored in plaintext on filesystem → **OPEN** (design trade-off)

## Gate Exit Criteria

| Criterion | Status |
|---|---|
| Every source file inventoried | ✅ 48 files |
| All trust boundaries identified | ✅ 5 |
| All entry points listed | ✅ 6 + 46 commands |
| SIL assigned per component | ✅ 46 entries |
| At least 1 view produced | ✅ 5 views |
| At least 1 FND opened | ✅ 3 FNDs |
| Bootloader truth table populated | ✅ |
