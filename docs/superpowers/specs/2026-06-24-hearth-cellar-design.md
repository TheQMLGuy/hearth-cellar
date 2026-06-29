# Hearth & Cellar — v1 Design

**Date:** 2026-06-24
**Status:** Approved by user; user delegated remaining decisions and waived the spec-review gate so implementation can proceed in the same turn.

## What

A curated YouTube viewing desktop app, packaged as a Windows installer. Recreates the Claude Design prototype at `project/Hearth & Cellar.dc.html` in a real Electron + React + TypeScript stack.

## Stack

- **Shell:** Electron 32, frameless window (we draw our own titlebar to match the design)
- **UI:** React 18 + TypeScript + Vite 5
- **Persistence:** `electron-store` v8 → JSON at `%APPDATA%\hearth-cellar\config.json`
- **YouTube:** `youtube-nocookie.com/embed/<id>` iframe; no API key
- **Packaging:** `electron-builder` → per-user NSIS installer with desktop shortcut

## v1 Scope (the slice that ships)

Screens:
1. **Today** — `Sanctuary` view from design. Day's rotation as cards. Click → Player.
2. **Player** — youtube-nocookie iframe with the design's chrome (back, title, creator, Done button).
3. **Ingest** — slide-down bar (Ctrl+I or +). URL + Title + Creator + category chips. Required fields enforce a usable Today card from day one.
4. **WKDY / SUN toggle** — auto-selects based on day of week, user can flip.

Stubbed as "Coming soon" placeholder cards: Courses, CourseFocus, Vault, Settings (the chrome shows them so the app feels complete).

## Data model

Single JSON store:
```ts
type Mode = 'WKDY' | 'SUN'
type Category = 'curiosity' | 'reflective' | 'craft'

interface LoopItem {
  id: string; url: string; videoId: string;
  title: string; creator: string;
  duration: string; category: Category;
  addedAt: string; paras: string[];
}
interface DayPlan { date: string; mode: Mode; itemIds: string[] }
interface Store {
  schemaVersion: 1; mode: Mode;
  loop: LoopItem[]; todayPlan: DayPlan | null;
}
```

## Behavior

- **First launch:** seeded with the design's placeholder items (Japanese joinery, sourdough, foraging, wabi-sabi etc.) so it feels alive.
- **Today rotation:** up to 5 items pulled from the loop pool, deterministically shuffled per day. Cached as `todayPlan` so re-opens mid-day show the same slate; recomputes on date or mode change.
- **Ingest:** Save disabled until URL + Title + Creator are filled. URL must parse as a YouTube video or playlist via `parseYouTubeUrl()`.
- **Player:** iframe with `?rel=0&modestbranding=1&iv_load_policy=3&playsinline=1`; Esc or Done returns to Today.
- **Window controls:** the design's 3 macOS-style dots are wired to close/minimize/maximize since the window is frameless.

## Layout

```
app/
  package.json, tsconfig.json, tsconfig.electron.json
  vite.config.ts, electron-builder.yml, index.html
  electron/
    main.ts, preload.ts
  src/
    main.tsx, App.tsx, types.ts, seed.ts, storeClient.ts, styles.css
    lib/
      youtube.ts, rotation.ts, ids.ts, categories.ts
    components/
      Titlebar.tsx, Today.tsx, Player.tsx, IngestPanel.tsx, ComingSoon.tsx
```

## Out of scope for v1 (v2 candidates)

- YouTube Data API (channel auto-fetch, video metadata, duration lookup)
- Courses / CourseFocus / Vault / Settings (real implementations)
- IFrame Player API (programmatic play/pause, real end-of-video detection)
- Playlist playback inside Player
- Watched-state tracking
- Code signing
