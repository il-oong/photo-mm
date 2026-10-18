import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertPublicUrl, isPrivateAddress } from '../src/urlGuard.js';

test('private addresses are detected', () => {
  for (const ip of ['127.0.0.1', '10.0.0.1', '192.168.1.1', '172.16.0.1', '169.254.169.254', '::1', 'fd00::1']) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  assert.equal(isPrivateAddress('8.8.8.8'), false);
});

test('rejects non-http and internal urls', async () => {
  await assert.rejects(assertPublicUrl('file:///etc/passwd'));
  await assert.rejects(assertPublicUrl('http://127.0.0.1:3000'));
  await assert.rejects(assertPublicUrl('not a url'));
});
