// Tukar sensor_data mentah (array register Modbus) kepada nilai berlabel
// ikut peta register per-device (devices.sensor_unit).
//
// Entri peta:
//   { key, label, unit?, idx, type: 'int16' | 'float32', scale?, wordSwap?, dp?, sensor_id? }
//   - int16   : nilai = register[idx] * scale   (scale 0.1 = "/10", 0.01 = "/100")
//   - float32 : IEEE754 daripada register[idx], register[idx+1]
//               wordSwap=true → register pertama = low word, kedua = high word
//   - dp      : bilangan tempat perpuluhan paparan

function toReg(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 0xffff ? n : null;
}

function float32(first, second, wordSwap) {
  const hi = wordSwap ? second : first;
  const lo = wordSwap ? first : second;
  const view = new DataView(new ArrayBuffer(4));
  view.setUint16(0, hi);
  view.setUint16(2, lo);
  return view.getFloat32(0);
}

function decodeOne(raw, entry) {
  const idx = entry.idx;
  if (entry.type === 'float32') {
    const a = toReg(raw[idx]);
    const b = toReg(raw[idx + 1]);
    if (a === null || b === null) return null;
    const v = float32(a, b, entry.wordSwap === true);
    return Number.isFinite(v) ? v : null;
  }
  const r = toReg(raw[idx]);
  if (r === null) return null;
  return r * (entry.scale ?? 1);
}

/**
 * @param {Array<string|number>} raw  sensor_data mentah
 * @param {Array<object>} map         devices.sensor_unit
 * @returns {Array<{key,label,unit,value,text}>|null}  null jika tiada peta/data
 */
export function decodeSensors(raw, map) {
  if (!Array.isArray(raw) || !Array.isArray(map) || map.length === 0) return null;
  return map.map((entry) => {
    const value = decodeOne(raw, entry);
    const text = value === null ? '—' : value.toFixed(entry.dp ?? 2);
    return {
      key: entry.key,
      label: entry.label ?? entry.key,
      unit: entry.unit ?? '',
      value,
      text,
    };
  });
}
