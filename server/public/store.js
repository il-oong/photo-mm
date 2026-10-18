// IndexedDB 에 현재 작업(원본 이미지 + 편집 정보)을 따로 보관
const DB = 'photo-mm', KEY = 'current';
const open = () => new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore('kv');
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
export async function save(blob, items, style) {
  try {
    const db = await open();
    db.transaction('kv', 'readwrite').objectStore('kv').put({ blob, items, style }, KEY);
  } catch {}
}
export async function load() {
  try {
    const db = await open();
    return await new Promise((res) => {
      const r = db.transaction('kv').objectStore('kv').get(KEY);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => res(null);
    });
  } catch { return null; }
}
