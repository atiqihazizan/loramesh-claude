import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSensorMap } from './sensor-map.js';

const IDS = new Set([11, 12, 28]);
const e = (o) => ({ key: 'a', label: 'A', sensor_id: 11, idx: 0, type: 'int16', ...o });

test('null / array kosong → null (kosongkan peta)', () => {
  assert.equal(validateSensorMap(null, IDS), null);
  assert.equal(validateSensorMap([], IDS), null);
});

test('peta sah dinormalkan, unit dibuang, disusun ikut idx', () => {
  const out = validateSensorMap(
    [
      e({ key: 'ph', label: 'pH', sensor_id: 12, idx: 1, type: 'float32', wordSwap: true, unit: 'x' }),
      e({ scale: 0.1, dp: 1 }),
      { type: 'skip', idx: 3 },
    ],
    IDS
  );
  assert.deepEqual(out, [
    { key: 'a', label: 'A', sensor_id: 11, idx: 0, type: 'int16', dp: 1, scale: 0.1 },
    { key: 'ph', label: 'pH', sensor_id: 12, idx: 1, type: 'float32', dp: 2, wordSwap: true },
    { key: 'skip_3', type: 'skip', idx: 3 },
  ]);
});

const bad = (input, re) => assert.throws(() => validateSensorMap(input, IDS), re);

test('menolak input tidak sah', () => {
  bad('x', /array/);
  bad([e({ sensor_id: 999 })], /master_sensor/);
  bad([e({ sensor_id: undefined })], /master_sensor/);
  bad([e({ type: 'int32' })], /type/);
  bad([e({ idx: 1.5 })], /idx/);
  bad([e({ idx: -1 })], /idx/);
  bad([e({ scale: 7 })], /scale/);
  bad([e({ dp: 9 })], /dp/);
  bad([e({ label: '' })], /label/);
  bad([e({ key: 'a b' })], /key/);
  bad([e(), e({ idx: 1 })], /berulang/);
});

test('menolak bertindih dan celah register', () => {
  bad([e({ key: 'f', type: 'float32', sensor_id: 12 }), e({ key: 'b', idx: 1 })], /bertindih/);
  bad([e(), e({ key: 'b', idx: 2 })], /tidak dipetakan/);
  bad([e({ idx: 1 })], /tidak dipetakan/);
});

test('ralat membawa status 400', () => {
  try {
    validateSensorMap('x', IDS);
    assert.fail('patut baling');
  } catch (err) {
    assert.equal(err.status, 400);
  }
});
