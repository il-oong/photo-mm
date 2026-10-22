import { parseMm, hitTest, shiftItems, scaleItems, cropHit, dragCrop } from './lib.js';
import { drawItems, drawCrop, noteBox, exportPng } from './render.js';
import * as store from './store.js';

const $ = (id) => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
let img = null, blob = null, items = [], mode = 'select', selected = null;
let pending = null; // 치수선 첫 점
let drag = null, undoStack = [];
let cropRect = null, cropDrag = null;
const style = { color: '#ff3b30', size: 0 };

const toast = (m) => { const t = $('toast'); t.textContent = m; t.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => (t.style.display = 'none'), 2500); };
const defaultSize = () => Math.round((img?.naturalWidth || 1000) / 28);
const sizeFromSlider = () => Math.round(defaultSize() * (Number($('size').value) / 30));

function ask(dlg, input, value = '') {
  return new Promise((res) => {
    input.value = value;
    dlg.returnValue = '';
    dlg.onclose = () => res(dlg.returnValue === 'ok' ? input.value.trim() : null);
    dlg.showModal();
    setTimeout(() => input.focus(), 50);
  });
}

function redraw() {
  if (!img) return;
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.drawImage(img, 0, 0);
  // noteBox 계산용 컨텍스트가 같으므로 그대로 사용
  drawItems(ctx, items, selected);
  if (cropRect) drawCrop(ctx, cropRect, cv.width, cv.height);
  if (pending) {
    ctx.fillStyle = style.color;
    ctx.beginPath();
    ctx.arc(pending.x, pending.y, sizeFromSlider() * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  $('undo').disabled = undoStack.length === 0;
  $('edit').disabled = !selected || selected.type === 'arrow';
  $('del').disabled = !selected;
}

function snapshot() { undoStack.push({ items: JSON.stringify(items), blob }); if (undoStack.length > 50) undoStack.shift(); }
function persist() { if (blob) store.save(blob, items, { color: style.color, slider: $('size').value }); }
function commit() { redraw(); persist(); }

function pos(e) {
  const r = cv.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * cv.width, y: ((e.clientY - r.top) / r.height) * cv.height };
}
const tol = () => Math.max(20, cv.width / 30);

async function setImage(b, restored) {
  const url = URL.createObjectURL(b);
  const im = new Image();
  await new Promise((res, rej) => { im.onload = res; im.onerror = rej; im.src = url; });
  img = im; blob = b;
  cv.width = im.naturalWidth; cv.height = im.naturalHeight;
  cv.hidden = false; $('empty').hidden = true; $('exportBtn').disabled = false; $('resize').disabled = false;
  if (!restored) { items = []; undoStack = []; selected = null; pending = null; }
  commit();
}

cv.addEventListener('pointerdown', async (e) => {
  if (!img) return;
  const p = pos(e);
  if (mode === 'crop') {
    const part = cropHit(cropRect, p, tol());
    if (part) { cropDrag = { part, last: p }; cv.setPointerCapture(e.pointerId); }
    return;
  }
  if (mode === 'arrow') {
    if (!pending) { pending = p; redraw(); return; }
    const a = pending; pending = null;
    snapshot();
    const it = { type: 'arrow', a, b: p, color: style.color, size: sizeFromSlider() };
    items.push(it); selected = it; setMode('select'); commit();
    return;
  }
  if (mode === 'dim') {
    if (!pending) { pending = p; redraw(); return; }
    const a = pending; pending = null;
    redraw();
    const mm = parseMm(await ask($('dlgNum'), $('numIn')));
    if (!mm) { redraw(); return; }
    snapshot();
    const it = { type: 'dim', a, b: p, mm, color: style.color, size: sizeFromSlider() };
    items.push(it); selected = it; setMode('select'); commit();
  } else if (mode === 'note') {
    const text = await ask($('dlgNote'), $('noteIn'));
    if (!text) return;
    snapshot();
    const it = { type: 'note', p, text, color: style.color, size: sizeFromSlider() };
    items.push(it); selected = it; setMode('select'); commit();
  } else {
    const h = hitTest(items, p, tol(), (it) => noteBox(ctx, it));
    selected = h ? h.item : null;
    if (h) {
      drag = { part: h.part, last: p, moved: false };
      cv.setPointerCapture(e.pointerId);
      syncControls(h.item);
    }
    redraw();
  }
});
cv.addEventListener('pointermove', (e) => {
  if (cropDrag) {
    const p = pos(e);
    cropRect = dragCrop(cropRect, cropDrag.part, p.x - cropDrag.last.x, p.y - cropDrag.last.y, cv.width, cv.height, Math.max(40, cv.width / 15));
    cropDrag.last = p; updateCropInfo(); redraw();
    return;
  }
  if (!drag || !selected) return;
  const p = pos(e), dx = p.x - drag.last.x, dy = p.y - drag.last.y;
  if (!drag.moved) { snapshot(); drag.moved = true; }
  const mv = (pt) => { pt.x += dx; pt.y += dy; };
  if (selected.type === 'dim' || selected.type === 'arrow') {
    if (drag.part === 'a') mv(selected.a); else if (drag.part === 'b') mv(selected.b); else { mv(selected.a); mv(selected.b); }
  } else mv(selected.p);
  drag.last = p; redraw();
});
const endDrag = () => { if (drag?.moved) persist(); drag = null; cropDrag = null; };
cv.addEventListener('pointerup', endDrag);
cv.addEventListener('pointercancel', endDrag);

function syncControls(it) { $('color').value = it.color; style.color = it.color; $('size').value = Math.round((it.size / defaultSize()) * 30); }
function updateCropInfo() { $('cropInfo').textContent = `${Math.round(cropRect.w)} × ${Math.round(cropRect.h)} px`; }
function setMode(m) {
  mode = m; pending = null; cropDrag = null;
  cropRect = m === 'crop' && img ? { x: 0, y: 0, w: cv.width, h: cv.height } : null;
  $('cropbar').hidden = m !== 'crop';
  if (cropRect) updateCropInfo();
  document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
  if (m !== 'select') selected = null;
  redraw();
}
document.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));

// 색상·크기 조절은 한 번 만지는 동안 하나의 실행취소 단위로 묶는다
let styleSnapped = false;
const snapOnce = () => { if (!styleSnapped) { snapshot(); styleSnapped = true; } };
$('color').oninput = (e) => { style.color = e.target.value; if (selected) { snapOnce(); selected.color = style.color; commit(); } };
$('size').oninput = () => { if (selected) { snapOnce(); selected.size = sizeFromSlider(); redraw(); } };
$('color').onchange = $('size').onchange = () => { styleSnapped = false; persist(); };
$('undo').onclick = async () => {
  if (!undoStack.length) return;
  const s = undoStack.pop();
  items = JSON.parse(s.items); selected = null;
  if (s.blob !== blob) await setImage(s.blob, true); else commit();
};

// 이미지 자체를 바꾸는 작업(자르기·크기): 이전 이미지와 항목을 실행취소에 남긴다
async function replaceImage(nb) {
  await setImage(nb, true);
}
function canvasBlob(c) { return new Promise((r) => c.toBlob(r, 'image/png')); }
$('cropCancel').onclick = () => setMode('select');
$('cropOk').onclick = async () => {
  const r = cropRect;
  const x = Math.round(r.x), y = Math.round(r.y), w = Math.round(r.w), h = Math.round(r.h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(img, x, y, w, h, 0, 0, w, h);
  snapshot();
  shiftItems(items, -x, -y);
  const nb = await canvasBlob(c);
  setMode('select');
  await replaceImage(nb);
};

const dlgResize = $('dlgResize');
let rzRatio = 1;
$('resize').onclick = () => {
  if (!img) return;
  rzRatio = img.naturalHeight / img.naturalWidth;
  $('resizeInfo').textContent = `현재 ${img.naturalWidth} × ${img.naturalHeight} px (비율 유지)`;
  $('rzW').value = img.naturalWidth; $('rzH').value = img.naturalHeight;
  dlgResize.returnValue = '';
  dlgResize.onclose = async () => {
    if (dlgResize.returnValue !== 'ok') return;
    const w = Math.round(Number($('rzW').value));
    if (!(w >= 50 && w <= 8000) || w === img.naturalWidth) return;
    const h = Math.max(1, Math.round(w * rzRatio));
    const f = w / img.naturalWidth;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const cx = c.getContext('2d');
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(img, 0, 0, w, h);
    snapshot();
    scaleItems(items, f);
    selected = null;
    await replaceImage(await canvasBlob(c));
  };
  dlgResize.showModal();
};
$('rzW').oninput = () => { $('rzH').value = Math.round(Number($('rzW').value) * rzRatio) || ''; };
$('rzH').oninput = () => { $('rzW').value = Math.round(Number($('rzH').value) / rzRatio) || ''; };
dlgResize.querySelectorAll('[data-pct]').forEach((b) => (b.onclick = () => {
  $('rzW').value = Math.round(img.naturalWidth * Number(b.dataset.pct) / 100); $('rzW').oninput();
}));
$('del').onclick = () => { if (!selected) return; snapshot(); items = items.filter((i) => i !== selected); selected = null; commit(); };
$('edit').onclick = async () => {
  if (!selected) return;
  if (selected.type === 'dim') {
    const mm = parseMm(await ask($('dlgNum'), $('numIn'), selected.mm));
    if (mm) { snapshot(); selected.mm = mm; commit(); }
  } else {
    const t = await ask($('dlgNote'), $('noteIn'), selected.text);
    if (t) { snapshot(); selected.text = t; commit(); }
  }
};

$('file').onchange = async (e) => {
  const f = e.target.files[0];
  if (f) await setImage(f).catch(() => toast('이미지를 열 수 없습니다'));
  e.target.value = '';
};

$('urlBtn').onclick = async () => {
  const u = await ask($('dlgUrl'), $('urlIn'));
  if (!u) return;
  toast('사이트 캡처 중… (최대 30초)');
  try {
    let token = localStorage.getItem('captureToken');
    let r = await fetch(`/capture?url=${encodeURIComponent(u)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (r.status === 401) {
      token = prompt('서버 접근 토큰');
      if (!token) return;
      localStorage.setItem('captureToken', token);
      r = await fetch(`/capture?url=${encodeURIComponent(u)}`, { headers: { Authorization: `Bearer ${token}` } });
    }
    if (!r.ok) throw new Error(await r.text());
    const b = await r.blob();
    await setImage(b);
    toast(r.headers.get('X-Truncated') === 'true' ? '페이지가 길어 일부만 캡처됨 (16,000px)' : '캡처 완료');
  } catch (e) { toast('캡처 실패: ' + e.message); }
};

$('exportBtn').onclick = async () => {
  const out = await exportPng(img, items);
  const file = new File([out], 'photo-mm.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(out); a.download = 'photo-mm.png'; a.click();
};

(async () => {
  const s = await store.load();
  if (!s) return;
  items = s.items || [];
  if (s.style) { style.color = s.style.color; $('color').value = s.style.color; $('size').value = s.style.slider; }
  await setImage(s.blob, true).catch(() => {});
})();

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
