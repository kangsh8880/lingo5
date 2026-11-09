/* 번역·음성인식 서비스
 * 번역: 본인 GAS(LanguageApp, 공식) → Google 번역(gtx) → MyMemory 순으로 시도
 *       발음 표기(병음·로마자)는 Google gtx 응답에서만 제공되어, GAS 번역 시 gtx로 발음만 보조 조회
 * 음성인식: Web Speech API (Chrome / Edge / Android / iOS Safari 14.5+)
 */
const Translator = (() => {
  const CODE = { ko: 'ko', vi: 'vi', en: 'en', zh: 'zh-CN', ja: 'ja' };

  async function viaGoogle(text, sl, tl) {
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=' + CODE[sl] + '&tl=' + CODE[tl] +
      '&dt=t&dt=rm&q=' + encodeURIComponent(text);
    const r = await fetch(url);
    if (!r.ok) throw new Error('Google HTTP ' + r.status);
    const d = await r.json();
    const segs = (d && d[0]) || [];
    const out = segs.filter(s => typeof s[0] === 'string').map(s => s[0]).join('').trim();
    const rm = segs.find(s => s[0] == null && typeof s[2] === 'string');
    if (!out) throw new Error('Google: empty');
    return { text: out, pron: rm ? rm[2] : '', srcPron: rm ? rm[3] : '', engine: 'Google' };
  }

  async function viaMyMemory(text, sl, tl) {
    const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=' + CODE[sl] + '|' + CODE[tl];
    const r = await fetch(url);
    if (!r.ok) throw new Error('MyMemory HTTP ' + r.status);
    const d = await r.json();
    if (String(d.responseStatus) !== '200') throw new Error('MyMemory: ' + (d.responseDetails || d.responseStatus));
    return { text: String(d.responseData.translatedText || '').trim(), pron: '', engine: 'MyMemory' };
  }

  async function viaGAS(text, sl, tl, proxy) {
    if (!proxy) throw new Error('GAS: no URL');
    const url = proxy + (proxy.includes('?') ? '&' : '?') + 'action=translate&sl=' + CODE[sl] + '&tl=' + CODE[tl] + '&text=' + encodeURIComponent(text);
    const r = await fetch(url);
    if (!r.ok) throw new Error('GAS HTTP ' + r.status);
    const body = (await r.text()).trim();
    let d;
    try { d = JSON.parse(body); } catch (e) { throw new Error('GAS: translate API not deployed'); }
    if (!d.ok) throw new Error('GAS: ' + d.error);
    let pron = '';
    if (['zh', 'ja', 'ko'].includes(tl)) { try { pron = (await viaGoogle(d.text, tl, tl === 'ko' ? 'en' : 'ko')).srcPron || ''; } catch (e) {} }
    return { text: d.text, pron, engine: 'GAS LanguageApp' };
  }

  async function translate(text, sl, tl, proxy) {
    const errs = [];
    for (const f of [viaGAS, viaGoogle, viaMyMemory]) {
      try { return await f(text, sl, tl, proxy); }
      catch (e) { errs.push((e && e.message) || String(e)); }
    }
    throw new Error(errs.length + ' engines failed — ' + errs.join(' / '));
  }

  /* ---------- 음성 인식 ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;

  function listen(lang, { onInterim, onFinal, onError, onEnd }) {
    if (!SR) { onError('unsupported'); return null; }
    stopListen();
    rec = new SR();
    rec.lang = TTS.LANG_CODE[lang];
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let finalText = '';
    rec.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript;
      }
      onInterim && onInterim((finalText + interim).trim());
    };
    rec.onerror = e => onError(e.error || 'unknown');
    rec.onend = () => { const txt = finalText.trim(); rec = null; if (txt) onFinal(txt); onEnd && onEnd(!!txt); };
    try { rec.start(); } catch (e) { onError(e.name || 'start-failed'); return null; }
    return rec;
  }
  function stopListen() { if (rec) { try { rec.stop(); } catch (e) {} } }
  function isListening() { return !!rec; }

  return { translate, listen, stopListen, isListening, supported: !!SR };
})();
