# 🌱 Word Garden

A calm VR word-learning game for the Meta Quest 3, made for practicing **speaking
words aloud** and **remembering vocabulary**. It runs in the Quest's web browser —
no app store, no installation on the headset.

## How the game works

- A friendly guide shows one picture at a time (🍎 apple, 🐶 dog…) and says the
  word: *"Apple! Can you say… apple?"*
- When your child says the word (or makes any clear vocal attempt), the picture
  comes alive — sparkles, a soft chime, and warm praise. **Every attempt counts.
  There is no way to fail** — after two gentle re-models the guide says it
  together with him and moves on happily.
- Every word he says grows a **plant in his garden** and earns a **sticker**.
  The garden is remembered between sessions.
- In later sessions the game re-asks words he knows ("What's this?") at growing
  intervals — this spaced practice is what builds long-term word memory.
- A session is short by design (8 words ≈ 5 minutes), and the structure is
  identical every time: hello → words → goodbye. Predictable and calm.

## Playing on the Quest 3

1. Deploy this folder (see below) so you have an `https://…` address.
2. On the Quest, open the **Browser**, go to that address, and bookmark it.
3. Tap **🥽 Enter VR**, and allow the **microphone** when asked.
4. Hand the headset over — seated play, objects come to him, no moving around.

### During play (parent controls)

- **Trigger button** (either controller): *"counts as correct!"* — press it any
  time he makes a good attempt the game didn't catch. Sit beside him and hold
  one controller while he plays.
- **Grip button**: calm break — the world dims to a slow-breathing lavender orb.
  Press again to continue.
- **Parent settings** (on the start screen): words per session, listening
  sensitivity, celebration intensity, volume, word groups, garden reset.

### Good practice

- Keep sessions **short (5–15 min), seated, and supervised** — you nearby,
  ideally watching via casting to your phone (Meta Horizon app → Cast).
- Same time, same routine helps. Stop while it's still fun.
- The game is practice **between** speech-therapy sessions, not a replacement.

## Testing without a headset

Open the address in any browser (or run locally, below) and press
**▶️ Play here** — the same game runs on a flat screen. Spacebar or click =
"counts as correct", `C` = calm break.

## Running locally

```bash
cd word-garden
npx serve .
```

Then open the printed `http://localhost:…` address. (The Quest itself needs an
`https://` address — deploy for headset use.)

## Deploying (free, ~2 minutes)

```bash
npm i -g vercel
cd word-garden
vercel --prod
```

The printed URL is your game. Any static host with HTTPS also works.

## Optional: real word recognition (Stage 2)

Out of the box the game detects *that* your child spoke (very forgiving — this
is intentional and matches speech-therapy practice). To also check *what* was
said (still forgivingly — a near-miss never blocks success, it only makes the
celebration bigger):

1. In Vercel, add an environment variable `OPENAI_API_KEY`.
2. In `index.html`, set `transcribeUrl: '/api/transcribe'`.
3. Redeploy.

## Project layout

- `index.html` — entry page, start screen, settings
- `src/main.js` — 3D world (Three.js + WebXR)
- `src/game.js` — session flow: greeting → words → goodbye
- `src/words.js` — the vocabulary (add words here; also generate a matching
  audio clip — see `assets/audio`)
- `src/speech.js` — microphone attempt detection (+ optional transcription)
- `src/garden.js` — spaced-repetition memory garden (saved in the browser)
- `assets/audio/` — pre-generated voice clips (macOS `say` → `afconvert`)
