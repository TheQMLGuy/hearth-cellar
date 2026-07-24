# DECISIONS (ADRs)

## INDEX
| ID | Title | Status | Date | Supersedes |
|---|---|---|---|---|
| ADR-0001 | Tauri 2 Migration | ACCEPTED | 2026-07-05 | — |

## ADR-0001  Tauri 2 Migration
- **Status:** ACCEPTED
- **Date:** 2026-07-05
- **Context:** The application was originally designed with Electron (v1 design), but has been migrated to Tauri 2 for low resource utilization and a lightweight binary.
- **Options considered:**
  - Electron
  - Tauri 2
- **Decision:** Tauri 2.
- **Consequences:** Low-level integration resides in Rust backend. System utilizes Rust core logic instead of Node.js.
- **Traces:** CON-0001.
