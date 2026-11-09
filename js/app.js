/* 5개국어 학습카드 - 화면 로직 */
(function () {
  'use strict';
  const st = Store.load();
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const L = () => st.settings;
  const R = {};

  /* ---------- 공통 ---------- */
  function toast(msg, type) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast show ' + (type || '');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.className = 'toast'; }, type === 'err' ? 6000 : 2600);
  }
  function save() { Store.save(); }
  function allCards() { return PHRASES.concat(st.custom); }
  function usable() { const s = L(); return allCards().filter(c => c[s.target] && c[s.native]); }
  function pron(c, lang) { return (c.pron && c.pron[lang]) || ''; }
  function say(c, lang) {
    TTS.speak(c[lang], lang, { rate: L().rate, proxy: L().proxy })
      .catch(e => toast('음성 재생 실패 (' + LANGS[lang].name + '): ' + (e && e.message || e), 'err'));
  }
  function boxLabel(b) { return b < 0 ? '미학습' : b >= 3 ? '습득' : '학습중'; }
  function boxClass(b) { return b < 0 ? 'b-none' : b >= 3 ? 'b-done' : 'b-ing'; }
  function catName(c) { return CATS[c] || c; }

  /* ---------- 언어 전환 ---------- */
  function drawLangSwitch() {
    $('#langSwitch').innerHTML = Object.keys(LANGS).map(k =>
      `<button class="chip ${L().target === k ? 'on' : ''}" data-lang="${k}" type="button">${LANGS[k].flag} ${LANGS[k].name}</button>`).join('');
    $$('#langSwitch [data-lang]').forEach(b => b.onclick = () => setTarget(b.dataset.lang));
  }
  function setTarget(lang) {
    const s = L();
    s.target = lang;
    if (s.native === lang) s.native = lang === 'ko' ? 'vi' : 'ko';
    save(); S = null; Q = null;
    drawLangSwitch(); route();
  }

  /* ---------- 라우팅 ---------- */
  const VIEWS = ['study', 'quiz', 'words', 'stats', 'setup'];
  function route() {
    let v = (location.hash || '').slice(1);
    if (!VIEWS.includes(v)) v = 'study';
    $$('.view').forEach(s => s.classList.toggle('active', s.id === 'view-' + v));
    $$('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.view === v));
    TTS.stop();
    R[v]();
  }
  window.addEventListener('hashchange', route);

  /* =====================================================
   * 1. 카드학습
   * ===================================================== */
  let S = null;
  function newSession(extra) {
    const q = SRS.buildQueue(usable(), st, extra);
    S = {
      queue: q.due.map(c => ({ c, kind: 'due' })).concat(q.fresh.map(c => ({ c, kind: 'new' }))),
      idx: 0, flipped: false, done: 0, again: 0, dueN: q.due.length, newN: q.fresh.length
    };
  }
  R.study = function () { if (!S) newSession(0); drawStudy(false); };

  function cur() { return S && S.queue[S.idx] ? S.queue[S.idx].c : null; }

  function drawStudy(autoplay) {
    const el = $('#view-study'), s = L();
    if (S.idx >= S.queue.length) {
      const msg = S.queue.length === 0 ? '오늘 예정된 복습·신규 카드가 없습니다.' : `학습 <b class="blue-t">${S.done}</b>장 · 다시 보기 <b class="red-t">${S.again}</b>회`;
      el.innerHTML = `<div class="panel center">
        <div class="big-emoji">🎉</div><h2>오늘 카드 학습 완료</h2><p>${msg}</p>
        <div class="row center gap"><button class="btn blue" id="more" type="button">신규 10장 더 학습</button>
        <a class="btn" href="#quiz">퀴즈 풀기</a><a class="btn" href="#stats">학습현황</a></div></div>`;
      $('#more').onclick = () => { newSession(10); if (!S.queue.length) toast('남은 신규 카드가 없습니다. 단어장에서 문장을 추가하세요.'); drawStudy(true); };
      return;
    }
    const item = S.queue[S.idx], c = item.c;
    const front = s.front === 'native' ? s.native : s.target;
    const back = front === s.target ? s.native : s.target;
    const remain = S.queue.length - S.idx;
    const pct = Math.round(S.idx / S.queue.length * 100);
    const kindTxt = item.kind === 'new' ? '신규' : item.kind === 'again' ? '다시' : '복습';
    el.innerHTML = `
      <div class="meta">
        <span class="pill blue">복습 ${S.dueN}</span><span class="pill green">신규 ${S.newN}</span>
        <span class="pill">남음 ${remain}</span><span class="cat">${esc(catName(c.cat))}</span>
      </div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <button class="card ${S.flipped ? 'flipped' : ''}" id="card" type="button" aria-label="카드 뒤집기">
        <span class="tag tag-${item.kind}">${kindTxt}</span>
        <span class="face-main lang-${front}">${esc(c[front])}</span>
        ${s.showPron && pron(c, front) ? `<span class="pron">${esc(pron(c, front))}</span>` : ''}
        ${S.flipped ? `<span class="divider"></span><span class="face-back lang-${back}">${esc(c[back])}</span>
          ${s.showPron && pron(c, back) ? `<span class="pron">${esc(pron(c, back))}</span>` : ''}`
          : '<span class="hint">탭하여 뜻 보기</span>'}
      </button>
      <div class="row center"><button class="btn round" id="play" type="button">🔊 ${LANGS[s.target].name} 듣기</button></div>
      ${S.flipped
        ? `<div class="grade">
            <button class="btn red" data-g="0" type="button">모름<small>다시 보기</small></button>
            <button class="btn yellow" data-g="1" type="button">애매<small>1일 후</small></button>
            <button class="btn green" data-g="2" type="button">알아요<small>${SRS.nextLabel(st, c)}</small></button></div>`
        : `<div class="grade"><button class="btn blue wide" id="flip" type="button">뜻 보기</button></div>`}
      <p class="keys">PC 단축키: Space 뒤집기 · 1 모름 · 2 애매 · 3 알아요 · P 듣기</p>`;
    $('#card').onclick = flip;
    $('#play').onclick = () => say(c, s.target);
    if ($('#flip')) $('#flip').onclick = flip;
    $$('#view-study [data-g]').forEach(b => b.onclick = () => grade(+b.dataset.g));
    if (autoplay && s.autoplay && !S.flipped && front === s.target) say(c, s.target);
  }
  function flip() {
    if (!S || S.flipped || !cur()) return;
    S.flipped = true;
    drawStudy(false);
    if (L().autoplay && L().front === 'native') say(cur(), L().target);
  }
  function grade(g) {
    const c = cur(); if (!c || !S.flipped) return;
    SRS.grade(st, c, g);
    if (g === 0) { S.queue.push({ c, kind: 'again' }); S.again++; }
    S.done++; S.idx++; S.flipped = false;
    save(); drawStudy(true);
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
  const QMODES = { meaning: '뜻 고르기', express: '표현 고르기', listen: '듣고 고르기' };

  R.quiz = function () { if (!Q) drawQuizSetup(); else drawQuiz(false); };

  function quizPool() {
    let p = usable();
    if (qcfg.scope === 'star') p = p.filter(c => st.stars[c.id]);
    else if (qcfg.scope === 'learned') p = p.filter(c => SRS.boxOf(st, c) >= 0);
    else if (qcfg.scope !== 'all') p = p.filter(c => c.cat === qcfg.scope);
    return p;
  }
  function drawQuizSetup() {
    const el = $('#view-quiz');
    const cats = Object.keys(CATS).filter(k => usable().some(c => c.cat === k));
    el.innerHTML = `<div class="panel">
      <h2>퀴즈 설정 <span class="sub">${LANGS[L().target].name} ↔ ${LANGS[L().native].name}</span></h2>
      <label class="lbl">문제 유형</label>
      <div class="chips">${Object.keys(QMODES).map(k => `<button class="chip ${qcfg.mode === k ? 'on' : ''}" data-mode="${k}" type="button">${QMODES[k]}</button>`).join('')}</div>
      <div class="grid2">
        <div><label class="lbl" for="qCount">문항 수</label>
          <select id="qCount">${[5, 10, 20].map(n => `<option value="${n}" ${qcfg.count === n ? 'selected' : ''}>${n}문항</option>`).join('')}</select></div>
        <div><label class="lbl" for="qScope">출제 범위</label>
          <select id="qScope"><option value="all">전체</option><option value="learned">학습한 카드</option><option value="star">즐겨찾기</option>
          ${cats.map(k => `<option value="${k}">${esc(CATS[k])}</option>`).join('')}</select></div>
      </div>
      <p class="note">틀린 문제는 자동으로 오늘 복습 카드에 추가됩니다.</p>
      <button class="btn blue wide" id="qStart" type="button">퀴즈 시작</button></div>`;
    $('#qScope').value = qcfg.scope;
    $$('#view-quiz [data-mode]').forEach(b => b.onclick = () => { qcfg.mode = b.dataset.mode; drawQuizSetup(); });
    $('#qCount').onchange = e => qcfg.count = +e.target.value;
    $('#qScope').onchange = e => qcfg.scope = e.target.value;
    $('#qStart').onclick = startQuiz;
  }
  function startQuiz() {
    const pool = quizPool();
    if (pool.length < 4) { toast('출제 범위의 문장이 ' + pool.length + '개입니다. 최소 4개가 필요합니다.', 'err'); return; }
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
    const q = Q.qs[Q.i], c = q.c, answered = q.pick !== null;
    let prompt;
    if (Q.mode === 'meaning') prompt = `<div class="q-main lang-${s.target}">${esc(c[s.target])}</div>${s.showPron && pron(c, s.target) ? `<div class="pron">${esc(pron(c, s.target))}</div>` : ''}`;
    else if (Q.mode === 'express') prompt = `<div class="q-main lang-${s.native}">${esc(c[s.native])}</div><div class="hint">${LANGS[s.target].name}로 알맞은 표현은?</div>`;
    else prompt = answered ? `<div class="q-main lang-${s.target}">${esc(c[s.target])}</div>${s.showPron && pron(c, s.target) ? `<div class="pron">${esc(pron(c, s.target))}</div>` : ''}`
      : `<div class="q-main">🎧</div><div class="hint">듣고 알맞은 뜻을 고르세요</div>`;
    el.innerHTML = `
      <div class="meta"><span class="pill blue">${QMODES[Q.mode]}</span><span class="pill">${Q.i + 1} / ${Q.qs.length}</span><span class="pill green">정답 ${Q.ok}</span></div>
      <div class="bar"><i style="width:${Math.round(Q.i / Q.qs.length * 100)}%"></i></div>
      <div class="qbox">${prompt}
        <button class="btn round" id="qPlay" type="button">🔊 ${Q.mode === 'listen' ? '다시 듣기' : '듣기'}</button></div>
      <div class="opts">${q.opts.map((o, k) => {
        let cls = '';
        if (answered) { if (k === q.ans) cls = 'right'; else if (k === q.pick) cls = 'wrong'; else cls = 'dim'; }
        return `<button class="opt ${cls} lang-${Q.optLang}" data-k="${k}" type="button" ${answered ? 'disabled' : ''}><b>${k + 1}</b> ${esc(o[Q.optLang])}</button>`;
      }).join('')}</div>
      ${answered ? `<div class="feedback ${q.pick === q.ans ? 'ok' : 'ng'}">${q.pick === q.ans ? '정답입니다' : '오답 — 오늘 복습 카드에 추가됨'}
         <div class="fb-detail"><b>${esc(c[s.target])}</b> ${pron(c, s.target) ? `<span class="pron">${esc(pron(c, s.target))}</span>` : ''} = ${esc(c[s.native])}</div></div>
         <button class="btn blue wide" id="qNext" type="button">${Q.i + 1 < Q.qs.length ? '다음 문제' : '결과 보기'}</button>` : ''}`;
    $('#qPlay').onclick = () => say(c, Q.mode === 'express' && !answered ? s.native : s.target);
    $$('#view-quiz [data-k]').forEach(b => b.onclick = () => answer(+b.dataset.k));
    if ($('#qNext')) $('#qNext').onclick = () => { Q.i++; drawQuiz(true); };
    if (autoplay && !answered && (Q.mode === 'listen' || (Q.mode === 'meaning' && s.autoplay))) say(c, s.target);
  }
  function answer(k) {
    const q = Q.qs[Q.i]; if (q.pick !== null) return;
    q.pick = k;
    const log = SRS.todayLog(st);
    log.quizN++;
    if (k === q.ans) { Q.ok++; log.quizOK++; } else SRS.lapse(st, q.c);
    save(); drawQuiz(false);
    if (L().autoplay && Q.mode !== 'meaning') say(q.c, L().target);
  }
  function drawQuizResult() {
    const el = $('#view-quiz'), s = L();
    const acc = Q.qs.length ? (Q.ok / Q.qs.length * 100).toFixed(1) : '0.0';
    const wrong = Q.qs.filter(q => q.pick !== q.ans);
    el.innerHTML = `<div class="panel center">
      <h2>퀴즈 결과</h2>
      <div class="score"><b class="${+acc >= 80 ? 'blue-t' : 'red-t'}">${acc}%</b><span>${Q.ok} / ${Q.qs.length} 정답</span></div>
      ${wrong.length ? `<table class="tbl"><thead><tr><th>${LANGS[s.target].name}</th><th>${LANGS[s.native].name}</th><th>듣기</th></tr></thead><tbody>
        ${wrong.map(q => `<tr><td class="lang-${s.target}">${esc(q.c[s.target])}${pron(q.c, s.target) ? `<br><span class="pron">${esc(pron(q.c, s.target))}</span>` : ''}</td><td>${esc(q.c[s.native])}</td>
        <td><button class="ic" data-play="${q.c.id}" type="button">🔊</button></td></tr>`).join('')}</tbody></table>
        <p class="note">오답 ${wrong.length}개는 카드학습의 오늘 복습에 포함되었습니다.</p>` : '<p>모두 맞혔습니다.</p>'}
      <div class="row center gap"><button class="btn blue" id="qAgain" type="button">같은 설정으로 다시</button>
      <button class="btn" id="qSetup" type="button">설정 변경</button><button class="btn" id="qStudy" type="button">오답 복습하기</button></div></div>`;
    $$('#view-quiz [data-play]').forEach(b => b.onclick = () => { const c = allCards().find(x => x.id === b.dataset.play); if (c) say(c, s.target); });
    $('#qAgain').onclick = startQuiz;
    $('#qSetup').onclick = () => { Q = null; drawQuizSetup(); };
    $('#qStudy').onclick = () => { S = null; location.hash = '#study'; };
  }

  /* =====================================================
   * 3. 단어장
   * ===================================================== */
  const W = { q: '', cat: 'all', star: false, add: false };
  R.words = function () {
    const el = $('#view-words'), s = L();
    const cats = Object.keys(CATS);
    el.innerHTML = `
      <div class="toolbar">
        <input id="wq" type="search" placeholder="검색 (모든 언어)" value="${esc(W.q)}">
        <select id="wcat"><option value="all">전체 분류</option>${cats.map(k => `<option value="${k}">${esc(CATS[k])}</option>`).join('')}</select>
        <button class="chip ${W.star ? 'on' : ''}" id="wstar" type="button">★ 즐겨찾기</button>
      </div>
      <div class="row gap wrap">
        <button class="btn" id="wAdd" type="button">${W.add ? '추가 닫기' : '＋ 내 문장 추가'}</button>
        <button class="btn" id="wExport" type="button">CSV 내보내기</button>
        <label class="btn file">CSV 가져오기<input type="file" id="wImport" accept=".csv,text/csv"></label>
        <span class="count" id="wCount"></span>
      </div>
      ${W.add ? `<form class="panel addform" id="addForm">
        <p class="note">한국어 + 학습 언어 1개 이상 입력. 괄호 ( ) 안 내용은 음성으로 읽지 않습니다.</p>
        <div class="grid2">
          ${['ko', 'vi', 'en', 'zh', 'ja'].map(k => `<div><label class="lbl" for="f_${k}">${LANGS[k].flag} ${LANGS[k].name}</label><input id="f_${k}" type="text"></div>`).join('')}
          <div><label class="lbl" for="f_zhp">중국어 병음</label><input id="f_zhp" type="text"></div>
          <div><label class="lbl" for="f_jap">일본어 로마자</label><input id="f_jap" type="text"></div>
        </div>
        <button class="btn blue wide" type="submit">저장</button></form>` : ''}
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
      .filter(c => !q || ['ko', 'vi', 'en', 'zh', 'ja'].some(k => String(c[k] || '').toLowerCase().includes(q)) || Object.values(c.pron || {}).some(v => String(v).toLowerCase().includes(q)));
    $('#wCount').textContent = list.length + '개';
    const meanLang = s.native;
    $('#wList').innerHTML = list.length ? list.map(c => {
      const b = SRS.boxOf(st, c);
      return `<div class="wrow">
        <button class="ic" data-play="${c.id}" type="button" aria-label="듣기">🔊</button>
        <div class="wtxt"><b class="lang-${s.target}">${esc(c[s.target])}</b>
          ${pron(c, s.target) ? `<span class="pron">${esc(pron(c, s.target))}</span>` : ''}
          <span class="mean">${esc(c[meanLang] || c.ko || '')}</span></div>
        <span class="badge ${boxClass(b)}">${boxLabel(b)}</span>
        <button class="ic star ${st.stars[c.id] ? 'on' : ''}" data-star="${c.id}" type="button" aria-label="즐겨찾기">★</button>
        ${c.cat === 'custom' ? `<button class="ic del" data-del="${c.id}" type="button" aria-label="삭제">✕</button>` : ''}
      </div>`;
    }).join('') : '<div class="empty">조건에 맞는 문장이 없습니다.</div>';
    $$('#wList [data-play]').forEach(b => b.onclick = () => { const c = allCards().find(x => x.id === b.dataset.play); if (c) say(c, s.target); });
    $$('#wList [data-star]').forEach(b => b.onclick = () => {
      const id = b.dataset.star; if (st.stars[id]) delete st.stars[id]; else st.stars[id] = 1; save(); drawWordList();
    });
    $$('#wList [data-del]').forEach(b => b.onclick = () => {
      if (b.dataset.armed) { st.custom = st.custom.filter(c => c.id !== b.dataset.del); save(); drawWordList(); toast('삭제했습니다.'); }
      else { b.dataset.armed = '1'; b.textContent = '삭제?'; b.classList.add('armed'); setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = '✕'; b.classList.remove('armed'); } }, 3000); }
    });
  }
  function addCustom(e) {
    e.preventDefault();
    const v = id => $('#' + id).value.trim();
    const c = { id: 'c' + Date.now().toString(36), cat: 'custom', ko: v('f_ko'), vi: v('f_vi'), en: v('f_en'), zh: v('f_zh'), ja: v('f_ja'), pron: { zh: v('f_zhp'), ja: v('f_jap') } };
    const filled = ['vi', 'en', 'zh', 'ja'].filter(k => c[k]).length;
    if (!c.ko || !filled) { toast('한국어와 학습 언어 1개 이상을 입력하세요.', 'err'); return; }
    st.custom.push(c); save(); S = null;
    toast('내 문장에 추가했습니다.'); W.add = false; R.words();
  }
  const CSV_COLS = ['cat', 'ko', 'vi', 'en', 'zh', 'zh_pron', 'ja', 'ja_pron'];
  const csvCell = v => /[",\n]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v);
  function exportCsv() {
    const rows = allCards().map(c => [c.cat, c.ko, c.vi, c.en, c.zh, pron(c, 'zh'), c.ja, pron(c, 'ja')].map(x => csvCell(x || '')).join(','));
    const csv = '﻿' + CSV_COLS.join(',') + '\n' + rows.join('\n');
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      a.download = '5개국어_학습카드_' + SRS.dateKey() + '.csv';
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) {}
    const out = $('#wCsvOut'); out.hidden = false; out.value = csv.slice(1);
    if (navigator.clipboard) navigator.clipboard.writeText(csv.slice(1)).then(() => toast('CSV 파일 저장 + 클립보드 복사 완료'), () => toast('CSV 파일 저장 시도함 (아래 텍스트를 복사해 사용 가능)'));
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
        const head = rows.shift().map(h => h.trim().toLowerCase());
        const idx = n => head.indexOf(n);
        if (idx('ko') < 0) throw new Error('첫 행에 ko 열이 없습니다 (필요 열: ' + CSV_COLS.join(', ') + ')');
        const exist = new Set(allCards().map(c => c.ko + '|' + c.vi + '|' + c.en));
        let add = 0, skip = 0;
        rows.forEach((r, n) => {
          const g = k => idx(k) >= 0 ? (r[idx(k)] || '').trim() : '';
          const c = { id: 'c' + Date.now().toString(36) + n, cat: 'custom', ko: g('ko'), vi: g('vi'), en: g('en'), zh: g('zh'), ja: g('ja'), pron: { zh: g('zh_pron'), ja: g('ja_pron') } };
          const sig = c.ko + '|' + c.vi + '|' + c.en;
          if (!c.ko || exist.has(sig)) { skip++; return; }
          exist.add(sig); st.custom.push(c); add++;
        });
        save(); S = null; R.words();
        toast('CSV 가져오기: 추가 ' + add + '개, 중복·빈 행 제외 ' + skip + '개');
      } catch (err) { toast('CSV 가져오기 실패: ' + err.message, 'err'); }
    };
    rd.onerror = () => toast('CSV 파일 읽기 실패: ' + (rd.error && rd.error.name), 'err');
    rd.readAsText(f, 'utf-8');
  }

  /* =====================================================
   * 4. 학습현황 (대시보드)
   * ===================================================== */
  const KPIS = {
    studied: { name: '카드 학습 수', unit: '장', dec: 0 },
    quizN: { name: '퀴즈 문항 수', unit: '문항', dec: 0 },
    acc: { name: '퀴즈 정답률', unit: '%', dec: 1 }
  };
  const SC = { kpi: 'studied', days: 14 };
  function lastDays(n) {
    const out = [], d = new Date();
    for (let i = n - 1; i >= 0; i--) { const x = new Date(d); x.setDate(d.getDate() - i); out.push(SRS.dateKey(x)); }
    return out;
  }
  function streak() {
    let n = 0; const d = new Date();
    const active = k => { const g = st.log[k]; return g && (g.studied + g.quizN) > 0; };
    if (!active(SRS.dateKey(d))) d.setDate(d.getDate() - 1);
    while (active(SRS.dateKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  R.stats = function () {
    const el = $('#view-stats'), s = L(), t = SRS.dayIndex();
    const cards = usable();
    let due = 0, learned = 0, ing = 0;
    cards.forEach(c => { const p = SRS.getP(st, c); if (!p) return; if (p.due <= t) due++; if (p.box >= 3) learned++; else ing++; });
    const tl = st.log[SRS.dateKey()] || { studied: 0 };
    let qn = 0, qok = 0; Object.values(st.log).forEach(g => { qn += g.quizN || 0; qok += g.quizOK || 0; });
    const acc = qn ? (qok / qn * 100).toFixed(1) : '0.0';
    const tiles = [
      ['오늘 학습', Math.round(tl.studied || 0), '장', ''],
      ['복습 예정', due, '장', due > 0 ? 'red-t' : ''],
      ['습득 문장', learned, '개', 'blue-t'],
      ['누적 퀴즈 정답률', acc, '%', +acc >= 80 ? 'blue-t' : qn ? 'red-t' : ''],
      ['연속 학습일', streak(), '일', '']
    ];
    el.innerHTML = `
      <h2 class="sec">${LANGS[s.target].name} 학습현황 <span class="sub">전체 ${cards.length}개 문장 기준</span></h2>
      <div class="tiles">${tiles.map(x => `<div class="tile"><span>${x[0]}</span><b class="${x[3]}">${x[1]}<small>${x[2]}</small></b></div>`).join('')}</div>
      <div class="panel">
        <div class="chart-head"><h3 id="chartTitle"></h3>
          <div class="chips">
            <select id="sKpi">${Object.keys(KPIS).map(k => `<option value="${k}">${KPIS[k].name}</option>`).join('')}</select>
            <select id="sDays">${[7, 14, 30].map(n => `<option value="${n}">최근 ${n}일</option>`).join('')}</select>
          </div></div>
        <div id="chart"></div>
      </div>
      <div class="panel">
        <h3>분류별 진척</h3>
        <table class="tbl"><thead><tr><th>분류</th><th>전체</th><th>미학습</th><th>학습중</th><th>습득</th><th>습득률</th></tr></thead><tbody>
        ${Object.keys(CATS).map(k => {
          const cs = cards.filter(c => c.cat === k); if (!cs.length) return '';
          let none = 0, a = 0, b = 0; cs.forEach(c => { const x = SRS.boxOf(st, c); if (x < 0) none++; else if (x >= 3) b++; else a++; });
          return `<tr><td>${esc(CATS[k])}</td><td>${cs.length}</td><td>${none}</td><td>${a}</td><td>${b}</td><td>${(b / cs.length * 100).toFixed(1)}%</td></tr>`;
        }).join('')}
        <tr class="sum"><td>합계</td><td>${cards.length}</td><td>${cards.length - learned - ing}</td><td>${ing}</td><td>${learned}</td><td>${cards.length ? (learned / cards.length * 100).toFixed(1) : '0.0'}%</td></tr>
        </tbody></table>
        <p class="note">습득 = 알아요 3회 이상 연속(복습 단계 3 이상). 카드 수치는 기간 필터와 무관한 현재 기준입니다.</p>
      </div>`;
    $('#sKpi').value = SC.kpi; $('#sDays').value = SC.days;
    $('#sKpi').onchange = e => { SC.kpi = e.target.value; drawChart(); };
    $('#sDays').onchange = e => { SC.days = +e.target.value; drawChart(); };
    drawChart();
  };
  function drawChart() {
    const k = KPIS[SC.kpi];
    $('#chartTitle').textContent = k.name + ' 추이';
    const days = lastDays(SC.days);
    const vals = days.map(d => {
      const g = st.log[d] || {};
      if (SC.kpi === 'acc') return g.quizN ? g.quizOK / g.quizN * 100 : 0;
      return g[SC.kpi] || 0;
    });
    const W = 720, H = 240, pl = 40, pr = 10, pt = 22, pb = 30;
    const max = SC.kpi === 'acc' ? 100 : Math.max(4, Math.ceil(Math.max.apply(null, vals) / 4) * 4);
    const bw = (W - pl - pr) / days.length;
    const y = v => pt + (H - pt - pb) * (1 - v / max);
    let g = '';
    for (let i = 0; i <= 4; i++) {
      const v = max * i / 4, yy = y(v);
      g += `<line x1="${pl}" x2="${W - pr}" y1="${yy}" y2="${yy}" class="gl"/><text x="${pl - 6}" y="${yy + 4}" class="ax" text-anchor="end">${k.dec ? v.toFixed(0) : Math.round(v)}</text>`;
    }
    vals.forEach((v, i) => {
      const x = pl + i * bw + bw * 0.18, w = bw * 0.64, yy = y(v);
      const lbl = days[i].slice(5).replace('-', '/');
      g += `<rect x="${x}" y="${yy}" width="${w}" height="${Math.max(0, H - pb - yy)}" rx="3" class="br ${i === vals.length - 1 ? 'today' : ''}"><title>${days[i]} ${k.name}: ${v.toFixed(k.dec)}${k.unit}</title></rect>`;
      if (v > 0) g += `<text x="${x + w / 2}" y="${yy - 5}" class="vl" text-anchor="middle">${v.toFixed(k.dec)}</text>`;
      if (SC.days <= 14 || i % 3 === 0 || i === vals.length - 1) g += `<text x="${x + w / 2}" y="${H - 10}" class="ax" text-anchor="middle">${lbl}</text>`;
    });
    $('#chart').innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${k.name} 추이">${g}</svg>
      <p class="note">단위: ${k.unit} · 기간 필터는 추이 차트에만 적용</p>`;
  }

  /* =====================================================
   * 5. 설정
   * ===================================================== */
  R.setup = function () {
    const el = $('#view-setup'), s = L();
    const viVoice = TTS.pickVoice('vi');
    el.innerHTML = `
      <div class="panel">
        <h3>학습 설정</h3>
        <div class="grid2">
          <div><label class="lbl" for="sTarget">학습 언어</label><select id="sTarget">${Object.keys(LANGS).map(k => `<option value="${k}">${LANGS[k].flag} ${LANGS[k].name}</option>`).join('')}</select></div>
          <div><label class="lbl" for="sNative">뜻 언어</label><select id="sNative">${Object.keys(LANGS).filter(k => k !== s.target).map(k => `<option value="${k}">${LANGS[k].flag} ${LANGS[k].name}</option>`).join('')}</select></div>
          <div><label class="lbl" for="sFront">카드 앞면</label><select id="sFront"><option value="target">학습 언어 (보고 뜻 떠올리기)</option><option value="native">뜻 언어 (보고 표현 떠올리기)</option></select></div>
          <div><label class="lbl" for="sNew">하루 신규 카드</label><select id="sNew">${[5, 10, 15, 20, 30].map(n => `<option value="${n}">${n}장</option>`).join('')}</select></div>
        </div>
        <label class="check"><input type="checkbox" id="sPron"> 발음 표기 보기 (중국어 병음 · 일본어 로마자)</label>
        <label class="check"><input type="checkbox" id="sAuto"> 카드·문제 표시 때 자동 듣기</label>
      </div>
      <div class="panel">
        <h3>음성 설정</h3>
        <label class="lbl" for="sRate">음성 속도 <b id="rateV">${s.rate}</b></label>
        <input type="range" id="sRate" min="0.5" max="1.3" step="0.1" value="${s.rate}">
        <label class="lbl" for="sProxy">베트남어 GAS 음성 프록시 URL (선택)</label>
        <input type="url" id="sProxy" placeholder="https://script.google.com/macros/s/.../exec" value="${esc(s.proxy)}">
        <p class="note">현재 기기: ${TTS.isMobile ? '모바일' : 'PC'} · 베트남어 기기 음성: ${viVoice ? esc(viVoice.name) : '<span class="red-t">없음</span>'}<br>
        베트남어 재생 순서: ${TTS.isMobile ? '' : 'Google Tiếng Việt 음성 → '}GAS 프록시 → Google 번역 음성 → 기기 기본 음성</p>
        <div class="row gap wrap">${Object.keys(LANGS).map(k => `<button class="btn" data-test="${k}" type="button">🔊 ${LANGS[k].name} 테스트</button>`).join('')}</div>
      </div>
      <div class="panel">
        <h3>백업·복원</h3>
        <p class="note">학습 기록은 이 브라우저에만 저장됩니다${Store.isPersistent() ? '' : ' — <span class="red-t">현재 저장소 사용 불가, 새로고침 시 기록이 사라집니다</span>'}. 기기 이동 시 백업 코드를 복사해 다른 기기에 붙여넣으세요.</p>
        <div class="row gap wrap"><button class="btn" id="bkCopy" type="button">백업 코드 복사</button><button class="btn" id="bkLoad" type="button">붙여넣은 코드로 복원</button>
          <button class="btn red" id="bkReset" type="button">전체 초기화</button></div>
        <textarea id="bkText" class="csvout" placeholder="백업 코드를 여기에 붙여넣기"></textarea>
      </div>`;
    $('#sTarget').value = s.target; $('#sNative').value = s.native; $('#sFront').value = s.front; $('#sNew').value = String(s.newPerDay);
    $('#sPron').checked = s.showPron; $('#sAuto').checked = s.autoplay;
    $('#sTarget').onchange = e => { setTarget(e.target.value); };
    $('#sNative').onchange = e => { s.native = e.target.value; save(); S = null; Q = null; };
    $('#sFront').onchange = e => { s.front = e.target.value; save(); };
    $('#sNew').onchange = e => { s.newPerDay = +e.target.value; save(); S = null; };
    $('#sPron').onchange = e => { s.showPron = e.target.checked; save(); };
    $('#sAuto').onchange = e => { s.autoplay = e.target.checked; save(); };
    $('#sRate').oninput = e => { s.rate = +e.target.value; $('#rateV').textContent = s.rate; save(); };
    $('#sProxy').onchange = e => { s.proxy = e.target.value.trim(); save(); toast(s.proxy ? '프록시 URL 저장' : '프록시 URL 삭제'); };
    $$('#view-setup [data-test]').forEach(b => b.onclick = () => say(PHRASES[1], b.dataset.test));
    $('#bkCopy').onclick = () => {
      const code = JSON.stringify(st);
      $('#bkText').value = code;
      if (navigator.clipboard) navigator.clipboard.writeText(code).then(() => toast('백업 코드 복사 완료 (' + code.length + '자)'), e => toast('클립보드 복사 실패: ' + e.name + ' — 아래 칸의 코드를 직접 복사하세요', 'err'));
    };
    $('#bkLoad').onclick = () => {
      try { const o = JSON.parse($('#bkText').value); if (!o.settings) throw new Error('settings 항목 없음'); Store.apply(o); save(); S = null; Q = null; drawLangSwitch(); R.setup(); toast('복원 완료'); }
      catch (e) { toast('복원 실패: ' + e.message, 'err'); }
    };
    $('#bkReset').onclick = e => {
      const b = e.currentTarget;
      if (b.dataset.armed) { Store.reset(); S = null; Q = null; drawLangSwitch(); R.setup(); toast('전체 초기화 완료'); }
      else { b.dataset.armed = '1'; b.textContent = '한 번 더 누르면 초기화'; setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = '전체 초기화'; } }, 3000); }
    };
  };

  /* ---------- 시작 ---------- */
  drawLangSwitch();
  route();
})();
