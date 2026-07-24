// Session state machine. Structure is IDENTICAL every session (predictability):
//   greeting → word loop (reviews first, then new words) → closing ritual.
// There is no failure state anywhere: attempts always lead to warmth.
import { wordById } from './words.js';
import { buildSession } from './garden.js';
import { fuzzyWordMatch } from './speech.js';

const PRAISE = ['praise1', 'praise2', 'praise3', 'praise4'];

export class Game {
  constructor({ world, audio, listener, garden }) {
    this.world = world;
    this.audio = audio;
    this.listener = listener;
    this.garden = garden;
    this.running = false;
    this.settings = {
      sessionLength: 8,
      sensitivity: 0.6,
      celebration: 1,     // 0.5 = extra gentle
      enabledIds: null,   // set by UI
    };
  }

  async start() {
    if (this.running) return;
    this.running = true;
    const { world, audio, garden } = this;
    this.listener.sensitivity = this.settings.sensitivity;

    garden.startSession();
    const queue = buildSession(garden, {
      length: this.settings.sessionLength,
      enabledIds: this.settings.enabledIds,
    });

    await this.listener.calibrate();

    // -- greeting ritual (same every time)
    await audio.say('hello');
    await this.pauseIfCalm();

    // -- word loop
    let saidCount = 0;
    for (const item of queue) {
      await this.pauseIfCalm();
      const ok = await this.presentWord(item);
      if (ok) saidCount += 1;
      world.rebuildGarden(garden);
      await wait(900);
    }

    // -- closing ritual (same every time)
    await this.world.hideCard();
    await world.showMessage('All done! 🌈', `${saidCount} words today — great work!`);
    await audio.say('goodbye');
    await wait(4000);
    await world.hideMessage();
    this.running = false;
    document.dispatchEvent(new CustomEvent('session-ended', { detail: { saidCount } }));
  }

  async presentWord(item) {
    const { world, audio } = this;
    const entry = wordById(item.id);
    const recall = item.mode === 'recall';

    // Show the picture; in recall mode the word is hidden behind a "?" and we
    // ask "What's this?" (retrieval practice) before modelling the word.
    await world.showCard(entry, !recall);
    if (recall) {
      await audio.say('whats-this');
    } else {
      await audio.say(entry.id); // "Apple! Can you say... apple?"
    }

    let attempts = 0;
    let modelled = !recall;
    while (true) {
      await this.pauseIfCalm();
      world.setListening(true);
      const result = await this.listenWithOverride();
      world.setListening(false);

      if (result.override) {
        await this.celebrate(entry, { big: true });
        this.garden.record(entry.id, { said: true, assisted: false });
        return true;
      }
      if (result.attempted) {
        const matched = fuzzyWordMatch(result.transcript, entry.word);
        await this.celebrate(entry, { big: matched || !result.transcript });
        this.garden.record(entry.id, { said: true, assisted: false });
        return true;
      }

      attempts += 1;
      if (attempts === 1) {
        // Warm re-model: show/repeat the word, listen again.
        world.revealWord();
        await audio.say(entry.id);
        modelled = true;
      } else {
        // Gentle advance — no failure. Say it together, animate anyway.
        world.revealWord();
        await audio.say('good-try');
        await audio.say(`${entry.id}-only`);
        this.audio.chime(0.5 * this.settings.celebration);
        await world.celebrate(0.5 * this.settings.celebration);
        this.garden.record(entry.id, { said: false, assisted: true });
        await world.hideCard();
        return false;
      }
    }
  }

  // Listen, but let a controller trigger press (parent) count as correct.
  async listenWithOverride() {
    const p = this.listener.listen({ timeoutMs: 8000 });
    const poll = new Promise((resolve) => {
      const iv = setInterval(() => {
        if (this.world.overridePressed) { clearInterval(iv); resolve({ override: true }); }
      }, 120);
      p.finally(() => clearInterval(iv));
    });
    const result = await Promise.race([p, poll]);
    return result.override ? { override: true } : { ...result, override: false };
  }

  async celebrate(entry, { big }) {
    const { audio, world } = this;
    const intensity = (big ? 1 : 0.7) * this.settings.celebration;
    audio.chime(intensity);
    world.revealWord();
    await world.celebrate(intensity);
    await audio.say(PRAISE[Math.floor(Math.random() * PRAISE.length)]);
    await audio.say(`${entry.id}-only`); // reinforce the word once more
    await world.hideCard();
  }

  async pauseIfCalm() {
    if (this.world.calmActive) await this.world.waitCalmEnd();
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
