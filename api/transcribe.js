// Optional Stage-2 speech recognition (Vercel serverless function).
// Forwards the recorded attempt to OpenAI Whisper and returns { text }.
// Enable by setting OPENAI_API_KEY in Vercel env and, in index.html,
// window.WORD_GARDEN_CONFIG.transcribeUrl = '/api/transcribe'.
// The game treats transcription as best-effort: failures never block success.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'not configured' });

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const audio = Buffer.concat(chunks);

    const form = new FormData();
    form.append('file', new Blob([audio], { type: 'audio/webm' }), 'attempt.webm');
    form.append('model', 'whisper-1');
    form.append('language', 'en');

    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
    });
    if (!r.ok) return res.status(502).json({ error: 'transcription failed' });
    const data = await r.json();
    res.status(200).json({ text: data.text || '' });
  } catch (err) {
    res.status(500).json({ error: 'server error' });
  }
}

export const config = { api: { bodyParser: false } };
