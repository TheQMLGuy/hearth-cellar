# TIMELINE — Requirements Ledger
> Append-only. Chronologically ordered. Every code change traces to an ID here.
> To change a requirement: append a new entry that `Supersedes:` the old one; mark the old `Status: SUPERSEDED`. **Never edit past entries' meaning.**

## INDEX
| ID | Kind | Title | Status | SIL | Owner | Superseded-by |
|---|---|---|---|---|---|---|
| REQ-0001 | REQ | Horizontal Courses Kanban Board | ACTIVE | SIL3 | @owner | — |
| REQ-0002 | REQ | Transcript-Based Part Segmentation | ACTIVE | SIL3 | @owner | — |
| REQ-0003 | REQ | Merged Wishlist (No More Vault) | ACTIVE | SIL3 | @owner | — |
| REQ-0004 | REQ | Category Quotas (Weekday vs Catch-up Sunday) | ACTIVE | SIL3 | @owner | — |
| REQ-0005 | REQ | reMarkable Cloud Integration | ACTIVE | SIL3 | @owner | — |
| REQ-0006 | REQ | Zero Distractions YouTube Player & Auto-Resume | ACTIVE | SIL3 | @owner | — |
| REQ-0007 | REQ | Delayed Loops Fallback | ACTIVE | SIL3 | @owner | — |
| REQ-0008 | REQ | YouTube Show URLs Support | ACTIVE | SIL3 | @owner | — |
| REQ-0009 | REQ | App Suggestions Section in Settings | ACTIVE | SIL2 | @owner | — |
| REQ-0010 | REQ | Category Day Restrictions & Non-Overlapping Rotation | PROPOSED | SIL3 | @owner | — |
| CON-0001 | CON | Windows-First Tauri Binary | ACTIVE | SIL3 | @owner | — |
| CON-0002 | CON | Video duration stored as seconds | ACTIVE | SIL3 | @owner | — |
| CON-0003 | CON | Category budgets stored as minutes | ACTIVE | SIL3 | @owner | — |
| CON-0004 | CON | UTF-8 default encoding | ACTIVE | SIL2 | @owner | — |
| CON-0005 | CON | YouTube Shorts quarantine threshold of 3 minutes | ACTIVE | SIL3 | @owner | — |
| NFR-0001 | NFR | Attention-Free Clean Interface | ACTIVE | SIL2 | @owner | — |

---

## ENTRIES

### REQ-0001
- **Kind:** REQ
- **Timestamp (created):** 2026-07-05T22:00:00Z
- **Status:** ACTIVE
- **SIL:** SIL3
- **Owner:** @owner
- **Source:** README.md
- **Statement:** The system SHALL display courses on a horizontal Kanban board across columns like Learning, Building, and Creative, supporting custom categories, renaming, recoloring, and prioritizing via drag-and-drop cards.
- **Rationale:** Structured visual organization of playlists and study videos.
- **Acceptance criteria:**
  1. User can import playlists or videos as Course cards.
  2. Cards can be dragged and dropped between columns.
  3. Columns support renaming and color customization.

### REQ-0002
- **Kind:** REQ
- **Timestamp (created):** 2026-07-05T22:01:00Z
- **Status:** ACTIVE
- **SIL:** SIL3
- **Owner:** @owner
- **Source:** README.md
- **Statement:** The system SHALL divide synthetic courses (built from single long videos) into 45-minute parts based on English transcripts or ASR captions context.
- **Rationale:** Breakdown of long lectures into manageable study parts.
- **Acceptance criteria:**
  1. Long videos fetch XML/text transcripts.
  2. Slices video into target durations (defaults to 45 mins).
  3. Uses captions context to create part labels.

### REQ-0003
- **Kind:** REQ
- **Timestamp (created):** 2026-07-05T22:02:00Z
- **Status:** ACTIVE
- **SIL:** SIL3
- **Owner:** @owner
- **Source:** README.md
- **Statement:** The system SHALL provide a unified Wishlist parking lot for keeping videos parked outside of the daily loop.
- **Rationale:** Replaces separate Vault and allows users to defer content.
- **Acceptance criteria:**
  1. Click heart symbol on video to park it in Wishlist.
  2. Removing a video from rotation places it in Wishlist.
  3. Promote video back to loop with one click from Wishlist.

### REQ-0004
- **Kind:** REQ
- **Timestamp (created):** 2026-07-05T22:03:00Z
- **Status:** ACTIVE
- **SIL:** SIL3
- **Owner:** @owner
- **Source:** README.md
- **Statement:** The system SHALL enforce category-specific daily minutes budgets on weekdays and aggregate channel uploads on Sunday.
- **Rationale:** Strict time budgeting to limit screen time and bundle channel feed reviews.
- **Acceptance criteria:**
  1. Weekday Today plan respects category budgets.
  2. Sunday rolls weekly uploads into a single Sunday Catch-up list.

### REQ-0005
- **Kind:** REQ
- **Timestamp (created):** 2026-07-05T22:04:00Z
- **Status:** ACTIVE
- **SIL:** SIL3
- **Owner:** @owner
- **Source:** README.md
- **Statement:** The system SHALL integrate with the reMarkable cloud to sync handwritten notes and display them side-by-side with watch history.
- **Rationale:** Pairing review annotations with study videos.
- **Acceptance criteria:**
  1. Connect/pair reMarkable cloud tokens.
  2. Open paired notes in split screen adjacent to the video player.

### REQ-0006
- **Kind:** REQ
- **Timestamp (created):** 2026-07-05T22:05:00Z
- **Status:** ACTIVE
- **SIL:** SIL3
- **Owner:** @owner
- **Source:** README.md
- **Statement:** The system SHALL embed the YouTube player without comments, recommendations, or autoplay, and auto-resume video playback from the exact second left off.
- **Rationale:** Attention-free viewing with persistent progress tracking.
- **Acceptance criteria:**
  1. Embed player using no-cookie or standard embed with related videos disabled (`rel=0`).
  2. Persist current video position and resume on reload.

### CON-0001
- **Kind:** CON
- **Timestamp (created):** 2026-07-05T22:06:00Z
- **Status:** ACTIVE
- **SIL:** SIL3
- **Owner:** @owner
- **Statement:** System SHALL be compiled as a single native Windows application utilizing Tauri 2 + React + Rust stack.
- **Rationale:** Desktop focus with low memory footprint.

### CON-0002
- **Kind:** CON
- **Timestamp (created):** 2026-07-05T22:07:00Z
- **Status:** ACTIVE
- **SIL:** SIL3
- **Owner:** @owner
- **Statement:** All video durations and playback positions SHALL be represented and stored as integer seconds.
- **Rationale:** Consistency in duration math.

### CON-0003
- **Kind:** CON
- **Timestamp (created):** 2026-07-05T22:08:00Z
- **Status:** ACTIVE
- **SIL:** SIL3
- **Owner:** @owner
- **Statement:** Category daily quotas SHALL be represented and stored in minutes.
- **Rationale:** Human-readable configuration representation.

### CON-0004
- **Kind:** CON
- **Timestamp (created):** 2026-07-05T22:09:00Z
- **Status:** ACTIVE
- **SIL:** SIL2
- **Owner:** @owner
- **Statement:** All read/write file streams and API payloads SHALL be encoded in UTF-8.
- **Rationale:** Standardized character encoding.

### CON-0005
- **Kind:** CON
- **Timestamp (created):** 2026-07-05T22:10:00Z
- **Status:** ACTIVE
- **SIL:** SIL3
- **Owner:** @owner
- **Source:** User Request 2026-07-05
- **Statement:** Any YouTube video with a duration ≤ 180 seconds (3 minutes), OR containing the `#shorts` hashtag (or variant) in the title, OR using a `/shorts/` URL path, SHALL be identified as a YouTube Short and quarantined/skipped.
- **Rationale:** YouTube increased the Shorts duration limit to 3 minutes in late 2024. The app must filter out these videos to keep them from entering the study loop.
- **Acceptance criteria:**
  1. Videos with duration ≤ 180 seconds are marked as Shorts.
  2. Videos with `#shorts` in title or `/shorts/` in URL path are marked as Shorts.
  3. Normal videos > 180 seconds are not marked as Shorts.

### NFR-0001
- **Kind:** NFR
- **Timestamp (created):** 2026-07-05T22:11:00Z
- **Status:** ACTIVE
- **SIL:** SIL2
- **Owner:** @owner
- **Statement:** The UI must maintain a clean, distraction-free aesthetic with no recommendation sidebars, autoplay loops, or attention-grabbing feeds.
- **Rationale:** Promotes focused study and intentionality.

### REQ-0007
- **Kind:** REQ
- **Timestamp (created):** 2026-07-06T22:45:00Z
- **Status:** ACTIVE
- **SIL:** SIL3
- **Owner:** @owner
- **Source:** User Request 2026-07-06
- **Statement:** The system SHALL move unwatched/partially watched videos from Today's plan (`todayPlan`) to a delayed loop (`delayedLoop`) on day-rollover. The planner SHALL draw from the main `loop` first for each category, and fallback to `delayedLoop` only if `loop` is empty for that category.
- **Rationale:** Prevents the feeling of lagging behind when missing daily video schedules.
- **Acceptance criteria:**
  1. Day rollover moves unwatched scheduled videos from `loop` to `delayedLoop`.
  2. Next day's plan displays fresh content from `loop` if available.
  3. Falls back to `delayedLoop` for category draw if and only if main `loop` has no items for that category.

### REQ-0008
- **Kind:** REQ
- **Timestamp (created):** 2026-07-14T23:15:00Z
- **Status:** ACTIVE
- **SIL:** SIL3
- **Owner:** @owner
- **Source:** User Request 2026-07-14
- **Statement:** The system SHALL support ingesting YouTube Show URLs (containing `/show/` path segment) as courses, and SHALL clean/strip any `VL` prefix from playlist IDs (e.g. converting `VLPL...` to `PL...`) to ensure compatibility with YouTube scraping and Data API v3 endpoints.
- **Rationale:** Allow importing show series that are represented as YouTube shows/playlists.
- **Acceptance criteria:**
  1. Parsing `https://www.youtube.com/show/VLPLUl4u3cNGP60V7HxLYRaJMbFzP77bzEjb` returns `{ kind: 'playlist', id: 'PLUl4u3cNGP60V7HxLYRaJMbFzP77bzEjb' }`.
  2. Any playlist ID starting with `VL` followed by a standard playlist prefix (like `PL`) has the `VL` prefix removed.
  3. Non-show URLs are unaffected.

### REQ-0009
- **Kind:** REQ
- **Timestamp (created):** 2026-07-14T23:16:00Z
- **Status:** ACTIVE
- **SIL:** SIL2
- **Owner:** @owner
- **Source:** User Request 2026-07-14
- **Statement:** The system SHALL provide an App Suggestions text area in Settings (under a new "Suggestions" tab) that persists to the store (`config.json`) as `appSuggestions`. The agent's boot instructions SHALL direct the AI to read this field and prioritize suggestions found within it.
- **Rationale:** Enables direct communication of feature ideas and feedback from the user to the coding assistant.
- **Acceptance criteria:**
  1. A "Suggestions" tab is visible in Settings.
  2. User can enter and save their ideas/feedback.
  3. The text is saved under `appSuggestions` in `config.json`.
  4. The AI boot loader contains a directive to check and retrieve these suggestions.

### REQ-0010
- **Kind:** REQ
- **Timestamp (created):** 2026-07-14T23:35:00Z
- **Status:** PROPOSED
- **SIL:** SIL3
- **Owner:** @owner
- **Source:** User Request 2026-07-14
- **Statement:** The system SHALL filter out categories that are not allowed on the current day of the week (based on their `days` property) during day plan calculation and category of the day selection. The round-robin rotation of categories of the day SHALL use a non-overlapping index stride (e.g. `(dayNum * targetLimit + i) % N`) to avoid consecutive-day overlaps.
- **Rationale:** Ensures user-configured daily category constraints are respected and provides a diverse rotation of categories of the day.
- **Acceptance criteria:**
  1. Categories not allowed today (e.g. weekend-only categories on weekdays) are not scheduled or shown as active categories of the day.
  2. If the user deletes a category or a category is disabled, stale category IDs in `todayPlan.activeCategoryIds` are filtered out.
  3. The active categories of the day rotate with zero or minimal consecutive-day overlaps.
