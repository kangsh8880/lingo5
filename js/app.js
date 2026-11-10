/* 5개국어 학습카드 - 화면 로직 */
(function () {
  'use strict';
  const st = Store.load();
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const L = () => st.settings;
  const t = (k, v) => I18N.t(k, v);
  const ln = k => t('lang_' + k);
  const catName = c => { const k = 'cat_' + c, v = t(k); return v === k ? (CATS[c] || c) : v; };
  const R = {};

  /* ---------- 최초 실행: 화면 언어 = 브라우저 언어, 뜻 언어 = 화면 언어 ---------- */
  (function initLang() {
    const s = L();
    if (!s.ui) {
      s.ui = I18N.browserLang();
      if (Store.isFresh() && s.ui !== 'ko') { s.native = s.ui; s.target = 'ko'; }
    }
    I18N.set(s.ui);
  })();

  /* ---------- 문장 원본: Google 시트 (GAS action=phrases) → 캐시 → 앱 내장 data.js ---------- */
  const PKEY = 'lingo5_phrases_v1';
  const BUILTIN = PHRASES.slice();
  const CAT_KEY = {}; Object.keys(CATS).forEach(k => { CAT_KEY[CATS[k]] = k; });
  const SRC = { kind: 'builtin', n: BUILTIN.length, at: '' };
  function rowToCard(r) {
    let cat = CAT_KEY[r.cat] || r.cat || 'daily';
    if (!CATS[cat]) CATS[cat] = r.cat;
    return { id: r.id, cat, src: 'sheet', ko: r.ko, vi: r.vi, en: r.en, zh: r.zh, ja: r.ja,
      pron: { zh: r.zhP, ja: r.jaP, ko: r.koP }, kpron: { vi: r.viK, zh: r.zhK, ja: r.jaK } };
  }
  function applyRows(rows, at) {
    const cards = rows.filter(r => r.id && r.ko).map(rowToCard);
    if (!cards.length) return false;
    PHRASES.splice(0, PHRASES.length, ...cards);
    SRC.kind = 'sheet'; SRC.n = cards.length; SRC.at = at || '';
    return true;
  }
  (function loadCachedPhrases() {
    try { const c = JSON.parse(localStorage.getItem(PKEY) || 'null'); if (c && c.rows) applyRows(c.rows, c.at); } catch (e) {}
  })();
  async function fetchPhrases(manual) {
    try {
      const url = proxyUrl() + (proxyUrl().includes('?') ? '&' : '?') + 'action=phrases' + (manual ? '&nocache=1' : '');
      const r = await fetch(url);
      if (!r.ok) throw new Error('GAS HTTP ' + r.status);
      const d = JSON.parse(await r.text());
      if (!d.ok) throw new Error(d.error || 'GAS error');
      const sig = JSON.stringify(d.rows);
      let old = ''; try { const c = JSON.parse(localStorage.getItem(PKEY) || 'null'); old = c ? JSON.stringify(c.rows) : ''; } catch (e) {}
      const changed = sig !== old || SRC.kind !== 'sheet';
      if (applyRows(d.rows, d.at)) {
        try { localStorage.setItem(PKEY, JSON.stringify({ at: d.at, rows: d.rows })); } catch (e) {}
        if (changed || manual) { S = null; Q = null; route(); }
        if (manual) toast(t('refreshed', { n: SRC.n }));
      }
    } catch (e) {
      if (manual) toast(t('refreshFail', { m: (e && e.message) || e }), 'err');
    }
  }

  /* ---------- 공통 ---------- */
  function toast(msg, type) {
    const el = $('#toast');
    el.textContent = msg;
    el.className = 'toast show ' + (type || '');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.className = 'toast'; }, type === 'err' ? 7000 : 2600);
  }
  function save() { Store.save(); }
  function allCards() { return PHRASES.concat(st.custom); }
  function usable() { const s = L(); return allCards().filter(c => c[s.target] && c[s.native]); }
  function rawPron(c, lang) { return (c.pron && c.pron[lang]) || ''; }
  /* 발음 표기: 로마자(병음·로마자) + 뜻 언어가 한국어면 한글 발음(GAS 원본) 추가 */
  function pron(c, lang) {
    if (lang === L().native) return '';   /* 모국어(뜻 언어)는 발음 표기 생략 */
    const parts = [rawPron(c, lang)];
    if (L().native === 'ko' && lang !== 'ko' && c.kpron && c.kpron[lang]) parts.push('[' + c.kpron[lang] + ']');
    return parts.filter(Boolean).join('  ');
  }
  function proxyUrl() { return L().proxy || DEFAULT_PROXY; }
  /* 음성 미리 받기 (지연 제거) */
  function pre(c, lang) { if (c && c[lang]) TTS.prefetch(c[lang], lang, proxyUrl()); }
  function say(c, lang) {
    TTS.speak(c[lang], lang, { rate: L().rate, proxy: proxyUrl() })
      .catch(e => toast(t('ttsFail', { lang: ln(lang), m: (e && e.message) || e }), 'err'));
  }
  /* 취약 문장: 틀린 횟수(모름·오답·따라 말하기 미통과) 많은 순 */
  function weakCards(n) {
    return usable().map(c => ({ c, p: SRS.getP(st, c) })).filter(x => x.p && x.p.lapses > 0)
      .sort((a, b) => b.p.lapses - a.p.lapses || a.p.box - b.p.box).slice(0, n || 10);
  }
  function diffHtml(r) {
    return `<div class="diff">${r.parts.map(x => `<span class="tk ${x.ok ? 'ok' : 'ng'}">${esc(x.t)}</span>`).join(r.joiner)}</div>`;
  }
  function logShadow(pct) {
    const g = SRS.todayLog(st);
    g.speakN = (g.speakN || 0) + 1; g.speakSum = (g.speakSum || 0) + pct;
  }
  /* 따라 말하기 공통: 학습 언어로 듣고 채점 → cb(결과) */
  function shadowListen(c, btn, cb) {
    const lang = L().target;
    if (Translator.isListening()) { Translator.stopListen(); return; }
    TTS.stop();
    const r = Translator.listen(lang, {
      onInterim: () => {},
      onFinal: txt => { const sc = Compare.score(c[lang], txt, lang, false); cb({ said: txt, ...sc }); },
      onError: code => {
        const msg = code === 'unsupported' ? t('srUnsupported') : code === 'not-allowed' || code === 'service-not-allowed' ? t('srDenied')
          : code === 'no-speech' ? t('srNoSpeech') : code === 'aborted' ? '' : t('srOther', { m: code });
        if (msg) toast(msg, 'err');
      },
      onEnd: () => { if (btn && btn.isConnected) btn.classList.remove('rec'); }
    });
    if (r && btn) btn.classList.add('rec');
  }
  function shadowBox(res) {
    const pass = res.pct >= 80;
    FX.haptic(pass ? 'good' : 'bad');
    return `<div class="shadow-res ${pass ? 'ok' : 'ng'}">
      ${Mascot.html(pass ? 'happy' : 'oops', pass ? t('mShadowGood') : t('mShadowTry'), 40)}
      <b>${t('scoreLbl', { n: res.pct.toFixed(1) })}</b> · ${pass ? t('passShadow') : t('failShadow')}
      ${diffHtml(res)}<div class="note">${t('heardTxt', { a: esc(res.said) })}</div></div>`;
  }

  function boxLabel(b) { return b < 0 ? t('bNone') : b >= 3 ? t('bDone') : t('bIng'); }
  function boxClass(b) { return b < 0 ? 'b-none' : b >= 3 ? 'b-done' : 'b-ing'; }

  /* ---------- 테마 ---------- */
  function applyTheme() { document.documentElement.dataset.theme = L().theme || 'light'; }
  applyTheme();
  FX.setHaptic(L().haptic !== false);

  /* ---------- 상단: 화면 언어 / 학습 언어 / 뜻 언어 ---------- */
  function drawChrome() {
    const s = L();
    document.documentElement.lang = s.ui;
    document.title = t('appTitle');
    $('#appTitle').textContent = t('appTitle');
    $('#uiLabel').textContent = t('uiLang');
    $('#uiLang').innerHTML = I18N.ORDER.map(k => `<option value="${k}">${LANGS[k].flag} ${LANGS[k].self}</option>`).join('');
    $('#uiLang').value = s.ui;
    $('#tgtLabel').textContent = t('targetLang');
    $('#natLabel').textContent = t('nativeLang');
    $('#tgtChips').innerHTML = I18N.ORDER.map(k =>
      `<button class="chip ${s.target === k ? 'on' : ''}" data-tgt="${k}" type="button">${LANGS[k].flag} ${esc(ln(k))}</button>`).join('');
    $('#natChips').innerHTML = I18N.ORDER.filter(k => k !== s.target).map(k =>
      `<button class="chip ${s.native === k ? 'on' : ''}" data-nat="${k}" type="button">${LANGS[k].flag} ${esc(ln(k))}</button>`).join('');
    $$('#tgtChips [data-tgt]').forEach(b => b.onclick = () => setTarget(b.dataset.tgt));
    $$('#natChips [data-nat]').forEach(b => b.onclick = () => setNative(b.dataset.nat));
    $$('#tabs a').forEach(a => { a.querySelector('span').textContent = t('tab' + a.dataset.view[0].toUpperCase() + a.dataset.view.slice(1)); });
    $('#foot').textContent = t('foot');
  }
  $('#uiLang').onchange = e => setUi(e.target.value);

  function setUi(lang) {
    const s = L();
    s.ui = lang; I18N.set(lang);
    /* 화면 언어를 바꾸면 뜻 언어도 같은 언어로 맞춤 (학습 언어와 같으면 학습 언어를 변경) */
    if (lang === s.target) s.target = lang === 'ko' ? 'vi' : 'ko';
    s.native = lang;
    save(); S = null; Q = null;
    drawChrome(); route();
  }
  function setTarget(lang) {
    const s = L();
    s.target = lang;
    if (s.native === lang) s.native = s.ui !== lang ? s.ui : (lang === 'ko' ? 'vi' : 'ko');
    save(); S = null; Q = null;
    drawChrome(); route();
  }
  function setNative(lang) {
    L().native = lang; save(); S = null; Q = null;
    drawChrome(); route();
  }

  /* ---------- 라우팅 ---------- */
  const VIEWS = ['study', 'quiz', 'speak', 'words', 'stats', 'setup'];
  function route() {
    let v = (location.hash || '').slice(1);
    if (!VIEWS.includes(v)) v = 'study';
    $$('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + v));
    $$('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.view === v));
    TTS.stop(); Translator.stopListen();
    R[v]();
  }
  window.addEventListener('hashchange', () => {
    if (document.startViewTransition && !FX.reduced()) document.startViewTransition(route); else route();
  });

  /* =====================================================
   * 1. 카드학습
   * ===================================================== */
  let S = null;
  function newSession(extra, onlyCards) {
    const q = onlyCards ? { due: SRS.shuffle(onlyCards.slice()), fresh: [] } : SRS.buildQueue(usable(), st, extra);
    S = { weak: !!onlyCards, anim: true, mood: 'idle', msg: t('mHello'),
      queue: q.due.map(c => ({ c, kind: 'due' })).concat(q.fresh.map(c => ({ c, kind: 'new' }))),
      idx: 0, flipped: false, done: 0, again: 0, dueN: q.due.length, newN: q.fresh.length
    };
  }
  R.study = function () { if (!S) newSession(0); drawStudy(false); };
  function cur() { return S && S.queue[S.idx] ? S.queue[S.idx].c : null; }

  function drawStudy(autoplay) {
    const el = $('#view-study'), s = L();
    if (S.idx >= S.queue.length) {
      const msg = S.queue.length === 0 ? t('noneToday') : t('doneMsg', { a: `<b class="blue-t">${S.done}</b>`, b: `<b class="red-t">${S.again}</b>` });
      el.innerHTML = `<div class="panel center">
        <div class="done-mascot">${Mascot.html(S.done > 0 ? 'party' : 'idle', '', 120)}</div><h2>${t('doneTitle')}</h2><p>${msg}</p>
        <div class="row center gap wrap"><button class="btn blue" id="more" type="button">${t('more10')}</button>
        <a class="btn" href="#quiz">${t('goQuiz')}</a><a class="btn" href="#stats">${t('tabStats')}</a></div></div>`;
      $('#more').onclick = () => { newSession(10); if (!S.queue.length) toast(t('noMoreNew')); drawStudy(true); };
      if (S.done > 0 && !S.celebrated) { S.celebrated = true; FX.confetti(0.6); FX.haptic('goal'); }
      return;
    }
    const item = S.queue[S.idx], c = item.c;
    const front = s.front === 'native' ? s.native : s.target;
    const back = front === s.target ? s.native : s.target;
    const remain = S.queue.length - S.idx;
    const pct = Math.round(S.idx / S.queue.length * 100);
    const kindTxt = item.kind === 'new' ? t('new') : item.kind === 'again' ? t('again') : t('due');
    const goal = Number(s.dailyGoal) || 20, today = (SRS.todayLog(st).studied || 0);
    el.innerHTML = `
      <div class="study-top">
        <div class="goal">${FX.ring(today, goal)}<div class="goal-txt"><b>${t('goalLbl')}</b><span><em>${today}</em> / ${goal}</span></div></div>
        <div id="mascotBox">${Mascot.html(S.mood, S.msg, 52)}</div>
      </div>
      <div class="meta">
        <span class="pill blue">${t('due')} ${S.dueN}</span><span class="pill green">${t('new')} ${S.newN}</span>
        <span class="pill">${t('left')} ${remain}</span><span class="cat">${esc(catName(c.cat))}</span>
      </div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <button class="card3d ${S.flipped ? 'flipped' : ''} ${S.anim ? 'card-in' : ''}" id="card" type="button">
        <span class="card-inner">
          <span class="face front">
            <span class="tag tag-${item.kind}">${kindTxt}</span>
            <span class="face-main lang-${front}">${esc(c[front])}</span>
            ${s.showPron && pron(c, front) ? `<span class="pron">${esc(pron(c, front))}</span>` : ''}
            <span class="hint">👆 ${t('tapToFlip')}</span>
          </span>
          <span class="face back">
            <span class="tag tag-${item.kind}">${kindTxt}</span>
            <span class="face-small lang-${front}">${esc(c[front])}</span>
            ${s.showPron && pron(c, front) ? `<span class="pron">${esc(pron(c, front))}</span>` : ''}
            <span class="divider"></span>
            <span class="face-back lang-${back}">${esc(c[back])}</span>
            ${s.showPron && pron(c, back) ? `<span class="pron">${esc(pron(c, back))}</span>` : ''}
          </span>
        </span>
      </button>
      ${S.weak ? `<div class="weak-banner">${t('weakSession', { n: S.dueN })}</div>` : ''}
      <div class="row center gap wrap"><button class="btn round" id="play" type="button">🔊 ${t('listenLang', { lang: ln(s.target) })}</button>
        <button class="btn round mic-s" id="shadow" type="button">${t('speakNow')}</button></div>
      <div id="shadowRes"></div>
      <div id="gradeArea">${gradeHtml(c)}</div>
      <p class="keys"><span class="swipe-hint">${t('swipeHint')}</span><br>${t('keys', { g0: t('g0'), g1: t('g1'), g2: t('g2') })}</p>`;
    pre(c, s.target);
    for (let k = 1; k <= 2; k++) { const nx = S.queue[S.idx + k]; if (nx) pre(nx.c, s.target); }
    const cardEl = $('#card');
    cardEl.onclick = () => { if (!cardEl.dataset.dragged) flip(); };
    cardEl.dataset.good = t('g2'); cardEl.dataset.bad = t('g0');
    FX.drag(cardEl, {
      enabled: () => S.flipped && !S.busy,
      onMove: dx => { cardEl.style.transition = 'none'; cardEl.style.transform = `translateX(${dx}px) rotate(${dx / 22}deg)`; cardEl.dataset.dir = dx > 50 ? 'good' : dx < -50 ? 'bad' : ''; },
      onEnd: dx => {
        if (dx > 90) return grade(2, dx);
        if (dx < -90) return grade(0, dx);
        cardEl.style.transition = ''; cardEl.style.transform = ''; cardEl.dataset.dir = '';
      }
    });
    $('#play').onclick = () => say(c, s.target);
    $('#shadow').onclick = e => shadowListen(c, e.currentTarget, res => {
      logShadow(res.pct); if (res.pct < 80) { const p = SRS.getP(st, c); if (p) p.lapses++; }
      save(); $('#shadowRes').innerHTML = shadowBox(res);
    });
    bindGrade();
    S.anim = false;
    if (autoplay && s.autoplay && !S.flipped && front === s.target) say(c, s.target);
  }
  function gradeHtml(c) {
    return S.flipped
      ? `<div class="grade grade-in">
          <button class="btn red" data-g="0" type="button">😵 ${t('g0')}<small>${t('seeAgain')}</small></button>
          <button class="btn yellow" data-g="1" type="button">🤔 ${t('g1')}<small>${t('afterDays', { n: 1 })}</small></button>
          <button class="btn green" data-g="2" type="button">😊 ${t('g2')}<small>${t('afterDays', { n: SRS.nextDays(st, c) })}</small></button></div>`
      : `<div class="grade"><button class="btn blue wide" id="flip" type="button">${t('showMeaning')}</button></div>`;
  }
  function bindGrade() {
    if ($('#flip')) $('#flip').onclick = flip;
    $$('#view-study [data-g]').forEach(b => b.onclick = () => grade(+b.dataset.g));
  }
  function flip() {
    if (!S || S.flipped || !cur() || S.busy) return;
    S.flipped = true;
    $('#card').classList.add('flipped');
    $('#gradeArea').innerHTML = gradeHtml(cur()); bindGrade();
    setMood('think', t('mThink'));
    if (L().autoplay && L().front === 'native') say(cur(), L().target);
  }
  function setMood(mood, msg) {
    S.mood = mood; S.msg = msg;
    const box = $('#mascotBox'); if (box) box.innerHTML = Mascot.html(mood, msg, 52);
  }
  function grade(g, swipeDx) {
    const c = cur(); if (!c || !S.flipped || S.busy) return;
    SRS.grade(st, c, g);
    if (g === 0) { S.queue.push({ c, kind: 'again' }); S.again++; }
    S.done++; save();
    FX.haptic(g === 2 ? 'good' : g === 0 ? 'bad' : 'mid');
    if (g === 2) setMood('happy', Mascot.pick([t('mGood1'), t('mGood2'), t('mGood3')]));
    else if (g === 1) setMood('think', t('mMid'));
    else setMood('oops', t('mBad'));
    const log = SRS.todayLog(st), goal = Number(L().dailyGoal) || 20;
    if (log.studied >= goal && !log.goalHit) { log.goalHit = true; save(); setMood('party', t('mGoal')); FX.confetti(0.8); FX.haptic('goal'); }
    S.busy = true;
    const card = $('#card');
    const done = () => { S.busy = false; S.idx++; S.flipped = false; S.anim = true; drawStudy(true); };
    if (FX.reduced() || !card) return done();
    if (swipeDx) {
      card.style.transition = 'transform .28s ease-in, opacity .28s';
      card.style.transform = `translateX(${Math.sign(swipeDx) * 520}px) rotate(${Math.sign(swipeDx) * 18}deg)`;
      card.style.opacity = '0';
    } else card.classList.add(g === 2 ? 'out-good' : g === 0 ? 'out-bad' : 'out-mid');
    setTimeout(done, 280);
  }
  document.addEventListener('keydown', e => {
    if (!$('#view-study').classList.contains('active')) return;
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); flip(); }
    else if (e.key === '1') grade(0);
    else if (e.key === '2') grade(1);
    else if (e.key === '3') grade(2);
    else if (e.key === 'p' || e.key === 'P') { const c = cur(); if (c) say(c, L().target); }
  });

  /* =====================================================
   * 2. 퀴즈
   * ===================================================== */
  let Q = null;
  const qcfg = { mode: 'meaning', count: 10, scope: 'all' };
  const QMODES = { meaning: 'mMeaning', express: 'mExpress', listen: 'mListen', dictation: 'mDictation', shadow: 'mShadow' };

  R.quiz = function () { if (!Q) drawQuizSetup(); else drawQuiz(false); };

  function quizPool() {
    let p = usable();
    if (qcfg.scope === 'star') p = p.filter(c => st.stars[c.id]);
    else if (qcfg.scope === 'weak') { const w = new Set(weakCards(50).map(x => x.c.id)); p = p.filter(c => w.has(c.id)); }
    else if (qcfg.scope === 'learned') p = p.filter(c => SRS.boxOf(st, c) >= 0);
    else if (qcfg.scope !== 'all') p = p.filter(c => c.cat === qcfg.scope);
    return p;
  }
  function drawQuizSetup() {
    const el = $('#view-quiz');
    const cats = Object.keys(CATS).filter(k => usable().some(c => c.cat === k));
    el.innerHTML = `<div class="panel">
      <h2>${t('quizSetup')} <span class="sub">${esc(ln(L().target))} ↔ ${esc(ln(L().native))}</span></h2>
      <label class="lbl">${t('qType')}</label>
      <div class="chips">${Object.keys(QMODES).map(k => `<button class="chip ${qcfg.mode === k ? 'on' : ''}" data-mode="${k}" type="button">${t(QMODES[k])}</button>`).join('')}</div>
      <div class="grid2">
        <div><label class="lbl" for="qCount">${t('qCount')}</label>
          <select id="qCount">${[5, 10, 20].map(n => `<option value="${n}" ${qcfg.count === n ? 'selected' : ''}>${t('nQ', { n })}</option>`).join('')}</select></div>
        <div><label class="lbl" for="qScope">${t('qScope')}</label>
          <select id="qScope"><option value="all">${t('scAll')}</option><option value="learned">${t('scLearned')}</option><option value="star">${t('scStar')}</option><option value="weak">${t('scWeak')}</option>
          ${cats.map(k => `<option value="${k}">${esc(catName(k))}</option>`).join('')}</select></div>
      </div>
      <p class="note">${t('qNoteWrong')}${qcfg.mode === 'dictation' ? '<br>' + t('dictRoman') : ''}</p>
      <button class="btn blue wide" id="qStart" type="button">${t('qStart')}</button></div>`;
    $('#qScope').value = cats.includes(qcfg.scope) || ['all', 'learned', 'star', 'weak'].includes(qcfg.scope) ? qcfg.scope : 'all';
    $$('#view-quiz [data-mode]').forEach(b => b.onclick = () => { qcfg.mode = b.dataset.mode; drawQuizSetup(); });
    $('#qCount').onchange = e => qcfg.count = +e.target.value;
    $('#qScope').onchange = e => qcfg.scope = e.target.value;
    $('#qStart').onclick = startQuiz;
  }
  function startQuiz() {
    const pool = quizPool();
    if (pool.length < 4) { toast(t('qNeed4', { n: pool.length }), 'err'); return; }
    const s = L();
    const optLang = qcfg.mode === 'express' ? s.target : s.native;
    const picks = SRS.shuffle(pool.slice()).slice(0, Math.min(qcfg.count, pool.length));
    const qs = picks.map(c => {
      const dis = SRS.shuffle(pool.filter(d => d.id !== c.id && d[optLang] !== c[optLang])).slice(0, 3);
      const opts = SRS.shuffle([c].concat(dis));
      return { c, opts, ans: opts.indexOf(c), pick: null };
    });
    Q = { qs, i: 0, ok: 0, mode: qcfg.mode, optLang };
    drawQuiz(true);
  }
  function drawQuiz(autoplay) {
    const el = $('#view-quiz'), s = L();
    if (Q.i >= Q.qs.length) return drawQuizResult();
    if (Q.mode === 'dictation' || Q.mode === 'shadow') return drawQuizOpen(autoplay);
    const q = Q.qs[Q.i], c = q.c, answered = q.pick !== null;
    const tgtBlock = `<div class="q-main lang-${s.target}">${esc(c[s.target])}</div>${s.showPron && pron(c, s.target) ? `<div class="pron">${esc(pron(c, s.target))}</div>` : ''}`;
    let prompt;
    if (Q.mode === 'meaning') prompt = tgtBlock;
    else if (Q.mode === 'express') prompt = `<div class="q-main lang-${s.native}">${esc(c[s.native])}</div><div class="hint">${t('whichExpr', { lang: ln(s.target) })}</div>`;
    else prompt = answered ? tgtBlock : `<div class="q-main">🎧</div><div class="hint">${t('listenPick')}</div>`;
    el.innerHTML = `
      <div class="meta"><span class="pill blue">${t(QMODES[Q.mode])}</span><span class="pill">${Q.i + 1} / ${Q.qs.length}</span><span class="pill green">${t('correctN', { n: Q.ok })}</span></div>
      <div class="bar"><i style="width:${Math.round(Q.i / Q.qs.length * 100)}%"></i></div>
      <div class="qbox">${prompt}
        <button class="btn round" id="qPlay" type="button">🔊 ${Q.mode === 'listen' ? t('replay') : t('listen')}</button></div>
      <div class="opts">${q.opts.map((o, k) => {
        let cls = '';
        if (answered) { if (k === q.ans) cls = 'right'; else if (k === q.pick) cls = 'wrong'; else cls = 'dim'; }
        return `<button class="opt ${cls} lang-${Q.optLang}" data-k="${k}" type="button" ${answered ? 'disabled' : ''}><b>${k + 1}</b> ${esc(o[Q.optLang])}</button>`;
      }).join('')}</div>
      ${answered ? `<div class="feedback-row">${Mascot.html(q.pick === q.ans ? 'happy' : 'oops', q.pick === q.ans ? t('mQuizOk') : t('mQuizNg'), 46)}</div>
         <div class="feedback ${q.pick === q.ans ? 'ok' : 'ng'}">${q.pick === q.ans ? t('right') : t('wrongAdded')}
         <div class="fb-detail"><b>${esc(c[s.target])}</b> ${pron(c, s.target) ? `<span class="pron">${esc(pron(c, s.target))}</span>` : ''} = ${esc(c[s.native])}</div></div>
         <button class="btn blue wide" id="qNext" type="button">${Q.i + 1 < Q.qs.length ? t('next') : t('seeResult')}</button>` : ''}`;
    pre(c, s.target); if (Q.qs[Q.i + 1]) pre(Q.qs[Q.i + 1].c, s.target);
    $('#qPlay').onclick = () => say(c, Q.mode === 'express' && !answered ? s.native : s.target);
    $$('#view-quiz [data-k]').forEach(b => b.onclick = () => answer(+b.dataset.k));
    if ($('#qNext')) $('#qNext').onclick = () => { Q.i++; drawQuiz(true); };
    if (autoplay && !answered && (Q.mode === 'listen' || (Q.mode === 'meaning' && s.autoplay))) say(c, s.target);
  }
  function commitQ(q, ok, pct) {
    if (q.done) return;
    q.done = true; q.pick = ok ? q.ans : -1;
    const log = SRS.todayLog(st);
    log.quizN++;
    if (ok) { Q.ok++; log.quizOK++; FX.haptic('good'); } else { SRS.lapse(st, q.c); FX.haptic('bad'); }
    if (Q.mode === 'shadow') logShadow(pct);
    save();
  }
  function drawQuizOpen(autoplay) {
    const el = $('#view-quiz'), s = L(), q = Q.qs[Q.i], c = q.c, lang = s.target;
    const tgt = `<div class="q-main lang-${lang}">${esc(c[lang])}</div>${s.showPron && pron(c, lang) ? `<div class="pron">${esc(pron(c, lang))}</div>` : ''}`;
    let body = '';
    if (Q.mode === 'dictation') {
      body = `<div class="qbox">${q.res ? tgt : `<div class="q-main">🎧</div><div class="hint">${t('dictHint', { lang: esc(ln(lang)) })}</div>`}
          <div class="hint">${esc(c[s.native])}</div>
          <button class="btn round" id="qPlay" type="button">🔊 ${t('replay')}</button></div>
        ${q.res ? `<div class="feedback ${q.res.result === 'ok' ? 'ok' : 'ng'}">${q.res.result === 'ok' ? t('right') : q.res.result === 'partial' ? t('partial') : t('wrongAdded')}
            ${diffHtml(q.res)}<div class="fb-detail">${t('yourAns', { a: esc(q.input) })}</div></div>`
          : `<form class="type-row" id="dForm"><input id="dIn" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" class="lang-${lang}">
            <button class="btn blue" type="submit">${t('check')}</button></form>`}`;
    } else {
      body = `<div class="qbox">${tgt}<div class="hint">${esc(c[s.native])}</div>
          <div class="row center gap wrap"><button class="btn round" id="qPlay" type="button">🔊 ${t('listen')}</button>
          <button class="btn round mic-s" id="qMic" type="button">${q.res ? t('speakAgain') : t('speakNow')}</button></div>
          <div class="hint">${t('shadowHint')}</div></div>
        ${q.res ? shadowBox(q.res) : ''}`;
    }
    const canNext = Q.mode === 'dictation' ? !!q.res : !!q.res;
    el.innerHTML = `
      <div class="meta"><span class="pill blue">${t(QMODES[Q.mode])}</span><span class="pill">${Q.i + 1} / ${Q.qs.length}</span><span class="pill green">${t('correctN', { n: Q.ok })}</span></div>
      <div class="bar"><i style="width:${Math.round(Q.i / Q.qs.length * 100)}%"></i></div>
      ${body}
      ${canNext ? `<button class="btn blue wide" id="qNext" type="button">${Q.i + 1 < Q.qs.length ? t('next') : t('seeResult')}</button>` : ''}`;
    pre(c, lang); if (Q.qs[Q.i + 1]) pre(Q.qs[Q.i + 1].c, lang);
    $('#qPlay').onclick = () => say(c, lang);
    if ($('#dForm')) {
      $('#dIn').focus();
      $('#dForm').onsubmit = e => {
        e.preventDefault();
        const v = $('#dIn').value.trim(); if (!v) return;
        q.input = v; q.res = Compare.dictation(c, lang, v);
        commitQ(q, q.res.result === 'ok', q.res.pct);
        drawQuizOpen(false);
      };
    }
    if ($('#qMic')) $('#qMic').onclick = e => shadowListen(c, e.currentTarget, res => {
      if (!q.res || res.pct > q.res.pct) q.res = res;   // 여러 번 시도 시 최고 점수 반영
      drawQuizOpen(false);
    });
    if ($('#qNext')) $('#qNext').onclick = () => {
      if (Q.mode === 'shadow') commitQ(q, q.res.pct >= 80, q.res.pct);
      Q.i++; drawQuiz(true);
    };
    if (autoplay && !q.res) say(c, lang);
  }

  function answer(k) {
    const q = Q.qs[Q.i]; if (q.pick !== null) return;
    q.pick = k;
    const log = SRS.todayLog(st);
    log.quizN++;
    if (k === q.ans) { Q.ok++; log.quizOK++; FX.haptic('good'); } else { SRS.lapse(st, q.c); FX.haptic('bad'); }
    save(); drawQuiz(false);
    if (L().autoplay && Q.mode !== 'meaning') say(q.c, L().target);
  }
  function drawQuizResult() {
    const el = $('#view-quiz'), s = L();
    const acc = Q.qs.length ? (Q.ok / Q.qs.length * 100).toFixed(1) : '0.0';
    const wrong = Q.qs.filter(q => q.pick !== q.ans);
    if (+acc === 100 && !Q.celebrated) { Q.celebrated = true; setTimeout(() => FX.confetti(1), 150); FX.haptic('goal'); }
    el.innerHTML = `<div class="panel center">
      <div class="done-mascot">${Mascot.html(+acc >= 80 ? 'party' : +acc >= 50 ? 'happy' : 'think', '', 96)}</div>
      <h2>${t('qResult')}</h2>
      <div class="score"><b class="${+acc >= 80 ? 'blue-t' : 'red-t'}" data-count="${acc}" data-dec="1" data-suffix="%">${acc}%</b><span>${t('scoreTxt', { a: Q.ok, b: Q.qs.length })}</span></div>
      ${wrong.length ? `<table class="tbl"><thead><tr><th>${esc(ln(s.target))}</th><th>${esc(ln(s.native))}</th><th>🔊</th></tr></thead><tbody>
        ${wrong.map(q => `<tr><td class="lang-${s.target}">${esc(q.c[s.target])}${pron(q.c, s.target) ? `<br><span class="pron">${esc(pron(q.c, s.target))}</span>` : ''}</td><td>${esc(q.c[s.native])}</td>
        <td><button class="ic" data-play="${q.c.id}" type="button">🔊</button></td></tr>`).join('')}</tbody></table>
        <p class="note">${t('wrongNote', { n: wrong.length })}</p>` : `<p>${t('allRight')}</p>`}
      <div class="row center gap wrap"><button class="btn blue" id="qAgain" type="button">${t('qAgain')}</button>
      <button class="btn" id="qSetup" type="button">${t('qChange')}</button><button class="btn" id="qStudy" type="button">${t('qReview')}</button></div></div>`;
    $$('#view-quiz [data-play]').forEach(b => b.onclick = () => { const c = allCards().find(x => x.id === b.dataset.play); if (c) say(c, s.target); });
    FX.countUp($('#view-quiz'));
    $('#qAgain').onclick = startQuiz;
    $('#qSetup').onclick = () => { Q = null; drawQuizSetup(); };
    $('#qStudy').onclick = () => { S = null; location.hash = '#study'; };
  }

  /* =====================================================
   * 2-1. 말하기 번역 (뜻 언어로 말하기 → 학습 언어로 번역)
   * ===================================================== */
  const SP = { rev: false, busy: false, last: null, mode: 'voice', psl: null, ptl: null, photo: null, img: '' };
  function spDir() { const s = L(); return SP.rev ? { from: s.target, to: s.native } : { from: s.native, to: s.target }; }

  R.speak = function () {
    if (SP.mode === 'photo') return drawPhoto();
    const el = $('#view-speak'), d = spDir();
    el.innerHTML = `
      ${spSeg()}
      <div class="panel center">
        <h2>${t('speakTitle')}</h2>
        <div class="dir">
          <span class="pill ${SP.rev ? 'blue' : 'green'}">🗣 ${esc(ln(d.from))}</span>
          <button class="ic swap" id="spSwap" type="button" title="${esc(t('swapDir'))}">⇄</button>
          <span class="pill ${SP.rev ? 'green' : 'blue'}">${esc(ln(d.to))}</span>
        </div>
        <button class="mic" id="spMic" type="button" aria-label="mic">🎤</button>
        <p class="hint" id="spHint">${t('tapToSpeak', { lang: esc(ln(d.from)) })}</p>
        <div class="heard lang-${d.from}" id="spHeard"></div>
        <form class="type-row" id="spForm">
          <input id="spIn" type="text" placeholder="${esc(t('typeHere', { lang: ln(d.from) }))}">
          <button class="btn blue" type="submit">${t('translateBtn')}</button>
        </form>
        <p class="note">${t('speakNote')}</p>
      </div>
      <div id="spResult"></div>
      <div class="panel">
        <div class="chart-head"><h3>${t('history')}</h3>${st.talk.length ? `<button class="btn" id="spClear" type="button">${t('clearHist')}</button>` : ''}</div>
        <div id="spHist"></div>
      </div>`;
    bindSeg();
    $('#spSwap').onclick = () => { Translator.stopListen(); SP.rev = !SP.rev; SP.last = null; R.speak(); };
    $('#spMic').onclick = toggleMic;
    $('#spForm').onsubmit = e => { e.preventDefault(); const v = $('#spIn').value.trim(); if (v) { $('#spHeard').textContent = v; doTranslate(v); } };
    if ($('#spClear')) $('#spClear').onclick = () => { st.talk = []; save(); R.speak(); };
    if (SP.last) drawSpResult(SP.last);
    drawSpHist();
  };

  /* ---------- 말하기 / 사진 번역 전환 ---------- */
  function spSeg() {
    return `<div class="seg">${['voice', 'photo'].map(m => `<button class="${SP.mode === m ? 'on' : ''}" data-spm="${m}" type="button">${t(m === 'voice' ? 'spVoice' : 'spPhoto')}</button>`).join('')}</div>`;
  }
  function bindSeg() { $$('#view-speak [data-spm]').forEach(b => b.onclick = () => { Translator.stopListen(); SP.mode = b.dataset.spm; R.speak(); }); }

  /* ---------- 사진 번역 (메뉴판·안내문) ---------- */
  function drawPhoto() {
    const el = $('#view-speak'), s = L();
    if (SP.psl === null) SP.psl = s.target;
    if (SP.ptl === null) SP.ptl = s.native;
    el.innerHTML = `${spSeg()}
      <div class="panel center">
        <h2>${t('spPhoto')}</h2>
        <div class="grid2 left">
          <div><label class="lbl" for="pSl">${t('photoLang')}</label>
            <select id="pSl"><option value="auto">${t('autoDetect')}</option>${I18N.ORDER.map(k => `<option value="${k}">${LANGS[k].flag} ${esc(ln(k))}</option>`).join('')}</select></div>
          <div><label class="lbl" for="pTl">${t('toLangLbl')}</label>
            <select id="pTl">${I18N.ORDER.map(k => `<option value="${k}">${LANGS[k].flag} ${esc(ln(k))}</option>`).join('')}</select></div>
        </div>
        <div class="photo-btns">
          <label class="btn blue file photo-btn">${t('photoCam')}<input type="file" id="pCam" accept="image/*" capture="environment"></label>
          <label class="btn file photo-btn">${t('photoGal')}<input type="file" id="pFile" accept="image/*"></label>
        </div>
        <p class="hint" id="pStatus">${SP.photo ? t('ocrLines', { n: SP.photo.length }) : ''}</p>
        ${SP.img ? `<img class="photo-prev" src="${SP.img}" alt="">` : ''}
        <p class="note">${t('ocrNote')}</p>
      </div>
      <div id="pResult"></div>`;
    bindSeg();
    $('#pSl').value = SP.psl;
    $('#pSl').onchange = e => { SP.psl = e.target.value; };
    $('#pTl').value = SP.ptl;
    $('#pTl').onchange = e => { SP.ptl = e.target.value; };
    ['#pCam', '#pFile'].forEach(id => { $(id).onchange = e => { const f = e.target.files[0]; if (f) runOcr(f); e.target.value = ''; }; });
    drawPhotoResult();
  }
  /* 사진 축소(긴 변 1600px, JPEG) → base64 */
  function shrinkImage(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const k = Math.min(1, 1600 / Math.max(img.width, img.height));
        const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        res(cv.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('image decode failed')); };
      img.src = url;
    });
  }
  async function runOcr(file) {
    const st0 = $('#pStatus'); st0.textContent = t('ocrRunning'); st0.classList.add('busy');
    SP.photo = null; $('#pResult').innerHTML = '';
    try {
      const dataUrl = await shrinkImage(file);
      SP.img = dataUrl;
      const prev = document.querySelector('.photo-prev');
      if (prev) prev.src = dataUrl; else st0.insertAdjacentHTML('afterend', `<img class="photo-prev" src="${dataUrl}" alt="">`);
      const r = await fetch(proxyUrl(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'ocr', image: dataUrl.split(',')[1], mime: 'image/jpeg', sl: SP.psl, tl: SP.ptl }) });
      if (!r.ok) throw new Error('GAS HTTP ' + r.status);
      const body = await r.text();
      let d; try { d = JSON.parse(body); } catch (e) { throw new Error('GAS: OCR API not deployed'); }
      if (!d.ok) throw new Error(d.error);
      SP.photo = d.lines.map(x => ({ ...x, saved: false })); SP.photoTl = SP.ptl; SP.photoSl = SP.psl;
      if (!$('#view-speak').classList.contains('active') || SP.mode !== 'photo') return;
      $('#pStatus').textContent = SP.photo.length ? t('ocrLines', { n: SP.photo.length }) : t('ocrNone');
      drawPhotoResult();
      if (SP.psl !== 'auto') SP.photo.slice(0, 6).forEach(x => TTS.prefetch(x.src, SP.psl, proxyUrl()));
    } catch (e) {
      const el = $('#pStatus'); if (el) el.textContent = '';
      toast(t('ocrFail', { m: (e && e.message) || e }), 'err');
    } finally { const el = $('#pStatus'); if (el) el.classList.remove('busy'); }
  }
  function drawPhotoResult() {
    const box = $('#pResult'); if (!box || !SP.photo || !SP.photo.length) return;
    const sl = SP.photoSl || SP.psl, nat = SP.photoTl || SP.ptl;
    box.innerHTML = `<div class="wlist">${SP.photo.map((x, i) => `
      <div class="wrow">
        ${sl !== 'auto' ? `<button class="ic" data-pplay="${i}" type="button">🔊</button>` : ''}
        <div class="wtxt"><b class="lang-${sl}">${esc(x.src)}</b><span class="mean dst-line">${esc(x.dst)}</span></div>
        ${x.saved ? `<span class="badge b-done">${t('savedMine')}</span>` : (sl !== 'auto' && sl !== nat ? `<button class="ic" data-psave="${i}" type="button" title="${esc(t('saveMine'))}">＋</button>` : '')}
      </div>`).join('')}</div>`;
    $$('#pResult [data-pplay]').forEach(b => b.onclick = () => { const x = SP.photo[+b.dataset.pplay]; say({ [sl]: x.src }, sl); });
    $$('#pResult [data-psave]').forEach(b => b.onclick = () => {
      const x = SP.photo[+b.dataset.psave]; if (x.saved) return;
      const c = { id: 'c' + Date.now().toString(36), cat: 'custom', ko: '', vi: '', en: '', zh: '', ja: '', pron: { zh: '', ja: '' } };
      c[sl] = x.src; c[nat] = x.dst; st.custom.push(c); x.saved = true; save(); S = null;
      toast(t('added')); drawPhotoResult();
    });
  }

  function toggleMic() {
    if (Translator.isListening()) { Translator.stopListen(); return; }
    const d = spDir(), mic = $('#spMic'), hint = $('#spHint');
    TTS.stop();
    const r = Translator.listen(d.from, {
      onInterim: txt => { $('#spHeard').textContent = txt; },
      onFinal: txt => { $('#spHeard').textContent = txt; doTranslate(txt); },
      onError: code => {
        const msg = code === 'unsupported' ? t('srUnsupported') : code === 'not-allowed' || code === 'service-not-allowed' ? t('srDenied')
          : code === 'no-speech' ? t('srNoSpeech') : code === 'aborted' ? '' : t('srOther', { m: code });
        if (msg) toast(msg, 'err');
      },
      onEnd: () => { if (mic) mic.classList.remove('on'); if (hint && !SP.busy) hint.textContent = t('tapToSpeak', { lang: ln(spDir().from) }); }
    });
    if (r) { mic.classList.add('on'); hint.textContent = t('listening'); $('#spHeard').textContent = ''; }
  }

  async function doTranslate(text) {
    const d = spDir();
    SP.busy = true;
    $('#spHint').textContent = t('translating');
    try {
      const res = await Translator.translate(text, d.from, d.to, proxyUrl());
      const item = { id: 't' + Date.now().toString(36), from: d.from, to: d.to, src: text, dst: res.text, pron: res.pron, engine: res.engine, saved: false };
      st.talk.unshift(item); st.talk = st.talk.slice(0, 30); save();
      SP.last = item;
      if ($('#view-speak').classList.contains('active')) { drawSpResult(item); drawSpHist(); }
      if (L().autoplay) TTS.speak(item.dst, item.to, { rate: L().rate, proxy: proxyUrl() }).catch(() => {});
    } catch (e) {
      toast(t('trFail', { m: (e && e.message) || e }), 'err');
    } finally {
      SP.busy = false;
      const h = $('#spHint'); if (h) h.textContent = t('tapToSpeak', { lang: ln(spDir().from) });
    }
  }

  function showPronFor(lang) { return ['zh', 'ja', 'ko'].includes(lang); }
  function drawSpResult(it) {
    $('#spResult').innerHTML = `
      <div class="panel result">
        <div class="src lang-${it.from}">${esc(it.src)}</div>
        <div class="dst lang-${it.to}">${esc(it.dst)}</div>
        ${it.pron && showPronFor(it.to) ? `<div class="pron">${esc(it.pron)}</div>` : ''}
        <div class="row center gap wrap">
          <button class="btn round" id="spPlay" type="button">🔊 ${t('listenLang', { lang: esc(ln(it.to)) })}</button>
          <button class="btn ${it.saved ? '' : 'green'}" id="spSave" type="button" ${it.saved ? 'disabled' : ''}>${it.saved ? t('savedMine') : t('saveMine')}</button>
          <button class="btn" id="spCopy" type="button">${t('copy')}</button>
        </div>
        <p class="note">${t('engine', { e: esc(it.engine) })}</p>
      </div>`;
    $('#spPlay').onclick = () => say({ [it.to]: it.dst }, it.to);
    $('#spSave').onclick = () => saveTalk(it);
    $('#spCopy').onclick = () => {
      if (navigator.clipboard) navigator.clipboard.writeText(it.dst).then(() => toast(t('copied')), e => toast(t('clipFail', { m: e.name }), 'err'));
    };
  }
  function saveTalk(it) {
    if (it.saved) return;
    const c = { id: 'c' + Date.now().toString(36), cat: 'custom', ko: '', vi: '', en: '', zh: '', ja: '', pron: { zh: '', ja: '' } };
    c[it.from] = it.src; c[it.to] = it.dst;
    if (it.pron && (it.to === 'zh' || it.to === 'ja')) c.pron[it.to] = it.pron;
    st.custom.push(c); it.saved = true;
    const h = st.talk.find(x => x.id === it.id); if (h) h.saved = true;
    save(); S = null;
    toast(t('added'));
    if (SP.last && SP.last.id === it.id) { SP.last.saved = true; drawSpResult(SP.last); }
    drawSpHist();
  }
  function drawSpHist() {
    const box = $('#spHist'); if (!box) return;
    box.innerHTML = st.talk.length ? `<div class="wlist">${st.talk.map(it => `
      <div class="wrow">
        <button class="ic" data-tplay="${it.id}" type="button">🔊</button>
        <div class="wtxt"><b class="lang-${it.to}">${esc(it.dst)}</b>
          ${it.pron && showPronFor(it.to) ? `<span class="pron">${esc(it.pron)}</span>` : ''}
          <span class="mean">${LANGS[it.from].flag} ${esc(it.src)}</span></div>
        ${it.saved ? `<span class="badge b-done">${t('savedMine')}</span>` : `<button class="ic" data-tsave="${it.id}" type="button" title="${esc(t('saveMine'))}">＋</button>`}
      </div>`).join('')}</div>` : `<div class="empty">${t('histEmpty')}</div>`;
    $$('#spHist [data-tplay]').forEach(b => b.onclick = () => { const it = st.talk.find(x => x.id === b.dataset.tplay); if (it) say({ [it.to]: it.dst }, it.to); });
    $$('#spHist [data-tsave]').forEach(b => b.onclick = () => { const it = st.talk.find(x => x.id === b.dataset.tsave); if (it) saveTalk(it); });
  }

  /* =====================================================
   * 3. 단어장
   * ===================================================== */
  const W = { q: '', cat: 'all', star: false, add: false };
  R.words = function () {
    const el = $('#view-words');
    el.innerHTML = `
      <div class="toolbar">
        <input id="wq" type="search" placeholder="${esc(t('search'))}" value="${esc(W.q)}">
        <select id="wcat"><option value="all">${t('allCats')}</option>${Object.keys(CATS).map(k => `<option value="${k}">${esc(catName(k))}</option>`).join('')}</select>
        <button class="chip ${W.star ? 'on' : ''}" id="wstar" type="button">★ ${t('scStar')}</button>
      </div>
      <div class="row gap wrap">
        <button class="btn" id="wAdd" type="button">${W.add ? t('addClose') : t('addOpen')}</button>
        <button class="btn" id="wExport" type="button">${t('csvOut')}</button>
        <label class="btn file">${t('csvIn')}<input type="file" id="wImport" accept=".csv,text/csv"></label>
        <span class="count" id="wCount"></span>
      </div>
      ${W.add ? `<form class="panel addform" id="addForm">
        <p class="note">${t('addNote')}</p>
        <div class="grid2">
          ${I18N.ORDER.map(k => `<div><label class="lbl" for="f_${k}">${LANGS[k].flag} ${esc(ln(k))}</label><input id="f_${k}" type="text"></div>`).join('')}
          <div><label class="lbl" for="f_zhp">${t('zhPron')}</label><input id="f_zhp" type="text"></div>
          <div><label class="lbl" for="f_jap">${t('jaPron')}</label><input id="f_jap" type="text"></div>
        </div>
        <button class="btn blue wide" type="submit">${t('save')}</button></form>` : ''}
      <div id="wList" class="wlist"></div>
      <textarea id="wCsvOut" class="csvout" readonly hidden></textarea>`;
    $('#wcat').value = W.cat;
    $('#wq').oninput = e => { W.q = e.target.value; drawWordList(); };
    $('#wcat').onchange = e => { W.cat = e.target.value; drawWordList(); };
    $('#wstar').onclick = () => { W.star = !W.star; R.words(); };
    $('#wAdd').onclick = () => { W.add = !W.add; R.words(); };
    $('#wExport').onclick = exportCsv;
    $('#wImport').onchange = importCsv;
    if ($('#addForm')) $('#addForm').onsubmit = addCustom;
    drawWordList();
  };
  function drawWordList() {
    const s = L(), q = W.q.trim().toLowerCase();
    const list = allCards().filter(c => c[s.target])
      .filter(c => W.cat === 'all' || c.cat === W.cat)
      .filter(c => !W.star || st.stars[c.id])
      .filter(c => !q || I18N.ORDER.some(k => String(c[k] || '').toLowerCase().includes(q)) || Object.values(c.pron || {}).some(v => String(v).toLowerCase().includes(q)));
    $('#wCount').textContent = t('countN', { n: list.length });
    $('#wList').innerHTML = list.length ? list.map(c => {
      const b = SRS.boxOf(st, c);
      const mean = c[s.native] || I18N.ORDER.map(k => k !== s.target && c[k]).find(Boolean) || '';
      return `<div class="wrow">
        <button class="ic" data-play="${c.id}" type="button">🔊</button>
        <div class="wtxt"><b class="lang-${s.target}">${esc(c[s.target])}</b>
          ${pron(c, s.target) ? `<span class="pron">${esc(pron(c, s.target))}</span>` : ''}
          <span class="mean">${esc(mean)}</span></div>
        <span class="badge ${boxClass(b)}">${boxLabel(b)}</span>
        <button class="ic star ${st.stars[c.id] ? 'on' : ''}" data-star="${c.id}" type="button">★</button>
        ${c.cat === 'custom' ? `<button class="ic del" data-del="${c.id}" type="button">✕</button>` : ''}
      </div>`;
    }).join('') : `<div class="empty">${t('noMatch')}</div>`;
    list.slice(0, 8).forEach(c => pre(c, s.target));
    $$('#wList [data-play]').forEach(b => b.onclick = () => { const c = allCards().find(x => x.id === b.dataset.play); if (c) say(c, s.target); });
    $$('#wList [data-star]').forEach(b => b.onclick = () => {
      const id = b.dataset.star; if (st.stars[id]) delete st.stars[id]; else st.stars[id] = 1; save(); drawWordList();
    });
    $$('#wList [data-del]').forEach(b => b.onclick = () => {
      if (b.dataset.armed) { st.custom = st.custom.filter(c => c.id !== b.dataset.del); save(); drawWordList(); toast(t('deleted')); }
      else { b.dataset.armed = '1'; b.textContent = t('delQ'); b.classList.add('armed'); setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = '✕'; b.classList.remove('armed'); } }, 3000); }
    });
  }
  function addCustom(e) {
    e.preventDefault();
    const v = id => $('#' + id).value.trim();
    const c = { id: 'c' + Date.now().toString(36), cat: 'custom', ko: v('f_ko'), vi: v('f_vi'), en: v('f_en'), zh: v('f_zh'), ja: v('f_ja'), pron: { zh: v('f_zhp'), ja: v('f_jap') } };
    if (I18N.ORDER.filter(k => c[k]).length < 2) { toast(t('need2'), 'err'); return; }
    st.custom.push(c); save(); S = null;
    toast(t('added')); W.add = false; R.words();
  }
  const CSV_COLS = ['cat', 'ko', 'vi', 'en', 'zh', 'zh_pron', 'ja', 'ja_pron'];
  const csvCell = v => /[",\n]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);
  function exportCsv() {
    const rows = allCards().map(c => [c.cat, c.ko, c.vi, c.en, c.zh, rawPron(c, 'zh'), c.ja, rawPron(c, 'ja')].map(x => csvCell(x || '')).join(','));
    const csv = CSV_COLS.join(',') + '\n' + rows.join('\n');
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
      a.download = 'lingo5_' + SRS.dateKey() + '.csv';
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) {}
    const out = $('#wCsvOut'); out.hidden = false; out.value = csv;
    if (navigator.clipboard) navigator.clipboard.writeText(csv).then(() => toast(t('csvDone')), () => toast(t('csvTried')));
    else toast(t('csvTried'));
  }
  function parseCsv(text) {
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(x => x.trim()));
  }
  function importCsv(e) {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const rows = parseCsv(String(rd.result).replace(/^﻿/, ''));
        const head = (rows.shift() || []).map(h => h.trim().toLowerCase());
        const idx = n => head.indexOf(n);
        if (I18N.ORDER.filter(k => idx(k) >= 0).length < 2) throw new Error(t('csvNoHead', { cols: CSV_COLS.join(', ') }));
        const exist = new Set(allCards().map(c => I18N.ORDER.map(k => c[k] || '').join('|')));
        let add = 0, skip = 0;
        rows.forEach((r, n) => {
          const g = k => idx(k) >= 0 ? (r[idx(k)] || '').trim() : '';
          const c = { id: 'c' + Date.now().toString(36) + n, cat: 'custom', ko: g('ko'), vi: g('vi'), en: g('en'), zh: g('zh'), ja: g('ja'), pron: { zh: g('zh_pron'), ja: g('ja_pron') } };
          const sig = I18N.ORDER.map(k => c[k]).join('|');
          if (I18N.ORDER.filter(k => c[k]).length < 2 || exist.has(sig)) { skip++; return; }
          exist.add(sig); st.custom.push(c); add++;
        });
        save(); S = null; R.words();
        toast(t('csvResult', { a: add, b: skip }));
      } catch (err) { toast(t('csvFail', { m: err.message }), 'err'); }
    };
    rd.onerror = () => toast(t('csvFail', { m: rd.error && rd.error.name }), 'err');
    rd.readAsText(f, 'utf-8');
  }

  /* =====================================================
   * 4. 학습현황
   * ===================================================== */
  const KPIS = {
    studied: { key: 'kpiStudied', unit: 'uCard', dec: 0 },
    quizN: { key: 'kpiQuizN', unit: 'uQ', dec: 0 },
    acc: { key: 'kpiAcc', unit: null, dec: 1 },
    shadow: { key: 'kpiShadow', unit: 'uPt', dec: 1 }
  };
  const SC = { kpi: 'studied', days: 14 };
  function lastDays(n) {
    const out = [], d = new Date();
    for (let i = n - 1; i >= 0; i--) { const x = new Date(d); x.setDate(d.getDate() - i); out.push(SRS.dateKey(x)); }
    return out;
  }
  function streak() {
    let n = 0; const d = new Date();
    const active = k => { const g = st.log[k]; return g && ((g.studied || 0) + (g.quizN || 0)) > 0; };
    if (!active(SRS.dateKey(d))) d.setDate(d.getDate() - 1);
    while (active(SRS.dateKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  R.stats = function () {
    const el = $('#view-stats'), s = L(), td = SRS.dayIndex();
    const cards = usable();
    let due = 0, learned = 0, ing = 0;
    cards.forEach(c => { const p = SRS.getP(st, c); if (!p) return; if (p.due <= td) due++; if (p.box >= 3) learned++; else ing++; });
    const tl = st.log[SRS.dateKey()] || { studied: 0 };
    let qn = 0, qok = 0; Object.values(st.log).forEach(g => { qn += g.quizN || 0; qok += g.quizOK || 0; });
    const acc = qn ? (qok / qn * 100).toFixed(1) : '0.0';
    let spN = 0, spS = 0; Object.values(st.log).forEach(g => { spN += g.speakN || 0; spS += g.speakSum || 0; });
    const spAvg = spN ? (spS / spN).toFixed(1) : '0.0';
    const tiles = [
      [t('kToday'), Math.round(tl.studied || 0), t('uCard'), ''],
      [t('kDue'), due, t('uCard'), due > 0 ? 'red-t' : ''],
      [t('kLearned'), learned, t('uItem'), 'blue-t'],
      [t('kAcc'), acc, '%', +acc >= 80 ? 'blue-t' : qn ? 'red-t' : ''],
      [t('kShadow'), spAvg, t('uPt'), +spAvg >= 80 ? 'blue-t' : spN ? 'red-t' : ''],
      [t('kStreak'), streak(), t('uDay'), '']
    ];
    const weak = weakCards(10);
    el.innerHTML = `
      <h2 class="sec">${t('statsTitle', { lang: esc(ln(s.target)) })} <span class="sub">${t('basis', { n: cards.length })}</span></h2>
      <div class="tiles">${tiles.map((x, i) => `<div class="tile" style="--d:${i * 60}ms"><span>${x[0]}</span><b class="${x[3]}"><em data-count="${x[1]}" data-dec="${String(x[1]).includes('.') ? 1 : 0}">${x[1]}</em><small>${x[2]}</small>${i === 5 && +x[1] >= 2 ? ' <i class="flame">🔥</i>' : ''}</b></div>`).join('')}</div>
      <div class="panel">
        <div class="chart-head"><h3 id="chartTitle"></h3>
          <div class="chips">
            <select id="sKpi">${Object.keys(KPIS).map(k => `<option value="${k}">${t(KPIS[k].key)}</option>`).join('')}</select>
            <select id="sDays">${[7, 14, 30].map(n => `<option value="${n}">${t('lastN', { n })}</option>`).join('')}</select>
          </div></div>
        <div id="chart"></div>
      </div>
      <div class="panel">
        <h3>${t('catProg')}</h3>
        <table class="tbl"><thead><tr><th>${t('thCat')}</th><th>${t('thTotal')}</th><th>${t('bNone')}</th><th>${t('bIng')}</th><th>${t('bDone')}</th><th>${t('thRate')}</th></tr></thead><tbody>
        ${Object.keys(CATS).map(k => {
          const cs = cards.filter(c => c.cat === k); if (!cs.length) return '';
          let none = 0, a = 0, b = 0; cs.forEach(c => { const x = SRS.boxOf(st, c); if (x < 0) none++; else if (x >= 3) b++; else a++; });
          return `<tr><td>${esc(catName(k))}</td><td>${cs.length}</td><td>${none}</td><td>${a}</td><td>${b}</td><td>${(b / cs.length * 100).toFixed(1)}%</td></tr>`;
        }).join('')}
        <tr class="sum"><td>${t('sum')}</td><td>${cards.length}</td><td>${cards.length - learned - ing}</td><td>${ing}</td><td>${learned}</td><td>${cards.length ? (learned / cards.length * 100).toFixed(1) : '0.0'}%</td></tr>
        </tbody></table>
        <p class="note">${t('masteryNote')}</p>
      </div>
      <div class="panel">
        <div class="chart-head"><h3>${t('weakTitle')}</h3>${weak.length ? `<button class="btn red" id="weakGo" type="button">${t('weakStudy')}</button>` : ''}</div>
        ${weak.length ? `<table class="tbl"><thead><tr><th>${esc(ln(s.target))}</th><th>${esc(ln(s.native))}</th><th>${t('thMiss')}</th><th>${t('thStage')}</th><th>🔊</th></tr></thead><tbody>
          ${weak.map(x => `<tr><td class="lang-${s.target}">${esc(x.c[s.target])}</td><td>${esc(x.c[s.native])}</td><td class="red-t"><b>${x.p.lapses}</b></td><td>${x.p.box}</td>
            <td><button class="ic" data-wplay="${x.c.id}" type="button">🔊</button></td></tr>`).join('')}</tbody></table>`
          : `<div class="empty">${t('weakNone')}</div>`}
      </div>`;
    $$('#view-stats [data-wplay]').forEach(b => b.onclick = () => { const c = allCards().find(x => x.id === b.dataset.wplay); if (c) say(c, s.target); });
    if ($('#weakGo')) $('#weakGo').onclick = () => { newSession(0, weakCards(20).map(x => x.c)); location.hash = '#study'; };
    FX.countUp($('#view-stats'));
    $('#sKpi').value = SC.kpi; $('#sDays').value = SC.days;
    $('#sKpi').onchange = e => { SC.kpi = e.target.value; drawChart(); };
    $('#sDays').onchange = e => { SC.days = +e.target.value; drawChart(); };
    drawChart();
  };
  function drawChart() {
    const k = KPIS[SC.kpi], name = t(k.key), unit = k.unit ? t(k.unit) : '%';
    $('#chartTitle').textContent = t('trend', { k: name });
    const days = lastDays(SC.days);
    const vals = days.map(d => {
      const g = st.log[d] || {};
      if (SC.kpi === 'acc') return g.quizN ? g.quizOK / g.quizN * 100 : 0;
      if (SC.kpi === 'shadow') return g.speakN ? g.speakSum / g.speakN : 0;
      return g[SC.kpi] || 0;
    });
    const W = 720, H = 240, pl = 40, pr = 10, pt = 22, pb = 30;
    const max = SC.kpi === 'acc' || SC.kpi === 'shadow' ? 100 : Math.max(4, Math.ceil(Math.max.apply(null, vals) / 4) * 4);
    const bw = (W - pl - pr) / days.length;
    const y = v => pt + (H - pt - pb) * (1 - v / max);
    let g = '';
    for (let i = 0; i <= 4; i++) {
      const v = max * i / 4, yy = y(v);
      g += `<line x1="${pl}" x2="${W - pr}" y1="${yy}" y2="${yy}" class="gl"/><text x="${pl - 6}" y="${yy + 4}" class="ax" text-anchor="end">${Math.round(v)}</text>`;
    }
    vals.forEach((v, i) => {
      const x = pl + i * bw + bw * 0.18, w = bw * 0.64, yy = y(v);
      const lbl = days[i].slice(5).replace('-', '/');
      g += `<rect x="${x}" y="${yy}" width="${w}" height="${Math.max(0, H - pb - yy)}" rx="3" class="br ${i === vals.length - 1 ? 'today' : ''}"><title>${days[i]} ${esc(name)}: ${v.toFixed(k.dec)}${esc(unit)}</title></rect>`;
      if (v > 0) g += `<text x="${x + w / 2}" y="${yy - 5}" class="vl" text-anchor="middle">${v.toFixed(k.dec)}</text>`;
      if (SC.days <= 14 || i % 3 === 0 || i === vals.length - 1) g += `<text x="${x + w / 2}" y="${H - 10}" class="ax" text-anchor="middle">${lbl}</text>`;
    });
    $('#chart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="chart grow" role="img" aria-label="${esc(t('trend', { k: name }))}">${g}</svg>
      <p class="note">${t('chartNote', { u: esc(unit) })}</p>`;
  }

  /* =====================================================
   * 5. 설정
   * ===================================================== */
  R.setup = function () {
    const el = $('#view-setup'), s = L();
    const viVoice = TTS.pickVoice('vi');
    el.innerHTML = `
      <div class="panel">
        <h3>${t('learnSet')}</h3>
        <div class="grid2">
          <div><label class="lbl" for="sUi">🌐 ${t('uiLang')}</label><select id="sUi">${I18N.ORDER.map(k => `<option value="${k}">${LANGS[k].flag} ${LANGS[k].self}</option>`).join('')}</select></div>
          <div><label class="lbl" for="sTarget">${t('targetLang')}</label><select id="sTarget">${I18N.ORDER.map(k => `<option value="${k}">${LANGS[k].flag} ${esc(ln(k))}</option>`).join('')}</select></div>
          <div><label class="lbl" for="sNative">${t('nativeLang')}</label><select id="sNative">${I18N.ORDER.filter(k => k !== s.target).map(k => `<option value="${k}">${LANGS[k].flag} ${esc(ln(k))}</option>`).join('')}</select></div>
          <div><label class="lbl" for="sFront">${t('cardFront')}</label><select id="sFront"><option value="target">${t('frontTarget')}</option><option value="native">${t('frontNative')}</option></select></div>
          <div><label class="lbl" for="sTheme">${t('theme')}</label><select id="sTheme">
            <option value="light">☀️ ${t('themeLight')}</option><option value="dark">🌙 ${t('themeDark')}</option><option value="auto">🖥 ${t('themeAuto')}</option></select></div>
          <div><label class="lbl" for="sGoal">${t('dailyGoal')}</label><select id="sGoal">${[10, 20, 30, 50, 100].map(n => `<option value="${n}">${t('nCards', { n })}</option>`).join('')}</select></div>
          <div><label class="lbl" for="sNew">${t('newPerDay')}</label><select id="sNew">${[5, 10, 15, 20, 30].map(n => `<option value="${n}">${t('nCards', { n })}</option>`).join('')}</select></div>
        </div>
        <label class="check"><input type="checkbox" id="sPron"> ${t('showPron')}</label>
        <label class="check"><input type="checkbox" id="sAuto"> ${t('autoplay')}</label>
        <label class="check"><input type="checkbox" id="sHaptic"> ${t('hapticLbl')}</label>
      </div>
      <div class="panel">
        <h3>${t('voiceSet')}</h3>
        <label class="lbl" for="sRate">${t('rate')} <b id="rateV">${s.rate}</b></label>
        <input type="range" id="sRate" min="0.5" max="1.3" step="0.1" value="${s.rate}">
        <label class="lbl" for="sProxy">${t('proxy')}</label>
        <input type="url" id="sProxy" placeholder="${esc(DEFAULT_PROXY)}" value="${esc(s.proxy)}">
        <p class="note">${t('proxyDefault')}</p>
        <p class="note">${t('device')}: <b>${TTS.isMobile ? t('mobile') : 'PC'}</b> · ${t('viVoice')}: ${viVoice ? esc(viVoice.name) : `<span class="red-t">${t('none')}</span>`}<br>
        ${t('viOrder')}: <b class="blue-t">${TTS.viRoute(proxyUrl()).map(esc).join(' → ')}</b><br>
        ${t('devVoices')}: ${I18N.ORDER.map(k => `${esc(ln(k))} ${TTS.hasVoice(k) ? '<b class="blue-t">✓</b>' : '<b class="red-t">✗</b>'}`).join(' · ')}<br>
        ${t('noVoiceNote')}</p>
        <div class="row gap wrap">${I18N.ORDER.map(k => `<button class="btn" data-test="${k}" type="button">🔊 ${t('test', { lang: esc(ln(k)) })}</button>`).join('')}</div>
      </div>
      <div class="panel">
        <h3>${t('dataSrc')}</h3>
        <p>${SRC.kind === 'sheet' ? `<b class="blue-t">${t('srcSheet', { n: SRC.n, t: esc(SRC.at ? new Date(SRC.at).toLocaleString() : '-') })}</b>` : `<b class="red-t">${t('srcBuiltin', { n: SRC.n })}</b>`}</p>
        <button class="btn" id="phrRefresh" type="button">🔄 ${t('refresh')}</button>
      </div>
      <div class="panel">
        <h3>${t('install')}</h3>
        <p class="note">${t('installNote')}</p>
        ${PWA.standalone() ? `<p class="blue-t"><b>${t('installed')}</b></p>`
          : `<div class="row gap wrap"><button class="btn blue" id="pwaBtn" type="button" ${PWA.canPrompt() ? '' : 'hidden'}>${t('installBtn')}</button></div>
             <p class="note">${PWA.isIos() ? t('installIos') : PWA.supported() ? '' : t('installNA')}</p>`}
      </div>
      <div class="panel">
        <h3>${t('backup')}</h3>
        <p class="note">${t('backupNote')}${Store.isPersistent() ? '' : ` <span class="red-t">${t('noStore')}</span>`}</p>
        <div class="row gap wrap"><button class="btn" id="bkCopy" type="button">${t('bkCopy')}</button><button class="btn" id="bkLoad" type="button">${t('bkLoad')}</button>
          <button class="btn red" id="bkReset" type="button">${t('bkReset')}</button></div>
        <textarea id="bkText" class="csvout" placeholder="${esc(t('bkPh'))}"></textarea>
      </div>`;
    $('#sUi').value = s.ui; $('#sTarget').value = s.target; $('#sNative').value = s.native; $('#sFront').value = s.front; $('#sNew').value = String(s.newPerDay);
    $('#sPron').checked = s.showPron; $('#sAuto').checked = s.autoplay;
    $('#sTheme').value = s.theme || 'light';
    $('#sGoal').value = String(s.dailyGoal || 20);
    $('#sGoal').onchange = e => { s.dailyGoal = +e.target.value; save(); };
    $('#sHaptic').checked = s.haptic !== false;
    $('#sHaptic').onchange = e => { s.haptic = e.target.checked; FX.setHaptic(s.haptic); save(); if (s.haptic) FX.haptic('good'); };
    $('#sTheme').onchange = e => { s.theme = e.target.value; save(); applyTheme(); };
    $('#sUi').onchange = e => setUi(e.target.value);
    $('#phrRefresh').onclick = () => fetchPhrases(true).then(() => { if ($('#view-setup').classList.contains('active')) R.setup(); });
    if ($('#pwaBtn')) $('#pwaBtn').onclick = () => PWA.prompt().then(() => R.setup());
    $('#sTarget').onchange = e => setTarget(e.target.value);
    $('#sNative').onchange = e => setNative(e.target.value);
    $('#sFront').onchange = e => { s.front = e.target.value; save(); };
    $('#sNew').onchange = e => { s.newPerDay = +e.target.value; save(); S = null; };
    $('#sPron').onchange = e => { s.showPron = e.target.checked; save(); };
    $('#sAuto').onchange = e => { s.autoplay = e.target.checked; save(); };
    $('#sRate').oninput = e => { s.rate = +e.target.value; $('#rateV').textContent = s.rate; save(); };
    $('#sProxy').onchange = e => { s.proxy = e.target.value.trim(); save(); toast(s.proxy ? t('proxySaved') : t('proxyDel')); R.setup(); };
    $$('#view-setup [data-test]').forEach(b => b.onclick = () => say(PHRASES[1], b.dataset.test));
    $('#bkCopy').onclick = () => {
      const code = JSON.stringify(st);
      $('#bkText').value = code;
      if (navigator.clipboard) navigator.clipboard.writeText(code).then(() => toast(t('bkCopied', { n: code.length })), e => toast(t('clipFail', { m: e.name }), 'err'));
    };
    $('#bkLoad').onclick = () => {
      try { const o = JSON.parse($('#bkText').value); if (!o.settings) throw new Error('settings'); Store.apply(o); I18N.set(L().ui || 'ko'); save(); S = null; Q = null; drawChrome(); R.setup(); toast(t('restored')); }
      catch (e) { toast(t('restoreFail', { m: e.message }), 'err'); }
    };
    $('#bkReset').onclick = e => {
      const b = e.currentTarget;
      if (b.dataset.armed) { const ui = L().ui; Store.reset(); L().ui = ui; save(); S = null; Q = null; drawChrome(); R.setup(); toast(t('resetDone')); }
      else { b.dataset.armed = '1'; b.textContent = t('bkResetConfirm'); setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = t('bkReset'); } }, 3000); }
    };
  };

  /* ---------- PWA (홈 화면 설치·오프라인) ---------- */
  const PWA = (() => {
    let deferred = null;
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; if ($('#view-setup').classList.contains('active')) R.setup(); });
    window.addEventListener('appinstalled', () => { deferred = null; toast(t('installed')); });
    const supported = () => 'serviceWorker' in navigator && location.protocol === 'https:' && !/claude\.ai|claudeusercontent/.test(location.host);
    if (supported()) { try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) {} }
    return {
      supported,
      canPrompt: () => !!deferred,
      isIos: () => /iPhone|iPad|iPod/i.test(navigator.userAgent),
      standalone: () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true,
      prompt: async () => { if (!deferred) return; deferred.prompt(); try { await deferred.userChoice; } catch (e) {} deferred = null; }
    };
  })();

  /* ---------- 시작 ---------- */
  drawChrome();
  route();
  fetchPhrases(false);
})();
