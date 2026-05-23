// src/map/DeviceLayer.jsx
// ----------------------------------------------------------------
// Lapisan device — marker + popup minimize.
//
// Child <Map> dalam MapView — hanya elemen peta (Marker/Popup).
// TypeFilter (butang terapung) BUKAN di sini — ia overlay,
// dirender oleh MapLayout.
//
// Tanggungjawab:
//   - Render marker (DeviceMarker) untuk device yang lulus penapis.
//   - Render popup minimize (DevicePopup) ikut flag KEEP_POPUP_OPEN.
//   - Klik marker/popup → setSelectedDeviceId (context) → panel
//     detail kanan-atas terbuka.
//
// Penapis type dibaca dari MapContext (hiddenTypeCodes) — ditulis
// oleh TypeFilter.
//
// NOTA: DeviceMarker/DevicePopup membungkus <Marker>/<Popup> dari
// react-map-gl, yang mesti jadi anak terus <Map>. Jangan bungkus
// dalam <div> — guna Fragment dengan key.
// ----------------------------------------------------------------

import { Fragment, useCallback, useMemo } from 'react';
import { useDevices } from '../hooks/useDevices.js';
import { useMapContext } from './MapContext.jsx';
import DeviceMarker from './DeviceMarker.jsx';
import DevicePopup, { KEEP_POPUP_OPEN } from './DevicePopup.jsx';

// Kunci type bagi satu device — selaras dengan TypeFilter.
// Medan dari /api/devices bernama `type` (bukan device_type).
function typeCodeOf(device) {
  return device.type?.code || device.data_type || '__none__';
}

export default function DeviceLayer() {
  const { devices } = useDevices();
  const { setSelectedDeviceId, selectedDeviceId, hiddenTypeCodes } =
    useMapContext();

  // Klik marker / popup → buka panel detail.
  const handleSelect = useCallback(
    (device) => {
      setSelectedDeviceId(device.device_id);
    },
    [setSelectedDeviceId],
  );

  // Device yang lulus penapis type; yang dipilih di-render last (atas stack).
  const visibleDevices = useMemo(() => {
    const list = devices.filter(
      (d) => !hiddenTypeCodes.has(typeCodeOf(d)),
    );
    if (selectedDeviceId == null) return list;
    const idx = list.findIndex((d) => d.device_id === selectedDeviceId);
    if (idx < 0) return list;
    const selected = list[idx];
    return [...list.slice(0, idx), ...list.slice(idx + 1), selected];
  }, [devices, hiddenTypeCodes, selectedDeviceId]);

  return (
    <>
      {visibleDevices.map((device) => (
        <Fragment key={device.device_id}>
          <DeviceMarker
            device={device}
            isSelected={device.device_id === selectedDeviceId}
            onClick={handleSelect}
          />
          {/* Popup minimize — kekal jika flag true */}
          {KEEP_POPUP_OPEN && (
            <DevicePopup
              device={device}
              onClick={() => handleSelect(device)}
            />
          )}
        </Fragment>
      ))}
    </>
  );
}
