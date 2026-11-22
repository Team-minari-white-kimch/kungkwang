// 쿵쾅 측정 엔진 비교 테스트: 기존(main) 엔진 vs 현재 작업본 엔진을 합성 신호로 비교
// 실행: node tests/engine-compare.mjs [기준 브랜치, 기본 origin/main]
// 정답을 계산으로 알 수 있는 신호만 쓰므로 장비 없이 누구나 같은 결과를 재현할 수 있음.
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import vm from 'node:vm';

const load = (html) => {
  const a = html.indexOf('const KE = (() => {'), b = html.indexOf("if (typeof module !== 'undefined') module.exports = KE;");
  if (a < 0 || b < 0) throw new Error('KE 엔진을 찾지 못함');
  const ctx = { module: { exports: null }, Math, Float32Array, Float64Array, Array, Object, Date, Infinity, isFinite };
  vm.runInNewContext(html.slice(a, b) + '\nmodule.exports = KE;', ctx);
  return ctx.module.exports;
};
const base = process.argv[2] || 'origin/main';
let oldHtml; try { oldHtml = execSync(`git show ${base}:index.html`, { maxBuffer: 1 << 26 }).toString(); } catch { oldHtml = execSync('git show main:index.html', { maxBuffer: 1 << 26 }).toString(); }
const OLD = load(oldHtml), NEW = load(readFileSync(new URL('../index.html', import.meta.url), 'utf8'));
const SR = 16000, day = new Date(2026, 0, 5, 14, 0); // 주간
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log('  ✗ 실패: ' + m); } };
const f1 = (v) => (v >= 0 ? '+' : '') + v.toFixed(1);
const rnd = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const tone = (f, sec, amp = 0.01, sr = SR) => Float32Array.from({ length: Math.round(sec * sr) }, (_, i) => amp * Math.sin(2 * Math.PI * f * i / sr));
const ra = (f) => { const f2 = f * f; return (12194 ** 2 * f2 * f2) / ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2)); };
const Aideal = (f) => 20 * Math.log10(ra(f) / ra(1000)); // IEC 61672-1 A특성 공식

console.log(`\n# 쿵쾅 측정 엔진 비교 (기준: ${base} → 현재 작업본)\n`);

// 1) A특성 저음 오차
console.log('## 1. A특성 주파수 응답 (IEC 61672-1 공식 대비 오차, dB)\n');
console.log('| 주파수 | 기존 오차 | 수정 오차 |'); console.log('|---|---|---|');
const ref = (K) => K.analyze(tone(1000, 3), { cal: 0, start: day }).leq;
const r0 = ref(OLD), r1 = ref(NEW);
for (const f of [31.5, 50, 63, 125, 250, 1000, 2000, 4000]) {
  const eo = OLD.analyze(tone(f, 3), { cal: 0, start: day }).leq - r0 - Aideal(f);
  const en = NEW.analyze(tone(f, 3), { cal: 0, start: day }).leq - r1 - Aideal(f);
  console.log(`| ${f} Hz | ${f1(eo)} | ${f1(en)} |`);
  ok(Math.abs(en) < 0.5, `A특성 ${f} Hz 오차 ${en.toFixed(2)} dB`);
}

// 2) 자동 기록(실시간) 레벨 vs 분석 레벨
console.log('\n## 2. 자동 기록 모드 레벨 − 분석 화면 레벨 (같은 1 kHz 소리, dB)\n');
const t48 = tone(1000, 2, 0.01, 48000);
const oldNight = (x) => { let s = 0; for (const v of x) s += v * v; return 10 * Math.log10(s / x.length + 1e-12); }; // 기존 nvStart 식
const newNight = NEW.meter(48000)(t48);
const dOld = oldNight(t48) - r0, dNew = newNight - r1;
console.log('| | 기존 | 수정 |'); console.log('|---|---|---|');
console.log(`| 차이 | ${f1(dOld)} | ${f1(dNew)} |`);
ok(Math.abs(dNew) < 0.5, `자동 기록 레벨 차이 ${dNew.toFixed(2)} dB`);

// 3) 최고소음도 초과 횟수: 빠름(F) 최고값이 기준보다 2 dB 낮은 쿵 소리 3번
console.log('\n## 3. 최고소음도 초과 횟수 (빠름 최고값이 기준 57 dB보다 2 dB 낮은 쿵 소리 3번)\n');
const thuds = (() => { const y = new Float32Array(6 * SR), r = rnd(3); for (const t0 of [1, 2.5, 4]) for (let i = 0; i < 0.35 * SR; i++) { const t = i / SR; y[Math.round(t0 * SR) + i] += 0.3 * Math.min(t / 0.004, 1) * Math.exp(-t / 0.07) * Math.sin(2 * Math.PI * 70 * t); } for (let i = 0; i < y.length; i++) y[i] += 0.0003 * (r() - 0.5); return y; })();
console.log('| | 사건 최고값 − 화면 최고소음도 | 초과로 센 횟수 | 판정 |'); console.log('|---|---|---|---|');
for (const [nm, K] of [['기존', OLD], ['수정', NEW]]) {
  const raw = K.analyze(thuds, { cal: 0, start: day }), cal = 55 - raw.lmax; // 화면 최고소음도 = 55 dB
  const r = K.analyze(thuds, { cal, start: day }), pk = Math.max(...r.ev.map((e) => e.peak)), c = r.checks[1];
  console.log(`| ${nm} | ${f1(pk - r.lmax)} | ${r.overLmax}회 | ${c.st} |`);
  if (K === NEW) { ok(r.overLmax === 0, `초과 횟수 ${r.overLmax}`); ok(Math.abs(pk - r.lmax) < 0.5, '사건 최고값과 최고소음도 불일치'); }
}

// 4) 짧은 녹음의 1분 등가소음도
console.log('\n## 4. 1분 등가소음도: 같은 쿵 소리를 20초 녹음 vs 60초 녹음 (dB)\n');
const sess = (sec) => { const y = new Float32Array(sec * SR), r = rnd(9); for (let k = 0; k < 20; k++) { const t0 = 1 + k * 0.9; for (let i = 0; i < 0.3 * SR; i++) { const t = i / SR; y[Math.round(t0 * SR) + i] += 0.2 * Math.exp(-t / 0.06) * Math.sin(2 * Math.PI * 90 * t); } } for (let i = 0; i < y.length; i++) y[i] += 0.0005 * (r() - 0.5); return y; };
const s20 = sess(20), s60 = sess(60);
console.log('| | 20초 녹음 | 60초 녹음(정답) | 차이 |'); console.log('|---|---|---|---|');
for (const [nm, K] of [['기존', OLD], ['수정', NEW]]) {
  const a = K.analyze(s20, { cal: 100, start: day }).leq1, b = K.analyze(s60, { cal: 100, start: day }).leq1;
  console.log(`| ${nm} | ${a.toFixed(1)} | ${b.toFixed(1)} | ${f1(a - b)} |`);
  if (K === NEW) ok(Math.abs(a - b) < 1, `짧은 녹음 차이 ${(a - b).toFixed(2)} dB`);
}

// 5) 배경소음 보정 (공정시험기준 보정식)
console.log('\n## 5. 배경소음 보정: 대상 50 dB + 배경소음 (dB)\n');
console.log('| 배경 | 측정값(합) | 보정 후 | 처리 |'); console.log('|---|---|---|---|');
for (const B of [35, 42, 45, 47, 49]) {
  const M = 10 * Math.log10(10 ** 5 + 10 ** (B / 10)), c = NEW.bgCorrect(M, B);
  console.log(`| ${B} | ${M.toFixed(1)} | ${c.hold ? '-' : c.v.toFixed(1)} | ${c.hold ? '3 dB 미만: 판정 불가' : c.corr ? '보정' : '보정 없음(10 dB 이상)'} |`);
  if (!c.hold && M - B < 10) ok(Math.abs(c.v - 50) < 0.05, `보정 후 ${c.v}`);
}

// 6) 클리핑, 7) 오차범위 판정
const clipY = Float32Array.from(tone(500, 2, 1.5), (v) => Math.max(-1, Math.min(1, v)));
const cl = NEW.analyze(clipY, { cal: 0, start: day }).clip;
console.log(`\n## 6. 클리핑 감지: 기존 없음 → 수정 ${cl ? '감지됨' : '감지 안 됨'}`); ok(cl, '클리핑 감지');
console.log('\n## 7. 오차범위를 고려한 판정 (최고소음도 59 dB, 기준 57 dB)\n');
console.log('| 보정 방식(오차범위) | 판정 |'); console.log('|---|---|');
for (const u of [0, 2, 6]) { const raw = NEW.analyze(thuds, { cal: 0, start: day }); const r = NEW.analyze(thuds, { cal: 59 - raw.lmax, start: day, unc: u }); console.log(`| ±${u} dB | ${r.checks[1].st} |`); }

// 8) 예시 소리가 그대로 동작하는지
console.log('\n## 8. 앱 예시 소리 (보정값 100) 최고소음도·판정\n');
console.log('| 예시 | 기존 | 수정 |'); console.log('|---|---|---|');
for (const k of ['walk', 'run', 'hammer', 'drag']) {
  const a = OLD.analyze(OLD.synth(k, 7), { cal: 100, start: day }), b = NEW.analyze(NEW.synth(k, 7), { cal: 100, start: day });
  const w = (r) => r.checks.filter((c) => c.st !== 'na').map((c) => c.st).join('/');
  console.log(`| ${k} | ${a.lmax.toFixed(1)} dB, ${w(a)} | ${b.lmax.toFixed(1)} dB, ${w(b)} |`);
}
// 9) 마이크 직류(DC) 성분: 조용한 녹음에 0.05 직류가 섞여도 가짜 큰 소리가 생기지 않아야 함
{ const q = Float32Array.from({ length: 3 * SR }, (_, i) => 0.05 + 0.0003 * Math.sin(i)), z = Float32Array.from({ length: 3 * SR }, (_, i) => 0.0003 * Math.sin(i));
  const d = NEW.analyze(q, { cal: 95, start: day }).lmax - NEW.analyze(z, { cal: 95, start: day }).lmax;
  console.log(`\n## 9. 직류 성분이 섞였을 때 최고소음도 변화: ${f1(d)} dB`); ok(Math.abs(d) < 1, `직류 성분 영향 ${d.toFixed(2)} dB`); }
console.log(fail ? `\n실패 ${fail}건` : '\n모든 검사 통과');
process.exit(fail ? 1 : 0);
