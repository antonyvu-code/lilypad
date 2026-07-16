// LILYPAD — scroll orchestration
// Lenis (smooth scroll) + GSAP ScrollTrigger (progress + reveals)
// feed the fixed WebGL scene created in scene.js.

// single-entry import: pulling gsap and ScrollTrigger from 'gsap/all'
// guarantees ONE core instance (separate entries can be pre-bundled by
// Vite into two cores, and triggers registered on one never fire)
import { gsap, ScrollTrigger } from 'gsap/all';
import Lenis from 'lenis';
import { createScene } from './scene.js';

gsap.registerPlugin(ScrollTrigger);

const debug = import.meta.env.DEV ? (window.__lp = { gsap, ScrollTrigger }) : null;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- smooth scroll ---------- */
if (!reducedMotion) {
  const lenis = new Lenis({ duration: 1.2 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* ---------- 3D scene ---------- */
const canvas = document.getElementById('scene');
const scene = createScene(canvas, { reducedMotion });
if (debug) debug.scene = scene;

if (scene) {
  // camera tour spans hero through the last anatomy step
  ScrollTrigger.create({
    trigger: '#top',
    start: 'top top',
    endTrigger: '#ground',
    end: 'top bottom',
    onUpdate: (self) => scene.setProgress(self.progress),
  });

  // stop rendering once the solid sections fully cover the canvas
  ScrollTrigger.create({
    trigger: '#ground',
    start: 'top top',
    onEnter: () => scene.setActive(false),
    onLeaveBack: () => scene.setActive(true),
  });
}

/* ---------- layout watchdog ---------- */
// The embedded preview (and some in-app browsers) can lay the page out
// from a 0x0 viewport without ever firing window.resize — ScrollTrigger
// would keep stale trigger positions. Observe the root element instead.
let lastW = 0;
let lastH = 0;
new ResizeObserver(() => {
  const w = document.documentElement.clientWidth;
  const h = document.documentElement.clientHeight;
  if (w > 0 && h > 0 && (w !== lastW || h !== lastH)) {
    lastW = w; lastH = h;
    ScrollTrigger.refresh();
  }
}).observe(document.documentElement);

/* ---------- header ---------- */
const header = document.getElementById('header');
ScrollTrigger.create({
  start: 80,
  onEnter: () => header.classList.add('scrolled'),
  onLeaveBack: () => header.classList.remove('scrolled'),
});

/* ---------- reveals ---------- */
if (!reducedMotion) {
  gsap.utils.toArray('[data-reveal]').forEach((el) => {
    gsap.from(el, {
      y: 24,
      autoAlpha: 0,
      duration: 0.9,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%' },
    });
  });
}
