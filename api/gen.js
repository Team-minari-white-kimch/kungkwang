// 쿵쾅 생성형 AI 문안 함수 (Vercel 서버 함수)
// - Gemini API 키는 Vercel 환경변수 GEMINI_API_KEY에만 둔다 (공개 페이지에 넣지 않음)
// - 쿵쾅 공개 주소에서 온 요청만 받는다
const ALLOW = /^https:\/\/(fordgril307-wq\.github\.io|kungkwang[\w-]*\.vercel\.app)$|^http:\/\/localhost(:\d+)?$/;

module.exports = async (req, res) => {
  const origin = req.headers.origin || '';
  const ok = ALLOW.test(origin);
  res.setHeader('Access-Control-Allow-Origin', ok ? origin : 'https://fordgril307-wq.github.io');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 받아요' });
  if (!ok) return res.status(403).json({ error: '허용되지 않은 주소예요' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const prompt = String((body && body.prompt) || '').slice(0, 4000);
  if (!prompt) return res.status(400).json({ error: '요청 문장이 비었어요' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY가 설정되지 않았어요' });

  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 1200, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    const j = await r.json();
    if (!r.ok) return res.status(502).json({ error: (j.error && j.error.message) || 'Gemini 오류' });
    const text = ((j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts) || []).map((p) => p.text || '').join('').trim();
    if (!text) return res.status(502).json({ error: '빈 응답' });
    return res.status(200).json({ text, model: 'gemini-2.5-flash' });
  } catch (e) {
    return res.status(502).json({ error: String(e && e.message || e) });
  }
};
