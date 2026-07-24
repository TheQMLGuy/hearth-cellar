# FINDINGS
> Every defect: opened, classified, tracked to closure. Schema per APPENDIX_SEVERITY_AND_DEFECTS §B.0.

## INDEX
| ID | Sev | Phase | Status | CWE/ASVS/WCAG | Component (SIL) | Opened | Closed |
|---|---|---|---|---|---|---|---|
| FND-0001 | P2 | 01 | FIXED | CWE-918 (SSRF) | lib.rs (SIL3) | 2026-07-13 | 2026-07-13 |
| FND-0002 | P2 | 01 | FIXED | CWE-1021 (Improper Restriction of Rendered UI Layers) | tauri.conf.json (SIL3) | 2026-07-13 | 2026-07-13 |
| FND-0003 | P2 | 01 | OPEN | CWE-312 (Cleartext Storage of Sensitive Information) | lib.rs/storeClient.ts (SIL3) | 2026-07-13 | — |
| FND-0004 | P2 | 02 | FIXED | CWE-1107 (Insufficient Visual/Structural Integrity Checks) | lib.rs (SIL3) | 2026-07-15 | 2026-07-15 |

## ENTRIES

### FND-0001: Ollama endpoint URL lacked SSRF validation
**Severity:** P2 | **Phase found:** 01 | **Status:** FIXED

**Description:** The `call_ollama_api` command (`lib.rs:1342`) accepts an `endpoint: String` parameter from the frontend (user-configurable in Settings). It had no validation preventing the endpoint from pointing to arbitrary internal or external hosts.

Video ID commands (`fetch_youtube_meta`, `fetch_youtube_transcript`) and playlist commands (`fetch_youtube_playlist_meta`, `fetch_youtube_playlist_videos`) DO validate at the Rust boundary with `is_video_id()` / `is_playlist_id()` — these were never vulnerable.

**Location:** `app/src-tauri/src/lib.rs:1342` — `call_ollama_api` (now has `is_ollama_safe_host` validation)

**Evidence:** Code review found `call_ollama_api` accepted any endpoint. Fixed on 2026-07-13 with `is_ollama_safe_host()` — restricts to localhost/127.0.0.1/::1.

**Fix applied:** Added `is_ollama_safe_host()` validation restricting endpoint to localhost/127.x/::1. Non-localhost addresses return an error.

---

### FND-0002: No Content Security Policy configured
**Severity:** P2 | **Phase found:** 01 | **Status:** FIXED

**Description:** `tauri.conf.json` set `"csp": null`, meaning the WebView2 had no Content Security Policy. Any XSS vulnerability in the React frontend could escalate to arbitrary script execution, Tauri command invocation, or filesystem access.

**Location:** `app/src-tauri/tauri.conf.json` — `app.security.csp` (was `null`, now fixed)

**Evidence:** Direct file read of tauri.conf.json confirmed `"csp": null`. Fixed to restrictive CSP on 2026-07-13.

**Fix applied:** Configured CSP restricting script/style sources to `'self'`, frame-src to `https://www.youtube.com`, connect-src to known external services only.

---

### FND-0003: API keys and tokens persisted in plaintext
**Severity:** P2 | **Phase found:** 01 | **Status:** OPEN

**Description:** YouTube API keys, Google OAuth tokens, reMarkable device tokens, Gemini API keys, and Ollama URLs are all stored in plaintext JSON files (%APPDATA%/com.hearthcellar.app/config.json and remarkable.json). A local attacker with filesystem access can extract all credentials.

**Location:**
- `app/src-tauri/src/lib.rs` — `write_store` writes entire PersistedStore to config.json, including `youtubeApiKey`, `youtubeApiKeys[]`, Google OAuth `accessToken`/`refreshToken`, `geminiApiKey`
- `app/src-tauri/src/remarkable.rs` — writes `device_token` to remarkable.json

**Evidence:** Code review of `write_store` and remarkable token persistence.

**Suggested fix:** Consider platform keychain APIs (Windows Credential Manager via Tauri store plugin or keyring crate). Mitigation: this is a local desktop app with assumed trusted user, but defense-in-depth warrants encrypted storage.

---

### FND-0004: YouTube uploads playlist scraping broken due to `lockupViewModel` UI change
**Severity:** P2 | **Phase found:** 02 | **Status:** FIXED

**Description:** The backend YouTube playlist scraper (`fetch_playlist_videos_impl` in `lib.rs`) used a regex matching `"playlistVideoRenderer"` to extract video IDs and titles. YouTube updated its uploads playlist pages to render videos using `"lockupViewModel"` objects instead, returning 0 videos and breaking explore category backfills (such as Philosophy).

**Location:** `app/src-tauri/src/lib.rs` — `fetch_playlist_videos_impl`

**Evidence:** Fetching the uploads playlist of channels returned status code 200 but contained 0 matches for `"playlistVideoRenderer"` and instead returned 30+ instances of `"lockupViewModel"`.

**Fix applied:** Added a secondary parser using string scanning and parenthesis brace-matching to extract and unescape video IDs (`contentId`) and titles from `"lockupViewModel"` objects when standard playlistVideoRenderer matches are empty.
