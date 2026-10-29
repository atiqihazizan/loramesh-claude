import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeDevicePatchIntoList } from './mergeDevicePatch.js';

const list = () => [
  { device_id: 'A', latitude: 2.7, longitude: 102.9, status: 'offline', sensor_data: { t: 1 } },
  { device_id: 'B', latitude: 1, longitude: 2, status: 'online' },
];

test('status, send_dt dan sensor_data dikemas kini untuk node static', () => {
  const out = mergeDevicePatchIntoList(list(), {
    device_id: 'A', status: 'online', send_dt: '2026-10-29T00:00:00Z', sensor_data: { t: 2 },
  });
  assert.equal(out[0].status, 'online');
  assert.equal(out[0].send_dt, '2026-10-29T00:00:00Z');
  assert.deepEqual(out[0].sensor_data, { t: 2 });
  assert.deepEqual(out[1], list()[1]); // B tidak disentuh
});

test('latitude/longitude null tidak memadam koordinat sedia ada', () => {
  const out = mergeDevicePatchIntoList(list(), {
    device_id: 'A', latitude: null, longitude: null, sensor_data: null, status: 'online',
  });
  assert.equal(out[0].latitude, 2.7);
  assert.equal(out[0].longitude, 102.9);
  assert.deepEqual(out[0].sensor_data, { t: 1 });
  assert.equal(out[0].status, 'online');
});

test('device tiada dalam senarai → rujukan asal dikembalikan', () => {
  const l = list();
  assert.equal(mergeDevicePatchIntoList(l, { device_id: 'Z', status: 'online' }), l);
});

test('input bukan array → dikembalikan seadanya', () => {
  assert.equal(mergeDevicePatchIntoList(undefined, { device_id: 'A' }), undefined);
});
