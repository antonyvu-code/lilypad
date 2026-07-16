// LILYPAD — procedural floating district (detail pass)
// Fixed fullscreen canvas; camera travels a Catmull-Rom spline driven
// by scroll progress (set externally via setProgress).
// Everything is generated from seeded primitives — no model files.

import * as THREE from 'three';

const SKY = 0xd3e6ec;
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

/* ---------------- ocean & sky ---------------- */
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

function createSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uZenith: { value: new THREE.Color(0xbcd8e6) },
      uHorizon: { value: new THREE.Color(0xd6e8ee) },
    },
    vertexShader: /* glsl */ `
      varying float vY;
      void main() {
        vY = normalize(position).y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      varying float vY;
      void main() {
        gl_FragColor = vec4(mix(uHorizon, uZenith, smoothstep(0.02, 0.6, vY)), 1.0);
      }
    `,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(450, 24, 16), mat);
}

/* ---------------- shared materials ---------------- */
function makeMats() {
  return {
    white: new THREE.MeshStandardMaterial({ color: 0xf1f5f6, roughness: 0.85 }),
    grey: new THREE.MeshStandardMaterial({ color: 0xcfdbe0, roughness: 0.9 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x9db4bd, roughness: 0.9 }),
    ink: new THREE.MeshStandardMaterial({ color: 0x2c3e4a, roughness: 0.8 }),
    green: new THREE.MeshStandardMaterial({ color: 0x7fae8a, roughness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x5d8f6b, roughness: 1 }),
    signal: new THREE.MeshStandardMaterial({ color: SIGNAL, roughness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x8fb6c4, roughness: 0.3, metalness: 0.2 }),
  };
}

/* ---------------- buildings ---------------- */
// Box buildings carry userData.win = {w, h, d}; cylinders userData.winCyl —
// window instances are generated afterwards from world matrices.
function buildTower(rand, mats, tall) {
  const g = new THREE.Group();
  const matPick = [mats.white, mats.grey, mats.dark];
  const m = matPick[(rand() * 3) | 0];

  if (rand() < 0.22) {
    // cylindrical tower
    const r = 1 + rand() * 0.9;
    const h = tall ? 5 + rand() * 9 : 2.5 + rand() * 3;
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), m);
    c.position.y = h / 2;
    c.userData.winCyl = { r, h };
    g.add(c);
    g.userData.topY = h;
    return g;
  }

  // box tower with optional setbacks
  const w = 1.4 + rand() * 2.2;
  const h0 = tall ? 3 + rand() * 8 : 2 + rand() * 3.5;
  const base = new THREE.Mesh(new THREE.BoxGeometry(w, h0, w), m);
  base.position.y = h0 / 2;
  base.userData.win = { w, h: h0, d: w };
  g.add(base);
  let top = h0;

  if (tall && h0 > 5 && rand() < 0.55) {
    const w1 = w * (0.55 + rand() * 0.2);
    const h1 = 2 + rand() * 4;
    const up = new THREE.Mesh(new THREE.BoxGeometry(w1, h1, w1), m);
    up.position.y = top + h1 / 2;
    up.userData.win = { w: w1, h: h1, d: w1 };
    g.add(up);
    top += h1;
  }
  if (rand() < 0.6) {
    // rooftop unit
    const u = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.28, 0.5, w * 0.28), mats.dark
    );
    u.position.set((rand() - 0.5) * w * 0.4, top + 0.25, (rand() - 0.5) * w * 0.4);
    g.add(u);
  }
  if (tall && top > 9 && rand() < 0.45) {
    // antenna mast with signal tip
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3, 6), mats.ink);
    mast.position.y = top + 1.5;
    g.add(mast);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), mats.signal);
    tip.position.y = top + 3;
    g.add(tip);
  }
  g.userData.topY = top;
  return g;
}

/* ---------------- pads ---------------- */
function buildPad(rand, mats, radius, buildingCount, tall) {
  const pad = new THREE.Group();

  const hull = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 0.7, 5, 40), mats.grey
  );
  hull.position.y = -1.5;
  pad.add(hull);
  const deck = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.04, radius, 1.4, 40), mats.white
  );
  deck.position.y = 1.6;
  pad.add(deck);

  // deck railing
  const rail = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 1.02, 0.07, 6, 60), mats.ink
  );
  rail.rotation.x = Math.PI / 2;
  rail.position.y = 2.75;
  pad.add(rail);

  for (let i = 0; i < buildingCount; i++) {
    const a = rand() * Math.PI * 2;
    const r = radius * (0.2 + rand() * 0.6);
    const tower = buildTower(rand, mats, tall && r < radius * 0.55);
    tower.position.set(Math.cos(a) * r, 2.3, Math.sin(a) * r);
    tower.rotation.y = rand() * Math.PI;
    pad.add(tower);
  }

  // garden terraces with trees
  for (let i = 0; i < 5; i++) {
    const a = rand() * Math.PI * 2;
    const r = radius * (0.3 + rand() * 0.5);
    const gr = 1.6 + rand() * 2.4;
    const g = new THREE.Mesh(new THREE.CylinderGeometry(gr, gr + 0.3, 0.8, 10), mats.green);
    g.position.set(Math.cos(a) * r, 2.7, Math.sin(a) * r);
    pad.add(g);
    const trees = 2 + ((rand() * 3) | 0);
    for (let k = 0; k < trees; k++) {
      const ta = rand() * Math.PI * 2;
      const tr = rand() * gr * 0.6;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.5, 5), mats.ink);
      trunk.position.set(g.position.x + Math.cos(ta) * tr, 3.35, g.position.z + Math.sin(ta) * tr);
      pad.add(trunk);
      const crown = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.35 + rand() * 0.4, 0), mats.leaf
      );
      crown.position.set(trunk.position.x, 3.75 + rand() * 0.25, trunk.position.z);
      pad.add(crown);
    }
  }
  return pad;
}

/* ---------------- details ---------------- */
function buildPetal(mats) {
  // curved photovoltaic sail — lathe profile, flattened to a blade
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const r = 0.6 + Math.sin(t * Math.PI * 0.82) * 4.6 * (1 - t * 0.55);
    pts.push(new THREE.Vector2(r, t * 30));
  }
  const geo = new THREE.LatheGeometry(pts, 18);
  const petal = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: 0xf7fafb, roughness: 0.45, metalness: 0.08, side: THREE.DoubleSide,
  }));
  petal.scale.z = 0.24;
  return petal;
}

function buildTurbine(mats) {
  const g = new THREE.Group();
  const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.5, 15, 8), mats.white);
  pylon.position.y = 7.5;
  g.add(pylon);
  const nacelle = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.8), mats.grey);
  nacelle.position.y = 15;
  g.add(nacelle);
  const rotor = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 6.4, 0.1), mats.white);
    blade.position.y = 3.2;
    const arm = new THREE.Group();
    arm.add(blade);
    arm.rotation.z = (i / 3) * Math.PI * 2;
    rotor.add(arm);
  }
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 10), mats.signal);
  rotor.add(hub);
  rotor.position.set(0, 15, 0.55);
  g.add(rotor);
  g.userData.rotor = rotor;
  return g;
}

function buildBoat(mats) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.8, 1.3), mats.white);
  hull.position.y = 0.4;
  g.add(hull);
  const bow = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.8, 3), mats.white);
  bow.rotation.x = Math.PI / 2;
  bow.rotation.z = Math.PI / 2;
  bow.position.set(2, 0.4, 0);
  g.add(bow);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.95), mats.ink);
  cabin.position.set(-0.6, 1.1, 0);
  g.add(cabin);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 1.32), mats.signal);
  stripe.position.y = 0.75;
  g.add(stripe);
  return g;
}

function buildCrane(mats) {
  const g = new THREE.Group();
  const col = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7.5, 0.5), mats.dark);
  col.position.y = 3.75;
  g.add(col);
  const jib = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.35, 0.45), mats.dark);
  jib.position.set(2.6, 7.2, 0);
  g.add(jib);
  const tip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), mats.signal);
  tip.position.set(6.6, 7.2, 0);
  g.add(tip);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3, 4), mats.ink);
  cable.position.set(5.4, 5.6, 0);
  g.add(cable);
  return g;
}

function buildGull() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xf7fafb });
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.24), mat);
    wing.position.x = s * 0.42;
    wing.rotation.y = s * 0.35;
    g.add(wing);
  }
  return g;
}

/* ---------------- city assembly ---------------- */
function buildCity(mats, anim) {
  const rand = mulberry32(20260716);
  const city = new THREE.Group();

  city.add(buildPad(rand, mats, 24, 46, true));

  // central lagoon (ballast heart)
  const lagoon = new THREE.Mesh(
    new THREE.CylinderGeometry(6.5, 6.5, 0.4, 32), mats.glass
  );
  lagoon.position.y = 2.5;
  city.add(lagoon);

  // three photovoltaic petal-sails around the lagoon
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const petal = buildPetal(mats);
    petal.position.set(Math.cos(a) * 11, 2.8, Math.sin(a) * 11);
    petal.rotation.y = -a;
    petal.rotation.z = 0.1;
    city.add(petal);
  }

  // satellite pads + bridges
  const satAngles = [0.4, 2.3, 4.4];
  const satDist = [];
  satAngles.forEach((a, i) => {
    const dist = 52 + i * 7;
    satDist.push(dist);
    const sat = buildPad(rand, mats, 10 + i * 2, 12, false);
    sat.position.set(Math.cos(a) * dist, 0, Math.sin(a) * dist);
    city.add(sat);
    const len = dist - 24 - (10 + i * 2);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(len, 0.5, 2.4), mats.grey);
    const mid = 24 + len / 2;
    bridge.position.set(Math.cos(a) * mid, 2.1, Math.sin(a) * mid);
    bridge.rotation.y = -a;
    city.add(bridge);
    // bridge handrails
    for (const s of [-1, 1]) {
      const hr = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.08), mats.ink);
      hr.position.set(Math.cos(a) * mid - Math.sin(a) * s * 1.1, 2.9, Math.sin(a) * mid + Math.cos(a) * s * 1.1);
      hr.rotation.y = -a;
      city.add(hr);
    }
  });

  // harbor: coral docking ring + cranes + containers on the leeward satellite
  const hA = satAngles[2];
  const hPos = new THREE.Vector3(Math.cos(hA) * satDist[2], 0, Math.sin(hA) * satDist[2]);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(15, 0.55, 10, 48, Math.PI * 1.25), mats.signal
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(hPos.x, 1.2, hPos.z);
  city.add(ring);

  for (const off of [-4, 4]) {
    const crane = buildCrane(mats);
    crane.position.set(hPos.x + off, 2.3, hPos.z + off * 0.6);
    crane.rotation.y = hA + Math.PI + off * 0.1;
    city.add(crane);
  }
  const boxMats = [mats.signal, mats.ink, mats.grey];
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.95, 1), boxMats[i % 3]);
    c.position.set(
      hPos.x - 3 + (i % 3) * 2.4,
      2.8 + (i > 4 ? 0.95 : 0),
      hPos.z - 4 + ((i / 3) | 0) * 1.4
    );
    c.rotation.y = hA;
    city.add(c);
  }

  // approach-lane buoys (bobbing)
  for (let i = 0; i < 6; i++) {
    const buoy = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 12), mats.signal);
    const t = i / 5;
    buoy.position.set(
      Math.cos(hA) * (80 + t * 60) + (i % 2 ? 6 : -6), 0.6, Math.sin(hA) * (80 + t * 60)
    );
    anim.buoys.push(buoy);
    city.add(buoy);
  }

  // offshore wind farm on the windward side
  for (let i = 0; i < 4; i++) {
    const a = 1.35 + i * 0.28;
    const d = 96 + (i % 2) * 16;
    const turbine = buildTurbine(mats);
    turbine.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    turbine.rotation.y = a + Math.PI;
    anim.rotors.push(turbine.userData.rotor);
    city.add(turbine);
  }

  return city;
}

// instanced windows from every flagged mesh's world matrix — one draw call
function buildWindows(city) {
  const dummy = new THREE.Object3D();
  const mats4 = [];
  city.updateMatrixWorld(true);
  city.traverse((mesh) => {
    if (mesh.userData.win) {
      const { w, h, d } = mesh.userData.win;
      for (const [axis, sign] of [['z', 1], ['z', -1], ['x', 1], ['x', -1]]) {
        const width = axis === 'z' ? w : d;
        const cols = Math.max(1, Math.floor((width - 0.8) / 1.15));
        const rows = Math.max(1, Math.floor((h - 1.2) / 1.5));
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            dummy.position.set(
              axis === 'z' ? (c - (cols - 1) / 2) * 1.15 : sign * (d / 2 + 0.02),
              -h / 2 + 1 + r * 1.5,
              axis === 'z' ? sign * (d / 2 + 0.02) : (c - (cols - 1) / 2) * 1.15
            );
            dummy.rotation.set(0, axis === 'z' ? (sign < 0 ? Math.PI : 0) : sign * Math.PI / 2, 0);
            dummy.updateMatrix();
            mats4.push(mesh.matrixWorld.clone().multiply(dummy.matrix));
          }
        }
      }
    } else if (mesh.userData.winCyl) {
      const { r, h } = mesh.userData.winCyl;
      const rows = Math.max(1, Math.floor((h - 1.2) / 1.5));
      const cols = Math.max(6, Math.round(r * 6));
      for (let row = 0; row < rows; row++) {
        for (let c = 0; c < cols; c++) {
          const a = (c / cols) * Math.PI * 2;
          dummy.position.set(Math.cos(a) * (r + 0.02), -h / 2 + 1 + row * 1.5, Math.sin(a) * (r + 0.02));
          dummy.rotation.set(0, -a + Math.PI / 2, 0);
          dummy.updateMatrix();
          mats4.push(mesh.matrixWorld.clone().multiply(dummy.matrix));
        }
      }
    }
  });
  const inst = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.55, 0.8),
    new THREE.MeshBasicMaterial({ color: 0x2a3d4a }),
    mats4.length
  );
  mats4.forEach((m, i) => inst.setMatrixAt(i, m));
  inst.instanceMatrix.needsUpdate = true;
  return inst;
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

  scene.add(createSky());
  const ocean = createOcean();
  scene.add(ocean);

  const anim = { rotors: [], buoys: [], boats: [], gulls: [] };
  const mats = makeMats();
  const city = buildCity(mats, anim);
  scene.add(city);
  scene.add(buildWindows(city));

  // boats circling outside the district (world space, not bobbing with city)
  [[95, 0.055, 0], [112, -0.038, 2.1], [126, 0.045, 4.2]].forEach(([r, sp, ph]) => {
    const boat = buildBoat(mats);
    anim.boats.push({ g: boat, r, sp, ph });
    scene.add(boat);
  });

  // gulls circling the towers
  for (let i = 0; i < 6; i++) {
    const gull = buildGull();
    anim.gulls.push({ g: gull, r: 42 + i * 7, h: 26 + (i % 3) * 4, sp: 0.14 + i * 0.02, ph: i * 1.1 });
    scene.add(gull);
  }

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
      for (const r of anim.rotors) r.rotation.z = t * 1.6;
      anim.buoys.forEach((b, i) => { b.position.y = 0.6 + Math.sin(t * 1.3 + i * 1.7) * 0.22; });
    }
    for (const b of anim.boats) {
      const a = b.ph + t * b.sp;
      b.g.position.set(Math.cos(a) * b.r, Math.sin(t * 1.1 + b.ph) * 0.3, Math.sin(a) * b.r);
      b.g.rotation.y = -a - Math.PI / 2 * Math.sign(b.sp);
    }
    for (const s of anim.gulls) {
      const a = s.ph + t * s.sp;
      s.g.position.set(Math.cos(a) * s.r, s.h + Math.sin(t * 0.9 + s.ph) * 1.4, Math.sin(a) * s.r);
      s.g.rotation.y = -a - Math.PI / 2;
      s.g.rotation.z = Math.sin(t * 6 + s.ph) * 0.35; // wing flap
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
    info: renderer.info, // debug: draw calls / triangles
  };
}
