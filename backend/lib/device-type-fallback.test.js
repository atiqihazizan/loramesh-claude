import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDeviceTypeId } from './device-type-fallback.js';

test('kod payload sah menang', () => assert.equal(resolveDeviceTypeId(3, { type_id: 9 }), 3));
test('kod tiada dalam master → guna type_id device (node 8865)', () =>
  assert.equal(resolveDeviceTypeId(null, { type_id: 9 }), 9));
test('tiada kedua-duanya → null', () => {
  assert.equal(resolveDeviceTypeId(null, {}), null);
  assert.equal(resolveDeviceTypeId(null, null), null);
});
