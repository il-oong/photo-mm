// IndexedDB 에 현재 작업(원본 이미지 + 편집 정보)을 따로 보관
// Blob 직접 저장은 일부 iOS 환경에서 실패하므로 ArrayBuffer 로 보관한다
const DB = 'photo-mm', KEY = 'current';
const open = () => new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore('kv');
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});

// 저장 요청이 겹쳐도 호출 순서대로 하나씩 처리해, 오래된 저장이 나중에 덮어쓰지 않게 한다
let queue = Promise.resolve();
/** 성공하면 true */
export function save(blob, items, style) {
  const run = queue.then(() => write(blob, items, style));
  queue = run.catch(() => {});
  return run;
}

async function write(blob, items, style) {
  try {
    const buf = await blob.arrayBuffer();
    const db = await open();
    await new Promise((res, rej) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put({ buf, type: blob.type, items, style }, KEY);
      tx.oncomplete = res;
      tx.onerror = tx.onabort = () => rej(tx.error);
    });
    db.close();
    return true;
  } catch {
    return false;
  }
}

export async function load() {
  try {
    const db = await open();
    const rec = await new Promise((res) => {
      const r = db.transaction('kv').objectStore('kv').get(KEY);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => res(null);
    });
    db.close();
    if (!rec) return null;
    const blob = rec.buf ? new Blob([rec.buf], { type: rec.type }) : rec.blob;
    return blob ? { blob, items: rec.items, style: rec.style } : null;
  } catch {
    return null;
  }
}
