/* 마스코트 '입말이' — 민트 동그라미 + 작은 입술 + 머리 위 파스텔 소리 파동
 * 상태: idle(기본) · happy(기쁨) · oops(아쉬움) · think(생각) · party(축하)
 */
const Mascot = (() => {
  let uid = 0;
  const INK = '#3E4656';
  const CX = 54, CY = 66, R = 40;

  function eyes(state) {
    const ey = CY - 5, ex = 13;
    if (state === 'happy' || state === 'party') {
      return `<path d="M${CX - ex - 5},${ey + 1} Q${CX - ex},${ey - 6} ${CX - ex + 5},${ey + 1}" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
              <path d="M${CX + ex - 5},${ey + 1} Q${CX + ex},${ey - 6} ${CX + ex + 5},${ey + 1}" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    }
    const lx = state === 'think' ? 2 : 0, ly = state === 'think' ? -2.5 : 0;
    return `<g class="m-eyes">
      <circle cx="${CX - ex + lx}" cy="${ey + ly}" r="5" fill="${INK}"/><circle cx="${CX + ex + lx}" cy="${ey + ly}" r="5" fill="${INK}"/>
      <circle cx="${CX - ex + lx + 1.7}" cy="${ey + ly - 1.8}" r="1.7" fill="#fff"/><circle cx="${CX + ex + lx + 1.7}" cy="${ey + ly - 1.8}" r="1.7" fill="#fff"/>
    </g>`;
  }

  function mouth(state) {
    const my = CY + 10;
    if (state === 'happy' || state === 'party') {
      return `<path d="M${CX - 10},${my - 2} Q${CX},${my - 6.5} ${CX + 10},${my - 2} Q${CX + 7},${my + 10} ${CX},${my + 10} Q${CX - 7},${my + 10} ${CX - 10},${my - 2}Z" fill="#E88A98" stroke="#D97786" stroke-width="1.6"/>
              <ellipse cx="${CX}" cy="${my + 5.6}" rx="4.4" ry="2.5" fill="#F7B3BD"/>`;
    }
    if (state === 'oops') return `<ellipse cx="${CX}" cy="${my + 1}" rx="4.8" ry="4" fill="#E88A98" stroke="#D97786" stroke-width="1.6"/>`;
    if (state === 'think') return `<path d="M${CX - 6},${my} Q${CX - 3},${my - 3.5} ${CX},${my - 1} Q${CX + 3},${my - 3.5} ${CX + 6},${my} Q${CX},${my + 4.5} ${CX - 6},${my}Z" fill="#EE9AA7" stroke="#D97786" stroke-width="1.4" transform="translate(4 0)"/>`;
    return `<path d="M${CX - 10},${my} Q${CX - 5},${my - 5.5} ${CX},${my - 1.6} Q${CX + 5},${my - 5.5} ${CX + 10},${my} Q${CX},${my + 7.5} ${CX - 10},${my}Z" fill="#EE9AA7" stroke="#D97786" stroke-width="1.5"/>`;
  }

  function svg(state, size) {
    const id = 'mi' + (++uid), w = size || 64;
    return `<svg class="mascot-svg" viewBox="0 0 120 112" width="${w}" height="${(w * 112 / 120).toFixed(0)}" aria-hidden="true">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F2FBF5"/><stop offset="1" stop-color="#CDEBD7"/></linearGradient></defs>
      <g class="m-wave" fill="none" stroke-linecap="round" stroke-width="4">
        <path d="M76,24 A10,10 0 0 1 76,40" stroke="#9DB8D6"/>
        <path d="M83,17 A17,17 0 0 1 83,47" stroke="#B9A9DC"/>
        <path d="M90,10 A24,24 0 0 1 90,54" stroke="#97CDA8"/>
      </g>
      <g class="m-body">
        <circle cx="${CX}" cy="${CY}" r="${R}" fill="url(#${id})" stroke="#97CDA8" stroke-width="3"/>
        <ellipse cx="${CX - 17}" cy="${CY - 24}" rx="10" ry="5" fill="#fff" opacity=".65" transform="rotate(-25 ${CX - 17} ${CY - 24})"/>
        <ellipse cx="${CX - 22}" cy="${CY + 9}" rx="6" ry="3.6" fill="#F7B8C2" opacity=".85"/>
        <ellipse cx="${CX + 22}" cy="${CY + 9}" rx="6" ry="3.6" fill="#F7B8C2" opacity=".85"/>
        ${eyes(state)}
        ${mouth(state)}
      </g>
      ${state === 'oops' ? `<path d="M${CX + 30},${CY - 30} c-4,7 -4,11 0,13 c4,-2 4,-6 0,-13z" fill="#BCD4EC" stroke="#9DB8D6"/>` : ''}
      ${state === 'think' ? '<g class="m-dots"><circle cx="102" cy="74" r="2.6" fill="#B9A9DC"/><circle cx="110" cy="66" r="3.4" fill="#B9A9DC"/></g>' : ''}
      ${state === 'party' ? '<g class="m-spark"><path d="M10,22 l2,6 6,2 -6,2 -2,6 -2,-6 -6,-2 6,-2z" fill="#FFE7A8"/><path d="M106,70 l1.6,4.6 4.6,1.6 -4.6,1.6 -1.6,4.6 -1.6,-4.6 -4.6,-1.6 4.6,-1.6z" fill="#CBBDEB"/><path d="M18,96 l1.3,3.7 3.7,1.3 -3.7,1.3 -1.3,3.7 -1.3,-3.7 -3.7,-1.3 3.7,-1.3z" fill="#BCD4EC"/></g>' : ''}
    </svg>`;
  }

  function html(state, msg, size) {
    return `<div class="mascot m-${state}">${svg(state, size)}${msg ? `<div class="mbubble">${msg}</div>` : ''}</div>`;
  }
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  return { svg, html, pick };
})();
