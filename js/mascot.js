/* 마스코트 '입말이' — 앱 아이콘의 입술에 눈·볼을 더한 캐릭터
 * 상태: idle(기본) · happy(기쁨) · oops(아쉬움) · think(생각) · party(축하)
 */
const Mascot = (() => {
  let uid = 0;
  /* 입 모양 변형 (아이콘 원본 좌표 기준) */
  const POSE = {
    idle:  { mouth: 1.0, lower: 0,   squeeze: 1.0 },
    happy: { mouth: 1.55, lower: 16, squeeze: 1.04 },
    party: { mouth: 1.7, lower: 20,  squeeze: 1.06 },
    oops:  { mouth: 0.06, lower: -30, squeeze: 0.88 },
    think: { mouth: 0.45, lower: -14, squeeze: 0.72 }
  };

  function eyes(state) {
    if (state === 'happy' || state === 'party') {
      return `<path d="M38,26 Q45,17 52,26" class="m-eye-arc" fill="none" stroke="#4A3B44" stroke-width="3.2" stroke-linecap="round"/><path d="M68,26 Q75,17 82,26" class="m-eye-arc" fill="none" stroke="#4A3B44" stroke-width="3.2" stroke-linecap="round"/>`;
    }
    const look = state === 'think' ? -3 : 0, lookX = state === 'think' ? 2 : 0;
    return `<g class="m-eyes">
      <ellipse cx="45" cy="25" rx="7.5" ry="8.5" fill="#fff" stroke="#D88A96" stroke-width="1.2"/>
      <ellipse cx="75" cy="25" rx="7.5" ry="8.5" fill="#fff" stroke="#D88A96" stroke-width="1.2"/>
      <circle cx="${46 + lookX}" cy="${26 + look}" r="3.8" fill="#4A3B44"/><circle cx="${76 + lookX}" cy="${26 + look}" r="3.8" fill="#4A3B44"/>
      <circle cx="${47.3 + lookX}" cy="${24.6 + look}" r="1.3" fill="#fff"/><circle cx="${77.3 + lookX}" cy="${24.6 + look}" r="1.3" fill="#fff"/>
    </g>`;
  }

  function svg(state, size) {
    const p = POSE[state] || POSE.idle, id = 'm' + (++uid);
    const sx = p.squeeze;
    return `<svg class="mascot-svg" viewBox="0 0 120 112" width="${size || 64}" height="${(size || 64) * 112 / 120}" aria-hidden="true">
      <defs>
        <linearGradient id="${id}u" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F6C3CA"/><stop offset="1" stop-color="#EFA4AF"/></linearGradient>
        <linearGradient id="${id}l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2AAB4"/><stop offset="1" stop-color="#E8939F"/></linearGradient>
      </defs>
      ${eyes(state)}
      <g transform="translate(60 0) scale(${sx} 1) translate(-60 0)">
        <g transform="translate(-25.8 -38.7) scale(0.4167)">
          <g transform="translate(0 252) scale(1 ${p.mouth}) translate(0 -252)">
            <path d="M86,252 C128,246 170,241 206,243 C242,241 284,246 326,252 C298,284 254,300 206,300 C158,300 114,284 86,252 Z" fill="#B66572"/>
            <ellipse cx="206" cy="287" rx="58" ry="15" fill="#F4B1BA"/>
            <path d="M110,254 C150,249 182,247 206,248 C230,247 262,249 302,254 L297,266 C262,261 232,260 206,260 C180,260 150,261 115,266 Z" fill="#fff"/>
          </g>
          <path d="M86,252 C114,206 156,184 184,198 C194,203 200,209 206,213 C212,209 218,203 228,198 C256,184 298,206 326,252 C284,246 242,241 206,243 C170,241 128,246 86,252 Z" fill="url(#${id}u)" stroke="#D88A96" stroke-width="5" stroke-linejoin="round"/>
          <g transform="translate(0 ${p.lower})">
            <path d="M86,252 C114,284 158,300 206,300 C254,300 298,284 326,252 C312,306 266,336 206,336 C146,336 100,306 86,252 Z" fill="url(#${id}l)" stroke="#D88A96" stroke-width="5" stroke-linejoin="round"/>
            <ellipse cx="226" cy="318" rx="34" ry="7" fill="#fff" opacity=".55"/>
          </g>
        </g>
      </g>
      <ellipse cx="22" cy="58" rx="7" ry="4.5" fill="#F7B8C2" opacity=".75"/>
      <ellipse cx="98" cy="58" rx="7" ry="4.5" fill="#F7B8C2" opacity=".75"/>
      ${state === 'oops' ? '<path d="M101,14 C97,22 97,26 101,28 C105,26 105,22 101,14 Z" fill="#BCD4EC" stroke="#9DB8D6" stroke-width="1"/>' : ''}
      ${state === 'party' ? '<g class="m-spark"><path d="M14,10 l2,6 6,2 -6,2 -2,6 -2,-6 -6,-2 6,-2z" fill="#FFE7A8"/><path d="M106,6 l1.5,4.5 4.5,1.5 -4.5,1.5 -1.5,4.5 -1.5,-4.5 -4.5,-1.5 4.5,-1.5z" fill="#CBBDEB"/></g>' : ''}
      ${state === 'think' ? '<g class="m-dots"><circle cx="104" cy="40" r="2.6" fill="#B9A9DC"/><circle cx="111" cy="31" r="3.4" fill="#B9A9DC"/></g>' : ''}
    </svg>`;
  }

  /* 말풍선 포함 마스코트 블록 */
  function html(state, msg, size) {
    return `<div class="mascot m-${state}">${svg(state, size)}${msg ? `<div class="mbubble">${msg}</div>` : ''}</div>`;
  }
  /* 기존 블록의 표정·말만 바꾸기 (튀어오름 효과 재생) */
  function set(el, state, msg) {
    if (!el) return;
    el.outerHTML = html(state, msg, +(el.querySelector('svg') || {}).getAttribute?.('width') || 64);
  }
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  return { svg, html, set, pick };
})();
