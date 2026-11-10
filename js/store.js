/* 로컬 저장소 (브라우저별 저장, 실패 시 메모리로 동작) */
/* 일일어학학습 GAS 웹앱 (베트남어 음성 프록시 + 번역 API) */
const DEFAULT_PROXY = 'https://script.google.com/macros/s/AKfycbwE93izqo_K32-HnCqtbmBX-Z6mSvo5HbVCEQPiOrHlrhfzu-2c4doKejnozeXrpEyv/exec';

const Store = (() => {
  const KEY = 'lingo5_v1';
  const defSettings = () => ({
    ui: '',              // 화면 언어 (빈 값이면 브라우저 언어)
    target: 'vi',        // 학습 언어
    native: 'ko',        // 뜻 언어
    front: 'target',     // 카드 앞면: target | native
    newPerDay: 10,       // 하루 신규 카드 수
    rate: 0.9,           // 음성 속도
    proxy: '',           // GAS 프록시 URL (비우면 DEFAULT_PROXY)
    showPron: true,      // 발음 표기
    autoplay: true,      // 카드 표시 시 자동 듣기
    theme: 'light'       // 화면 테마: light | dark | auto
  });
  const def = () => ({ settings: defSettings(), progress: {}, log: {}, stars: {}, custom: [], talk: [] });
  let mem = def();
  let persistent = true;
  let fresh = true;

  function load() {
    try {
      const s = localStorage.getItem(KEY);
      if (s) { apply(JSON.parse(s)); fresh = false; }
    } catch (e) { persistent = false; }
    return mem;
  }
  function apply(o) {
    const d = def();
    mem.settings = Object.assign(d.settings, (o && o.settings) || {});
    mem.progress = (o && o.progress) || {};
    mem.log = (o && o.log) || {};
    mem.stars = (o && o.stars) || {};
    mem.custom = Array.isArray(o && o.custom) ? o.custom : [];
    mem.talk = Array.isArray(o && o.talk) ? o.talk : [];
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(mem)); persistent = true; }
    catch (e) { persistent = false; }
  }
  function reset() { apply(def()); save(); }
  return { load, save, reset, apply, get: () => mem, isPersistent: () => persistent, isFresh: () => fresh };
})();
