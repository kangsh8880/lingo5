/* 음성 재생 모듈
 * - 괄호 안 내용 제거 후 재생 (cleaned 사용, 원문 사용 금지)
 * - 한국어/영어/중국어/일본어: Web Speech API (Google 음성 우선)
 * - 베트남어
 *   · PC   : Google Tiếng Việt 기기 음성(있을 때) → GAS 프록시(설정 시) → Google 번역 음성(tw-ob) → Google 번역 음성(gtx) → 기기 베트남어 음성
 *   · 모바일: GAS 프록시(설정 시) → Google 번역 음성(tw-ob) → Google 번역 음성(gtx) → 기기 베트남어 음성
 *   · PC Chrome에는 Google 베트남어 기기 음성이 없어 Google 번역 음성을 직접 호출함.
 *     출처(Referer) 헤더가 붙으면 차단되는 경우가 있어 index.html에 no-referrer 지정 + Audio에도 지정
 * - 이중 재생 방지: _currentViAudio 로 이전 Audio 정지, body 클릭 리스너 사용 안 함
 */
const TTS = (() => {
  const LANG_CODE = { ko: 'ko-KR', vi: 'vi-VN', en: 'en-US', zh: 'zh-CN', ja: 'ja-JP' };
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const hasSynth = 'speechSynthesis' in window;
  const t = (k, v) => I18N.t(k, v);
  let voices = [];
  window._currentViAudio = null;

  function loadVoices() { try { voices = window.speechSynthesis.getVoices() || []; } catch (e) { voices = []; } }
  if (hasSynth) { loadVoices(); try { window.speechSynthesis.onvoiceschanged = loadVoices; } catch (e) {} }

  const clean = s => String(s || '').replace(/\([^)]*\)/g, '').replace(/\s{2,}/g, ' ').trim();

  function voicesFor(lang) {
    if (!voices.length) loadVoices();
    const pre = LANG_CODE[lang].slice(0, 2).toLowerCase();
    return voices.filter(v => v.lang && v.lang.replace('_', '-').toLowerCase().startsWith(pre));
  }
  function pickVoice(lang) {
    const list = voicesFor(lang);
    return list.find(v => /google/i.test(v.name)) || list.find(v => /natural|online/i.test(v.name)) || list[0] || null;
  }
  function googleVoice(lang) { return voicesFor(lang).find(v => /google/i.test(v.name)) || null; }

  function stop() {
    if (hasSynth) { try { window.speechSynthesis.cancel(); } catch (e) {} }
    if (window._currentViAudio) { try { window._currentViAudio.pause(); window._currentViAudio.src = ''; } catch (e) {} window._currentViAudio = null; }
  }

  function speakWeb(text, lang, rate, voice) {
    return new Promise((resolve, reject) => {
      if (!hasSynth) return reject(new Error(t('eNoSynth')));
      const v = voice || pickVoice(lang);
      if (!v && lang === 'vi') return reject(new Error(t('eNoVoice', { lang: t('lang_vi') })));
      const u = new SpeechSynthesisUtterance(text);
      u.lang = LANG_CODE[lang];
      if (v) u.voice = v;
      u.rate = rate;
      u.onend = () => resolve('web');
      u.onerror = e => reject(new Error('Web Speech: ' + (e.error || 'unknown')));
      window.speechSynthesis.speak(u);
    });
  }

  function playAudio(src, label) {
    return new Promise((resolve, reject) => {
      const a = new Audio();
      try { a.referrerPolicy = 'no-referrer'; } catch (e) {}
      a.preload = 'auto';
      window._currentViAudio = a;
      let started = false;
      const timer = setTimeout(() => { if (!started) { try { a.pause(); } catch (e) {} reject(new Error(t('eTimeout', { src: label }))); } }, 7000);
      a.onplaying = () => { started = true; clearTimeout(timer); };
      a.onended = () => { clearTimeout(timer); resolve(label); };
      a.onerror = () => { clearTimeout(timer); const c = a.error ? ' (code ' + a.error.code + ')' : ''; reject(new Error(t('eLoad', { src: label }) + c)); };
      a.src = src;
      const p = a.play();
      if (p && p.catch) p.catch(e => { clearTimeout(timer); reject(new Error(t('eBlocked', { src: label, m: e.name || e.message }))); });
    });
  }

  async function viViaProxy(text, proxy) {
    const url = proxy + (proxy.includes('?') ? '&' : '?') + 'text=' + encodeURIComponent(text) + '&tl=vi';
    const r = await fetch(url);
    if (!r.ok) throw new Error('GAS proxy HTTP ' + r.status);
    const body = (await r.text()).trim();
    let b64 = body;
    if (body.startsWith('{')) { const o = JSON.parse(body); b64 = o.audio || o.data || o.base64 || ''; }
    if (!b64) throw new Error('GAS proxy: empty');
    if (!b64.startsWith('data:')) b64 = 'data:audio/mpeg;base64,' + b64;
    return playAudio(b64, t('rProxy'));
  }

  function viDirect(text, client) {
    const url = 'https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=' + client +
      '&total=1&idx=0&textlen=' + text.length + '&q=' + encodeURIComponent(text);
    return playAudio(url, t('rDirect') + '[' + client + ']');
  }

  /* 실제 재생 순서 (설정 화면 표시용) */
  function viRoute(proxy) {
    const r = [];
    if (!isMobile && googleVoice('vi')) r.push(t('rGoogleVoice'));
    if (proxy) r.push(t('rProxy'));
    r.push(t('rDirect'), t('rDevice'));
    return r;
  }

  async function speak(raw, lang, opts = {}) {
    const cleaned = clean(raw);
    if (!cleaned) return;
    stop();
    const rate = Number(opts.rate) || 1;
    if (lang !== 'vi') return speakWeb(cleaned, lang, rate);

    const chain = [];
    const gv = googleVoice('vi');
    if (!isMobile && gv) chain.push(() => speakWeb(cleaned, 'vi', rate, gv));
    if (opts.proxy) chain.push(() => viViaProxy(cleaned, opts.proxy));
    chain.push(() => viDirect(cleaned, 'tw-ob'));
    chain.push(() => viDirect(cleaned, 'gtx'));
    chain.push(() => speakWeb(cleaned, 'vi', rate));

    const errs = [];
    for (const f of chain) {
      try { return await f(); }
      catch (e) {
        const m = (e && e.message) || String(e);
        if (/interrupted|canceled/i.test(m)) return;
        errs.push(m);
      }
    }
    throw new Error(t('eAll', { n: errs.length, m: errs.join(' / ') }));
  }

  return { speak, stop, clean, isMobile, pickVoice, viRoute, LANG_CODE };
})();
