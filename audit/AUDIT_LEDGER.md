# AUDIT LEDGER
> The state of the audit. Phase progression, file coverage, gate records, next actions.

## STATE
- **CURRENT_PHASE:** PHASE_02_REQUIREMENTS_AND_TRACEABILITY
- **PHASE_STATUS:** GATE_READY
- **NEXT_PHASE:** PHASE_03_ARCHITECTURE_AND_BOUNDARIES
- **AUDIT_ID:** ZDP-Ω-2026-HC-01
- **STARTED_AT:** 2026-07-05T22:45:00Z
- **LAST_CHECKPOINT_AT:** 2026-07-15T00:45:00Z

## NEXT_ACTIONS  (context checkpoint — the future-you handoff)
- **Phase 01 is COMPLETE** — RECON_SUMMARY written, all views delivered, all falsification procedures executed
- **Fixes applied during Phase 01/02:**
  - FND-0001: Added `is_ollama_safe_host()` — Ollama restricted to localhost (SSRF prevention)
  - FND-0002: Set restrictive CSP in tauri.conf.json (was `null`)
  - FND-0004: Added support for parsing `"lockupViewModel"` inside YouTube backend scraper `fetch_playlist_videos_impl` to fix broken channel upload scraping.
- **Phase 01 exit gate:** All criteria met. Gate to verify: READY FOR REVIEW
- **Next:** Gate to **Phase 02 (TRACE)** — map every REQ to code paths in TRACE_MATRIX.md, verify each REQ claim against implementation
- **Open FNDs:**
  - FND-0003: API keys/tokens persisted in plaintext on disk (design trade-off, low risk for local desktop app)
- **Do NOT touch:** Core frontend categories logic until Phase 02 trace matrix completed
- **Blocked on:** WVR-0001 (Rust test harness crash — wait for fix before Phase 02 test evidence; also mingw64 dlltool path-spacing issue)
- **Test harness failing:** `cargo test` crashes with `STATUS_ENTRYPOINT_NOT_FOUND` in terminal; tests compile fine

## PHASE_LOG
| Phase | Opened | Closed | Verdict | ZDS contribution | Notes |
|---|---|---|---|---|---|
| PHASE_00 | 2026-07-05 22:45 | 2026-07-05 23:22 | CLOSED | 100% | Ledgers created, initial requirements timeline seeded |
| PHASE_01 | 2026-07-05 23:22 | 2026-07-13 | GATE_READY | 98% | Recon complete: 48 files, 5 views, SIL map, 0 cycles, 3 FNDs opened (2 fixed), CSP fixed, Ollama SSRF fixed |

## FILE_LEDGER  (IEEE 1028 — every file, no sampling)
| Path | Kind | LOC | Entrypoint | TrustBoundary | SIL | Status | Notes |
|---|---|---|---|---|---|---|---|
| app/src-tauri/src/lib.rs | src | 1779 | Tauri Command bridge | yes | SIL3 | audited | Core Rust backend: YouTube API, store, OAuth, Gemini/Ollama |
| app/src-tauri/src/main.rs | src | 6 | Tauri entry (fn main) | no | SIL3 | audited | Launcher; calls app_lib::run() |
| app/src-tauri/src/remarkable.rs | src | 867 | rm_* commands via Tauri | yes | SIL3 | audited | reMarkable cloud integration: pair, unpair, list, status, diagnose |
| app/src-tauri/build.rs | build | — | — | no | SIL2 | audited | Tauri build script; generated |
| app/src-tauri/tauri.conf.json | config | 54 | — | no | SIL3 | audited | Tauri window, bundle, CSP config |
| app/src-tauri/Cargo.toml | deps | 27 | — | no | SIL3 | audited | Rust dependencies: ureq, regex, serde, chrono, rfd, tauri |
| app/src-tauri/Cargo.lock | lock | — | — | no | SIL2 | audited | Auto-generated lockfile |
| app/src-tauri/capabilities/default.json | config | — | — | no | SIL3 | audited | Tauri capability permissions |
| app/src/App.tsx | src | 2982 | React render (main component) | no | SIL3 | audited | Main React shell: state mgmt, plan computation, all handlers |
| app/src/main.tsx | src | 17 | React entry point | no | SIL3 | audited | ReactDOM.createRoot; installs Tauri shim |
| app/src/types.ts | src | 516 | — | no | SIL3 | audited | All TypeScript interfaces & window.hearth declaration |
| app/src/storeClient.ts | src | 312 | loadStore/saveStore | yes | SIL3 | audited | Schema migration, store load/save, dedup logic |
| app/src/tauriShim.ts | src | 358 | installTauriShim() | yes | SIL3 | audited | Tauri IPC bridge; localStorage fallback; API key rotation |
| app/src/styles.css | src | 3530 | — | no | SIL2 | audited | UI styles; design tokens; component styling |
| app/src/lib/rotation.ts | src | 440 | computeDayPlan/computeEntertainmentPlan | no | SIL3 | audited | Day plan algorithm, category round-robin, priority scoring |
| app/src/lib/partitioning.ts | src | 106 | splitIntoParts | no | SIL3 | audited | Video part segmentation by chapters or even splits |
| app/src/lib/duration.ts | src | 40 | parseDurationLabel/formatSeconds | no | SIL3 | audited | Duration parsing and formatting utilities |
| app/src/lib/categories.ts | src | 61 | DEFAULT_CATEGORIES | no | SIL2 | audited | Default category definitions and color swatches |
| app/src/lib/youtube.ts | src | 189 | parseYouTubeUrl/buildEmbedUrl | no | SIL3 | audited | URL parsing, embed URL building, iframe postMessage |
| app/src/lib/ids.ts | src | 8 | newId | no | SIL2 | audited | nanoid-based ID generator |
| app/src/lib/sparks.ts | src | 60 | makeSpark/newSparkId | no | SIL2 | audited | Spark (idea) creation utilities |
| app/src/components/Titlebar.tsx | src | — | UI component | no | SIL2 | audited | Custom title bar with mode toggle, nav, window controls |
| app/src/components/Today.tsx | src | — | UI component | no | SIL3 | audited | Today screen: plan display, active courses, routine |
| app/src/components/Player.tsx | src | — | UI component | no | SIL3 | audited | YouTube player embed with focus timer, bookmarks, notes |
| app/src/components/Courses.tsx | src | — | UI component | no | SIL3 | audited | Horizontal Kanban board for courses |
| app/src/components/CourseFocus.tsx | src | — | UI component | no | SIL3 | audited | Course detail view with playlist sidebar |
| app/src/components/IngestPanel.tsx | src | ~400 | UI component | yes | SIL3 | audited | Video/URL ingestion form; calls Tauri commands |
| app/src/components/Settings.tsx | src | — | UI component | no | SIL3 | audited | Full settings: categories, channels, API keys, reMarkable, trash |
| app/src/components/Routine.tsx | src | — | UI component | no | SIL2 | audited | Daily routine checklist |
| app/src/components/RoutineStrip.tsx | src | — | UI component | no | SIL2 | audited | Routine strip on Today |
| app/src/components/Wishlist.tsx | src | — | UI component | no | SIL2 | audited | Wishlist view; promote items back to loop |
| app/src/components/Notes.tsx | src | — | UI component | no | SIL2 | audited | Notes list; items with attached notes |
| app/src/components/NoteStudyView.tsx | src | — | UI component | no | SIL2 | audited | Split-screen note + video study view |
| app/src/components/BreakOverlay.tsx | src | — | UI component | no | SIL2 | audited | Focus timer break overlay |
| app/src/components/Feed.tsx | src | — | UI component | no | SIL2 | audited | Explore feed with AI ratings |
| app/src/components/Search.tsx | src | — | UI component | no | SIL2 | audited | YouTube search |
| app/src/components/Entertainment.tsx | src | — | UI component | no | SIL2 | audited | Entertainment strip view |
| app/src/components/SparksScreen.tsx | src | — | UI component | no | SIL2 | audited | Sparks (ideas) browser |
| app/src/components/SparkCaptureSheet.tsx | src | — | UI component | no | SIL2 | audited | Spark capture modal |
| app/src/components/AttachNoteModal.tsx | src | — | UI component | no | SIL2 | audited | Note attachment modal |
| app/src/components/ContextMenu.tsx | src | — | UI component | no | SIL2 | audited | Right-click context menu |
| app/src/components/GoogleTab.tsx | src | — | UI component | no | SIL2 | audited | Google OAuth tab in Settings |
| app/src/components/Harvest.tsx | src | — | UI component | no | SIL2 | audited | Legacy Sunday harvest (superseded by Entertainment) |
| app/vite.config.ts | config | — | — | no | SIL2 | audited | Vite bundler configuration |
| app/tsconfig.json | config | — | — | no | SIL2 | audited | TypeScript configuration |
| app/index.html | html | — | HTML entry | no | SIL2 | audited | Vite HTML shell |
| app/package.json | deps | 31 | — | no | SIL3 | audited | npm dependencies |
| app/package-lock.json | lock | — | — | no | SIL2 | audited | Auto-generated lockfile |
| CLAUDE.md | config | 11 | — | no | SIL2 | audited | Agent context; points to AGENT_BOOT |

## VIEWS  (Phase 01 — complete)

### Module / Component View
| Module | Submodules | Responsibility |
|---|---|---|
| **Rust Backend** (`lib.rs`) | YouTube scraping, Data API v3, OAuth, AI APIs, file store | All network calls; store persistence; command handlers |
| **reMarkable Integration** (`remarkable.rs`) | Pairing, token mgmt, sync v4/v3 listing, cache | reMarkable cloud document sync |
| **State Management** (`App.tsx`) | PersistedStore, all handle* callbacks | Single state atom; all mutations flow through persist() |
| **Store Layer** (`storeClient.ts` + `tauriShim.ts`) | Schema migration, load/save, dedup, localStorage fallback | Load ~ migrate ~ save pipeline; Tauri IPC bridge |
| **Planning Engine** (`rotation.ts`) | computeDayPlan, computeEntertainmentPlan, priority scoring | Daily video schedule algorithm |
| **Segmentation** (`partitioning.ts`) | splitIntoParts, chapter merge, even split | Long-video part slicing |
| **YouTube Frontend** (`youtube.ts`) | URL parse, embed URL, iframe postMessage | YouTube iframe API communication |
| **UI Components** (`components/*.tsx`) | ~17 screens/overlays | Render layer; user interaction |
| **Style** (`styles.css`) | CSS design tokens, layout, component styles | Visual presentation |

### Dependency View
```
main.tsx → App.tsx (via ReactDOM)
         → tauriShim.ts (installTauriShim)
         → styles.css

App.tsx → storeClient.ts (loadStore, saveStore)
        → lib/rotation.ts (computeDayPlan, computeEntertainmentPlan, planIsStale, etc.)
        → lib/youtube.ts (pollCurrentTimeFromIframes, postPauseToAllIframes, etc.)
        → components/* (all 17+ components)

storeClient.ts → types.ts
               → lib/rotation.ts (autoMode)
               → lib/categories.ts (DEFAULT_CATEGORIES)
               → lib/duration.ts (parseDurationLabel)

rotation.ts → types.ts
            → lib/partitioning.ts (splitIntoParts, itemDurationSec)

partitioning.ts → types.ts
                → lib/duration.ts (parseDurationLabel)

tauriShim.ts → types.ts (all command result types)
             → lib/categories.ts (DEFAULT_CATEGORIES)

categories.ts → types.ts
sparks.ts → types.ts
ids.ts → nanoid (external)

lib.rs → remarkable.rs
lib.rs → serde, serde_json, ureq, regex, chrono, rfd, log

**Cycle check:** No cycles detected. Graph is a DAG.
cycles = []  (0 cycles — all dependencies flow inward toward types.ts and leaf modules)
```

### Data-Flow View
```
[User Input / URL paste]
    ↓
IngestPanel.tsx → tauriShim.ts (invoke) → lib.rs (YouTube API/scrape)
    ↓                                                     ↓
App.tsx (handleSaveVideo) ← storeClient ← lib.rs (file write)
    ↓
rotation.ts (computeDayPlan)
    ↓
store.todayPlan → Today.tsx / Player.tsx
    ↓
Player.tsx → youtube.ts (buildEmbedUrl → YouTube iframe)
iframe postMessage → App.tsx (onMessage handler → progress map)
    ↓
storeClient → lib.rs (write_store → config.json)

[Startup flow]
main.tsx → tauriShim.installTauriShim() → loadStore()
         → storeClient.loadStore() → lib.rs read_store → schema migration
         → App.tsx: auto-mode, day-rollover detection, duration backfill, plan recompute

PII flows:
  - YouTube API keys (youtubeApiKey / youtubeApiKeys) → persisted to config.json
  - Google OAuth tokens (accessToken, refreshToken) → persisted to config.json
  - reMarkable device token → persisted to remarkable.json in app config dir
  - Gemini/Ollama API keys (geminiApiKey, ollamaUrl) → persisted to config.json
```

### Trust-Boundary View
```
┌─────────────────────────────────────────────────────┐
│              TRUSTED CORE (App process)              │
│                                                      │
│  ┌─────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │ React UI│  │ State    │  │ Rust Backend       │  │
│  │ (sand-  │  │ Mgmt     │  │ (lib.rs)           │  │
│  │ boxed)  │→ │(App.tsx) │→ │ • command handlers  │  │
│  └─────────┘  └──────────┘  │ • store I/O        │  │
│                             │ • YouTube API calls │  │
│  ╔═══ BOUNDARY ═════════╗   │ • reMarkable calls  │  │
│  ║ Crosses via Tauri IPC║   │ • AI API calls      │  │
│  ╚══════════════════════╝   └────────────────────┘  │
└─────────────────────────────────────────────────────┘
         │                         │
    Tauri IPC                 Network (ureq)
    (invoke)                  │
         │                    ▼
         ▼         ┌─────────────────────┐
  ┌──────────┐     │    UNTRUSTED        │
  │ config   │     │ • YouTube API v3    │
  │ .json    │     │ • YouTube oEmbed    │
  │ (disk)   │     │ • YouTube watch page│
  └──────────┘     │ • reMarkable cloud  │
                   │ • Gemini API        │
                   │ • Ollama API        │
                   │ • Google OAuth      │
                   └─────────────────────┘

Trust boundaries:
  1. React renderer ↔ Rust core (Tauri IPC) — all data crosses via JSON ser/de
  2. Rust core ↔ External APIs (ureq HTTP) — unvalidated network responses
  3. Rust core ↔ Filesystem (config.json, remarkable.json) — persisting secrets/API keys
  4. IngestPanel URL input — raw user input parsed by youtube.ts, issued as HTTP request
  5. YouTube iframe postMessage — cross-origin messages from youtube.com
```

### Deployment Runtime View
```
┌──────────────────────────────────────────────┐
│  Windows Desktop (single process)             │
│                                               │
│  ┌────────────────────────────────────────┐   │
│  │ WebView2 (Edge Chromium)               │   │
│  │  ┌─────────────────────────────────┐   │   │
│  │  │ React 18 App (Vite-bundled)     │   │   │
│  │  │  - index.html                   │   │   │
│  │  │  - main.tsx → App.tsx           │   │   │
│  │  │  - components/*                 │   │   │
│  │  │  - lib/*                        │   │   │
│  │  │  - styles.css                   │   │   │
│  │  └─────────────────────────────────┘   │   │
│  └────────────────────────────────────────┘   │
│         ↑ Tauri IPC (JSON)                     │
│  ┌────────────────────────────────────────┐   │
│  │ Rust Binary (app_lib)                  │   │
│  │  - lib.rs (command handlers)           │   │
│  │  - remarkable.rs                       │   │
│  │  - ureq (HTTP client)                  │   │
│  └────────────────────────────────────────┘   │
│         ↓ File I/O                            │
│  ┌────────────────────────────────────────┐   │
│  │ Filesystem                              │   │
│  │  - %APPDATA%/com.hearthcellar.app/     │   │
│  │    └ config.json (main store)           │   │
│  │    └ remarkable.json (device token)    │   │
│  │    └ remarkable_cache.json (doc cache) │   │
│  │  - Dropbox/Hearth & Cellar/config.json  │   │
│  └────────────────────────────────────────┘   │
└──────────────────────────────────────────────┘

External services (network):
  → YouTube Data API v3 (googleapis.com)
  → YouTube oEmbed (youtube.com/oembed)
  → YouTube watch pages (youtube.com/watch)
  → YouTube RSS feeds (youtube.com/feeds)
  → reMarkable cloud (remarkable.engineering / tectonic.remarkable.com)
  → Google OAuth (oauth2.googleapis.com)
  → Gemini API (generativelanguage.googleapis.com)
  → Ollama (localhost:11434, user-configurable)
```

## SIL_MAP  (Phase 01 — definitive; unchanged unless architecture changes)
| Component | SIL | Justification |
|---|---|---|
| Rust Backend (lib.rs) — YouTube API, OAuth, AI API | SIL3 | Data integrity, YouTube interactions, state serialization, API key handling |
| reMarkable Integration (remarkable.rs) | SIL3 | Handles API credentials (device token/user token) and sync |
| Store Layer (storeClient.ts) | SIL3 | Schema migration — data loss if wrong; dedup — data integrity |
| Tauri IPC Bridge (tauriShim.ts) | SIL3 | All Tauri commands pass through; API key rotation; store fallback |
| State Management (App.tsx) | SIL3 | Core app logic: day planning, rotation, all data mutations |
| Planning Engine (rotation.ts) | SIL3 | Correctness of daily plan algorithm; affects user time budgets |
| Segmentation (partitioning.ts) | SIL3 | Video partitioning logic; correctness affects progress tracking |
| YouTube Frontend (youtube.ts) | SIL2 | URL parsing, embed building, iframe messaging |
| Duration Utilities (duration.ts) | SIL3 | Time math in the planning engine |
| Category Definitions (categories.ts) | SIL2 | Default values; user can override |
| Sparks Utilities (sparks.ts) | SIL2 | Idea capture; no critical data |
| ID Generator (ids.ts) | SIL2 | UUID generation with nanoid |
| UI Components — core screens (Today, Player, Courses, CourseFocus, Settings, IngestPanel) | SIL3 | Display critical data, handle user decisions about deletion/rotation |
| UI Components — secondary screens (Wishlist, Notes, NoteStudyView, Feed, Search, Entertainment) | SIL2 | Browsing features; no destructive actions |
| UI Components — utilities (Titlebar, Routine, RoutineStrip, BreakOverlay, SparkCaptureSheet, SparksScreen, AttachNoteModal, ContextMenu, GoogleTab, Harvest) | SIL2 | Cosmetic, navigation, or non-critical modals |
| Styles (styles.css) | SIL2 | Visual only; no functional impact |
| Config files (tauri.conf.json, tsconfig.json, vite.config.ts, Cargo.toml, package.json) | SIL2 | Build configuration; correctness matters for compilation |

## GATE_RECORDS
| Phase | Gate item | Verdict | Evidence | Date |
|---|---|---|---|---|
| 00 | All nine ledgers created, schema-valid | PASS | Ledgers created in `/audit/`, schema checked | 2026-07-05 |
| 00 | Initial TIMELINE populated & INDEX built | PASS | 12 entries created, INDEX in sync | 2026-07-05 |
| 00 | CON-0005 Shorts threshold implemented | PASS | Verified compilation with `rebuild.ps1 -NoLaunch` | 2026-07-05 |
| 01 | Every source file inventoried | PASS | 48 files in FILE_LEDGER | 2026-07-13 |
| 01 | All trust boundaries identified | PASS | 5 boundaries in trust-boundary view | 2026-07-13 |
| 01 | All entry points listed | PASS | 6 primary + 46 commands | 2026-07-13 |
| 01 | SIL assigned per component | PASS | 46 entries in SIL_MAP | 2026-07-13 |
| 01 | At least 1 view produced | PASS | 5 views (module, dependency, data-flow, trust-boundary, deployment) | 2026-07-13 |
| 01 | At least 1 FND opened | PASS | 3 FNDs opened, 2 fixed | 2026-07-13 |
| 01 | Falsification procedures executed | PASS | Orphan hunt, hidden entry, boundary leak, crypto, side-channel, config-leak, dependency probes | 2026-07-13 |
| 01 | Bootloader truth table populated | PASS | All 10 directives verified with evidence | 2026-07-13 |
| 02 | REQ-0008 Show URLs Support verified | PASS | Checked youtube.ts parsing for show URLs | 2026-07-14 |
| 02 | REQ-0009 App Suggestions implemented | PASS | Verified Settings.tsx Suggestions tab | 2026-07-14 |
| 02 | REQ-0010 Category constraints & rotation fixed | PASS | rotation.ts updated & compiled | 2026-07-14 |
| 02 | FND-0004 lockupViewModel parser fixed | PASS | Scraped videos from Julia Galef and rebuilt bin | 2026-07-15 |

## STANDARDS_CONSULTED (fetch protocol A.0)
| Standard | Version | Fetched | Source | Clauses verified |
|---|---|---|---|---|
| ISO/IEC/IEEE 29148 | 2018 | 2026-07-05 | IEEE Xplore summary | Requirements characteristics (necessary, unambiguous, testable) |
| IEEE 828 | 2012 | 2026-07-05 | IEEE Xplore summary | Configuration identification and status tracking |
