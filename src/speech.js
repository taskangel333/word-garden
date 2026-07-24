// Speech input, staged for forgiveness:
//   Stage 1 (default): voice-activity detection — any clear vocal attempt counts.
//   Stage 2 (optional): if window.WORD_GARDEN_CONFIG.transcribeUrl is set, the
//   attempt audio is also sent to a transcription endpoint and fuzzy-matched,
//   but a VAD-detected attempt STILL counts as success if matching fails.
//   Recognition problems must never read as "you failed".

export class SpeechListener {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.stream = null;
    this.level = 0;          // smoothed 0..1-ish RMS, for the mic indicator
    this.noiseFloor = 0.01;
    this.sensitivity = 0.5;  // 0..1 from parent settings (higher = easier)
    this._raf = null;
  }

  async init() {
    if (this.stream) return true;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      src.connect(this.analyser);
      this._buf = new Float32Array(this.analyser.fftSize);
      this._monitor();
      return true;
    } catch (err) {
      console.warn('Microphone unavailable:', err);
      return false;
    }
  }

  _rms() {
    this.analyser.getFloatTimeDomainData(this._buf);
    let sum = 0;
    for (let i = 0; i < this._buf.length; i++) sum += this._buf[i] * this._buf[i];
    return Math.sqrt(sum / this._buf.length);
  }

  _monitor() {
    const tick = () => {
      if (this.analyser) {
        const rms = this._rms();
        this.level = this.level * 0.8 + rms * 0.2;
      }
      this._raf = requestAnimationFrame(tick);
    };
    tick();
  }

  // Sample ambient noise so the speech threshold adapts to the room.
  async calibrate(ms = 800) {
    if (!this.analyser) return;
    const samples = [];
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      samples.push(this._rms());
      await new Promise((r) => setTimeout(r, 40));
    }
    samples.sort((a, b) => a - b);
    this.noiseFloor = samples[Math.floor(samples.length * 0.9)] || 0.01;
  }

  get threshold() {
    // sensitivity 1 → barely above noise; sensitivity 0 → needs a clear voice
    const margin = 0.09 - this.sensitivity * 0.075;
    return Math.max(this.noiseFloor * 1.8, this.noiseFloor + margin);
  }

  /**
   * Listen for a vocal attempt.
   * Resolves { attempted, transcript } — attempted=true when voice was
   * sustained ~250ms cumulatively. Never rejects.
   */
  listen({ timeoutMs = 8000, signal } = {}) {
    return new Promise((resolve) => {
      if (!this.analyser) {
        // No microphone: keep the listening window open so the parent's
        // override button still has its normal window to respond.
        setTimeout(() => resolve({ attempted: false, transcript: null }), timeoutMs);
        return;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();

      let voicedMs = 0;
      let last = performance.now();
      const t0 = last;
      let recorder = null;
      let chunks = [];
      const cfg = window.WORD_GARDEN_CONFIG || {};
      if (cfg.transcribeUrl && window.MediaRecorder) {
        try {
          recorder = new MediaRecorder(this.stream);
          recorder.ondataavailable = (e) => chunks.push(e.data);
          recorder.start();
        } catch { recorder = null; }
      }

      const finish = async (attempted) => {
        clearInterval(iv);
        let transcript = null;
        if (recorder && recorder.state !== 'inactive') {
          try {
            const done = new Promise((r) => (recorder.onstop = r));
            recorder.stop();
            await done;
            if (attempted && chunks.length) {
              transcript = await this._transcribe(new Blob(chunks, { type: recorder.mimeType }), cfg);
            }
          } catch { /* transcription is best-effort only */ }
        }
        resolve({ attempted, transcript });
      };

      const iv = setInterval(() => {
        const now = performance.now();
        const dt = now - last;
        last = now;
        if (signal?.aborted) return finish(false);
        if (this.level > this.threshold) voicedMs += dt;
        if (voicedMs > 250) {
          // Heard a real attempt — keep the mic open a moment so a spoken
          // word is fully captured for optional transcription, then succeed.
          clearInterval(iv);
          setTimeout(() => finish(true), recorder ? 900 : 250);
        } else if (now - t0 > timeoutMs) {
          finish(false);
        }
      }, 30);
    });
  }

  async _transcribe(blob, cfg) {
    try {
      const res = await fetch(cfg.transcribeUrl, {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'audio/webm' },
        body: blob,
      });
      if (!res.ok) return null;
      const data = await res.json();
      return (data.text || '').trim().toLowerCase() || null;
    } catch { return null; }
  }
}

// Very forgiving fuzzy match: exact word inclusion, or first-sound match, or
// small edit distance. A miss NEVER blocks success — callers only use this to
// upgrade the celebration, not to gate it.
export function fuzzyWordMatch(transcript, targetWord) {
  if (!transcript) return false;
  const t = transcript.toLowerCase().replace(/[^a-z\s]/g, '');
  const target = targetWord.toLowerCase();
  if (t.includes(target)) return true;
  for (const token of t.split(/\s+/)) {
    if (!token) continue;
    if (token[0] === target[0] && Math.abs(token.length - target.length) <= 2) return true;
    if (editDistance(token, target) <= Math.max(1, Math.floor(target.length / 3))) return true;
  }
  return false;
}

function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  return dp[a.length][b.length];
}
