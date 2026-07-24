// Persistent "word garden": every word the child says grows a plant, and a
// Leitner-style spaced-repetition schedule decides which learned words get
// re-asked ("What's this?") in later sessions.
import { WORDS } from './words.js';

const KEY = 'word-garden-v1';

// A word in bin N is reviewed every 2^N sessions (bin 0 = every session).
const MAX_BIN = 4;

export class Garden {
  constructor() {
    const raw = localStorage.getItem(KEY);
    this.data = raw ? JSON.parse(raw) : { sessionCount: 0, plants: {}, stickers: 0 };
  }

  save() { localStorage.setItem(KEY, JSON.stringify(this.data)); }

  plant(id) { return this.data.plants[id]; }
  get plantedIds() { return Object.keys(this.data.plants); }
  get stickerCount() { return this.data.stickers; }

  startSession() {
    this.data.sessionCount += 1;
    this.save();
  }

  // Words due for recall review this session.
  reviewDue(limit = 4) {
    const s = this.data.sessionCount;
    return this.plantedIds
      .filter((id) => {
        const p = this.data.plants[id];
        return s - (p.lastSession || 0) >= Math.pow(2, p.bin);
      })
      .sort((a, b) => this.data.plants[a].bin - this.data.plants[b].bin)
      .slice(0, limit);
  }

  // Words never planted, for introducing new vocabulary.
  newWords(limit, enabledIds) {
    return WORDS
      .filter((w) => enabledIds.includes(w.id) && !this.data.plants[w.id])
      .slice(0, limit)
      .map((w) => w.id);
  }

  // said=true → real vocal attempt succeeded; assisted=true → we advanced
  // gently after re-models (exposure still counts, memory bin does not move up).
  record(id, { said, assisted }) {
    const p = this.data.plants[id] || { bin: 0, times: 0, lastSession: 0 };
    p.times += 1;
    p.lastSession = this.data.sessionCount;
    if (said && !assisted) p.bin = Math.min(MAX_BIN, p.bin + 1);
    this.data.plants[id] = p;
    if (said) this.data.stickers += 1;
    this.save();
  }

  reset() {
    this.data = { sessionCount: 0, plants: {}, stickers: 0 };
    this.save();
  }
}

// Build one session's word queue: due reviews first (recall practice),
// then new words, then extra reviews of the youngest plants to fill up.
export function buildSession(garden, { length = 8, enabledIds }) {
  const due = garden.reviewDue(Math.min(4, length));
  const fresh = garden.newWords(length - due.length, enabledIds);
  const queue = [
    ...due.map((id) => ({ id, mode: 'recall' })),
    ...fresh.map((id) => ({ id, mode: 'learn' })),
  ];
  if (queue.length < length) {
    const extras = garden.plantedIds
      .filter((id) => enabledIds.includes(id) && !queue.some((q) => q.id === id))
      .sort((a, b) => garden.plant(a).bin - garden.plant(b).bin)
      .slice(0, length - queue.length);
    queue.push(...extras.map((id) => ({ id, mode: 'recall' })));
  }
  return queue;
}
