/* 문장 비교·채점 (따라 말하기 / 받아쓰기)
 * - 베트남어·영어: 단어 단위, 중국어·일본어·한국어: 글자 단위 비교
 * - 최장 공통 부분열(LCS)로 정답 문장의 어느 부분이 맞았는지 표시
 * - loose: 성조·부호(diacritics) 무시 비교 → 베트남어 '부분 정답' 판정용
 */
const Compare = (() => {
  const PUNCT = /[.,!?;:"'“”‘’。、，！？：；「」『』（）()\[\]\-–—…~·]/g;
  const noDia = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
  const key = s => TTS.clean(s).toLowerCase().replace(PUNCT, '').trim();
  const charLang = l => l === 'zh' || l === 'ja' || l === 'ko';

  function tokens(s, lang) {
    const src = TTS.clean(s);
    if (charLang(lang)) return Array.from(src).filter(ch => key(ch) && !/\s/.test(ch)).map(ch => ({ orig: ch, k: key(ch) }));
    return src.split(/\s+/).map(w => ({ orig: w, k: key(w) })).filter(x => x.k);
  }

  function lcsFlags(T, S, eq) {
    const n = T.length, m = S.length;
    const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
      dp[i][j] = eq(T[i].k, S[j].k) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const flags = new Array(n).fill(false);
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (eq(T[i].k, S[j].k)) { flags[i] = true; i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
    }
    return flags;
  }

  /* target 대비 said 일치율(%) — 길이가 더 긴 쪽 기준이라 불필요한 말을 덧붙여도 감점 */
  function score(target, said, lang, loose) {
    const T = tokens(target, lang), S = tokens(said, lang);
    const eq = loose ? (a, b) => noDia(a) === noDia(b) : (a, b) => a === b;
    const flags = lcsFlags(T, S, eq);
    const hit = flags.filter(Boolean).length;
    const pct = T.length ? Math.round(hit / Math.max(T.length, S.length) * 1000) / 10 : 0;
    return { pct, parts: T.map((t, i) => ({ t: t.orig, ok: flags[i] })), joiner: charLang(lang) ? '' : ' ' };
  }

  /* 로마자(병음·로마자) 입력 비교: 공백·성조·장음 무시 */
  function romanKey(s) {
    return noDia(String(s || '').toLowerCase()).replace(/[^a-z]/g, '').replace(/ou/g, 'o').replace(/uu/g, 'u');
  }
  const isLatin = s => /^[\x20-\x7EÀ-ɏḀ-ỿ]+$/.test(String(s).trim());

  /* 받아쓰기 채점: 'ok' | 'partial' | 'ng' */
  function dictation(card, lang, input) {
    if ((lang === 'zh' || lang === 'ja') && isLatin(input) && card.pron && card.pron[lang]) {
      const ok = romanKey(input) === romanKey(card.pron[lang]);
      const r = score(card[lang], ok ? card[lang] : '', lang);
      return { result: ok ? 'ok' : 'ng', pct: ok ? 100 : 0, parts: r.parts, joiner: r.joiner, byRoman: true };
    }
    const strict = score(card[lang], input, lang, false);
    if (strict.pct === 100) return { result: 'ok', ...strict };
    const loose = score(card[lang], input, lang, true);
    if (loose.pct === 100) return { result: 'partial', ...loose, pct: strict.pct };
    return { result: 'ng', ...strict };
  }

  return { score, dictation, noDia };
})();
