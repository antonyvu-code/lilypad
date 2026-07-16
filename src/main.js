// LILYPAD — scroll orchestration & interaction layer
// Lenis (smooth scroll) + GSAP ScrollTrigger choreograph the fixed WebGL
// scene, the DOM storytelling and every hover affordance.
//
// Techniques on display:
//   1. SplitText masked line reveal (hero intro)
//   2. scrub tween (hero exit follows the scrollbar 1:1)
//   3. parallax via fromTo + scrub (ghost numerals)
//   4. onToggle state sync (progress rail)
//   5. scrubbed stagger (standards text illumination)
//   6. pin + horizontal scrub (systems cards, desktop only)
//   7. gsap.matchMedia() responsive/reduced-motion contexts
//   8. gsap.quickTo magnetic buttons (pointer: fine only)

// single-entry import: pulling everything from 'gsap/all' guarantees ONE
// core instance (separate entries can be pre-bundled by Vite into two
// cores, and triggers registered on one never fire)
import { gsap, ScrollTrigger, SplitText } from 'gsap/all';
import Lenis from 'lenis';
import { createScene } from './scene.js';

gsap.registerPlugin(ScrollTrigger, SplitText);

const debug = import.meta.env.DEV ? (window.__lp = { gsap, ScrollTrigger }) : null;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- smooth scroll ---------- */
let lenis = null;
if (!reducedMotion) {
  lenis = new Lenis({ duration: 1.2 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

// route anchor clicks through Lenis so in-page nav eases instead of jumping
const scrollToEl = (el) => {
  if (lenis) lenis.scrollTo(el, { offset: -70, duration: 1.4 });
  else el.scrollIntoView();
};
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const el = document.querySelector(a.getAttribute('href'));
    if (el) { e.preventDefault(); scrollToEl(el); }
  });
});

/* ---------- 3D scene ---------- */
const canvas = document.getElementById('scene');
const scene = createScene(canvas, { reducedMotion });
if (debug) debug.scene = scene;

/* ---------- sheet readout: live nav data follows the tour ---------- */
const roSec = document.getElementById('ro-sec');
const roHdg = document.getElementById('ro-hdg');
const roPos = document.getElementById('ro-pos');
// section derived from live geometry — one source of truth, so large
// scroll jumps (anchor clicks) can never skip a state change
const SECTION_NAMES = ['HULL', 'SKIN', 'GARDENS', 'HARBOR'];
const stepEls = [...document.querySelectorAll('.step')];
const updateReadout = (p, scroll) => {
  const mid = scroll + window.innerHeight / 2;
  let sec = 'APPROACH';
  stepEls.forEach((el, i) => { if (mid >= el.offsetTop) sec = SECTION_NAMES[i]; });
  roSec.textContent = sec;
  roHdg.textContent = `${((204 + p * 126) % 360).toFixed(1)}°`;
  roPos.textContent =
    `04°${(21 + p * 25).toFixed(1)}′N 009°${(18 + p * 36).toFixed(1)}′W`;
};

if (scene) {
  // camera tour spans hero through the last anatomy step
  ScrollTrigger.create({
    trigger: '#top',
    start: 'top top',
    endTrigger: '#ground',
    end: 'top bottom',
    onUpdate: (self) => {
      scene.setProgress(self.progress);
      updateReadout(self.progress, self.scroll());
    },
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

/* ---------- header: solid surface + direction-aware hide ---------- */
const header = document.getElementById('header');
ScrollTrigger.create({
  start: 80,
  onEnter: () => header.classList.add('scrolled'),
  onLeaveBack: () => header.classList.remove('scrolled'),
});
if (!reducedMotion) {
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      header.classList.toggle('hidden', self.direction === 1 && self.scroll() > 300);
    },
  });
}

/* ---------- progress rail: state synced to the tour ---------- */
const rail = document.getElementById('rail');
document.querySelectorAll('.rail button').forEach((btn) => {
  const step = document.getElementById(btn.dataset.target).closest('.step');
  btn.addEventListener('click', () => scrollToEl(step));
  ScrollTrigger.create({
    trigger: step,
    start: 'top center',
    end: 'bottom center',
    onToggle: (self) => btn.classList.toggle('active', self.isActive),
  });
});
ScrollTrigger.create({
  trigger: '#ground',
  start: 'top center',
  onEnter: () => { roSec.textContent = 'DOSSIER'; },
});
// readout sits over the navy CTA at page end — flip it light there
ScrollTrigger.create({
  trigger: '.cta',
  start: 'top 92%',
  end: 'bottom top',
  toggleClass: { targets: '.readout', className: 'invert' },
});
ScrollTrigger.create({
  trigger: '#ground',
  start: 'top 60%',
  onEnter: () => rail.classList.add('hidden'),
  onLeaveBack: () => rail.classList.remove('hidden'),
});

/* ---------- FAQ: soften the native <details> snap ---------- */
document.querySelectorAll('.faq-list details').forEach((d) => {
  d.addEventListener('toggle', () => {
    if (d.open && !reducedMotion) {
      gsap.from(d.querySelector('p'), { y: -10, autoAlpha: 0, duration: 0.35, ease: 'power2.out' });
    }
  });
});

/* ---------- motion contexts ---------- */
const mm = gsap.matchMedia();

mm.add('(prefers-reduced-motion: no-preference)', () => {
  /* 1 — hero intro: masked lines rise like a tide */
  const split = SplitText.create('#hero-title', { type: 'lines', mask: 'lines' });
  gsap.timeline({ defaults: { ease: 'power4.out' } })
    .from(split.lines, { yPercent: 115, duration: 1.2, stagger: 0.12, delay: 0.25 })
    .from('[data-hero]', { y: 24, autoAlpha: 0, duration: 0.9, stagger: 0.1 }, '-=0.7');

  /* 2 — hero exit: content hands the stage to the city, 1:1 with scroll */
  gsap.to('.hero > *', {
    yPercent: -28,
    autoAlpha: 0,
    stagger: 0.04,
    ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: '65% top', scrub: true },
  });

  /* 3 — ghost numerals: slow counter-parallax behind the panels */
  gsap.utils.toArray('.ghost-num').forEach((num) => {
    gsap.fromTo(num, { yPercent: 30 }, {
      yPercent: -30,
      ease: 'none',
      scrollTrigger: { trigger: num.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  /* 5 — standards: words light up as the line crosses the viewport */
  const words = SplitText.create('#standards-title', { type: 'words' }).words;
  gsap.from(words, {
    opacity: 0.12,
    stagger: 0.06,
    ease: 'none',
    scrollTrigger: { trigger: '.standards', start: 'top 78%', end: 'top 32%', scrub: true },
  });

  /* generic reveals (everything else keeps the single house pattern) */
  gsap.utils.toArray('[data-reveal]').forEach((el) => {
    gsap.from(el, {
      y: 24,
      autoAlpha: 0,
      duration: 0.9,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%' },
    });
  });
});

/* 6 — systems: spec values count up when their row enters */
mm.add('(prefers-reduced-motion: no-preference)', () => {
  gsap.utils.toArray('.spec b[data-count]').forEach((el) => {
    gsap.fromTo(el, { textContent: 0 }, {
      textContent: +el.dataset.count,
      snap: { textContent: 1 }, // integers only while counting
      duration: 1.6,
      ease: 'power2.out',
      scrollTrigger: { trigger: el.closest('.row'), start: 'top 82%' },
    });
  });
});

/* 8 — magnetic buttons: quickTo = a reusable, interruptible tween */
mm.add('(pointer: fine) and (prefers-reduced-motion: no-preference)', () => {
  const cleanups = [];
  document.querySelectorAll('.btn').forEach((btn) => {
    const xTo = gsap.quickTo(btn, 'x', { duration: 0.4, ease: 'power3' });
    const yTo = gsap.quickTo(btn, 'y', { duration: 0.4, ease: 'power3' });
    const move = (e) => {
      const r = btn.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * 0.35);
      yTo((e.clientY - r.top - r.height / 2) * 0.5);
    };
    const leave = () => { xTo(0); yTo(0); };
    btn.addEventListener('mousemove', move);
    btn.addEventListener('mouseleave', leave);
    cleanups.push(() => {
      btn.removeEventListener('mousemove', move);
      btn.removeEventListener('mouseleave', leave);
    });
  });
  return () => cleanups.forEach((fn) => fn()); // matchMedia revert hook
});
