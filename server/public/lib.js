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
    if (it.type === 'dim') {
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
