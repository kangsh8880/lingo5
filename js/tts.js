/* 음성 재생 모듈
 * - 괄호 안 내용 제거 후 재생 (cleaned 사용, 원문 사용 금지)
 * - 한국어/영어/중국어/일본어: Web Speech API (Google 음성 우선)
 * - 베트남어
 *   · GAS 프록시(일일어학학습, 공식 서버 경유) → [PC] Google Tiếng Việt 기기 음성 → Google 번역 음성(tw-ob) → Google 번역 음성(gtx) → 기기 베트남어 음성
 *   · PC Chrome에는 Google 베트남어 기기 음성이 없어 Google 번역 음성을 직접 호출함.
 *     출처(Referer) 헤더가 붙으면 차단되는 경우가 있어 index.html에 no-referrer 지정 + Audio에도 지정
 * - 한국어/영어/중국어/일본어도 기기에 해당 언어 음성이 없거나 재생 실패 시
 *   GAS 프록시 → Google 번역 음성 순으로 자동 전환 (예: 갤럭시 탭에 중국어·일본어 음성 미설치)
 * - 이중 재생 방지: _currentViAudio 로 이전 Audio 정지, body 클릭 리스너 사용 안 함
 */
const TTS = (() => {
  const LANG_CODE = { ko: 'ko-KR', vi: 'vi-VN', en: 'en-US', zh: 'zh-CN', ja: 'ja-JP' };
  const GT = { ko: 'ko', vi: 'vi', en: 'en', zh: 'zh-CN', ja: 'ja' };   // Google 번역 음성 언어 코드
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const hasSynth = 'speechSynthesis' in window;
  const t = (k, v) => I18N.t(k, v);
  let voices = [];
  window._currentViAudio = null;

  /* 안드로이드 Chrome은 음성 목록이 늦게 채워짐 → 최대 1초 대기 */
  let voicesWaited = false;   // 대기는 최초 1회만 (이후 지연 없음)
  function waitVoices() {
    return new Promise(res => {
      if (!hasSynth || voicesWaited) return res();
      voicesWaited = true;
      let n = 0; const iv = setInterval(() => { loadVoices(); if (voices.length || ++n > 10) { clearInterval(iv); res(); } }, 100);
    });
  }
  function hasVoice(lang) { return voicesFor(lang).length > 0; }
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
      if (!v) return reject(new Error(t('eNoVoice', { lang: t('lang_' + lang) })));
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

  /* ---------- 음성 파일 캐시: 메모리 → 기기 저장소(Cache Storage) → GAS 다운로드 ----------
   * 한 번 받은 음성은 기기에 저장되어 다음부터 즉시 재생, 카드·문제가 화면에 나오면 미리 받아둠(prefetch) */
  const AUDIO_CACHE = 'lingo5-audio-v1';
  const mem = new Map();        // key → data URL
  const inflight = new Map();   // key → Promise<data URL>
  const akey = (lang, text) => lang + '|' + text;
  const aurl = key => 'https://audio.lingo5.local/' + encodeURIComponent(key);
  async function cacheGet(key) {
    if (mem.has(key)) return mem.get(key);
    try {
      if (!('caches' in window)) return null;
      const c = await caches.open(AUDIO_CACHE); const r = await c.match(aurl(key));
      if (!r) return null;
      const v = await r.text(); mem.set(key, v); return v;
    } catch (e) { return null; }
  }
  async function cachePut(key, dataUrl) {
    mem.set(key, dataUrl);
    try { if ('caches' in window) { const c = await caches.open(AUDIO_CACHE); await c.put(aurl(key), new Response(dataUrl)); } } catch (e) {}
  }
  async function fetchProxy(text, proxy, lang) {
    const url = proxy + (proxy.includes('?') ? '&' : '?') + 'text=' + encodeURIComponent(text) + '&lang=' + GT[lang];
    const r = await fetch(url);
    if (!r.ok) throw new Error('GAS proxy HTTP ' + r.status);
    const body = (await r.text()).trim();
    let b64 = body;
    if (!body || body === 'error') throw new Error('GAS proxy: error');
    if (body.startsWith('{')) { const o = JSON.parse(body); b64 = o.audio || o.data || o.base64 || ''; }
    if (!b64) throw new Error('GAS proxy: empty');
    return b64.startsWith('data:') ? b64 : 'data:audio/mpeg;base64,' + b64;
  }
  /* 캐시에 있으면 즉시, 받는 중이면 그 결과를, 없으면 새로 받기 */
  function getAudio(text, proxy, lang) {
    const key = akey(lang, text);
    if (inflight.has(key)) return inflight.get(key);
    const p = (async () => {
      const hit = await cacheGet(key); if (hit) return hit;
      const d = await fetchProxy(text, proxy, lang); await cachePut(key, d); return d;
    })();
    inflight.set(key, p);
    p.then(() => inflight.delete(key), () => inflight.delete(key));
    return p;
  }
  async function viaProxy(text, proxy, lang) {
    if (!proxy) throw new Error('GAS proxy: no URL');
    return playAudio(await getAudio(text, proxy, lang), t('rProxy'));
  }
  /* 기기 음성으로 바로 읽는 언어는 받을 필요 없음 */
  function needsRemote(lang) { return lang === 'vi' ? !(!isMobile && googleVoice('vi')) : !hasVoice(lang); }
  /* 미리 받기: 화면에 나온 카드·다음 카드 */
  function prefetch(raw, lang, proxy) {
    const text = clean(raw);
    if (!text || !proxy || !lang) return;
    if (!voices.length) loadVoices();
    if (!needsRemote(lang)) return;
    getAudio(text, proxy, lang).catch(() => {});
  }

  function viaDirect(text, client, lang) {
    const url = 'https://translate.google.com/translate_tts?ie=UTF-8&tl=' + GT[lang] + '&client=' + client +
      '&total=1&idx=0&textlen=' + text.length + '&q=' + encodeURIComponent(text);
    return playAudio(url, t('rDirect') + '[' + client + ']');
  }

  /* 실제 재생 순서 (설정 화면 표시용) */
  function viRoute(proxy) {
    const r = [];
    if (proxy) r.push(t('rProxy'));
    if (!isMobile && googleVoice('vi')) r.push(t('rGoogleVoice'));
    r.push(t('rDirect'), t('rDevice'));
    return r;
  }

  async function speak(raw, lang, opts = {}) {
    const cleaned = clean(raw);
    if (!cleaned) return;
    stop();
    const rate = Number(opts.rate) || 1;
    if (!voices.length) await waitVoices();
    const chain = [];
    if (lang === 'vi') {
      const gv = googleVoice('vi');
      if (opts.proxy) chain.push(() => viaProxy(cleaned, opts.proxy, 'vi'));
      if (!isMobile && gv) chain.push(() => speakWeb(cleaned, 'vi', rate, gv));
      chain.push(() => viaDirect(cleaned, 'tw-ob', 'vi'));
      chain.push(() => viaDirect(cleaned, 'gtx', 'vi'));
      chain.push(() => speakWeb(cleaned, 'vi', rate));
    } else {
      const has = voicesFor(lang).length > 0;
      if (has) chain.push(() => speakWeb(cleaned, lang, rate));          // 기기 음성 우선
      if (opts.proxy) chain.push(() => viaProxy(cleaned, opts.proxy, lang));
      chain.push(() => viaDirect(cleaned, 'tw-ob', lang));
      chain.push(() => viaDirect(cleaned, 'gtx', lang));
      if (!has) chain.push(() => speakWeb(cleaned, lang, rate));
    }

    const errs = [];
    for (const f of chain) {
      try { return await f(); }
      catch (e) {
        const m = (e && e.message) || String(e);
        if (/interrupted|canceled/i.test(m)) return;
        errs.push(m);
      }
    }
    throw new Error(lang === 'vi' ? t('eAll', { n: errs.length, m: errs.join(' / ') }) : errs.length + ' routes failed — ' + errs.join(' / '));
  }

  return { speak, stop, clean, isMobile, pickVoice, viRoute, hasVoice, prefetch, LANG_CODE };
})();
