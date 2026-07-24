# PHASE 13 — FRONTEND LAYOUT & VISUAL INTEGRITY
> "It works on my machine" is not a layout guarantee. Grids that don't drift, spacing on a scale, type on a scale, states covered, and every breakpoint/RTL/dark-mode/i18n edge tested. **This is the layout phase — accessibility gets its own phase (14).**

**Lead standards:**
- **ISO 9241-112** — presentation of information (organization: legible, understandable, consistent, discriminable).
- **ISO 9241-125** — visual presentation of information (recommendations for typography, spacing, layout, viewing).
- **ISO 9241-110** — interaction principles (suitability for the task, self-descriptiveness, conformity with expectations, learnability, controllability, user-error tolerance, self-descriptiveness of state, individualization).
- **ISO 9241-161** — guidance on visual UI elements.
- **W3C i18n** guidance and **Unicode UAX #9** (bidi) — RTL & bidirectional text correctness.
- **Design-system practice** — tokens, primitives, states as a first-class artifact.

**SIL depth:** every user-facing route in scope; commerce/auth/high-consequence flows get expanded state coverage. **Inputs:** TIMELINE NFRs (supported viewports/locales/themes), design system if any, Phase 01 UI inventory.

## 13.1 MISSION
Prove the UI renders as designed across every supported viewport, orientation, density, theme, locale, direction, input mode, and content-length extreme; that spacing/typography/color come from a coherent token system; and that every interactive component has all its states designed, implemented, and regression-guarded.

## 13.2 FETCH & GROUND
Fetch: WCAG 2.2 (bounds like reflow 320 CSS px, text spacing overrides — for cross-check with P14), ISO 9241-125 principles, W3C i18n bidi + text-fitting, current viewport spec + safe-area guidance. Record versions.

## 13.3 FALSIFICATION PROCEDURES — RUN AS THE RIVAL

> **Mind: THE RIVAL.** Hostile, no benefit of the doubt, no courtesy notice. Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.1.

- **Viewport gauntlet:** render every page at every declared breakpoint × orientation × density × zoom (100%/200%/400%) × text-spacing overrides (WCAG 1.4.12) × reduced-motion × forced-colors × dark/light. Anywhere content clips, overlaps, disappears, or requires 2D scrolling below 320 CSS px width = finding.
- **Content-stress test:** replace every string with (a) empty, (b) 200-char worst-case, (c) a Turkish/German/Thai/Japanese/Arabic sample of realistic length, (d) numeric extremes (long currency: "1 234 567 890,00 zł"), (e) emoji + combining marks. Truncations must be graceful and reversible (tooltip / expand).
- **State enumeration:** for every interactive component list: default, hover, focus, focus-visible, active, disabled, loading, error, success, empty (no data), long-content, skeleton, offline, degraded. Every missing state = finding.
- **RTL flip:** render locales in RTL; icons that carry direction (arrows, chevrons, progress) mirror correctly; bidi text with mixed scripts renders without visual salad; logical properties used everywhere directional.
- **Token drift hunt:** grep the codebase for raw hex colors, raw pixel values on spacing/typography, hardcoded font families — every literal is a bypass of the design system.
- **Overflow attacks:** long single-word URLs, `word-break` cases, small containers, huge images; test all.

## 13.4 EXHAUSTIVE RULES

### Design-system integrity (tokens over literals)
- **R13.1 Token discipline:** color, spacing, radius, elevation/shadow, typography (family, size, weight, line-height, tracking), motion (duration, easing), and z-index all come from a **named token set**. Raw literals in components = P2/P3 findings (P2 if it breaks theme/RTL, P3 otherwise).
- **R13.2 Scale coherence:** spacing on a documented scale (e.g., 4/8-px baseline); typography on a modular scale; no orphan values ("22px because it looked right").
- **R13.3 Semantic tokens layer:** components consume *semantic* tokens (`color.surface.default`, `space.card-gap`), not *primitive* tokens (`gray.700`) directly, so themes can vary without component edits.
- **R13.4 Component contracts** (design-side): every component has documented props, allowed slot content, size/variant/state matrix, and forbidden usages. Undocumented components on any user route = finding.

### Layout & responsiveness
- **R13.5 Grid & rhythm:** page uses a defined layout grid (columns/gutters/margins) per breakpoint; vertical rhythm from the type scale; no ad-hoc margin stacks that collapse unpredictably.
- **R13.6 Breakpoint policy** documented; components declare which breakpoints they were designed for; content adapts, not just shrinks (reflow, not just scale).
- **R13.7 Reflow (crosses to P14/1.4.10):** content usable at 320 CSS px wide without 2D scrolling for vertical-scrolling content (and 256 px high for horizontal). Fixed layouts at small viewports = P1.
- **R13.8 Safe-area & viewport insets** respected on notched/floating-UI devices; nothing critical under system chrome.
- **R13.9 Overflow discipline:** every scroll region is intentional and reachable by keyboard (crosses to P14); no accidental horizontal scrollbars; ellipsis truncation always has a reveal path.
- **R13.10 Aspect-ratio integrity:** media reserves space (`aspect-ratio` or explicit dimensions) so layout doesn't jump on load (crosses to P15 CLS).

### Typography
- **R13.11 Type stack:** documented families with tested fallbacks + metric-adjusted `size-adjust`/`ascent-override` where fallback swap is visible (mitigates layout shift).
- **R13.12 Sizing & readability:** measure ~45–75 characters/line for body; line-height ≥ 1.4 for body; heading hierarchy semantic and visual match; body sizes readable on the target device class.
- **R13.13 Fluid typography** (if used) has floor/ceiling clamps; user zoom to 200% still usable (WCAG 1.4.4 — verified in P14).
- **R13.14 Numerals + tabular data:** use tabular-figures where columns of numbers align; date/number formatting locale-aware (ties R06.16/R06.21).

### Color, contrast & theming
- **R13.15 Contrast** (checked in depth in P14; here we check *systemic*): the token palette is built with contrast pairs known to pass; components never combine tokens outside declared pairings.
- **R13.16 Dark mode & forced-colors:** each theme designed, not auto-derived by inversion. `prefers-color-scheme` and `forced-colors` (Windows High Contrast / OS forced) respected; no critical info conveyed only by color (crosses to P14).
- **R13.17 Never color-alone signaling:** state (error, success, required) uses shape/text/icon *and* color.

### Motion
- **R13.18 Motion budget:** durations from tokens; purpose-driven; obeys `prefers-reduced-motion` at the primitive level (feature, not opt-in per component).
- **R13.19 No motion-only signaling** (blink-to-mean-error): still content conveys the message.

### Internationalization & bidi
- **R13.20 Logical properties/values** for anything directional (`margin-inline-start`, `text-align: start`, `padding-block`) — no hard `left/right` in layout code.
- **R13.21 Bidi correctness:** mixed-script strings render per UAX #9; icons that indicate direction mirror in RTL; number/date formatting locale-aware; sort orders BCP 47 locale-aware where user-facing.
- **R13.22 Text expansion:** UI accommodates ~+35% string length without breaking layout in the longest supported locale.
- **R13.23 Font coverage:** fonts include glyphs for all supported locales, or fallbacks are aesthetically acceptable and tested.

### Component-state completeness
- **R13.24** Every interactive component ships **all** states from the enumeration list (13.3 §"State enumeration"); each state has a design ref (design-system doc) and a code implementation, gated by visual regression tests in P23.
- **R13.25** Forms: labels always visible (not placeholder-only); required/optional indicated; errors specific, inline, and screen-reader-linked (accessibility depth in P14).
- **R13.26** Data tables: headers, alignment (numeric right / text start), sort/filter state visible, empty & loading states designed.
- **R13.27** Media: images have intrinsic dimensions and alt strategy; video has poster + controls; loading states never jitter layout.

### Content & error UX
- **R13.28** Empty states carry meaning + next action; error states include what happened, why (safely), and what to do.
- **R13.29** Skeletons/spinners chosen intentionally per perceived-latency threshold; unbounded spinners banned — after N seconds, degrade to a message + retry.
- **R13.30** Toast/notification patterns don't cover focused controls (crosses to P14 focus-not-obscured).

### Visual regression protection
- **R13.31** A visual regression suite (screenshot / DOM snapshot / component gallery) covers the critical screens × the breakpoints × themes × directions. Deltas require review; auto-approve is banned on SIL3/4 flows. Wired into CI in P23.

## 13.5 EXIT GATE — JUDGED AS THE PRINCIPAL

> **Mind: THE PRINCIPAL.** Guilty until the evidence tier matches; no gate closes on "mostly." Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.2.

- [ ] Design-token drift scan clean (no raw literals in components). **Evidence:** grep + counts.
- [ ] Viewport gauntlet passes for all pages (screenshots stored). **Evidence:** gallery.
- [ ] Content-stress test passes (empty / long / i18n / RTL / emoji). **Evidence:** stress-test gallery.
- [ ] State-matrix complete per interactive component. **Evidence:** matrix.
- [ ] Reflow at 320 CSS px verified across pages. **Evidence:** capture set.
- [ ] Theme + forced-colors + reduced-motion honored. **Evidence:** captures.
- [ ] Logical-properties audit clean. **Evidence:** grep for `left|right` in layout scope.
- [ ] Visual regression suite in place with baseline. **Evidence:** suite + baseline hashes.

## 13.6 ARTIFACTS OUT
Design-token inventory; component state matrix; viewport/i18n/theme gallery; visual regression baseline; layout findings.

> Next: `PHASE_14_ACCESSIBILITY.md`.
