import { formatMm } from './lib.js';

const FONT = 'system-ui, -apple-system, "Apple SD Gothic Neo", sans-serif';

export function noteBox(ctx, it) {
  ctx.font = `600 ${it.size}px ${FONT}`;
  const lines = it.text.split('\n');
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + it.size * 0.8;
  const h = lines.length * it.size * 1.25 + it.size * 0.5;
  return { x: it.p.x, y: it.p.y, w, h };
}

function pill(ctx, x, y, w, h, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 4);
  ctx.fill();
}

export function drawItems(ctx, items, selected) {
  for (const it of items) {
    ctx.save();
    if (it.type === 'dim') {
      const lw = Math.max(2, it.size / 7);
      ctx.strokeStyle = it.color;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(it.a.x, it.a.y);
      ctx.lineTo(it.b.x, it.b.y);
      ctx.stroke();
      // 양 끝 눈금
      const ang = Math.atan2(it.b.y - it.a.y, it.b.x - it.a.x) + Math.PI / 2;
      const t = it.size * 0.6;
      for (const pt of [it.a, it.b]) {
        ctx.beginPath();
        ctx.moveTo(pt.x - Math.cos(ang) * t, pt.y - Math.sin(ang) * t);
        ctx.lineTo(pt.x + Math.cos(ang) * t, pt.y + Math.sin(ang) * t);
        ctx.stroke();
      }
      // 값 라벨 (선 중앙)
      const label = formatMm(it.mm);
      ctx.font = `700 ${it.size}px ${FONT}`;
      const tw = ctx.measureText(label).width + it.size * 0.8;
      const th = it.size * 1.4;
      const mx = (it.a.x + it.b.x) / 2, my = (it.a.y + it.b.y) / 2;
      pill(ctx, mx - tw / 2, my - th / 2, tw, th, 'rgba(255,255,255,0.92)');
      ctx.strokeStyle = it.color;
      ctx.lineWidth = lw / 2;
      ctx.beginPath();
      ctx.roundRect(mx - tw / 2, my - th / 2, tw, th, th / 4);
      ctx.stroke();
      ctx.fillStyle = it.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, mx, my + it.size * 0.05);
      if (it === selected) handles(ctx, [it.a, it.b], it.size);
    } else if (it.type === 'arrow') {
      const lw = Math.max(3, it.size / 5);
      const ang = Math.atan2(it.b.y - it.a.y, it.b.x - it.a.x);
      const head = Math.min(it.size * 1.2, Math.hypot(it.b.x - it.a.x, it.b.y - it.a.y) * 0.6);
      ctx.strokeStyle = ctx.fillStyle = it.color;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(it.a.x, it.a.y);
      ctx.lineTo(it.b.x - Math.cos(ang) * head * 0.7, it.b.y - Math.sin(ang) * head * 0.7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(it.b.x, it.b.y);
      ctx.lineTo(it.b.x - Math.cos(ang - 0.45) * head, it.b.y - Math.sin(ang - 0.45) * head);
      ctx.lineTo(it.b.x - Math.cos(ang + 0.45) * head, it.b.y - Math.sin(ang + 0.45) * head);
      ctx.closePath();
      ctx.fill();
      if (it === selected) handles(ctx, [it.a, it.b], it.size);
    } else {
      const box = noteBox(ctx, it);
      pill(ctx, box.x, box.y, box.w, box.h, 'rgba(255,255,255,0.92)');
      ctx.strokeStyle = it.color;
      ctx.lineWidth = Math.max(2, it.size / 10);
      ctx.beginPath();
      ctx.roundRect(box.x, box.y, box.w, box.h, it.size / 3);
      ctx.stroke();
      ctx.fillStyle = it.color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      it.text.split('\n').forEach((l, i) => ctx.fillText(l, box.x + it.size * 0.4, box.y + it.size * 0.25 + i * it.size * 1.25));
      if (it === selected) handles(ctx, [{ x: box.x, y: box.y }, { x: box.x + box.w, y: box.y + box.h }], it.size, true);
    }
    ctx.restore();
  }
}

function handles(ctx, pts, size, dashed) {
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#0a84ff';
  ctx.lineWidth = Math.max(2, size / 8);
  if (dashed) {
    ctx.setLineDash([size / 3, size / 3]);
    ctx.strokeRect(pts[0].x, pts[0].y, pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    return;
  }
  for (const p of pts) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, size * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

/** 원본 해상도로 합성한 PNG Blob */
export async function exportPng(img, items) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  drawItems(ctx, items, null);
  return new Promise((r) => c.toBlob(r, 'image/png'));
}

/** 자르기 영역 표시: 바깥을 어둡게, 테두리와 모서리 손잡이 */
export function drawCrop(ctx, r, W, H) {
  const u = Math.max(W, H) / 60;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, r.y);
  ctx.fillRect(0, r.y + r.h, W, H - r.y - r.h);
  ctx.fillRect(0, r.y, r.x, r.h);
  ctx.fillRect(r.x + r.w, r.y, W - r.x - r.w, r.h);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = Math.max(2, u / 4);
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = '#0a84ff';
  for (const [x, y] of [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h],
    [r.x + r.w / 2, r.y], [r.x + r.w / 2, r.y + r.h], [r.x, r.y + r.h / 2], [r.x + r.w, r.y + r.h / 2]]) {
    ctx.beginPath(); ctx.arc(x, y, u * 0.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}
