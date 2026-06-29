# Hearth & Cellar

A desktop app for people who like YouTube's depth but resent its grip.

The algorithm is good at exploration and terrible at restraint. Hearth & Cellar is a deliberate, time-boxed counter: a curated daily ritual where you pick the videos, the app picks the rhythm, and nothing autoplays you into an hour you didn't plan to spend.

Built with Tauri + React + Rust. Windows-first. MIT licensed.

---

## What it does

- **Daily time budget per category** — not a never-ending queue. You set how many minutes/day Curiosity / Reflective / Craft (or whatever categories you make) gets. The packer fills only that.
- **Long videos auto-split across days** — using the video's own chapters when present, even slices otherwise. A 2-hour talk becomes four ~30-minute parts on four days.
- **Sticky day plan** — finishing a video doesn't summon a new one. Today's list is locked at sunrise; tomorrow brings the next picks.
- **Shorts rejected at ingest** — URL pattern + duration ≤60s + a one-time quarantine sweep for anything that slipped in.
- **Channel harvest on Sunday** — channels you follow accumulate weekly uploads into a flat Sunday view, instead of pinging you every day.
- **Courses kanban** — playlists organized by category (Learning / Building / Creative / your own), drag-drop between columns.
- **Wishlist** — a parking lot for "would like to watch eventually" outside the daily rotation. One-click promote to loop.
- **reMarkable Cloud integration** — attach a note from your reMarkable tablet to any video. Watched videos with attached notes appear in a Notes view for return-watching with the page you wrote alongside.
- **Per-video resume** — closes mid-video, reopens at the second you left.
- **Single binary** — Tauri-bundled, no Electron weight.

---

## Install

Download the latest `Hearth & Cellar_*_x64-setup.exe` from [Releases](https://github.com/theqmlguy/hearth-cellar/releases) and run it. Windows may warn about an unsigned installer — choose "More info" → "Run anyway".

---

## Build from source

Requires Node 20+, Rust stable with the Windows MSVC or MinGW toolchain, and `npm`.

```bash
git clone https://github.com/theqmlguy/hearth-cellar.git
cd hearth-cellar/app
npm install
npm run tauri:build
```

The bundled `.exe` and NSIS installer land under `src-tauri/target/release/` (or wherever your `CARGO_TARGET_DIR` points). For dev with hot-reload: `npm run tauri:dev`.

**Note for mingw users:** if your project path contains spaces, set `CARGO_TARGET_DIR` to a no-spaces path (e.g. `$env:LOCALAPPDATA\Temp\hc-target`) before building — `dlltool.exe` can't handle quoted paths.

---

## Tech stack

- **Tauri 2** — desktop shell, IPC, system integration
- **React 18 + TypeScript + Vite** — renderer
- **Rust** (ureq, rfd, regex) — backend HTTP, native file picker, YouTube metadata parsing
- **YouTube IFrame Player API** — embed + state events
- **YouTube Data API v3** (optional) — for chapters + duration metadata; falls back to oEmbed + watch-page scrape

---

## License

[MIT](./LICENSE) — copy, modify, distribute, including commercially. Keep the notice.
