# Hearth & Cellar

A dedicated desktop dashboard for people who appreciate YouTube's depth but resent its attention-grabbing design.

The algorithmic feed is engineered for exploration but lacks restraint. Autoplay, endless scroll, and recommendation loops are designed to pull you from one video to the next. **Hearth & Cellar** is a deliberate, time-boxed counter: a curated daily ritual where you decide what to study, the app dictates the pacing, and you are never autoplayed into content you didn't plan to watch.

Built with Tauri + React + Rust. Windows-first. MIT licensed.

---

## 📖 The Philosophy: Restoring Retrospective Value

The modern web is built on the *attention economy*, where value is measured in daily active minutes. This optimization favors low-friction, high-arousal exploration over focused, retrospective study. 

Hearth & Cellar turns video consumption into a structured, analog-feeling ritual:
1. **Explore in the Cellar, study at the Hearth**: Add channels, queues, and playlists to your wishlist. Let them settle.
2. **Strict Time Budgeting**: You don't clear an endless list of videos; instead, you allocate minutes per category. When the daily container is filled, you are done.
3. **Partitioned Deep Dives**: A 3-hour long-form lecture shouldn't take over your day or get abandoned. Hearth & Cellar slices it into manageable 45-minute daily parts based on video transcripts or chapters.
4. **Active Reflection**: With direct reMarkable cloud integration, notes you write on your tablet are paired to specific videos, creating a library of annotated study sessions.

---

## ⚡ Core Features

- **Horizontal Courses Kanban Board** — Import entire playlists or single long videos. Organize them across columns like **Learning**, **Building**, and **Creative** (with support for custom categories, renaming, and recoloring). Easily drag and drop cards to change course priorities or assign categories.
- **Transcript-Based Part Segmentation** — Synthetic courses (built from single long videos) automatically fetch English transcripts or ASR captions to divide and label each 45-minute segment based on the context of the spoken words.
- **Merged Wishlist (No More Vault)** — A single unified parking lot for keeping videos. Mark a video in your loop with the heart symbol to move it straight to your Wishlist (removing it from the active daily rotation), keeping it stored safely. Promote it back to the loop with one click when you're ready.
- **Category Quotas (Weekday vs Catch-up Sunday)** — Assign category-specific time budgets (e.g. *30m Curiosity, 20m Reflective, 10m Craft*). Sunday acts as a flat catch-up day for channels, pulling weekly uploads into a single, clean Sunday list.
- **reMarkable Cloud Integration** — Attach handwritten note files directly to study playlists. Watch history paired with notes surfaces in a side-by-side split screen so you can review your annotations alongside the video.
- **Zero Distractions & Auto-Resume** — No sidebar comments, no recommendations, and no auto-playing next videos. Closed mid-video? The player automatically resumes to the exact second you left.
- **Super-Lightweight Single Binary** — Packaged with Tauri, running on a Rust core backend, requiring minimal memory compared to standard Chrome tab groups or heavy Electron apps.

---

## 📦 Downloads & Releases

Pre-compiled, ready-to-run setup installers and binaries are available in the **[Releases](https://github.com/theqmlguy/hearth-cellar/releases)** page:

* **[Hearth & Cellar Setup 2.2.0.exe](https://github.com/theqmlguy/hearth-cellar/releases/download/v2.2.0/Hearth.Cellar.Setup.2.2.0.exe)** — The recommended standard Windows installer.
* **[Hearth.Cellar.Portable.zip](https://github.com/theqmlguy/hearth-cellar/releases/download/v2.2.0/Hearth.Cellar.Portable.zip)** — A portable folder with the standalone binary, ready to run without installation.

*Note: Windows may flag the installer as unsigned. Choose **"More info"** and click **"Run anyway"** to proceed.*

---

## 🛠️ Building From Source

### Prerequisites
- [Node.js 20+](https://nodejs.org)
- [Rust & Cargo](https://rustup.rs) (MSVC toolchain on Windows)
- `npm` or `yarn`

### Setup and Compilation
1. Clone the repository:
   ```bash
   git clone https://github.com/theqmlguy/hearth-cellar.git
   cd hearth-cellar/app
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server (with hot reload):
   ```bash
   npm run tauri:dev
   ```
4. Build the production executable:
   ```bash
   npm run tauri:build
   ```
   The compiled `.exe` and NSIS setup installer will be generated in `src-tauri/target/release/` (or your defined `CARGO_TARGET_DIR`).

---

## ⚙️ Technology Stack

- **Tauri 2** — Backend shell, native window management, local system integration, and IPC bridge.
- **React 18 + Vite + TypeScript** — Elegant, fast user interface rendering.
- **Rust backend** — Low-level networking (via `ureq`), file selection interfaces (`rfd`), XML regex parser for transcripts, and YouTube metadata extraction.
- **YouTube IFrame Player API** — Clean embeds with state-event listeners for duration-tracking and pausing.
- **YouTube Data API v3** — Fast retrieval of playlists, videos, channels, and chapters (with automatic fallback to HTML watch-page scraping if no key is provided).

---

## 📄 License

Licensed under the [MIT License](./LICENSE) — free to copy, modify, distribute, or bundle commercially. Please preserve the copyright notice.
