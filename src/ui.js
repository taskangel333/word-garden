// Start screen + parent settings panel (2D DOM, shown before/after sessions).
import { WORDS } from './words.js';

const SETTINGS_KEY = 'word-garden-settings-v1';
const CLIP_NAMES = [
  'hello', 'goodbye', 'whats-this', 'good-try', 'calm',
  'praise1', 'praise2', 'praise3', 'praise4',
  ...WORDS.flatMap((w) => [w.id, `${w.id}-only`]),
];

export function setupUI({ renderer, audio, listener, garden, game, world }) {
  const overlay = document.getElementById('overlay');
  const categories = [...new Set(WORDS.map((w) => w.category))];
  const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  const s = {
    sessionLength: saved.sessionLength ?? 8,
    sensitivity: saved.sensitivity ?? 0.6,
    celebration: saved.celebration ?? 1,
    ambient: saved.ambient ?? false,
    volume: saved.volume ?? 0.7,
    enabledCats: saved.enabledCats ?? categories,
  };

  overlay.innerHTML = `
    <div class="panel">
      <h1>🌱 Word Garden</h1>
      <p class="tag">Say the word — watch it come alive!</p>
      <p class="stickers">⭐ Stickers collected: <b id="sticker-count">${garden.stickerCount}</b>
         &nbsp;·&nbsp; 🌸 Words growing: <b id="plant-count">${garden.plantedIds.length}</b></p>
      <div class="buttons">
        <button id="btn-vr" class="big" hidden>🥽 Enter VR</button>
        <button id="btn-flat" class="big alt">▶️ Play here (no headset)</button>
      </div>
      <details id="parent-settings">
        <summary>👨‍👦 Parent settings</summary>
        <label>Words per session: <span id="len-val">${s.sessionLength}</span>
          <input id="set-len" type="range" min="4" max="12" step="1" value="${s.sessionLength}"></label>
        <label>Listening ease (higher = quieter voice counts): <span id="sen-val">${Math.round(s.sensitivity * 100)}%</span>
          <input id="set-sen" type="range" min="0" max="1" step="0.05" value="${s.sensitivity}"></label>
        <label>Celebration intensity: <span id="cel-val">${Math.round(s.celebration * 100)}%</span>
          <input id="set-cel" type="range" min="0.3" max="1" step="0.05" value="${s.celebration}"></label>
        <label>Voice volume: <span id="vol-val">${Math.round(s.volume * 100)}%</span>
          <input id="set-vol" type="range" min="0.2" max="1" step="0.05" value="${s.volume}"></label>
        <label class="row"><input id="set-amb" type="checkbox" ${s.ambient ? 'checked' : ''}> Soft background sound</label>
        <div class="cats">Word groups:
          ${categories.map((c) => `<label class="row"><input type="checkbox" class="cat" data-cat="${c}" ${s.enabledCats.includes(c) ? 'checked' : ''}> ${c}</label>`).join('')}
        </div>
        <button id="btn-reset" class="danger">Reset garden (start over)</button>
      </details>
      <p class="help">During play: the <b>trigger</b> button = “counts as correct!” ·
        the <b>grip</b> button = calm break · keep sessions short &amp; supervised 💙</p>
    </div>`;

  const $ = (id) => document.getElementById(id);

  function showToast(text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('show'), 30);
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 600); }, 6000);
  }

  const persist = () => localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  const applySettings = () => {
    game.settings.sessionLength = s.sessionLength;
    game.settings.sensitivity = s.sensitivity;
    game.settings.celebration = s.celebration;
    game.settings.enabledIds = WORDS.filter((w) => s.enabledCats.includes(w.category)).map((w) => w.id);
    listener.sensitivity = s.sensitivity;
    audio.setVolume(s.volume);
  };
  applySettings();

  $('set-len').oninput = (e) => { s.sessionLength = +e.target.value; $('len-val').textContent = s.sessionLength; persist(); applySettings(); };
  $('set-sen').oninput = (e) => { s.sensitivity = +e.target.value; $('sen-val').textContent = `${Math.round(s.sensitivity * 100)}%`; persist(); applySettings(); };
  $('set-cel').oninput = (e) => { s.celebration = +e.target.value; $('cel-val').textContent = `${Math.round(s.celebration * 100)}%`; persist(); applySettings(); };
  $('set-vol').oninput = (e) => { s.volume = +e.target.value; $('vol-val').textContent = `${Math.round(s.volume * 100)}%`; persist(); applySettings(); };
  $('set-amb').onchange = (e) => { s.ambient = e.target.checked; persist(); };
  overlay.querySelectorAll('.cat').forEach((cb) => {
    cb.onchange = () => {
      s.enabledCats = [...overlay.querySelectorAll('.cat')].filter((c) => c.checked).map((c) => c.dataset.cat);
      if (!s.enabledCats.length) { cb.checked = true; s.enabledCats = [cb.dataset.cat]; }
      persist(); applySettings();
    };
  });
  $('btn-reset').onclick = () => {
    if (confirm('Reset the whole garden? All plants and stickers will be gone.')) {
      garden.reset();
      world.rebuildGarden(garden);
      $('sticker-count').textContent = '0';
      $('plant-count').textContent = '0';
    }
  };

  async function beginSession() {
    const micOk = await listener.init();
    if (!micOk) {
      // Never dead-end: play without the mic — the parent's trigger/space
      // button marks attempts as correct instead.
      showToast('Microphone is off — press the trigger (or spacebar) when he says the word 💙');
    }
    audio.ensure();
    await audio.preload(CLIP_NAMES);
    if (s.ambient) audio.ambientOn(); else audio.ambientOff();
    overlay.classList.add('hidden');
    game.start();
    return true;
  }

  // Flat-screen play (testing on a laptop/phone)
  $('btn-flat').onclick = () => beginSession();

  // WebXR entry
  if (navigator.xr) {
    navigator.xr.isSessionSupported('immersive-vr').then((ok) => {
      if (!ok) return;
      const btn = $('btn-vr');
      btn.hidden = false;
      btn.onclick = async () => {
        try {
          const session = await navigator.xr.requestSession('immersive-vr', {
            optionalFeatures: ['local-floor'],
          });
          await renderer.xr.setSession(session);
          session.addEventListener('end', () => overlay.classList.remove('hidden'));
          await beginSession();
        } catch (err) {
          console.warn('Could not enter VR:', err);
          alert('Could not enter VR — try again, or use "Play here".');
        }
      };
    });
  }

  document.addEventListener('session-ended', () => {
    $('sticker-count').textContent = garden.stickerCount;
    $('plant-count').textContent = garden.plantedIds.length;
    // In VR the headset stays in the scene (garden is visible); on flat screen
    // bring the menu back so the parent can start the next session.
    if (!renderer.xr.isPresenting) overlay.classList.remove('hidden');
  });
}
