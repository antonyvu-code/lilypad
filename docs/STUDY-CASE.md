# LILYPAD — Study Case

**A floating city for the century of water.**
Speculative brand & launch site — concept, design and build by Nullpunkt, 2026.

---

## 1. Problem

Sea level rise is usually communicated in one of two registers: apocalypse
(drowned skylines, red warning maps) or bureaucracy (PDF reports, adaptation
frameworks). Neither register makes anyone *want* the future.

Lilypad — inspired by Vincent Callebaut's 2008 "Lilypad" floating ecopolis —
poses a different question: **what if buoyant infrastructure were marketed
like a product you could actually move into?** Not a disaster response, but
an address.

The site's job is therefore persuasion by precision. It must make a floating
district of 5,000 residents feel *engineered* rather than utopian — the way
vectrfl.com makes industrial staffing feel like military logistics. The
benchmark register is: calm, technical, quietly confident. If the visitor
leaves thinking "someone has clearly done the math," the site has won.

**Audience:** three overlapping groups — coastal municipalities scouting
adaptation options, journalists covering climate infrastructure, and the
general "solarpunk-curious" public. All three are served by the same funnel:
understand the anatomy → trust the standards → request a berth.

## 2. Reference analysis (vectrfl.com, by Utsubo)

What we take from Vectr — and what we deliberately change:

| Vectr | Lilypad | Rationale |
|---|---|---|
| Fixed fullscreen WebGL canvas, DOM scrolls over it | Same | The cleanest separation of cinematics (GPU) and content (DOM/SEO) |
| Hand-modeled GLB (nuclear plant, 2 MB Draco) | **Fully procedural geometry** — zero model files | Portfolio point: the whole city is code; also removes the asset pipeline |
| Camera travels through scene on scroll (ScrollTrigger progress → spline) | Same, Catmull-Rom path with 6 keyframes | Proven pattern; the scroll *is* the guided tour |
| Numbered process 01–04 ("Activation… Arrival") | Numbered **anatomy** 01–04 (Hull, Skin, Gardens, Harbor) | A city is a body, not a workflow — anatomy is the honest metaphor |
| Solid-background sections take over mid-page | Same — canvas stops rendering once covered | Saves GPU; gives the page a "landing" after the flight |
| Roboto forced into industrial character via −6% tracking | Archivo, −4% tracking, engineered grotesque | Same trick, different family; Archivo's high x-height reads "spec sheet" |
| No reduced-motion support, 10/15 images missing alt | **WCAG AA throughout** | Our standing rule — and our edge over a famous studio |

## 3. Sitemap & narrative arc

Single page, seven beats, ~11 viewport-heights:

1. **HERO** — "The city that rises with the sea." Camera holds wide; the
   district sits on the horizon line like a promise.
2. **ANATOMY 01 — THE HULL** — camera descends to the waterline; buoyancy,
   ballast lagoons, bio-concrete.
3. **ANATOMY 02 — THE SKIN** — camera climbs the sails; photovoltaic petals,
   wind columns, CO₂-scrubbing surface.
4. **ANATOMY 03 — THE GARDENS** — near-overhead orbit; aquaculture terraces,
   the central lagoon as ballast heart.
5. **ANATOMY 04 — THE HARBOR** — low pass at water level toward the coral
   docking ring; arrival choreography, seasonal drift.
6. **SYSTEMS** (solid background begins) — four proof cards: Energy positive
   / Water autonomous / Grown on board / Storm-rated. Then **STANDARDS** —
   "Sea-grade standards across every deck" (mirror of Vectr's
   "nuclear-grade"), then **FAQ** (4 native `<details>`).
7. **CTA** — inverted navy panel: "The sea is rising. So are we." —
   REQUEST A BERTH.

The camera path is the plot: **approach → inspect → understand → arrive.**
The visitor performs the same journey a future resident would.

## 4. Visual direction

**Dialect: "MARITIME SPEC"** — the graphic language of naval architecture
drawings and offshore engineering datasheets, applied to a hopeful subject.

- **Palette (2-color extreme + one signal):**
  - Sky/fog field: `#d3e6ec` (the entire 3D atmosphere lives in this value)
  - Surface panels: `#f4f8f9`
  - Ink: `#071522` (navy-black, used for text *and* the CTA inversion)
  - Signal: coral `#ff5a3c` — reserved for the harbor ring in the scene,
    the step numerals, and interactive accents. Small text on light uses
    the AA-safe deep coral `#c2340f`.
  - Rationale: the sea owns blue; the brand owns coral. One saturated
    signal against a desaturated world = single-saturated-accent principle.
- **Type:** Archivo (400/500/600). Display: 600, `clamp(3rem → 6.5rem)`,
  tracking −0.04 em, line-height 0.92. Labels: 12 px, uppercase,
  tracking +0.14 em. Body: 400, 17 px, 1.6.
- **Texture:** none. No grain, no noise. The wave shader supplies all the
  life; every 2D surface stays instrument-clean.

## 5. Motion spec

- **Smooth scroll:** Lenis (1.2 s lerp curve), disabled entirely under
  `prefers-reduced-motion`.
- **Camera:** GSAP ScrollTrigger measures progress across hero→anatomy
  (0…1) → two Catmull-Rom splines (position + look-target), eased by
  per-frame lerp (`0.06`) so the camera always feels like it has mass.
  Reduced motion: camera snaps to keyframe positions without smoothing,
  waves freeze at a fixed phase — the site becomes a sequence of stills.
- **Ocean:** vertex-displaced plane, 3 summed sine waves, color mixed by
  wave height (deep `#3a7d92` → crest `#bfe0e8`), hand-rolled fog in the
  fragment shader matching `#d3e6ec`.
- **City idle:** ±0.4 unit vertical bob at 0.3 Hz, ±0.15° roll — enough to
  say "floating," never enough to say "unstable."
- **DOM reveals:** single pattern only — 24 px rise + fade, 0.9 s,
  `power3.out`, staggered 0.08 s. One easing family per site.
- **Storytelling layer (ScrollTrigger showcase):**
  - Hero: SplitText masked-line rise (the headline surfaces like a tide),
    then a scrubbed exit — content hands the stage to the city 1:1 with
    the scrollbar.
  - Ghost numerals 01–04 (26 vw, stroked, transparent) counter-parallax
    behind the panels — depth without a single extra polygon.
  - Progress rail (right edge): dots sync to the active anatomy step via
    `onToggle`, click routes through Lenis `scrollTo`; hides once the
    solid sections begin.
  - Standards: word-by-word illumination scrubbed across the viewport
    (opacity 0.12 → 1).
  - Systems: section pins and the four proof cards travel horizontally
    (`pin` + scrub, desktop + motion-ok only via `gsap.matchMedia`);
    stacked grid everywhere else.
- **Hover layer:** magnetic buttons (`gsap.quickTo`, `pointer: fine`
  only), card lift with coral border, nav underline slide, header hides
  on scroll-down / returns on scroll-up.
- **Render budget:** DPR clamped at 1.75; RAF fully suspended when the
  solid sections cover the canvas (IntersectionObserver sentinel) and on
  `visibilitychange`.

## 6. Tech rationale

- **Vite + vanilla ES modules** — a single-page cinematic brochure needs no
  framework; ship the minimum.
- **Three.js (procedural only)** — the entire district is generated from
  seeded primitives (~40 lines of layout code) instead of a GLB. Total
  payload target < 700 KB gzip, i.e. **less than Vectr's model alone**.
- **GSAP 3.15 + ScrollTrigger** — scroll orchestration standard; 3.15's
  `easeReverse` available for toggle affordances.
- **Lenis 1.3** — same choice Utsubo made; the industry default for a reason.
- **No postprocessing** — fog + palette discipline replaces bloom. Cheapest
  possible "atmosphere."

## 7. Accessibility & performance contract

- Contrast: body ink on panels 15.9:1; deep coral on panels 5.4:1 (AA);
  labels ≥ 4.5:1. Verified computed values, not eyeballed.
- Skip link, semantic landmarks, single `<h1>`, FAQ as native
  `<details>/<summary>` (keyboard + SR for free), all meaningful images
  have alt text, decorative canvas is `aria-hidden`.
- `prefers-reduced-motion`: no smooth scroll, no reveals, no bob, frozen
  waves, snap camera. The page remains fully readable as static document.
- No-WebGL / no-JS fallback: sky-gradient background persists; all content
  is plain DOM and remains complete.
- Budget: < 700 KB gzip total, TTI < 2 s on mid-tier hardware, 60 fps
  scroll on integrated graphics (DPR clamp + suspended RAF do the work).

## 8. KPIs (fictional program, real metrics)

- Scroll completion ≥ 60% (the camera tour is the product)
- "Request a berth" click-through ≥ 4%
- Lighthouse: Performance ≥ 90, Accessibility 100

---

*Speculative concept. Inspired by Vincent Callebaut Architectures'
"Lilypad — Floating Ecopolis for Climate Refugees" (2008); not affiliated.
Reference pattern study: vectrfl.com by Utsubo.*
