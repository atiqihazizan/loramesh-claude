// src/map/FollowToggle.jsx
// ----------------------------------------------------------------
// Follow-camera toggle button — floating, bottom-right above zoom.
//
//   - Disabled (grey) when no device is selected, OR when the
//     selected device is STATIC (is_static: true). Follow only
//     makes sense for dynamic (moving) devices.
//   - Selecting a dynamic device → button enabled, follow can stay
//     active. Selecting a static device → button disabled.
//   - When enabled and ON, the map follows the selected device's
//     position on each socket update (logic in MapView).
// ----------------------------------------------------------------

import { useEffect } from 'react';
import { Crosshair } from 'lucide-react';
import { useMapContext } from './MapContext.jsx';
import { useDevices } from '../hooks/useDevices.js';

export default function FollowToggle() {
  const { followMode, setFollowMode, selectedDeviceId, setDetailPanelMinimized } =
    useMapContext();
  const { devices } = useDevices();

  // Selected device — to check is_static.
  const device =
    selectedDeviceId != null
      ? devices.find((d) => d.device_id === selectedDeviceId) || null
      : null;

  const isStatic = device?.is_static === true;

  // Disabled: no device selected, OR selected device is static.
  const disabled = device == null || isStatic;

  // If follow is ON but the selected device becomes static (or
  // selection cleared), turn follow off — it cannot apply.
  useEffect(() => {
    if (followMode && disabled) {
      setFollowMode(false);
    }
  }, [followMode, disabled, setFollowMode]);

  const handleClick = () => {
    if (disabled) return;
    const next = !followMode;
    setFollowMode(next);
    if (next) setDetailPanelMinimized(true);
  };

  const title =
    device == null
      ? 'Select a device to follow'
      : isStatic
        ? 'Follow unavailable — device is static'
        : followMode
          ? 'Follow camera: ON'
          : 'Follow camera: OFF';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={title}
      className={
        'absolute bottom-[9.5rem] right-3 z-20 flex h-7 w-7 items-center ' +
        'justify-center rounded-lg shadow-lg ring-1 transition-colors ' +
        (disabled
          ? 'cursor-not-allowed bg-white/70 text-slate-300 ring-slate-200'
          : followMode
            ? 'bg-blue-600 text-white ring-blue-600'
            : 'bg-white/95 text-slate-600 ring-slate-200 backdrop-blur hover:bg-slate-100')
      }
    >
      <Crosshair size={16} strokeWidth={2} />
    </button>
  );
}
