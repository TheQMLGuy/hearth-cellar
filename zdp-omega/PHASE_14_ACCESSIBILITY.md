# PHASE 14 — ACCESSIBILITY (WCAG 2.2 A/AA/AAA)
> Accessibility is a civil-rights baseline, not a checkbox. Verify every user-facing artifact against a testable standard: **WCAG 2.2** (adopted as ISO/IEC 40500), success-criterion by success-criterion, level per SIL and jurisdiction.

**Lead standards:**
- **W3C WCAG 2.2** (86 success criteria; POUR: Perceivable · Operable · Understandable · Robust). Adopted as **ISO/IEC 40500** (WCAG 2.2 recognized ISO/IEC 40500:2025).
- **EN 301 549** — EU accessibility (references WCAG 2.x; covers software, docs, hardware).
- **US Section 508** — federal ICT (references WCAG 2.x).
- **ISO 9241-171** (accessibility of software), **ISO 9241-11** (usability definitions), **ATAG 2.0** (authoring tools), **WAI-ARIA 1.2** (roles, states, properties), **ARIA Authoring Practices Guide**.
- **ISO 30071-1** — organizational digital accessibility.
- **W3C Cognitive Accessibility Guidance** — supplemental.

**SIL depth (target level):** SIL1 → WCAG 2.2 **A** at minimum; SIL2/3 → **AA** (the practical/legal norm); SIL4 or public-sector or otherwise mandated → **AA + selected AAA** (esp. authentication, focus visibility). Where jurisdiction demands EN 301 549 / Section 508 / national law → follow that binding baseline.

**Inputs:** Phase 13 layout artifacts, TIMELINE NFR (target conformance level, jurisdictions), UI inventory.

## 14.1 MISSION
Verify every success criterion at the required level, with **manual + assistive-technology testing** (automated tools catch ~30–40% of issues; they do not certify conformance). Produce a **VPAT/ACR-ready** conformance report and a remediation queue for Phase 22.

## 14.2 FETCH & GROUND (mandatory)
1. Fetch **W3C WCAG 2.2 quick reference** (all 86 SC + techniques + failures). Load as an authoritative per-SC checklist.
2. Fetch **ARIA Authoring Practices Guide** for widget patterns actually used (menu, dialog, tabs, combobox, tree, listbox, grid).
3. If jurisdictional: fetch **EN 301 549** current version and/or **Section 508** for the mapping to WCAG.
4. Record versions in METRICS.

## 14.3 FALSIFICATION PROCEDURES — RUN AS THE RIVAL (mostly manual — automation is *insufficient*)

> **Mind: THE RIVAL.** Hostile, no benefit of the doubt, no courtesy notice. Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.1.

- **Keyboard-only run:** unplug the mouse. Complete every core flow. Focus visible at every step (2.4.7 / 2.4.11-13); no traps (2.1.2); logical order (2.4.3); reachable everything (2.1.1); skip-link works (2.4.1).
- **Screen reader run:** with one of the primary AT (a desktop AT + a mobile AT relevant to your users). Every meaningful element announces role + name + state; heading order navigable; landmarks correct; live regions announce updates without spam.
- **Zoom & spacing overrides:** browser zoom to 200% (1.4.4) and 400% reflow (1.4.10); apply WCAG 1.4.12 text-spacing overrides — no content lost/clipped.
- **Contrast sweep:** measure every text and meaningful non-text pair; check across themes and states (hover/focus/disabled).
- **Motion & sensitivity:** anything flashing checked against 2.3.1 (three-flash-or-below), animation from interactions can be disabled (2.3.3), vestibular safety respected under `prefers-reduced-motion`.
- **Cognitive load probes:** error recovery (3.3.1/3), consistent help location (3.2.6), redundant entry (3.3.7), predictable navigation (3.2.3), accessible authentication (3.3.8/9).
- **Pointer & touch:** target size ≥ 24×24 CSS px (2.5.8) or exception via spacing; single-pointer alternative to any drag operation (2.5.7); no path-based gestures required (2.5.1).
- **Time limits:** anything with a timeout has warning + extension (2.2.1); auto-updating content pauseable (2.2.2).

## 14.4 EXHAUSTIVE RULES (WCAG 2.2 principle-by-principle, non-exhaustive callouts of the sharpest edges)

### Perceivable
- **R14.1 Non-text content (1.1.1):** every meaningful image/icon has a text alternative; decorative content marked as such (empty alt / `aria-hidden`); complex images have long descriptions.
- **R14.2 Media (1.2.x):** captions on prerecorded and live video; audio description or transcript alternative where applicable at the target level; no auto-play audio.
- **R14.3 Structure & relationships (1.3.1):** headings, lists, tables, forms use **semantic elements**, not `<div>` soup; programmatic relationships match visual ones; ARIA only where semantics gap exists (**first rule of ARIA: don't use ARIA**).
- **R14.4 Meaningful sequence (1.3.2):** DOM order = reading order; CSS reorderings (grid/flex) don't create a mismatch that harms AT users.
- **R14.5 Sensory characteristics (1.3.3):** instructions never rely solely on shape/color/position ("click the round green button").
- **R14.6 Orientation (1.3.4), Identify Input Purpose (1.3.5), Identify Purpose (1.3.6 AAA):** no forced orientation; input purposes machine-identifiable (autocomplete tokens).
- **R14.7 Use of color (1.4.1):** never sole means of conveying info (ties R13.17).
- **R14.8 Audio control (1.4.2):** any audio > 3s has controls.
- **R14.9 Contrast (1.4.3 AA):** normal text ≥ **4.5:1**, large text ≥ **3:1**; **1.4.11 AA** non-text (UI components, meaningful graphics) ≥ **3:1**; enhanced (1.4.6 AAA) ≥ 7:1 / 4.5:1.
- **R14.10 Resize text (1.4.4):** 200% zoom without loss.
- **R14.11 Images of text (1.4.5):** avoid unless customizable / essential (logos ok).
- **R14.12 Reflow (1.4.10 AA):** 320 CSS px wide vertical scrolling, no 2D scrolling (ties R13.7).
- **R14.13 Text spacing (1.4.12 AA):** content survives user overrides on line-height / letter/word/paragraph spacing.
- **R14.14 Content on hover/focus (1.4.13 AA):** dismissible, hoverable, persistent.

### Operable
- **R14.15 Keyboard (2.1.1 / 2.1.3):** every function operable without keyboard shortcuts unique to a pointer; no key-only trap (2.1.2); character key shortcuts remappable/disable-able (2.1.4).
- **R14.16 Timing (2.2.1 / 2.2.2):** timeouts warn + extend; pause/stop/hide for auto-updating.
- **R14.17 Seizures (2.3.1):** no more than 3 flashes/sec above threshold; motion from interactions can be disabled (2.3.3 AAA).
- **R14.18 Navigable (2.4.1 skip / 2.4.2 titles / 2.4.3 focus order / 2.4.4 link purpose / 2.4.5 multiple ways / 2.4.6 headings/labels / 2.4.7 focus visible).**
- **R14.19 Focus Not Obscured (2.4.11 AA, 2.4.12 AAA):** sticky headers/footers/cookie banners don't fully hide the focused element (AA) — none of it hidden (AAA).
- **R14.20 Focus Appearance (2.4.13 AAA):** focus ring area ≥ 2 CSS px perimeter equivalent; ≥ 3:1 contrast against unfocused state; not just an OS default that a designer overrode invisibly.
- **R14.21 Input Modalities (2.5.x):** pointer gestures alternative (2.5.1); pointer cancellation supported (2.5.2); label in name (2.5.3); no accidental motion actuation without opt-out (2.5.4).
- **R14.22 Dragging Movements (2.5.7 AA):** every drag has a single-pointer alternative.
- **R14.23 Target Size Minimum (2.5.8 AA):** interactive targets ≥ **24×24 CSS px** or spaced so a 24-diameter circle doesn't overlap another target; enhanced (2.5.5 AAA) ≥ 44×44.

### Understandable
- **R14.24 Readable (3.1.1 language of page / 3.1.2 language of parts).**
- **R14.25 Predictable (3.2.1 on focus / 3.2.2 on input / 3.2.3 consistent navigation / 3.2.4 consistent identification / 3.2.5 change on request AAA / 3.2.6 Consistent Help AA).**
- **R14.26 Input Assistance (3.3.1 error identification / 3.3.2 labels or instructions / 3.3.3 error suggestion / 3.3.4 error prevention on legal-financial-data / 3.3.5 help / 3.3.6 error prevention all AAA).**
- **R14.27 Redundant Entry (3.3.7 AA):** don't ask users to re-enter info in the same session/process — auto-fill or offer selection of previously entered.
- **R14.28 Accessible Authentication (3.3.8 AA / 3.3.9 AAA):** no cognitive function test required for auth (transcription, puzzles); paste allowed; password managers work; passkeys/passwordless/email link/biometric offered as reasonable alternatives.

### Robust
- **R14.29 Parsing:** (2.2 removed 4.1.1 — modern parsers handle imperfect markup — but semantic validity still matters).
- **R14.30 Name, Role, Value (4.1.2):** every custom control exposes correct role, accessible name, and state to AT. Custom widgets follow the ARIA Authoring Practices patterns; roving tabindex or `aria-activedescendant` implemented correctly for composite widgets.
- **R14.31 Status Messages (4.1.3):** non-focus-stealing status updates via `role="status"` / `aria-live` at appropriate politeness.

### Beyond WCAG (fill the cognitive gaps)
- **R14.32** Plain-language pass on critical flows (Flesch-Kincaid or comparable readability index recorded); jargon defined on first use.
- **R14.33** Consistent iconography with textual labels (label absence only where universal and tested).
- **R14.34** Recognizable/undoable actions on destructive operations (crosses to 3.3.4).
- **R14.35** Documented **AT support matrix**: (screen reader × browser × OS) combinations tested with dates and results.

### Documents, media, PDF, non-web
- **R14.36** Downloadable documents (PDF, DOCX) meet the same conformance target (tagged PDFs, semantic Word) or an accessible alternative provided.
- **R14.37** Video captions accurate (not just auto-generated) for SIL3+ content; transcripts available; audio descriptions where visual info is essential.

## 14.5 EVIDENCE MODEL
Every SC gets: `SC-ID | level | applies? | verdict | evidence (test refs, AT+browser+OS combo, screenshot/recording) | notes | remediation link`. Automated tool output is *supporting* evidence, never sole evidence for a manual criterion.

## 14.6 EXIT GATE — JUDGED AS THE PRINCIPAL

> **Mind: THE PRINCIPAL.** Guilty until the evidence tier matches; no gate closes on "mostly." Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.2.

- [ ] Every applicable SC at the target level marked with verdict + evidence. **Evidence:** the completed conformance matrix.
- [ ] Keyboard-only end-to-end runs pass on all core flows. **Evidence:** recordings.
- [ ] Screen-reader runs on the AT support matrix pass on core flows. **Evidence:** recordings + notes.
- [ ] Contrast sweep clean at AA (or AAA per SIL/policy). **Evidence:** measurements.
- [ ] Reflow at 320 CSS px + 200% zoom + text-spacing override checks pass. **Evidence:** captures.
- [ ] Target size 24×24 audit clean (or exception documented). **Evidence:** measurements.
- [ ] All P0/P1 accessibility findings closed or remediation-committed with dates. **Evidence:** FND status.
- [ ] Accessibility Conformance Report (ACR/VPAT-style) drafted. **Evidence:** the draft.

## 14.7 ARTIFACTS OUT
WCAG 2.2 conformance matrix; AT support matrix; keyboard & screen-reader run recordings/notes; contrast measurements; accessibility conformance report (ACR); Phase 22 remediation queue.

> Next: `PHASE_15_FRONTEND_PERFORMANCE.md`.
