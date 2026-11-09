/* 음성 재생 모듈
 * - 괄호 안 내용 제거 후 재생 (cleaned 사용, 원문 사용 금지)
 * - 한국어/영어/중국어/일본어: Web Speech API (Google 음성 우선)
 * - 베트남어: PC Chrome은 'Google Tiếng Việt' 음성 우선 → GAS 프록시 → Google 번역 음성 직접 → 기기 기본 음성
 *             모바일은 GAS 프록시 → Google 번역 음성 직접 → 기기 기본 음성
 * - 이중 재생 방지: _currentViAudio 로 이전 Audio 정지, body 클릭 리스너 사용 안 함
 */
const TTS = (() => {
  const LANG_CODE = { ko: 'ko-KR', vi: 'vi-VN', en: 'en-US', zh: 'zh-CN', ja: 'ja-JP' };
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const hasSynth = 'speechSynthesis' in window;
  let voices = [];
  window._currentViAudio = null;

  function loadVoices() { try { voices = window.speechSynthesis.getVoices() || []; } catch (e) { voices = []; } }
  if (hasSynth) { loadVoices(); try { window.speechSynthesis.onvoiceschanged = loadVoices; } catch (e) {} }

  const clean = t => String(t || '').replace(/\([^)]*\)/g, '').replace(/\s{2,}/g, ' ').trim();

  function pickVoice(lang) {
    if (!voices.length) loadVoices();
    const pre = LANG_CODE[lang].slice(0, 2).toLowerCase();
    const list = voices.filter(v => v.lang && v.lang.replace('_', '-').toLowerCase().startsWith(pre));
    return list.find(v => /google/i.test(v.name)) || list[0] || null;
  }

  function stop() {
    if (hasSynth) { try { window.speechSynthesis.cancel(); } catch (e) {} }
    if (window._currentViAudio) { try { window._currentViAudio.pause(); } catch (e) {} window._currentViAudio = null; }
  }

  function speakWeb(text, lang, rate) {
    return new Promise((resolve, reject) => {
      if (!hasSynth) return reject(new Error('이 브라우저는 Web Speech API 미지원'));
      const v = pickVoice(lang);
      if (!v && lang === 'vi') return reject(new Error('기기에 베트남어 음성 없음'));
      const u = new SpeechSynthesisUtterance(text);
      u.lang = LANG_CODE[lang];
      if (v) u.voice = v;
      u.rate = rate;
      u.onend = () => resolve('web');
      u.onerror = e => reject(new Error('Web Speech 오류: ' + (e.error || 'unknown')));
      window.speechSynthesis.speak(u);
    });
  }

  function playAudio(src, label) {
    return new Promise((resolve, reject) => {
      const a = new Audio(src);
      window._currentViAudio = a;
      a.onended = () => resolve(label);
      a.onerror = () => reject(new Error(label + ' 음원 로드 실패'));
      const p = a.play();
      if (p && p.catch) p.catch(e => reject(new Error(label + ' 재생 차단: ' + (e.name || e.message))));
    });
  }

  async function viViaProxy(text, proxy) {
    const url = proxy + (proxy.includes('?') ? '&' : '?') + 'text=' + encodeURIComponent(text) + '&tl=vi';
    const r = await fetch(url);
    if (!r.ok) throw new Error('GAS 프록시 HTTP ' + r.status);
    const body = (await r.text()).trim();
    let b64 = body;
    if (body.startsWith('{')) { const o = JSON.parse(body); b64 = o.audio || o.data || o.base64 || ''; }
    if (!b64) throw new Error('GAS 프록시 응답 비어 있음');
    if (!b64.startsWith('data:')) b64 = 'data:audio/mpeg;base64,' + b64;
    return playAudio(b64, 'GAS 프록시');
  }

  function viDirect(text) {
    return playAudio('https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=vi&q=' + encodeURIComponent(text), 'Google 번역 음성');
  }

  async function speak(raw, lang, opts = {}) {
    const cleaned = clean(raw);
    if (!cleaned) return;
    stop();
    const rate = Number(opts.rate) || 1;
    if (lang !== 'vi') return speakWeb(cleaned, lang, rate);

    const v = pickVoice('vi');
    const chain = [];
    if (!isMobile && v && /google/i.test(v.name)) chain.push(() => speakWeb(cleaned, 'vi', rate));
    if (opts.proxy) chain.push(() => viViaProxy(cleaned, opts.proxy));
    chain.push(() => viDirect(cleaned));
    chain.push(() => speakWeb(cleaned, 'vi', rate));

    const errs = [];
    for (const f of chain) {
      try { return await f(); }
      catch (e) {
        const m = e && e.message || String(e);
        if (/interrupted|canceled/i.test(m)) return;
        errs.push(m);
      }
    }
    throw new Error('베트남어 음성 ' + errs.length + '개 경로 모두 실패 — ' + errs.join(' / '));
  }

  return { speak, stop, clean, isMobile, pickVoice, LANG_CODE };
})();
