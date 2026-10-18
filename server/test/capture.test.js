import { test } from 'node:test';
import assert from 'node:assert/strict';
import { screenshotUnderCap } from '../src/capture.js';

const fake = (sizes) => {
  const calls = [];
  const shot = async (o) => {
    calls.push(o);
    return Buffer.alloc(sizes[Math.min(calls.length - 1, sizes.length - 1)]);
  };
  return { shot, calls };
};

test('returns the first result under the cap', async () => {
  const { shot, calls } = fake([500, 100]);
  const img = await screenshotUnderCap(shot, 1000);
  assert.equal(img.length, 500);
  assert.equal(calls.length, 1);
});

test('falls back to lower quality, then css scale', async () => {
  const { shot, calls } = fake([5000, 4000, 900]);
  const img = await screenshotUnderCap(shot, 1000);
  assert.equal(img.length, 900);
  assert.deepEqual(calls.map((c) => c.scale), [undefined, undefined, 'css']);
});

test('rejects when nothing fits the cap', async () => {
  const { shot, calls } = fake([5000]);
  await assert.rejects(screenshotUnderCap(shot, 1000), /너무 커서/);
  assert.equal(calls.length, 4);
});
