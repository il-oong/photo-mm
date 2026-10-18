import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMm, parseMm, distToSegment, hitTest } from '../public/lib.js';

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
