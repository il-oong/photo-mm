// 화면과 무관한 순수 로직 (테스트 가능)
export function formatMm(mm) {
  const n = Number(mm);
  const s = Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' mm';
}

export function parseMm(text) {
  const n = Number(String(text).replace(/[,\s]|mm/gi, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function distToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** 탭한 위치에서 잡히는 항목을 찾는다. 반환: {item, part:'a'|'b'|'body'} 또는 null (위에 그려진 것 우선) */
export function hitTest(items, p, tol, noteBox) {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it.type === 'dim' || it.type === 'arrow') {
      if (Math.hypot(p.x - it.a.x, p.y - it.a.y) <= tol) return { item: it, part: 'a' };
      if (Math.hypot(p.x - it.b.x, p.y - it.b.y) <= tol) return { item: it, part: 'b' };
      if (distToSegment(p, it.a, it.b) <= tol) return { item: it, part: 'body' };
    } else if (it.type === 'note') {
      const box = noteBox(it);
      if (p.x >= box.x - tol / 2 && p.x <= box.x + box.w + tol / 2 && p.y >= box.y - tol / 2 && p.y <= box.y + box.h + tol / 2) {
        return { item: it, part: 'body' };
      }
    }
  }
  return null;
}

/** 모든 항목을 (dx,dy) 만큼 이동 — 자르기 후 좌표 보정용 */
export function shiftItems(items, dx, dy) {
  for (const it of items) {
    for (const k of ['a', 'b', 'p']) if (it[k]) { it[k].x += dx; it[k].y += dy; }
  }
}

/** 이미지 크기를 f 배로 바꿀 때 항목 좌표와 글자 크기도 같이 */
export function scaleItems(items, f) {
  for (const it of items) {
    for (const k of ['a', 'b', 'p']) if (it[k]) { it[k].x *= f; it[k].y *= f; }
    it.size *= f;
  }
}

/** 자르기 영역에서 탭 위치가 어느 부분인지: nw n ne e se s sw w / move / null */
export function cropHit(r, p, tol) {
  const nearL = Math.abs(p.x - r.x) <= tol, nearR = Math.abs(p.x - (r.x + r.w)) <= tol;
  const nearT = Math.abs(p.y - r.y) <= tol, nearB = Math.abs(p.y - (r.y + r.h)) <= tol;
  const inX = p.x >= r.x - tol && p.x <= r.x + r.w + tol, inY = p.y >= r.y - tol && p.y <= r.y + r.h + tol;
  if (!inX || !inY) return null;
  const v = nearT ? 'n' : nearB ? 's' : '';
  const h = nearL ? 'w' : nearR ? 'e' : '';
  if (v || h) return v + h;
  return 'move';
}

/** 자르기 영역을 (dx,dy) 만큼 끌었을 때의 새 영역 (이미지 W×H 안, 최소 min) */
export function dragCrop(r, part, dx, dy, W, H, min) {
  let { x, y, w, h } = r;
  if (part === 'move') {
    x = Math.max(0, Math.min(W - w, x + dx));
    y = Math.max(0, Math.min(H - h, y + dy));
    return { x, y, w, h };
  }
  let x2 = x + w, y2 = y + h;
  if (part.includes('w')) x = Math.max(0, Math.min(x + dx, x2 - min));
  if (part.includes('e')) x2 = Math.min(W, Math.max(x2 + dx, x + min));
  if (part.includes('n')) y = Math.max(0, Math.min(y + dy, y2 - min));
  if (part.includes('s')) y2 = Math.min(H, Math.max(y2 + dy, y + min));
  return { x, y, w: x2 - x, h: y2 - y };
}
