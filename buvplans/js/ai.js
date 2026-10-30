// AI vizualizācija: 3D skata attēls → fotoreālistisks interjers ar izvēlētu ģeneratoru.
// API atslēgas lietotājs ievada pats; tās glabājas tikai pārlūkā un tiek sūtītas tikai izvēlētajam pakalpojumam.

export const STYLES = [
  ['scandi', 'Skandināvu', 'Scandinavian interior, light oak wood, white walls, soft textiles, natural daylight'],
  ['modern', 'Moderns', 'modern contemporary interior, clean lines, neutral palette, designer furniture'],
  ['minimal', 'Minimālisms', 'minimalist interior, very few objects, calm neutral tones, hidden storage'],
  ['industrial', 'Industriāls', 'industrial loft interior, concrete, black metal, exposed brick, warm lamps'],
  ['classic', 'Klasisks', 'classic elegant interior, mouldings, parquet, warm fabrics, chandelier'],
  ['japandi', 'Japandi', 'japandi interior, natural wood, linen, muted earth tones, low furniture'],
  ['evening', 'Vakara gaisma', 'cozy interior at evening, warm artificial lighting, lamps on'],
];

/** Teksta uzdevums ģeneratoram. */
export function buildPrompt(styleId, extra) {
  const st = STYLES.find((s) => s[0] === styleId) || STYLES[0];
  return [
    'Photorealistic architectural interior visualization rendered from this 3D model view.',
    'Keep exactly the same room layout, walls, window and door positions, furniture placement and camera angle.',
    `Style: ${st[2]}.`,
    extra ? `Details: ${extra}.` : '',
    'High quality, realistic materials and lighting, no text, no people.',
  ].filter(Boolean).join(' ');
}

const b64 = (dataUrl) => dataUrl.split(',')[1];
const blobOf = async (dataUrl) => (await fetch(dataUrl)).blob();
const toDataUrl = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });

async function failText(resp) {
  let t = '';
  try { t = (await resp.json())?.error?.message || ''; } catch { try { t = await resp.text(); } catch { /* ignore */ } }
  return `${resp.status} ${t}`.trim().slice(0, 300);
}

/**
 * Ģeneratori. `api` — tiešs izsaukums ar lietotāja atslēgu; bez `api` — atver ģeneratora vietni,
 * lejupielādē 3D attēlu un nokopē aprakstu, lai to ielīmētu turpat.
 */
export const GENERATORS = [
  {
    id: 'openai', name: 'OpenAI (GPT Image)', keyUrl: 'https://platform.openai.com/api-keys',
    note: 'Rediģē 3D attēlu pēc apraksta. Vajag OpenAI API atslēgu.',
    async api(image, prompt, key) {
      const fd = new FormData();
      fd.append('model', 'gpt-image-1');
      fd.append('image', await blobOf(image), 'skats.png');
      fd.append('prompt', prompt);
      fd.append('size', '1536x1024');
      const r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd });
      if (!r.ok) throw new Error(await failText(r));
      const j = await r.json();
      return `data:image/png;base64,${j.data[0].b64_json}`;
    },
  },
  {
    id: 'gemini', name: 'Google Gemini (Nano Banana)', keyUrl: 'https://aistudio.google.com/apikey',
    note: 'Gemini 2.5 Flash Image pārveido attēlu, saglabājot plānojumu. Vajag Google AI Studio atslēgu.',
    async api(image, prompt, key) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${encodeURIComponent(key)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/png', data: b64(image) } }] }] }),
      });
      if (!r.ok) throw new Error(await failText(r));
      const j = await r.json();
      const part = j.candidates?.[0]?.content?.parts?.find((p) => p.inline_data || p.inlineData);
      const d = part?.inline_data || part?.inlineData;
      if (!d) throw new Error('Atbildē nav attēla. Pamēģini citu aprakstu.');
      return `data:${d.mime_type || d.mimeType || 'image/png'};base64,${d.data}`;
    },
  },
  {
    id: 'stability', name: 'Stability AI (Stable Image)', keyUrl: 'https://platform.stability.ai/account/keys',
    note: 'Struktūras kontrole saglabā sienas un mēbeļu izvietojumu. Vajag Stability AI atslēgu.',
    async api(image, prompt, key) {
      const fd = new FormData();
      fd.append('image', await blobOf(image), 'skats.png');
      fd.append('prompt', prompt);
      fd.append('control_strength', '0.7');
      fd.append('output_format', 'png');
      const r = await fetch('https://api.stability.ai/v2beta/stable-image/control/structure', { method: 'POST', headers: { Authorization: `Bearer ${key}`, Accept: 'image/*' }, body: fd });
      if (!r.ok) throw new Error(await failText(r));
      return toDataUrl(await r.blob());
    },
  },
  { id: 'chatgpt', name: 'ChatGPT (vietnē)', url: 'https://chatgpt.com/', note: 'Atvērs ChatGPT, lejupielādēs 3D attēlu un nokopēs aprakstu — ielīmē abus tērzēšanā. Atslēga nav vajadzīga.' },
  { id: 'midjourney', name: 'Midjourney (vietnē)', url: 'https://www.midjourney.com/imagine', note: 'Atvērs Midjourney, lejupielādēs 3D attēlu (izmanto kā attēla atsauci) un nokopēs aprakstu.' },
  { id: 'leonardo', name: 'Leonardo AI (vietnē)', url: 'https://app.leonardo.ai/', note: 'Atvērs Leonardo AI, lejupielādēs 3D attēlu un nokopēs aprakstu.' },
  { id: 'krea', name: 'Krea AI (vietnē)', url: 'https://www.krea.ai/image', note: 'Atvērs Krea AI, lejupielādēs 3D attēlu un nokopēs aprakstu.' },
];
