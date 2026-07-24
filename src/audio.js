// Audio playback: pre-generated voice clips, a soft synthesized chime, and an
// optional very quiet ambient pad. All output passes through one master gain
// with a hard cap so nothing can ever be startlingly loud.
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.buffers = new Map();
    this.volume = 0.7;      // parent setting 0..1
    this.speaking = false;  // game pauses mic listening while true
    this._ambient = null;
  }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    // Cap: even at max parent volume the game stays gentle.
    this.master.gain.value = Math.min(this.volume, 1) * 0.6;
    this.master.connect(this.ctx.destination);
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = Math.min(v, 1) * 0.6;
  }

  async load(name) {
    if (this.buffers.has(name)) return this.buffers.get(name);
    const res = await fetch(`assets/audio/${name}.m4a`);
    const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
    this.buffers.set(name, buf);
    return buf;
  }

  async preload(names) {
    this.ensure();
    await Promise.all(names.map((n) => this.load(n).catch(() => null)));
  }

  // Play a voice clip; resolves when it ends.
  async say(name) {
    this.ensure();
    const buf = await this.load(name).catch(() => null);
    if (!buf) return;
    this.speaking = true;
    await new Promise((resolve) => {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.master);
      src.onended = resolve;
      src.start();
    });
    // Small tail so the mic doesn't pick up the speaker's echo as an attempt.
    await new Promise((r) => setTimeout(r, 350));
    this.speaking = false;
  }

  // Gentle two-note chime (synthesized, nothing sudden).
  chime(intensity = 1) {
    this.ensure();
    const t = this.ctx.currentTime;
    [[523.25, 0], [659.25, 0.18], [783.99, 0.36]].forEach(([freq, dt], i) => {
      if (intensity < 0.6 && i === 2) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t + dt);
      g.gain.linearRampToValueAtTime(0.12 * intensity, t + dt + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t + dt + 1.1);
      osc.connect(g).connect(this.master);
      osc.start(t + dt);
      osc.stop(t + dt + 1.2);
    });
  }

  ambientOn() {
    this.ensure();
    if (this._ambient) return;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.025, this.ctx.currentTime + 4); // very soft fade-in
    g.connect(this.master);
    const oscs = [196, 196.6, 294].map((f) => {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.connect(g);
      o.start();
      return o;
    });
    this._ambient = { g, oscs };
  }

  ambientOff() {
    if (!this._ambient) return;
    const { g, oscs } = this._ambient;
    g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.5);
    setTimeout(() => oscs.forEach((o) => o.stop()), 1700);
    this._ambient = null;
  }
}
