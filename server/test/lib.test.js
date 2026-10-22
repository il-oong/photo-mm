import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMm, parseMm, distToSegment, hitTest, shiftItems, scaleItems, cropHit, dragCrop } from '../public/lib.js';

test('formatMm', () => {
  assert.equal(formatMm(1250), '1,250 mm');
  assert.equal(formatMm(12.34), '12.3 mm');
  assert.equal(formatMm(999), '999 mm');
});
test('parseMm', () => {
  assert.equal(parseMm('1,250 mm'), 1250);
  assert.equal(parseMm('abc'), null);
  assert.equal(parseMm('-5'), null);
});
test('distToSegment', () => {
  assert.equal(distToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 3);
  assert.equal(distToSegment({ x: 13, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 5);
});
test('hitTest picks topmost and endpoint', () => {
  const d = { type: 'dim', a: { x: 0, y: 0 }, b: { x: 100, y: 0 } };
  const n = { type: 'note', p: { x: 40, y: -5 } };
  const box = () => ({ x: 40, y: -5, w: 30, h: 10 });
  assert.equal(hitTest([d, n], { x: 50, y: 0 }, 5, box).item, n);
  assert.deepEqual(hitTest([d], { x: 2, y: 1 }, 5, box).part, 'a');
  assert.equal(hitTest([d], { x: 50, y: 50 }, 5, box), null);
});

test('hitTest handles arrows like dims', () => {
  const a = { type: 'arrow', a: { x: 0, y: 0 }, b: { x: 100, y: 0 } };
  assert.equal(hitTest([a], { x: 99, y: 1 }, 5, () => null).part, 'b');
});
test('shiftItems / scaleItems', () => {
  const items = [{ type: 'dim', a: { x: 10, y: 10 }, b: { x: 20, y: 10 }, size: 4 }, { type: 'note', p: { x: 5, y: 5 }, size: 2 }];
  shiftItems(items, -5, -5);
  assert.deepEqual(items[0].a, { x: 5, y: 5 });
  assert.deepEqual(items[1].p, { x: 0, y: 0 });
  scaleItems(items, 2);
  assert.deepEqual(items[0].b, { x: 30, y: 10 });
  assert.equal(items[0].size, 8);
});
test('cropHit / dragCrop', () => {
  const r = { x: 10, y: 10, w: 100, h: 80 };
  assert.equal(cropHit(r, { x: 11, y: 12 }, 5), 'nw');
  assert.equal(cropHit(r, { x: 60, y: 90 }, 5), 's');
  assert.equal(cropHit(r, { x: 60, y: 50 }, 5), 'move');
  assert.equal(cropHit(r, { x: 300, y: 50 }, 5), null);
  assert.deepEqual(dragCrop(r, 'move', -50, 500, 200, 200, 20), { x: 0, y: 120, w: 100, h: 80 });
  assert.deepEqual(dragCrop(r, 'se', 1000, 1000, 200, 200, 20), { x: 10, y: 10, w: 190, h: 190 });
  assert.equal(dragCrop(r, 'w', 1000, 0, 200, 200, 20).w, 20);
});
