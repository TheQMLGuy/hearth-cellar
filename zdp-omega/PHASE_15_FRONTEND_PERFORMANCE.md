# PHASE 15 — FRONTEND PERFORMANCE
> The user's perception is the truth. Optimize for what humans feel — measured at the 75th percentile from real users, on the devices they actually use.

**Lead standards:**
- **W3C Web Performance WG** specs: HR Time, Performance Timeline, Navigation Timing, Resource Timing, Paint Timing, Element Timing, Long Tasks, Event Timing, Layout Instability, User Timing.
- **Google Core Web Vitals** (industry-consensus targets): **LCP · INP · CLS** — thresholds and methodology.
- **ISO/IEC 25010:2023** — performance efficiency (time behavior, resource utilization, capacity).
- **ISO/IEC 25023** — measurement of performance characteristics.
- **RUM + Lab** methodology (field vs synthetic).

**SIL depth:** SIL2+ user-facing routes have measured field metrics + regression gates; SIL3/4 have per-release perf budgets and error-budget-style ratchets. **Inputs:** Phase 13 layout, Phase 12 bundle output, TIMELINE NFR performance targets.

## 15.1 MISSION
Meet or beat Core Web Vitals p75 targets for real users on realistic devices/networks; keep bundle size and CPU work within a budget; ensure no regression can ship without a gate flip.

## 15.2 FIELD-VS-LAB DISCIPLINE
- **Field (RUM)** is truth: real users, real networks, real devices, real content. Collect via the browser Performance APIs; report at p75 (and p95 for tail).
- **Lab (synthetic)** is for diagnosis and regression detection at a repeatable operating point — throttled CPU (e.g., 4–6× slowdown) and network (e.g., Slow 4G) profiles that approximate the median target user, documented in TIMELINE.
- **Never use lab p50 to claim field p75 met** — one is not the other.

## 15.3 FALSIFICATION PROCEDURES — RUN AS THE RIVAL

> **Mind: THE RIVAL.** Hostile, no benefit of the doubt, no courtesy notice. Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.1.

- **Cold-cache first paint:** load each critical page cold, throttled (per profile), and inspect LCP element identity, waterfall (blocking JS/CSS, font swap, image decode), and the source of the "hero" byte.
- **Interaction stress:** on the busiest page, hammer the primary interactions (click, type, scroll) while a large task is in flight; measure INP.
- **Layout-shift hunts:** load with slow images / late fonts / dynamic ads/banners; measure CLS; identify the shifting elements by attribution API.
- **Bundle attack:** trace top 20 largest modules by parsed size; identify polyfills for target browsers you no longer need, mis-tree-shaken libraries, duplicate copies of the same dep at different versions.
- **Third-party audit:** every third-party script tagged with its owner, purpose, blocking-behavior, and its own perf cost — anything failing to justify itself is a candidate for removal or async/deferred/facade patterns.

## 15.4 EXHAUSTIVE RULES

### Targets (Core Web Vitals — field p75, all-device)
- **R15.1 LCP** (Largest Contentful Paint) ≤ **2.5 s** — the hero renders quickly.
- **R15.2 INP** (Interaction to Next Paint) ≤ **200 ms** — interactions feel snappy end-to-end (INP replaced FID as the responsiveness metric).
- **R15.3 CLS** (Cumulative Layout Shift) ≤ **0.1** — the page doesn't move under the user.
- **R15.4** Supporting metrics tracked with targets: **TTFB** (server responsiveness), **FCP** (first paint), **TBT** (lab proxy for INP), **TTI**. Stretch to LCP ≤ 1.8 s and INP ≤ 100 ms for SIL3/4 flagship flows.
- **R15.5** Metric budgets recorded in TIMELINE as NFRs; regressions >X% at p75 for two weeks trip the alert; regression at release gate blocks (P23).

### Loading strategy
- **R15.6 Critical path lean:** critical CSS inlined (or fast-arriving); render-blocking JS eliminated on above-the-fold; non-critical CSS/JS deferred; preload for the LCP candidate resource (hero image or font).
- **R15.7 Fonts:** self-hosted or from a reliable CDN; `font-display: swap` (or `optional` for AAA-perf); `size-adjust`/`ascent-override` to reduce CLS on font swap; subset by language.
- **R15.8 Images:** correct format (AVIF/WebP with fallback), responsive `srcset`+`sizes`, dimensions in HTML or `aspect-ratio` (CLS), lazy-loading for below-the-fold, decoding hints, LCP image is *not* lazy-loaded.
- **R15.9 Third-party scripts:** async/defer; where possible use facade patterns (chat/video/analytics loaded on interaction/idle); privacy-preserving analytics allowed (ties P11).
- **R15.10 Prefetch/preload sanity:** only for high-confidence next-navigations; over-preloading harms perf.

### Runtime work
- **R15.11 Long-task discipline:** any main-thread task > **50 ms** logged; break with `requestIdleCallback`/scheduler yielding; expensive work offloaded to workers where feasible.
- **R15.12 Interaction handlers** finish (script + rendering) ≤ INP budget; passive listeners for scroll/touch; debounce/throttle high-frequency inputs; avoid forced synchronous layout ("layout thrashing").
- **R15.13 Rendering:** virtualize long lists; avoid expensive `box-shadow`/filter/blur where GPU-bound on target devices; contain paint with `contain`/`content-visibility` for offscreen sections.
- **R15.14 Memory:** detached DOM nodes / listeners cleaned on route change; long-lived pages soak-tested for growth (ties R08.7 for SPA sessions).

### Bundling & delivery
- **R15.15 Bundle budgets** per route (parsed JS/CSS) documented and gated; over-budget PR fails until justified.
- **R15.16 Code splitting** at route + interaction boundaries; shared chunks vs duplicated code balanced.
- **R15.17 Caching:** immutable, content-hashed asset URLs with long `Cache-Control`; short-lived HTML; correct `Vary`; service-worker (if any) with a documented lifecycle + kill switch; version skew handled.
- **R15.18 Compression** (brotli/gzip) enabled; HTTP/2 or 3 negotiated; connection reuse.

### Perceptual & offline UX
- **R15.19 Perceived-performance patterns:** skeletons matched to final layout (avoid CLS), optimistic UI where safe, progressive rendering.
- **R15.20 Offline/degraded UX** for progressive/PWA experiences: cached shell + last-known data with staleness labels (ties Phase 09 degradation).

### Measurement plumbing
- **R15.21 RUM in place:** capture LCP/INP/CLS + attribution (which element/script/interaction caused it) segmented by device class, connection, geo, route.
- **R15.22 Perf regression tests in CI (lab):** stable throttling profile; runs on critical routes; fails on threshold breach.
- **R15.23 Dashboards + alerts:** perf SLOs and error budgets (P17) drive engineering priority, not vibes.

## 15.5 EXIT GATE — JUDGED AS THE PRINCIPAL

> **Mind: THE PRINCIPAL.** Guilty until the evidence tier matches; no gate closes on "mostly." Full stance: `APPENDIX_RIVAL_AND_PRINCIPAL_DOCTRINE.md` §E.2.

- [ ] Field CWV p75 meets targets on all critical routes for the trailing 28 days. **Evidence:** dashboard export.
- [ ] Lab regression suite runs per PR; budgets enforced. **Evidence:** CI config + report.
- [ ] LCP element documented per critical page + preloaded appropriately. **Evidence:** per-page notes.
- [ ] Long-task audit clean or improvements queued. **Evidence:** audit output.
- [ ] Bundle inventory + budgets published; top-offender remediation ticketed. **Evidence:** inventory.
- [ ] Third-party inventory justified; heavy ones on facades/async. **Evidence:** inventory.
- [ ] Fonts / images / caching best practices verified. **Evidence:** config snapshots.

## 15.6 ARTIFACTS OUT
CWV dashboard export; per-route LCP analysis; long-task report; bundle inventory + budgets; third-party inventory; CI perf gates config.

> Next: `PHASE_16_BACKEND_PERFORMANCE.md`.
