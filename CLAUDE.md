# Hearth & Cellar — ZDP-Ω Guidelines

This repository follows the **Zero-Defect Protocol Omega (ZDP-Ω)**. 
To continue, you MUST immediately read and follow the boot sequence in the bootloader:

👉 **[ZDP-Ω Bootloader File](file:///c:/Github%20Repos/MyMedia/hearth-cellar-project/audit/AGENT_BOOT.md)** 👈

## Core Directives
1. **Ledger over memory**: The ledgers in `/audit/` are the single source of truth.
2. **Evidence or it didn't happen**: Do not pass any check without verifying and recording concrete evidence.
3. **No unmapped edits**: Every code change must cite a `REQ-*` or `FND-*` ID from `TIMELINE.md`.
