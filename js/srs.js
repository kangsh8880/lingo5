/* 간격반복 복습 엔진 (단계 0~6, 복습 주기 0·1·2·4·7·15·30일) */
const SRS = (() => {
  const INTERVALS = [0, 1, 2, 4, 7, 15, 30];

  const pad = n => String(n).padStart(2, '0');
  const dateKey = (d = new Date()) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const dayIndex = (d = new Date()) => Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
  const key = (lang, id) => lang + ':' + id;

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function todayLog(st) {
    const k = dateKey();
    if (!st.log[k]) st.log[k] = { studied: 0, quizN: 0, quizOK: 0, newCards: {} };
    if (!st.log[k].newCards) st.log[k].newCards = {};
    return st.log[k];
  }
  function getP(st, card) { return st.progress[key(st.settings.target, card.id)]; }

  function buildQueue(cards, st, extraNew) {
    const t = dayIndex(), due = [], fresh = [];
    cards.forEach(c => {
      const p = getP(st, c);
      if (!p) fresh.push(c);
      else if (p.due <= t) due.push(c);
    });
    const used = todayLog(st).newCards[st.settings.target] || 0;
    const left = Math.max(0, Number(st.settings.newPerDay) - used) + (extraNew || 0);
    return { due: shuffle(due), fresh: shuffle(fresh).slice(0, left) };
  }

  /* g: 0=모름, 1=애매, 2=알아요 */
  function grade(st, card, g) {
    const k = key(st.settings.target, card.id), t = dayIndex();
    let p = st.progress[k];
    const isNew = !p;
    if (!p) p = { box: 0, due: t, reps: 0, lapses: 0 };
    if (g === 0) { p.box = 0; p.lapses++; p.due = t; }
    else if (g === 1) { p.box = Math.max(1, p.box); p.due = t + 1; }
    else { p.box = Math.min(6, p.box + 1); p.due = t + INTERVALS[p.box]; }
    p.reps++; p.last = t;
    st.progress[k] = p;
    const log = todayLog(st);
    log.studied++;
    if (isNew) log.newCards[st.settings.target] = (log.newCards[st.settings.target] || 0) + 1;
  }

  /* 퀴즈 오답 → 오늘 복습 대상으로 편입 */
  function lapse(st, card) {
    const k = key(st.settings.target, card.id), t = dayIndex();
    const p = st.progress[k] || { box: 0, due: t, reps: 0, lapses: 0 };
    p.box = 0; p.due = t; p.lapses++;
    st.progress[k] = p;
  }

  function nextLabel(st, card) {
    const p = getP(st, card);
    const nb = Math.min(6, (p ? p.box : 0) + 1);
    return INTERVALS[nb] + '일 후';
  }

  function boxOf(st, card) { const p = getP(st, card); return p ? p.box : -1; }

  return { INTERVALS, dateKey, dayIndex, key, shuffle, todayLog, buildQueue, grade, lapse, nextLabel, boxOf, getP };
})();
