// src/map/DeviceLayer.jsx
// ----------------------------------------------------------------
// Lapisan device — render marker + popup.
//
// Tingkah laku ikut flag KEEP_POPUP_OPEN (dari DevicePopup.jsx):
//
//   true  — SETIAP marker ada popup kekal. Mula minimize.
//           Klik popup → maximize ↔ minimize (per-device).
//           maximizedId menjejak device mana sedang maximize.
//
//   false — Tiada popup sehingga marker diklik. Klik marker →
//           popup maximize untuk device itu. Klik marker lain →
//           pindah. Klik butang tutup → tiada popup.
//
// Diletak sebagai child <Map> dalam MapView.
// ----------------------------------------------------------------

import { useState, useCallback } from 'react';
import { useDevices } from '../hooks/useDevices.js';
import DeviceMarker from './DeviceMarker.jsx';
import DevicePopup, { KEEP_POPUP_OPEN } from './DevicePopup.jsx';

export default function DeviceLayer() {
  const { devices } = useDevices();

  // flag true  : device_id yang sedang MAXIMIZE (selain itu minimize).
  // flag false : device_id yang popupnya terbuka (selain itu tiada).
  const [activeId, setActiveId] = useState(null);

  // Klik marker.
  const handleMarkerClick = useCallback(
    (device) => {
      if (KEEP_POPUP_OPEN) {
        // Popup sudah kekal — klik marker pun maximize/minimize.
        setActiveId((cur) =>
          cur === device.device_id ? null : device.device_id,
        );
      } else {
        // Tiada popup — klik marker buka maximize device ini.
        setActiveId(device.device_id);
      }
    },
    [],
  );

  // Klik popup minimize → maximize (atau sebaliknya).
  const handleToggle = useCallback((deviceId) => {
    setActiveId((cur) => (cur === deviceId ? null : deviceId));
  }, []);

  // Tutup popup (flag false sahaja).
  const handleClose = useCallback(() => {
    setActiveId(null);
  }, []);

  return (
    <>
      {devices.map((device) => {
        const id = device.device_id;
        const isActive = id === activeId;

        // Tentukan sama ada popup device ini patut dirender.
        // flag true  : semua marker ada popup (sentiasa).
        // flag false : hanya device aktif ada popup.
        const showPopup = KEEP_POPUP_OPEN || isActive;

        return (
          <div key={id}>
            <DeviceMarker
              device={device}
              isSelected={isActive}
              onClick={handleMarkerClick}
            />
            {showPopup && (
              <DevicePopup
                device={device}
                // flag true  : maximize bila device ini aktif.
                // flag false : popup yang dirender memang maximize.
                isMaximized={KEEP_POPUP_OPEN ? isActive : true}
                onToggle={() => handleToggle(id)}
                onClose={handleClose}
              />
            )}
          </div>
        );
      })}
    </>
  );
}