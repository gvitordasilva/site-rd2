import * as THREE from 'three';

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

/* a experiência sempre começa no hero */
history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

/* respeita a preferência de "reduzir movimento" do sistema */
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------ */
/*  data — obras no carrossel 3D                                       */
/* ------------------------------------------------------------------ */

const IMG = (id) =>
  `https://images.unsplash.com/${id}?w=720&h=960&fit=crop&q=80&auto=format`;

const WORKS = [
  { title: 'panobianco pilares — academia',     url: 'assets/obras/pilares-fachada.jpeg',     area: 'a confirmar', tipo: 'comercial',   status: 'entregue · 2026' },
  { title: 'panobianco taquara — academia',      url: 'assets/obras/taquara-fachada.jpeg',     area: 'a confirmar', tipo: 'comercial',   status: 'entregue · 2026' },
  { title: 'panobianco campos — academia',       url: 'assets/obras/campos-fachada.jpeg',      area: '1.350 m²',    tipo: 'comercial',   status: 'entregue · 2025' },
  { title: 'panobianco rio das ostras — academia', url: 'assets/obras/estaleiro-fachada.jpeg',  area: 'a confirmar', tipo: 'comercial',   status: 'entregue · 2026' },
  { title: 'panobianco tijuca — academia',       url: 'assets/obras/tijuca-interior.jpeg',     area: 'a confirmar', tipo: 'comercial',   status: 'entregue · 2026' },
  { title: 'retrofit edifício central',         url: IMG('photo-1487958449943-2429e8be8625'), area: '9.600 m²',  tipo: 'retrofit',    status: 'entregue · 2024' },
  { title: 'residencial lumina',                url: IMG('photo-1479839672679-a46483c0e7c8'), area: '14.200 m²', tipo: 'residencial', status: 'entregue · 2021' },
  { title: 'condomínio mirante',                url: IMG('photo-1431576901776-e539bd916ba2'), area: '21.300 m²', tipo: 'residencial', status: 'entregue · 2020' },
  { title: 'galpão logístico vetor',            url: IMG('photo-1503328427499-d92d1ac3d174'), area: '40.500 m²', tipo: 'industrial',  status: 'entregue · 2023' },
  { title: 'edifício atlas — comercial',        url: IMG('photo-1494522855154-9297ac14b55f'), area: '16.800 m²', tipo: 'comercial',   status: 'em obra · 2026' },
  { title: 'canteiro — gestão de obras',        url: IMG('photo-1541888946425-d81bb19240f5'), area: '—',         tipo: 'gestão',      status: 'serviço' },
  { title: 'projetos & engenharia',             url: IMG('photo-1503387762-592deb58ef4e'), area: '—',         tipo: 'consultoria', status: 'serviço' },
];

const N = WORKS.length;

/* spiral geometry constants */
const ANGLE_STEP = 0.62;
const TOTAL = N * ANGLE_STEP;
const HALF = TOTAL / 2;
const RADIUS = 5.4;
const PITCH = 0.92;
const PLANE_W = 2.15;
const PLANE_H = 2.85;

/* list layout constants */
const SPACING = PLANE_W + 0.65;
const TOTAL_W = N * SPACING;
const HALF_W = TOTAL_W / 2;
const LINEAR_FACTOR = TOTAL_W / TOTAL;

/* ------------------------------------------------------------------ */
/*  dom                                                                */
/* ------------------------------------------------------------------ */

const $ = (id) => document.getElementById(id);
const glRoot = $('gl');
const preloader = $('preloader');
const preloaderCount = $('preloaderCount');
const preloaderBar = $('preloaderBar');
const heroEl = $('hero');
const heroTitle = $('heroTitle');
const heroEyebrow = $('heroEyebrow');
const workIndexEl = $('workIndex');
const workTitleEl = $('workTitle');
const workLabel = $('workLabel');
const scrollHint = $('scrollHint');
const badge = $('badge');
const menuEl = $('menu');
const menuBtn = $('menuBtn');
const modeBtn = $('modeBtn');
const viewNav = $('viewNav');
const specName = $('specName');
const specArea = $('specArea');
const specTipo = $('specTipo');
const specStatus = $('specStatus');
const specSheet = $('specSheet');
const cursorEl = $('cursor');
const cursorRing = $('cursorRing');

/* split hero title into chars */
(() => {
  const text = heroTitle.textContent;
  heroTitle.textContent = '';
  for (const ch of text) {
    const wrap = document.createElement('span');
    wrap.className = 'char-wrap';
    const inner = document.createElement('span');
    inner.className = 'char';
    inner.innerHTML = ch === ' ' || ch === ' ' ? '&nbsp;' : ch;
    wrap.appendChild(inner);
    heroTitle.appendChild(wrap);
  }
  gsap.set('.hero__title .char', { yPercent: 115 });
})();

/* ------------------------------------------------------------------ */
/*  three.js setup                                                     */
/* ------------------------------------------------------------------ */

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 60);
camera.position.set(0, 0, 8.6);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 760 ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 0);
glRoot.appendChild(renderer.domElement);

/* ------------------------------------------------------------------ */
/*  shaders                                                            */
/* ------------------------------------------------------------------ */

const VERT = /* glsl */ `
  uniform float uVel;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 pos = position;
    float w = sin(uv.y * 3.14159265);
    pos.z -= w * uVel * 1.35;
    pos.x += w * uVel * 0.4;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uVel;
  uniform float uHover;
  uniform float uDim;
  uniform float uBlueprint;
  varying vec2 vUv;

  float gray(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  void main() {
    /* motion blur along travel direction */
    float blur = clamp(abs(uVel), 0.0, 1.0) * 0.06;
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 5; i++) {
      float t = float(i) / 4.0 - 0.5;
      acc += texture2D(uMap, vUv + vec2(uVel * 0.012, t * blur)).rgb;
    }
    acc /= 5.0;

    /* concrete duotone grade */
    float g = smoothstep(0.02, 0.92, gray(acc));
    g = pow(g, 0.72);
    vec3 duo = mix(vec3(0.05, 0.048, 0.045), vec3(0.95, 0.93, 0.88), g);

    /* ---- blueprint pass: edge-traced wireframe on technical paper ---- */
    vec2 px = vec2(1.7 / 720.0, 1.7 / 960.0);
    float c0 = gray(texture2D(uMap, vUv).rgb);
    float cx = gray(texture2D(uMap, vUv + vec2(px.x, 0.0)).rgb);
    float cy = gray(texture2D(uMap, vUv + vec2(0.0, px.y)).rgb);
    float edge = clamp((abs(c0 - cx) + abs(c0 - cy)) * 5.5, 0.0, 1.0);
    /* fine drafting grid in uv space */
    vec2 gd = abs(fract(vUv * 11.0) - 0.5);
    float grid = (1.0 - smoothstep(0.0, 0.06, min(gd.x, gd.y))) * 0.32;
    float bp = clamp(edge + grid, 0.0, 1.0);
    vec3 navy = vec3(0.043, 0.067, 0.102);
    vec3 cyan = vec3(0.44, 0.71, 0.92);
    vec3 blueprintCol = mix(navy, cyan, bp);

    /* base = duotone OR blueprint; real photo bleeds in on hover (both modes) */
    vec3 base = mix(duo, blueprintCol, uBlueprint);
    vec3 col = mix(base, acc, uHover);
    col *= uDim;

    /* rounded corners via uv-space sdf */
    vec2 r = vec2(0.05, 0.0375);
    vec2 q = abs(vUv - 0.5) - (vec2(0.5) - r);
    float d = length(max(q / r, 0.0));
    float alpha = 1.0 - step(1.0, d);

    gl_FragColor = vec4(col, alpha);
  }
`;

/* ------------------------------------------------------------------ */
/*  textures                                                           */
/* ------------------------------------------------------------------ */

function fallbackTexture(i) {
  const c = document.createElement('canvas');
  c.width = 720; c.height = 960;
  const ctx = c.getContext('2d');
  const tones = [['#1c1a17', '#3e3a33'], ['#26221e', '#544e44'], ['#171614', '#2f2c27']];
  const [a, b] = tones[i % tones.length];
  const grad = ctx.createLinearGradient(0, 0, 720, 960);
  grad.addColorStop(0, a);
  grad.addColorStop(1, b);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 720, 960);
  ctx.fillStyle = 'rgba(236,231,223,0.9)';
  ctx.font = '400 300px Anton, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(i + 1).padStart(2, '0'), 360, 440);
  ctx.font = '30px Space Grotesk, sans-serif';
  ctx.fillText('RD2 ENGENHARIA', 360, 760);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

let loadedCount = 0;
let realProgress = 0;

function loadTexture(work, i) {
  return new Promise((resolve) => {
    new THREE.TextureLoader().load(
      work.url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        bump(); resolve(tex);
      },
      undefined,
      () => { bump(); resolve(fallbackTexture(i)); }
    );
  });
  function bump() {
    loadedCount += 1;
    realProgress = loadedCount / N;
  }
}

/* ------------------------------------------------------------------ */
/*  meshes                                                             */
/* ------------------------------------------------------------------ */

const geometry = new THREE.PlaneGeometry(PLANE_W, PLANE_H, 24, 32);
const items = [];

WORKS.forEach((work, i) => {
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uMap:       { value: fallbackTexture(i) },
      uVel:       { value: 0 },
      uHover:     { value: 0 },
      uDim:       { value: 1 },
      uBlueprint: { value: 0 },
    },
    side: THREE.DoubleSide,
    transparent: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData = { index: i, hover: 0, hoverTarget: 0, intro: 0, theta: 0, listX: 0 };
  scene.add(mesh);
  items.push(mesh);
  loadTexture(work, i).then((tex) => { material.uniforms.uMap.value = tex; });
});

/* ------------------------------------------------------------------ */
/*  scroll state                                                       */
/* ------------------------------------------------------------------ */

let scrollTarget = 0;
let scrollCurrent = 0;
let velocity = 0;
let smoothVel = 0;
let menuOpen = false;
let started = false;
let hintShown = false;
let heroChromeReady = false;

/* 0 no topo da página -> 1 quando o conteúdo cobre o hero */
let heroProgress = 0;
const heroActive = () => heroProgress < 0.5;

const layoutState = { progress: 0 };  // 0 = spiral, 1 = list
let currentView = 'spiral';

const blueprintState = { value: 0 };  // 0 = foto, 1 = prancheta
let blueprintOn = false;

const wrap = (v, total) => ((v % total) + total) % total;

/* page scroll drives the spiral while the hero is visible */
let lastScrollY = window.scrollY;
addEventListener('scroll', () => {
  const y = window.scrollY;
  const dy = y - lastScrollY;
  lastScrollY = y;
  heroProgress = Math.min(y / (innerHeight * 0.85), 1);
  if (!menuOpen && started && heroProgress < 1) scrollTarget += dy * 0.0026;
  if (y > 8) dismissHint();
}, { passive: true });

/* drag rotates the spiral (horizontal intent only, hero visible) */
let dragging = false;
let dragMoved = 0;
let lastX = 0, lastY = 0;
let downTime = 0;

addEventListener('pointerdown', (e) => {
  if (menuOpen || !started || !heroActive()) return;
  if (e.target.closest('.header, .menu, a, button')) return;
  dragging = true;
  dragMoved = 0;
  lastX = e.clientX;
  lastY = e.clientY;
  downTime = performance.now();
});

addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / innerHeight) * 2 + 1;
  if (!dragging) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  dragMoved += Math.abs(dx) + Math.abs(dy);
  scrollTarget += -dx * 0.012;
  if (dragMoved > 8) dismissHint();
});

addEventListener('pointerup', () => {
  if (!dragging) return;
  dragging = false;
  const isClick = dragMoved < 7 && performance.now() - downTime < 350;
  if (isClick && hovered && !menuOpen) focusItem(hovered);
});

function dismissHint() {
  if (hintShown) return;
  hintShown = true;
  gsap.to(scrollHint, { autoAlpha: 0, duration: 0.6, overwrite: true });
}

/* bring a clicked card to the front */
function focusItem(mesh) {
  const u = mesh.userData;
  const offset = layoutState.progress > 0.5 ? u.listX / LINEAR_FACTOR : u.theta;
  scrollProxy.value = scrollTarget;
  gsap.to(scrollProxy, {
    value: scrollTarget + offset,
    duration: 1.1,
    ease: 'power3.inOut',
    overwrite: true,
    onUpdate: () => { scrollTarget = scrollProxy.value; },
  });
}
const scrollProxy = { value: 0 };

/* ------------------------------------------------------------------ */
/*  raycast hover                                                      */
/* ------------------------------------------------------------------ */

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(-10, -10);
let hovered = null;

function updateHover() {
  if (menuOpen || !started || !heroActive()) { setHovered(null); return; }
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(items);
  setHovered(hits.length ? hits[0].object : null);
}

function setHovered(mesh) {
  if (hovered === mesh) return;
  if (hovered) hovered.userData.hoverTarget = 0;
  hovered = mesh;
  if (hovered) hovered.userData.hoverTarget = 1;
  cursorRing.classList.toggle('is-hover', !!hovered);
}

/* ------------------------------------------------------------------ */
/*  work label                                                         */
/* ------------------------------------------------------------------ */

let currentWork = -1;

function updateWorkLabel() {
  let best = 0;
  let bestDist = Infinity;
  for (const mesh of items) {
    const u = mesh.userData;
    const d = layoutState.progress > 0.5 ? Math.abs(u.listX) : Math.abs(u.theta);
    if (d < bestDist) { bestDist = d; best = u.index; }
  }
  if (best === currentWork) return;
  currentWork = best;
  workIndexEl.textContent = String(best + 1).padStart(2, '0');
  workTitleEl.textContent = WORKS[best].title;
  updateSpec(best);
  gsap.fromTo(workTitleEl, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out' });
}

/* ------------------------------------------------------------------ */
/*  view toggle (spiral / list)                                        */
/* ------------------------------------------------------------------ */

viewNav.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-view]');
  if (!btn || btn.dataset.view === currentView) return;
  currentView = btn.dataset.view;
  viewNav.querySelectorAll('[data-view]').forEach((b) =>
    b.classList.toggle('is-active', b === btn));
  gsap.to(layoutState, {
    progress: currentView === 'list' ? 1 : 0,
    duration: 1.4,
    ease: 'expo.inOut',
  });
});

/* ------------------------------------------------------------------ */
/*  modo projeto (prancheta)                                           */
/* ------------------------------------------------------------------ */

modeBtn.addEventListener('click', () => {
  blueprintOn = !blueprintOn;
  document.body.classList.toggle('blueprint', blueprintOn);
  modeBtn.querySelector('.mode-btn__label').textContent = blueprintOn ? 'foto' : 'projeto';
  gsap.to(blueprintState, {
    value: blueprintOn ? 1 : 0,
    duration: 1.1,
    ease: 'power2.inOut',
  });
});

function updateSpec(index) {
  const w = WORKS[index];
  specSheet.textContent = `folha ${String(index + 1).padStart(2, '0')} / ${String(N).padStart(2, '0')}`;
  specName.textContent = w.title.split(' — ')[0];
  specArea.textContent = `área — ${w.area}`;
  specTipo.textContent = `tipo — ${w.tipo}`;
  specStatus.textContent = `status — ${w.status}`;
}

/* ------------------------------------------------------------------ */
/*  menu                                                               */
/* ------------------------------------------------------------------ */

const menuTl = gsap.timeline({ paused: true });
menuTl
  .set(menuEl, { visibility: 'visible' })
  .to('.menu__panel', { y: 0, yPercent: 0, duration: 0.9, ease: 'expo.inOut',
      startAt: { yPercent: -101 } }, 0)
  .fromTo('.menu__links a',
    { yPercent: 60, opacity: 0 },
    { yPercent: 0, opacity: 1, duration: 0.7, stagger: 0.07, ease: 'power3.out' }, 0.45)
  .fromTo('.menu__footer',
    { opacity: 0, y: 16 },
    { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, 0.7);

function toggleMenu(open) {
  menuOpen = open;
  menuEl.classList.toggle('is-open', menuOpen);
  document.body.classList.toggle('menu-open', menuOpen);
  menuBtn.querySelector('.menu-btn__label').textContent = menuOpen ? 'fechar' : 'menu';
  if (menuOpen) menuTl.timeScale(1).play();
  else menuTl.timeScale(1.35).reverse();
}

menuBtn.addEventListener('click', () => toggleMenu(!menuOpen));

/* menu + anchor links scroll to sections */
document.querySelectorAll('[data-scroll]').forEach((a) =>
  a.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    const wasOpen = menuOpen;
    if (menuOpen) toggleMenu(false);
    gsap.to(window, {
      scrollTo: { y: target, offsetY: 0 },
      duration: 1.2,
      ease: 'power3.inOut',
      delay: wasOpen ? 0.3 : 0,
    });
  }));

document.querySelectorAll('[data-scroll-top]').forEach((a) =>
  a.addEventListener('click', (e) => {
    e.preventDefault();
    gsap.to(window, { scrollTo: 0, duration: 1.4, ease: 'power3.inOut' });
  }));

/* ------------------------------------------------------------------ */
/*  custom cursor                                                      */
/* ------------------------------------------------------------------ */

const dotX = gsap.quickTo(cursorEl, 'x', { duration: 0.12, ease: 'power3' });
const dotY = gsap.quickTo(cursorEl, 'y', { duration: 0.12, ease: 'power3' });
const ringX = gsap.quickTo(cursorRing, 'x', { duration: 0.45, ease: 'power3' });
const ringY = gsap.quickTo(cursorRing, 'y', { duration: 0.45, ease: 'power3' });

addEventListener('mousemove', (e) => {
  dotX(e.clientX); dotY(e.clientY);
  ringX(e.clientX); ringY(e.clientY);
});

document.querySelectorAll('[data-cursor]').forEach((el) => {
  el.addEventListener('mouseenter', () => cursorRing.classList.add('is-hover'));
  el.addEventListener('mouseleave', () => cursorRing.classList.remove('is-hover'));
});

/* ------------------------------------------------------------------ */
/*  render loop                                                        */
/* ------------------------------------------------------------------ */

const camTarget = new THREE.Vector2(0, 0);
const clock = new THREE.Clock();

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);

  /* slow idle drift in spiral view */
  if (started && !dragging && !menuOpen && layoutState.progress < 0.5 && heroActive() && !reduceMotion) {
    scrollTarget += dt * 0.018;
  }

  scrollCurrent += (scrollTarget - scrollCurrent) * (1 - Math.pow(0.0015, dt));
  velocity = scrollTarget - scrollCurrent;
  smoothVel += (velocity - smoothVel) * 0.08;
  const velClamped = THREE.MathUtils.clamp(smoothVel, -0.9, 0.9);

  const p = layoutState.progress;
  const linearScroll = scrollCurrent * LINEAR_FACTOR;

  for (const mesh of items) {
    const u = mesh.userData;

    /* spiral placement */
    const theta = wrap(u.index * ANGLE_STEP - scrollCurrent + HALF, TOTAL) - HALF;
    u.theta = theta;
    const sx = -Math.sin(theta) * RADIUS;
    const sy = -theta * PITCH;
    const sz = Math.cos(theta) * RADIUS - RADIUS;
    const sRotY = -theta;

    /* list placement */
    const lx = wrap(u.index * SPACING - linearScroll + HALF_W, TOTAL_W) - HALF_W;
    u.listX = lx;

    mesh.position.x = THREE.MathUtils.lerp(sx, lx, p);
    mesh.position.y = THREE.MathUtils.lerp(sy, 0, p);
    mesh.position.z = THREE.MathUtils.lerp(sz, 0, p);
    mesh.rotation.y = THREE.MathUtils.lerp(sRotY, 0, p);

    /* hover ease */
    u.hover += (u.hoverTarget - u.hover) * 0.1;

    const s = (u.intro || 0) * (1 + u.hover * 0.05);
    mesh.scale.setScalar(Math.max(s, 0.0001));

    /* depth dimming (spiral only) */
    const depthDim = THREE.MathUtils.clamp(
      THREE.MathUtils.mapLinear(sz, -RADIUS * 2, 0, 0.34, 1), 0.34, 1);
    const uniforms = mesh.material.uniforms;
    uniforms.uDim.value = THREE.MathUtils.lerp(depthDim, 1, p) + u.hover * 0.05;
    uniforms.uVel.value = velClamped;
    uniforms.uHover.value = u.hover;
    uniforms.uBlueprint.value = blueprintState.value;
  }

  /* camera parallax */
  camTarget.x = pointer.x * 0.35;
  camTarget.y = pointer.y * 0.25;
  camera.position.x += (camTarget.x - camera.position.x) * 0.04;
  camera.position.y += (camTarget.y - camera.position.y) * 0.04;
  camera.lookAt(0, 0, 0);

  /* fade hero chrome out as the page content scrolls over it */
  if (heroChromeReady) {
    const fade = Math.max(1 - heroProgress * 1.3, 0);
    const vis = fade > 0.01 ? 'visible' : 'hidden';
    for (const el of [heroEl, badge, workLabel]) {
      el.style.opacity = fade;
      el.style.visibility = vis;
    }
  }
  if (started) {
    glRoot.style.opacity = Math.max(1 - heroProgress * 1.05, 0);
    viewNav.classList.toggle('is-hidden', !heroActive());
  }

  updateHover();
  if (started) updateWorkLabel();

  /* pula o render quando o conteúdo já cobre o 3D (economiza GPU/bateria) */
  if (heroProgress < 0.995) renderer.render(scene, camera);
}
tick();

/* ------------------------------------------------------------------ */
/*  resize                                                             */
/* ------------------------------------------------------------------ */

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.position.z = camera.aspect < 0.9 ? 12 : 8.6;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', onResize);
onResize();

/* ------------------------------------------------------------------ */
/*  section reveals + stat counters                                    */
/* ------------------------------------------------------------------ */

if (reduceMotion) {
  /* sem animação: tudo já no estado final */
  gsap.set('.reveal, .reveal-lines', { opacity: 1, y: 0 });
  document.querySelectorAll('.stat__num').forEach((el) => {
    el.textContent = el.dataset.count;
  });
} else {
  document.querySelectorAll('.reveal, .reveal-lines').forEach((el) => {
    gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: 1.1,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 86%' },
    });
  });
  gsap.set('.reveal-lines', { opacity: 0, y: 40 });

  document.querySelectorAll('.stat__num').forEach((el) => {
    const target = Number(el.dataset.count);
    const counter = { value: 0 };
    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () =>
        gsap.to(counter, {
          value: target,
          duration: 1.8,
          ease: 'power2.out',
          onUpdate: () => { el.textContent = Math.round(counter.value); },
        }),
    });
  });
}

/* ------------------------------------------------------------------ */
/*  preloader + intro                                                  */
/* ------------------------------------------------------------------ */

let displayed = 0;
let introPlayed = false;

function preloaderTick() {
  if (introPlayed) return;
  displayed += (realProgress * 100 - displayed) * 0.06;
  if (realProgress >= 1 && displayed > 99.2) displayed = 100;
  preloaderCount.textContent = Math.round(displayed);
  preloaderBar.style.transform = `scaleX(${displayed / 100})`;
  if (displayed >= 100) { playIntro(); return; }
  requestAnimationFrame(preloaderTick);
}
preloaderTick();

/* safety: if network stalls, force-finish after 8s */
setTimeout(() => { realProgress = 1; }, 8000);

function playIntro() {
  if (introPlayed) return;
  introPlayed = true;

  /* start at the top so the spiral is in view */
  window.scrollTo(0, 0);

  /* pre-spin the spiral so it settles into place */
  scrollCurrent = scrollTarget - 2.4;

  const tl = gsap.timeline({
    defaults: { ease: 'expo.out' },
    onStart: () => { started = true; },
  });

  tl.to(preloader, {
    yPercent: -100,
    duration: 1.1,
    ease: 'power4.inOut',
    onComplete: () => preloader.remove(),
  });

  /* cards bloom in */
  items.forEach((mesh, i) => {
    tl.to(mesh.userData, { intro: 1, duration: 1.4, ease: 'expo.out' }, 0.55 + i * 0.05);
  });

  tl.to('.hero__title .char',
    { yPercent: 0, duration: 1.2, stagger: 0.045, ease: 'power4.out' }, 0.8)
  .to(heroEyebrow, { opacity: 1, duration: 0.8, ease: 'power2.out' }, 1.3)
  .to([badge, workLabel], { opacity: 1, duration: 0.8, stagger: 0.1 }, 1.4)
  .to(scrollHint, { opacity: 1, duration: 0.8 }, 1.6)
  .add(() => { heroChromeReady = true; }, 2.4);
}

/* ------------------------------------------------------------------ */
/*  comparador antes & depois (arraste)                                */
/* ------------------------------------------------------------------ */

(() => {
  const ad = document.getElementById('adCompare');
  if (!ad) return;
  const handle = document.getElementById('adHandle');
  let active = false;

  const setPos = (clientX) => {
    const r = ad.getBoundingClientRect();
    const p = Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100));
    ad.style.setProperty('--pos', p + '%');
  };

  ad.addEventListener('pointerdown', (e) => {
    active = true;
    ad.setPointerCapture(e.pointerId);
    setPos(e.clientX);
  });
  ad.addEventListener('pointermove', (e) => { if (active) setPos(e.clientX); });
  const stop = () => { active = false; };
  ad.addEventListener('pointerup', stop);
  ad.addEventListener('pointercancel', stop);

  /* acessibilidade: setas movem o handle */
  if (handle) handle.addEventListener('keydown', (e) => {
    const cur = parseFloat(getComputedStyle(ad).getPropertyValue('--pos')) || 50;
    if (e.key === 'ArrowLeft')  ad.style.setProperty('--pos', Math.max(0, cur - 4) + '%');
    if (e.key === 'ArrowRight') ad.style.setProperty('--pos', Math.min(100, cur + 4) + '%');
  });
})();

/* ------------------------------------------------------------------ */
/*  detalhe da obra (modal a partir do grid)                           */
/* ------------------------------------------------------------------ */

(() => {
  const modal = document.getElementById('obraModal');
  if (!modal) return;
  const img = document.getElementById('omImg');
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v || '—'; };
  let lastFocus = null;

  const open = (fig) => {
    const d = fig.dataset;
    if (!d.name) return;
    img.src = d.img || '';
    img.alt = d.name;
    set('omName', d.name);
    set('omLocal', d.local);
    set('omArea', d.area);
    set('omAno', d.ano);
    set('omEscopo', d.escopo);
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    lastFocus = document.activeElement;
    modal.querySelector('.obra-modal__close').focus();
  };
  const close = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };

  document.querySelectorAll('.obra[data-name]').forEach((fig) => {
    fig.addEventListener('click', () => open(fig));
  });
  modal.querySelectorAll('[data-obra-close]').forEach((el) =>
    el.addEventListener('click', close));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) close();
  });
})();

/* ------------------------------------------------------------------ */
/*  formulário: trava enquanto o endpoint não está configurado         */
/* ------------------------------------------------------------------ */

(() => {
  const form = document.getElementById('orcamentoForm');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    if (form.getAttribute('action').includes('SEU_ID_AQUI')) {
      e.preventDefault();
      const note = document.getElementById('formNote');
      if (note) {
        note.hidden = false;
        note.textContent = 'configure o endpoint do formulário (action) para ativar o envio.';
      }
    }
  });
})();
