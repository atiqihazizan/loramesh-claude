import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeSensors } from './sensorDecode.js';

// Peta POC (suhu UV254 guna /100 — belum disahkan pengguna)
const MAP = [
  { key: 'turbidity', label: 'Turbidity', unit: 'NTU', idx: 0, type: 'int16', scale: 0.1, dp: 1 },
  { key: 'cod', label: 'COD', idx: 1, type: 'int16', scale: 0.1, dp: 1 },
  { key: 'temp', label: 'Suhu', unit: '°C', idx: 2, type: 'int16', scale: 0.01, dp: 2 },
  { key: 'ph', label: 'pH', idx: 3, type: 'float32', wordSwap: true, dp: 2 },
  { key: 'ss_turb', label: 'SS Turbidity', idx: 5, type: 'float32', wordSwap: true, dp: 2 },
  { key: 'ss_temp', label: 'SS Suhu', unit: '°C', idx: 7, type: 'float32', wordSwap: true, dp: 2 },
  { key: 'nh4', label: 'NH4+', idx: 9, type: 'float32', wordSwap: true, dp: 2 },
  { key: 'do', label: 'DO', idx: 11, type: 'int16', scale: 0.01, dp: 2 },
  { key: 'oiw', label: 'OIW', idx: 12, type: 'int16', scale: 0.01, dp: 2 },
];

// Mesej sebenar 88880014 (log_mqtt 2026-10-29 09:54)
const RAW = ['402', '207', '2971', '47186', '16642', '46490', '17737', '7921', '16906', '0', '0', '720', '3737', ''];

test('nyahkod mesej sebenar 88880014', () => {
  const out = Object.fromEntries(decodeSensors(RAW, MAP).map((s) => [s.key, s.text]));
  assert.deepEqual(out, {
    turbidity: '40.2', cod: '20.7', temp: '29.71', ph: '8.17',
    ss_turb: '3227.35', ss_temp: '34.53', nh4: '0.00', do: '7.20', oiw: '37.37',
  });
});

test('contoh pengguna: 36536,17737 swap → 3224.92', () => {
  const r = decodeSensors(['36536', '17737'], [{ key: 'x', idx: 0, type: 'float32', wordSwap: true }]);
  assert.equal(r[0].text, '3224.92');
});

test('tanpa wordSwap susunan dibaca terus (high word dahulu)', () => {
  const r = decodeSensors(['17737', '36536'], [{ key: 'x', idx: 0, type: 'float32' }]);
  assert.equal(r[0].text, '3224.92');
});

test('nilai tidak sah (cth -1) dalam susunan sepadan → null, paparan —', () => {
  const m = [{ key: 'a', idx: 0, type: 'int16' }, { key: 'y', idx: 1, type: 'float32' }];
  const r = decodeSensors(['5', '-1', '-1'], m);
  assert.equal(r[0].text, '5.00');
  assert.equal(r[1].value, null);
  assert.equal(r[1].text, '—');
});

test('susunan lama lebih pendek (4 dan 6 elemen) ditolak, bukan dinyahkod palsu', () => {
  assert.equal(decodeSensors(['3840', '46490', '17737', '64365'], MAP), null);
  assert.equal(decodeSensors(['3840', '46490', '17737', '64365', '16903', ''], MAP), null);
});

test('susunan lebih panjang daripada peta ditolak', () => {
  assert.equal(decodeSensors([...RAW.slice(0, 13), '1', ''], MAP), null);
});

test('elemen kosong di hujung diabaikan (13 atau 14 elemen sama sahaja)', () => {
  const a = decodeSensors(RAW, MAP);
  const b = decodeSensors(RAW.slice(0, 13), MAP);
  const c = decodeSensors([...RAW, ''], MAP);
  assert.deepEqual(b, a);
  assert.deepEqual(c, a);
});

test('tiada peta atau data → null (jatuh balik ke paparan mentah)', () => {
  assert.equal(decodeSensors(RAW, null), null);
  assert.equal(decodeSensors(RAW, []), null);
  assert.equal(decodeSensors(null, MAP), null);
});
