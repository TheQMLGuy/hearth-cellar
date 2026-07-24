# TRACE MATRIX
> Every requirement → design → code → test → evidence. Bidirectional: from a file, find its requirements.

## REQ → CODE + TEST
| REQ ID | Design ref (ADR/view) | Code refs | Test refs | Evidence tier | Status |
|---|---|---|---|---|---|
| REQ-0001 | — | app/src/components/Courses.tsx | — | — | UNKNOWN |
| REQ-0002 | — | app/src/lib/partitioning.ts | — | — | UNKNOWN |
| REQ-0003 | — | app/src/components/Wishlist.tsx | — | — | UNKNOWN |
| REQ-0004 | — | app/src/lib/rotation.ts, app/src/lib/categories.ts | — | — | UNKNOWN |
| REQ-0005 | — | app/src-tauri/src/remarkable.rs, app/src/components/NoteStudyView.tsx | — | — | UNKNOWN |
| REQ-0006 | — | app/src/components/Player.tsx | — | — | UNKNOWN |
| CON-0001 | — | app/src-tauri/tauri.conf.json | — | — | UNKNOWN |
| CON-0002 | — | app/src/types.ts | — | — | UNKNOWN |
| CON-0003 | — | app/src/types.ts | — | — | UNKNOWN |
| CON-0004 | — | app/package.json, app/src-tauri/Cargo.toml | — | — | UNKNOWN |
| CON-0005 | — | app/src-tauri/src/lib.rs, app/src/components/IngestPanel.tsx, app/src/lib/rotation.ts | — | — | ACTIVE |
| REQ-0007 | — | app/src/App.tsx, app/src/lib/rotation.ts, app/src/components/Settings.tsx, app/src/types.ts, app/src/storeClient.ts | — | — | ACTIVE |
| NFR-0001 | — | app/src/styles.css | — | — | UNKNOWN |

## CODE → REQ  (reverse index)
| Path | Serves REQ/INV | Notes |
|---|---|---|
| app/src-tauri/src/lib.rs | CON-0005, REQ-0002, REQ-0004 | — |
| app/src/components/IngestPanel.tsx | CON-0005 | — |
| app/src/components/Courses.tsx | REQ-0001 | — |
| app/src/components/Wishlist.tsx | REQ-0003 | — |
| app/src/components/Player.tsx | REQ-0006 | — |
| app/src-tauri/src/remarkable.rs | REQ-0005 | — |
| app/src/App.tsx | REQ-0007 | — |
| app/src/lib/rotation.ts | REQ-0004, REQ-0007, CON-0005 | — |
| app/src/components/Settings.tsx | REQ-0007 | — |
| app/src/types.ts | CON-0002, CON-0003, REQ-0007 | — |
| app/src/storeClient.ts | REQ-0007 | — |
