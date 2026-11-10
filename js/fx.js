/* 화면 효과: 색종이(축하), 숫자 올라가기, 애니메이션 줄이기 설정 존중 */
const FX = (() => {
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COLORS = ['#F6C3CA', '#D6E4F0', '#DDF1E3', '#FFF3D4', '#ECE6F6', '#BCD4EC', '#97CDA8', '#B9A9DC'];

  /* 색종이: 화면 위쪽 양옆에서 터지며 떨어짐 (외부 라이브러리 없이 canvas) */
  function confetti(power) {
    if (reduced()) return;
    const k = power || 1;
    const cv = document.createElement('canvas');
    cv.className = 'fx-canvas';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = innerWidth, H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    document.body.appendChild(cv);
    const g = cv.getContext('2d'); g.scale(dpr, dpr);
    const N = Math.round(110 * k), parts = [];
    for (let i = 0; i < N; i++) {
      const left = i % 2 === 0;
      parts.push({
        x: left ? W * 0.15 : W * 0.85, y: H * 0.35,
        vx: (left ? 1 : -1) * (2 + Math.random() * 6), vy: -(7 + Math.random() * 8),
        r: 4 + Math.random() * 5, a: Math.random() * Math.PI, va: (Math.random() - 0.5) * 0.3,
        c: COLORS[i % COLORS.length], round: Math.random() < 0.35
      });
    }
    const t0 = performance.now(), LIFE = 1800;
    (function frame(now) {
      const p = (now - t0) / LIFE;
      g.clearRect(0, 0, W, H);
      g.globalAlpha = p > 0.75 ? Math.max(0, 1 - (p - 0.75) / 0.25) : 1;
      parts.forEach(o => {
        o.vy += 0.32; o.vx *= 0.985; o.x += o.vx; o.y += o.vy; o.a += o.va;
        g.save(); g.translate(o.x, o.y); g.rotate(o.a); g.fillStyle = o.c;
        if (o.round) { g.beginPath(); g.arc(0, 0, o.r * 0.6, 0, Math.PI * 2); g.fill(); }
        else g.fillRect(-o.r, -o.r * 0.45, o.r * 2, o.r * 0.9);
        g.restore();
      });
      if (p < 1) requestAnimationFrame(frame); else cv.remove();
    })(t0);
  }

  /* data-count 값까지 0부터 올라가기 (정수/소수 1자리 유지) */
  function countUp(root) {
    if (!root) return;
    root.querySelectorAll('[data-count]').forEach(el => {
      const end = parseFloat(el.dataset.count), dec = +el.dataset.dec || 0, suf = el.dataset.suffix || '';
      if (!isFinite(end) || reduced() || end === 0) return;
      const t0 = performance.now(), D = 700;
      (function step(now) {
        const p = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - p, 3);
        el.textContent = (end * e).toFixed(dec) + suf;
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    });
  }
  /* 진동 피드백 (안드로이드 Chrome; 아이폰은 미지원 → 무시) */
  let hapticOn = true;
  function setHaptic(on) { hapticOn = !!on; }
  function haptic(kind) {
    if (!hapticOn || !navigator.vibrate) return;
    try { navigator.vibrate(kind === 'bad' ? [18, 60, 18] : kind === 'goal' ? [12, 40, 12, 40, 30] : 10); } catch (e) {}
  }
  /* 오늘 목표 원형 링 */
  function ring(done, goal, size) {
    const r = 17, c = 2 * Math.PI * r, p = Math.min(1, goal ? done / goal : 0), sz = size || 46;
    return `<svg class="goal-ring ${p >= 1 ? 'full' : ''}" viewBox="0 0 44 44" width="${sz}" height="${sz}">
      <defs><linearGradient id="gr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9DB8D6"/><stop offset=".5" stop-color="#B9A9DC"/><stop offset="1" stop-color="#97CDA8"/></linearGradient></defs>
      <circle cx="22" cy="22" r="${r}" class="ring-bg"/>
      <circle cx="22" cy="22" r="${r}" class="ring-fg" stroke="url(#gr)" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - p)).toFixed(1)}" transform="rotate(-90 22 22)"/>
      <text x="22" y="25.5" text-anchor="middle" class="ring-txt">${p >= 1 ? '✓' : Math.round(p * 100) + '%'}</text></svg>`;
  }
  /* 손가락으로 밀기 (카드 스와이프): onMove(dx,dy) · onEnd(dx,dy) */
  function drag(el, { onMove, onEnd, enabled }) {
    let sx = 0, sy = 0, on = false, moved = false, id = null;
    el.addEventListener('pointerdown', e => { if (!enabled()) return; on = true; moved = false; sx = e.clientX; sy = e.clientY; id = e.pointerId; });
    el.addEventListener('pointermove', e => {
      if (!on || e.pointerId !== id) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!moved && Math.abs(dx) > 8) { moved = true; try { el.setPointerCapture(id); } catch (x) {} }
      if (moved) { e.preventDefault(); onMove(dx, dy); }
    });
    const end = e => { if (!on || e.pointerId !== id) return; on = false; if (moved) { onEnd(e.clientX - sx, e.clientY - sy); el.dataset.dragged = '1'; setTimeout(() => delete el.dataset.dragged, 50); } };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }
  return { confetti, countUp, reduced, haptic, setHaptic, ring, drag };
})();
