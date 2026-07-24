import * as THREE from '../vendor/three.module.js';
import { WORDS, wordById } from './words.js';
import { SpeechListener } from './speech.js';
import { GameAudio } from './audio.js';
import { Garden } from './garden.js';
import { Game } from './game.js';
import { setupUI } from './ui.js';

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#e3eff7');
scene.fog = new THREE.Fog('#e3eff7', 8, 26);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.05, 60);
camera.position.set(0, 1.5, 0);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------- lighting
const hemi = new THREE.HemisphereLight('#fdf7e8', '#9fc79a', 1.1);
const dir = new THREE.DirectionalLight('#fff6df', 1.2);
dir.position.set(3, 6, 2);
scene.add(hemi, dir);

// ---------------------------------------------------------------- environment
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(22, 48),
  new THREE.MeshLambertMaterial({ color: '#b9dcb0' }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

function softTree(x, z, s = 1) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09 * s, 0.13 * s, 0.7 * s, 8),
    new THREE.MeshLambertMaterial({ color: '#a8886a' }),
  );
  trunk.position.y = 0.35 * s;
  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(0.55 * s, 14, 12),
    new THREE.MeshLambertMaterial({ color: '#8fbf85' }),
  );
  crown.position.y = 0.95 * s;
  crown.scale.y = 0.9;
  g.add(trunk, crown);
  g.position.set(x, 0, z);
  return g;
}
[[-5, -7, 1.6], [4.5, -8, 1.9], [-8, -3, 1.3], [7.5, -4, 1.4], [-3.5, -11, 2.2], [2.8, -12, 2.0]]
  .forEach(([x, z, s]) => scene.add(softTree(x, z, s)));

// A few soft clouds
const cloudMat = new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 });
[[-4, 6, -14], [5, 7, -16], [0, 8, -18]].forEach(([x, y, z]) => {
  const c = new THREE.Group();
  [[0, 0, 0, 1], [0.8, 0.1, 0, 0.7], [-0.8, 0.05, 0, 0.75]].forEach(([cx, cy, cz, cs]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.9 * cs, 12, 10), cloudMat);
    m.position.set(cx, cy, cz);
    m.scale.y = 0.6;
    c.add(m);
  });
  c.position.set(x, y, z);
  scene.add(c);
});

// ---------------------------------------------------------------- canvas helpers
function canvasTexture(draw, w = 1024, h = 1024) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawWordCard(ctx, w, h, { emoji, word, showWord, color }) {
  ctx.clearRect(0, 0, w, h);
  roundRect(ctx, 24, 24, w - 48, h - 48, 90);
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.fill();
  ctx.lineWidth = 14;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '440px "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  ctx.fillText(emoji, w / 2, h * 0.42);
  ctx.font = 'bold 170px "Arial Rounded MT Bold", "Comic Sans MS", sans-serif';
  ctx.fillStyle = showWord ? '#41525f' : '#a9b8c4';
  ctx.fillText(showWord ? word : '?', w / 2, h * 0.82);
}

// ---------------------------------------------------------------- word card
const cardMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
const card = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.85), cardMat);
card.position.set(0, 1.35, -1.5);
scene.add(card);
let cardState = null;

function setCard(entry, showWord) {
  cardState = { entry, showWord };
  if (cardMat.map) cardMat.map.dispose();
  cardMat.map = canvasTexture((ctx, w, h) =>
    drawWordCard(ctx, w, h, { emoji: entry.emoji, word: entry.word, showWord, color: entry.color }));
  cardMat.needsUpdate = true;
}

// ---------------------------------------------------------------- guide blob
const guide = new THREE.Group();
const blob = new THREE.Mesh(
  new THREE.SphereGeometry(0.26, 24, 20),
  new THREE.MeshLambertMaterial({ color: '#a8d8c8' }),
);
blob.scale.y = 1.12;
const face = new THREE.Mesh(
  new THREE.PlaneGeometry(0.3, 0.3),
  new THREE.MeshBasicMaterial({
    transparent: true,
    map: canvasTexture((ctx, w, h) => {
      ctx.fillStyle = '#3a4a55';
      ctx.beginPath(); ctx.arc(w * 0.35, h * 0.4, 34, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(w * 0.65, h * 0.4, 34, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 22; ctx.strokeStyle = '#3a4a55'; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(w * 0.5, h * 0.52, 130, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
    }, 512, 512),
  }),
);
face.position.set(0, 0.02, 0.245);
guide.add(blob, face);
guide.position.set(-0.75, 1.0, -1.55);
guide.rotation.y = 0.35;
scene.add(guide);

// ---------------------------------------------------------------- mic indicator
const micGlow = new THREE.Mesh(
  new THREE.SphereGeometry(0.06, 18, 16),
  new THREE.MeshBasicMaterial({ color: '#7fb8e8', transparent: true, opacity: 0 }),
);
micGlow.position.set(0, 0.78, -1.35);
scene.add(micGlow);

// ---------------------------------------------------------------- sparkles
const sparkleGroups = [];
function sparkleBurst(intensity = 1) {
  const n = Math.floor(40 * intensity);
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  const vel = [];
  for (let i = 0; i < n; i++) {
    pos[i * 3] = card.position.x + (Math.random() - 0.5) * 0.2;
    pos[i * 3 + 1] = card.position.y + (Math.random() - 0.5) * 0.2;
    pos[i * 3 + 2] = card.position.z + (Math.random() - 0.5) * 0.2;
    const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI;
    const sp = 0.25 + Math.random() * 0.4;
    vel.push(new THREE.Vector3(Math.cos(a) * Math.sin(e) * sp, Math.cos(e) * sp * 0.8 + 0.15, Math.sin(a) * Math.sin(e) * sp * 0.4));
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: '#ffe9a8', size: 0.025, transparent: true, opacity: 0.95 });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  sparkleGroups.push({ pts, vel, life: 0 });
}

// ---------------------------------------------------------------- garden plants
const plantGroup = new THREE.Group();
scene.add(plantGroup);
function rebuildGarden(garden) {
  plantGroup.clear();
  const ids = garden.plantedIds;
  ids.forEach((id, i) => {
    const entry = wordById(id);
    if (!entry) return;
    const p = garden.plant(id);
    const angle = -Math.PI / 2 + (i - (ids.length - 1) / 2) * 0.32;
    const r = 2.6;
    const h = 0.16 + p.bin * 0.09;
    const g = new THREE.Group();
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.02, h, 6),
      new THREE.MeshLambertMaterial({ color: '#7cae74' }),
    );
    stem.position.y = h / 2;
    const bloom = new THREE.Mesh(
      new THREE.PlaneGeometry(0.16 + p.bin * 0.03, 0.16 + p.bin * 0.03),
      new THREE.MeshBasicMaterial({
        transparent: true,
        map: canvasTexture((ctx, w, hh) => {
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.font = '200px "Apple Color Emoji", sans-serif';
          ctx.fillText(entry.emoji, w / 2, hh / 2);
        }, 256, 256),
      }),
    );
    bloom.position.y = h + 0.09;
    g.add(stem, bloom);
    g.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
    g.userData.bloom = bloom;
    plantGroup.add(g);
  });
}

// ---------------------------------------------------------------- big message card
const msgMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
const msgPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.55), msgMat);
msgPlane.position.set(0, 1.9, -1.6);
scene.add(msgPlane);
function setMessage(text, sub = '') {
  if (msgMat.map) msgMat.map.dispose();
  msgMat.map = canvasTexture((ctx, w, h) => {
    roundRect(ctx, 12, 12, w - 24, h - 24, 60);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 120px "Arial Rounded MT Bold", "Comic Sans MS", sans-serif';
    ctx.fillStyle = '#41525f';
    ctx.fillText(text, w / 2, sub ? h * 0.38 : h * 0.5);
    if (sub) {
      ctx.font = '64px "Arial Rounded MT Bold", "Comic Sans MS", sans-serif';
      ctx.fillStyle = '#7a8a96';
      ctx.fillText(sub, w / 2, h * 0.72);
    }
  }, 1024, 432);
  msgMat.needsUpdate = true;
}

// ---------------------------------------------------------------- calm corner
const calmSphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.3, 28, 24),
  new THREE.MeshLambertMaterial({ color: '#c8bce8', transparent: true, opacity: 0 }),
);
calmSphere.position.set(0, 1.35, -1.5);
scene.add(calmSphere);
let calmActive = false;

// ---------------------------------------------------------------- tweens
// The render loop animates tweens, but completion is guaranteed by a
// wall-clock timer — if rendering pauses (headset set down, tab hidden),
// the session flow must keep moving instead of hanging on an animation.
const tweens = [];
function tween(ms, fn) {
  return new Promise((resolve) => {
    const tw = { t: 0, ms, fn, done: false };
    tw.finish = () => {
      if (tw.done) return;
      tw.done = true;
      fn(1);
      const i = tweens.indexOf(tw);
      if (i >= 0) tweens.splice(i, 1);
      resolve();
    };
    tweens.push(tw);
    setTimeout(tw.finish, ms + 50);
  });
}
const fadeTo = (mat, target, ms = 500) => {
  const from = mat.opacity;
  return tween(ms, (k) => { mat.opacity = from + (target - from) * k; });
};

// ---------------------------------------------------------------- world API for the game
let overrideFlag = false;
let listeningVisual = false;
const world = {
  setCard, setMessage, rebuildGarden,
  sparkle: sparkleBurst,
  showCard: async (entry, showWord) => {
    setCard(entry, showWord);
    card.scale.setScalar(0.7);
    await Promise.all([fadeTo(cardMat, 1, 450), tween(450, (k) => card.scale.setScalar(0.7 + 0.3 * easeOut(k)))]);
  },
  revealWord: () => { if (cardState) setCard(cardState.entry, true); },
  hideCard: () => fadeTo(cardMat, 0, 450),
  showMessage: async (text, sub) => { setMessage(text, sub); await fadeTo(msgMat, 1, 450); },
  hideMessage: () => fadeTo(msgMat, 0, 450),
  celebrate: async (intensity) => {
    sparkleBurst(intensity);
    await tween(700, (k) => {
      const s = 1 + Math.sin(k * Math.PI) * 0.18 * intensity;
      card.scale.setScalar(s);
      card.position.y = 1.35 + Math.sin(k * Math.PI) * 0.09;
    });
  },
  setListening: (on) => { listeningVisual = on; overrideFlag = false; },
  get overridePressed() { const v = overrideFlag; overrideFlag = false; return v; },
  get calmActive() { return calmActive; },
  waitCalmEnd: async () => { while (calmActive) await new Promise((r) => setTimeout(r, 200)); },
};
function easeOut(k) { return 1 - Math.pow(1 - k, 3); }

// ---------------------------------------------------------------- calm toggle
async function toggleCalm(audio) {
  calmActive = !calmActive;
  if (calmActive) {
    audio.say('calm');
    fadeTo(cardMat, 0, 800);
    fadeTo(msgMat, 0, 800);
    fadeTo(calmSphere.material, 0.85, 1500);
    tween(1500, (k) => { hemi.intensity = 1.1 - 0.75 * k; dir.intensity = 1.2 - 0.9 * k; });
  } else {
    fadeTo(calmSphere.material, 0, 1200);
    tween(1200, (k) => { hemi.intensity = 0.35 + 0.75 * k; dir.intensity = 0.3 + 0.9 * k; });
  }
}

// ---------------------------------------------------------------- wiring
const audio = new GameAudio();
const listener = new SpeechListener();
const garden = new Garden();
const game = new Game({ world, audio, listener, garden });
rebuildGarden(garden);

// Controllers: trigger = parent "counts as correct" override while listening,
// grip (squeeze) = calm corner toggle.
for (let i = 0; i < 2; i++) {
  const c = renderer.xr.getController(i);
  c.addEventListener('selectstart', () => { overrideFlag = true; });
  c.addEventListener('squeezestart', () => toggleCalm(audio));
  scene.add(c);
}
// Desktop fallback: click/space = override, C = calm.
window.addEventListener('keydown', (e) => {
  if (e.key === ' ') overrideFlag = true;
  if (e.key.toLowerCase() === 'c') toggleCalm(audio);
});
renderer.domElement.addEventListener('pointerdown', () => { overrideFlag = true; });

// ---------------------------------------------------------------- render loop
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // tweens
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t += dt * 1000;
    const k = Math.min(tw.t / tw.ms, 1);
    if (k >= 1) tw.finish();
    else tw.fn(k);
  }

  // guide idle bob (faster wiggle while speaking)
  const speed = audio.speaking ? 7 : 1.6;
  guide.position.y = 1.0 + Math.sin(t * speed) * (audio.speaking ? 0.02 : 0.03);
  guide.rotation.z = Math.sin(t * speed * 0.7) * (audio.speaking ? 0.06 : 0.02);

  // mic indicator pulses with the child's voice level
  if (listeningVisual && !calmActive) {
    const lvl = Math.min(listener.level * 14, 1);
    micGlow.material.opacity += ((0.35 + lvl * 0.6) - micGlow.material.opacity) * 0.25;
    micGlow.scale.setScalar(1 + lvl * 1.6 + Math.sin(t * 2.5) * 0.08);
  } else {
    micGlow.material.opacity *= 0.9;
  }

  // sparkles
  for (let i = sparkleGroups.length - 1; i >= 0; i--) {
    const s = sparkleGroups[i];
    s.life += dt;
    const p = s.pts.geometry.attributes.position;
    for (let j = 0; j < s.vel.length; j++) {
      p.array[j * 3] += s.vel[j].x * dt;
      p.array[j * 3 + 1] += s.vel[j].y * dt;
      p.array[j * 3 + 2] += s.vel[j].z * dt;
      s.vel[j].y -= dt * 0.35;
    }
    p.needsUpdate = true;
    s.pts.material.opacity = Math.max(0, 0.95 - s.life * 0.6);
    if (s.life > 1.8) { scene.remove(s.pts); s.pts.geometry.dispose(); sparkleGroups.splice(i, 1); }
  }

  // calm breathing
  if (calmSphere.material.opacity > 0.01) {
    calmSphere.scale.setScalar(1 + Math.sin(t * (Math.PI / 2)) * 0.12); // ~4s breath cycle
  }

  // plants sway gently
  plantGroup.children.forEach((g, i) => { g.rotation.z = Math.sin(t * 0.8 + i) * 0.05; });

  renderer.render(scene, camera);
});

// ---------------------------------------------------------------- UI / start
setupUI({ renderer, audio, listener, garden, game, world });

// Debug handle (harmless in production; used for flat-screen testing).
window.__wg = { game, audio, listener, garden };
