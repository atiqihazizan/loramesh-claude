import test from 'node:test';
import assert from 'node:assert/strict';
import { pickPresent, KEEP_LAST_KEYS } from './present-fields.js';

test('medan null/undefined diabaikan', () => {
  const r = pickPresent({ speed: null, cpu_temp: undefined, sensor_data: ['1'] }, KEEP_LAST_KEYS);
  assert.deepEqual(r, { sensor_data: ['1'] });
});

test('nilai sifar dan false kekal (bukan "tiada")', () => {
  const r = pickPresent({ speed: 0, cpu_temp: 0, sensor_data: [] }, KEEP_LAST_KEYS);
  assert.deepEqual(r, { speed: 0, cpu_temp: 0, sensor_data: [] });
});

test('medan di luar senarai kunci tidak diambil', () => {
  assert.deepEqual(pickPresent({ speed: 5, heading: 90 }, ['speed']), { speed: 5 });
});

test('objek kosong/null selamat', () => {
  assert.deepEqual(pickPresent(null, KEEP_LAST_KEYS), {});
  assert.deepEqual(pickPresent({}, KEEP_LAST_KEYS), {});
});
