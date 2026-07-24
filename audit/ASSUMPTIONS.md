# ASSUMPTIONS
> Every inherited/implicit belief the system relies on, with a test that fires if the belief becomes false.

## ENTRIES

### ASM-0001
- **Assumption:** YouTube Data API v3 quota limits are maintained, and scraping watch-pages remains functional as a fallback.
- **Origin:** [youtube.ts](file:///c:/Github%20Repos/MyMedia/hearth-cellar-project/app/src/lib/youtube.ts) / [lib.rs](file:///c:/Github%20Repos/MyMedia/hearth-cellar-project/app/src-tauri/src/lib.rs)
- **What breaks if false:** Channel and playlist ingestion will fail if Google API keys are absent and YouTube alters its watch page HTML schema.
- **Violation test:** Ingestion integration tests verifying successful fallback parse of a known video ID.
- **Owner:** @owner
- **Review date:** 2026-10-05
