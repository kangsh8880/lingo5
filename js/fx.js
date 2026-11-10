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
  return { confetti, countUp, reduced };
})();
