// Pengesahan peta register per-device (devices.sensor_unit).
// Format entri sama dengan frontend/src/lib/sensorDecode.js.
// Unit/julat datang daripada master_sensor melalui sensor_id — tidak disimpan di sini.

const MAX_ENTRIES = 64;
const MAX_REGISTERS = 256;
const SCALES = [1, 0.1, 0.01, 0.001];
const TYPES = ['int16', 'float32', 'skip'];

function fail(message) {
  const err = new Error(`sensor_unit: ${message}`);
  err.status = 400;
  return err;
}

const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

function span(entry) {
  return entry.type === 'float32' ? 2 : 1;
}

/**
 * Sahkan & normalkan peta.
 * @param {unknown} input        badan permintaan (null = kosongkan peta)
 * @param {Set<number>} masterIds id master_sensor yang wujud
 * @returns {Array<object>|null}  peta bersih, disusun ikut idx; null jika dikosongkan
 * @throws  Error dengan status 400
 */
export function validateSensorMap(input, masterIds) {
  if (input === null) return null;
  if (!Array.isArray(input)) throw fail('mesti array atau null');
  if (input.length === 0) return null;
  if (input.length > MAX_ENTRIES) throw fail(`maksimum ${MAX_ENTRIES} entri`);

  const keys = new Set();
  const out = input.map((raw, i) => {
    const at = `entri ${i + 1}`;
    if (!raw || typeof raw !== 'object') throw fail(`${at} tidak sah`);
    if (!TYPES.includes(raw.type)) throw fail(`${at}: type mesti ${TYPES.join('/')}`);
    if (!isInt(raw.idx, 0, MAX_REGISTERS - 1)) throw fail(`${at}: idx mesti nombor bulat 0–${MAX_REGISTERS - 1}`);

    if (raw.type === 'skip') return { key: `skip_${raw.idx}`, type: 'skip', idx: raw.idx };

    const key = typeof raw.key === 'string' ? raw.key.trim() : '';
    if (!/^[A-Za-z0-9_]{1,50}$/.test(key)) throw fail(`${at}: key mesti huruf/nombor/_ (maks 50)`);
    if (keys.has(key)) throw fail(`${at}: key "${key}" berulang`);
    keys.add(key);

    const label = typeof raw.label === 'string' ? raw.label.trim() : '';
    if (label.length < 1 || label.length > 100) throw fail(`${at}: label wajib (maks 100 aksara)`);

    if (!isInt(raw.sensor_id, 1, Number.MAX_SAFE_INTEGER) || !masterIds.has(raw.sensor_id)) {
      throw fail(`${at}: sensor_id tiada dalam master_sensor`);
    }

    const dp = raw.dp ?? 2;
    if (!isInt(dp, 0, 6)) throw fail(`${at}: dp mesti 0–6`);

    const entry = { key, label, sensor_id: raw.sensor_id, idx: raw.idx, type: raw.type, dp };
    if (raw.type === 'int16') {
      const scale = raw.scale ?? 1;
      if (!SCALES.includes(scale)) throw fail(`${at}: scale mesti salah satu ${SCALES.join(', ')}`);
      entry.scale = scale;
    } else {
      entry.wordSwap = raw.wordSwap === true;
    }
    return entry;
  });

  out.sort((a, b) => a.idx - b.idx);

  // Setiap register 0..akhir mesti dilindungi tepat sekali (guna "skip" untuk yang tidak dipakai),
  // supaya panjang peta sepadan dengan panjang data (pengawal panjang di sensorDecode.js).
  let next = 0;
  for (const e of out) {
    if (e.idx < next) throw fail(`register ${e.idx} bertindih`);
    if (e.idx > next) throw fail(`register ${next} tidak dipetakan (tambah "skip" jika tidak digunakan)`);
    next = e.idx + span(e);
  }
  if (next > MAX_REGISTERS) throw fail('melebihi bilangan register');
  return out;
}
