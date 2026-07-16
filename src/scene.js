// LILYPAD — procedural floating district
// Fixed fullscreen canvas; camera travels a Catmull-Rom spline driven
// by scroll progress (set externally via setProgress).

import * as THREE from 'three';

const SKY = 0xd3e6ec;
const INK = 0x071522;
const SIGNAL = 0xff5a3c;

// seeded PRNG so the city is identical on every visit
function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- ocean ---------------- */
function createOcean() {
  const geo = new THREE.PlaneGeometry(700, 700, 160, 160);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color(0x3a7d92) },
      uCrest: { value: new THREE.Color(0xbfe0e8) },
      uFogColor: { value: new THREE.Color(SKY) },
      uFogNear: { value: 60 },
      uFogFar: { value: 300 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying float vH;
      varying float vDist;
      void main() {
        vec3 p = position;
        float h =
          sin(p.x * 0.055 + uTime * 0.9) * 0.9 +
          sin(p.z * 0.042 - uTime * 0.6) * 0.7 +
          sin((p.x + p.z) * 0.09 + uTime * 1.3) * 0.35;
        p.y += h;
        vH = h;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vDist = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uDeep;
      uniform vec3 uCrest;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      varying float vH;
      varying float vDist;
      void main() {
        float t = smoothstep(-1.6, 1.9, vH);
        vec3 col = mix(uDeep, uCrest, t);
        float fog = smoothstep(uFogNear, uFogFar, vDist);
        col = mix(col, uFogColor, fog);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  return new THREE.Mesh(geo, mat);
}

/* ---------------- city ---------------- */
function buildPad(rand, radius, buildingCount, tall) {
  const pad = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf1f5f6, roughness: 0.85 });
  const grey = new THREE.MeshStandardMaterial({ color: 0xcfdbe0, roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x9db4bd, roughness: 0.9 });
  const green = new THREE.MeshStandardMaterial({ color: 0x7fae8a, roughness: 1 });

  // hull: wide truncated cone under a flat deck
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.7, 5, 40), grey);
  hull.position.y = -1.5;
  pad.add(hull);
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.04, radius, 1.4, 40), white);
  deck.position.y = 1.6;
  pad.add(deck);

  // buildings in radial rings
  const mats = [white, grey, dark];
  for (let i = 0; i < buildingCount; i++) {
    const a = rand() * Math.PI * 2;
    const r = radius * (0.2 + rand() * 0.62);
    const h = (tall ? 3 + rand() * 11 : 2 + rand() * 4) * (1.2 - r / radius / 1.6);
    const w = 1.2 + rand() * 2.2;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mats[(rand() * 3) | 0]);
    b.position.set(Math.cos(a) * r, 2.3 + h / 2, Math.sin(a) * r);
    b.rotation.y = rand() * Math.PI;
    pad.add(b);
  }

  // garden terraces
  for (let i = 0; i < 5; i++) {
    const a = rand() * Math.PI * 2;
    const r = radius * (0.3 + rand() * 0.5);
    const g = new THREE.Mesh(new THREE.CylinderGeometry(1.6 + rand() * 2.4, 1.8 + rand() * 2.4, 0.8, 10), green);
    g.position.set(Math.cos(a) * r, 2.7, Math.sin(a) * r);
    pad.add(g);
  }
  return pad;
}

function buildCity() {
  const rand = mulberry32(20260716);
  const city = new THREE.Group();

  // central pad
  const main = buildPad(rand, 24, 46, true);
  city.add(main);

  // central lagoon (ballast heart)
  const lagoon = new THREE.Mesh(
    new THREE.CylinderGeometry(6.5, 6.5, 0.4, 32),
    new THREE.MeshStandardMaterial({ color: 0x5da4b8, roughness: 0.4 })
  );
  lagoon.position.y = 2.5;
  city.add(lagoon);

  // three photovoltaic petal-sails around the lagoon
  const petalMat = new THREE.MeshStandardMaterial({
    color: 0xf7fafb, roughness: 0.5, side: THREE.DoubleSide,
  });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const petal = new THREE.Mesh(new THREE.ConeGeometry(5.5, 30, 4, 1, true), petalMat);
    petal.scale.z = 0.28;
    petal.position.set(Math.cos(a) * 11, 16, Math.sin(a) * 11);
    petal.rotation.y = -a + Math.PI / 4;
    petal.rotation.z = 0.12;
    city.add(petal);
  }

  // satellite pads + bridges
  const bridgeMat = new THREE.MeshStandardMaterial({ color: 0xe4ecef, roughness: 0.9 });
  const satAngles = [0.4, 2.3, 4.4];
  satAngles.forEach((a, i) => {
    const dist = 52 + i * 7;
    const sat = buildPad(rand, 10 + i * 2, 12, false);
    sat.position.set(Math.cos(a) * dist, 0, Math.sin(a) * dist);
    city.add(sat);
    const len = dist - 24 - (10 + i * 2);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(len, 0.5, 2.4), bridgeMat);
    const mid = 24 + len / 2;
    bridge.position.set(Math.cos(a) * mid, 2.1, Math.sin(a) * mid);
    bridge.rotation.y = -a;
    city.add(bridge);
  });

  // harbor: coral docking ring on the leeward satellite
  const harborA = satAngles[2];
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(15, 0.55, 10, 48, Math.PI * 1.25),
    new THREE.MeshStandardMaterial({ color: SIGNAL, roughness: 0.6 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(Math.cos(harborA) * 66, 1.2, Math.sin(harborA) * 66);
  city.add(ring);

  // coral buoys marking the approach lane
  const buoyMat = new THREE.MeshStandardMaterial({ color: SIGNAL, roughness: 0.6 });
  for (let i = 0; i < 6; i++) {
    const buoy = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 12), buoyMat);
    const t = i / 5;
    buoy.position.set(
      Math.cos(harborA) * (80 + t * 60) + (i % 2 ? 6 : -6),
      0.6,
      Math.sin(harborA) * (80 + t * 60)
    );
    city.add(buoy);
  }

  return city;
}

/* ---------------- camera path ---------------- */
// approach → hull → skin → gardens → harbor
const POSITIONS = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-14, 30, 150),   // hero: wide approach
  new THREE.Vector3(-52, 7, 70),     // 01 hull: waterline
  new THREE.Vector3(40, 26, 44),     // 02 skin: climbing the sails
  new THREE.Vector3(6, 52, 30),      // 03 gardens: near-overhead
  new THREE.Vector3(-30, 6, -62),    // 04 harbor: low pass
  new THREE.Vector3(-70, 16, -110),  // exit: pull away
]);
const TARGETS = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 10, 0),
  new THREE.Vector3(0, 2, 0),
  new THREE.Vector3(0, 16, 0),
  new THREE.Vector3(0, 3, 0),
  new THREE.Vector3(-15, 2, -50),
  new THREE.Vector3(0, 8, 0),
]);

/* ---------------- main ---------------- */
export function createScene(canvas, { reducedMotion = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch {
    return null; // no-WebGL fallback: CSS sky gradient stays
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(SKY);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(SKY, 60, 300);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 600);

  scene.add(new THREE.HemisphereLight(0xeaf6ff, 0x4a7484, 1.15));
  const sun = new THREE.DirectionalLight(0xfff2e0, 1.7);
  sun.position.set(60, 90, 30);
  scene.add(sun);

  const ocean = createOcean();
  scene.add(ocean);
  const city = buildCity();
  scene.add(city);

  const clock = new THREE.Clock();
  let progress = 0;        // target (set by scroll)
  let eased = 0;           // smoothed
  let active = true;
  let rafId = 0;

  const pos = new THREE.Vector3();
  const tgt = new THREE.Vector3();
  let vpW = 0;
  let vpH = 0;

  function step() {
    // size from CSS layout every frame — survives environments where the
    // canvas starts at 0x0 and no window resize event ever fires
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w > 0 && h > 0 && (w !== vpW || h !== vpH)) {
      vpW = w; vpH = h;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false); // false: leave CSS in control
    }
    if (vpW === 0) return;

    const t = reducedMotion ? 1.8 : clock.getElapsedTime();
    ocean.material.uniforms.uTime.value = t;

    if (!reducedMotion) {
      city.position.y = Math.sin(t * 0.6) * 0.4;
      city.rotation.z = Math.sin(t * 0.4) * 0.0026;
    }

    eased = reducedMotion ? progress : eased + (progress - eased) * 0.06;
    POSITIONS.getPointAt(Math.min(eased, 0.999), pos);
    TARGETS.getPointAt(Math.min(eased, 0.999), tgt);
    camera.position.copy(pos);
    camera.lookAt(tgt);

    renderer.render(scene, camera);
  }

  function frame() {
    rafId = requestAnimationFrame(frame);
    if (active) step();
  }
  frame();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(rafId);
    else frame();
  });

  canvas.classList.add('is-ready');

  return {
    setProgress(p) { progress = p; },
    setActive(a) { active = a; },
    tick: step, // manual frame for tests / rAF-suspended environments
  };
}
