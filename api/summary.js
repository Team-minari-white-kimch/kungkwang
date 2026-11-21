// 쿵쾅 기록 요약: 앱이 보낸 집계 숫자를 Gemini로 짧은 요약·조언·추천 이유로 바꾼다.
// 환경변수: GEMINI_API_KEY(필수), GEMINI_MODEL(기본 gemini-2.5-flash-lite), ALLOWED_ORIGINS(쉼표 구분)
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://fordgril307-wq.github.io').split(',').map((s) => s.trim());

const PROMPT = `너는 층간소음 기록 앱 '쿵쾅'의 분석 도우미야. 아래 JSON은 사용자의 소음 기록을 앱이 집계한 결과야.
규칙:
- JSON에 있는 사실과 숫자만 써. 새 숫자나 추측을 만들지 마.
- 법적 판정이나 상대 이웃에 대한 단정은 하지 마. 휴대폰 측정은 참고값이야.
- 차분한 해요체, 감정을 자극하지 않는 말투.
- summary: 최근 소음 패턴을 한 문장(60자 이내)으로.
- advice: 분석을 더 정확하게 하려면 무엇을 더 기록하면 좋은지, 또는 기록이 충분하면 그 사실을 한 문장(70자 이내)으로. checks 중 ok=false 항목을 우선해.
- reason: nextStep을 왜 지금 추천하는지 1~2문장(100자 이내). doneSteps를 참고해.`;

const SCHEMA = { type: 'OBJECT', properties: { summary: { type: 'STRING' }, advice: { type: 'STRING' }, reason: { type: 'STRING' } }, required: ['summary', 'advice', 'reason'] };

module.exports = async (req, res) => {
  const origin = req.headers.origin || '';
  if (ORIGINS.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not set' });

  const facts = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  if (facts.length > 4000) return res.status(413).json({ error: 'too large' });

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: facts }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 400, responseMimeType: 'application/json', responseSchema: SCHEMA },
      }),
    });
    if (!r.ok) return res.status(502).json({ error: `gemini ${r.status}` });
    const j = await r.json();
    const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
    const out = JSON.parse(text);
    return res.status(200).json({ summary: String(out.summary || ''), advice: String(out.advice || ''), reason: String(out.reason || '') });
  } catch (e) {
    return res.status(502).json({ error: 'summary failed' });
  }
};
