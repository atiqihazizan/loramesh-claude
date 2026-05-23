// src/map/MapView.jsx
// ----------------------------------------------------------------
// Full-screen MapLibre map (react-map-gl/maplibre).
//
// Rotate/tilt/pan always enabled — no mode:
//   pan: left drag · rotate/tilt: right drag or two fingers
//   maxPitch: 85
//
// Follow camera: when followMode is ON and a device is selected,
// FollowCamera eases the map to that device on each position
// update. Manual drag is allowed; the next update pulls back.
//
// Reads center/zoom/activeTile from MapContext.
// ----------------------------------------------------------------

import { useMemo, useEffect, useRef } from 'react';
import Map, { useMap } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

import { buildMapStyle } from '../lib/mapStyle.js';
import { getTrackingConfig, isDeviceMoving } from '../lib/trackingConfig.js';
import { useMapContext } from './MapContext.jsx';
import { useDevices } from '../hooks/useDevices.js';
import { useAgencies } from '../hooks/useAgencies.js';
import { useAuthStore } from '../store/authStore.js';
import MapControls from './MapControls.jsx';
import DeviceLayer from './DeviceLayer.jsx';
import FollowToggle from './FollowToggle.jsx';

// Internal — follows the selected device when followMode is ON.
// Lives inside <Map> so it has useMap(). Renders nothing.
function FollowCamera() {
  const { current: mapInstance } = useMap();
  const { followMode, selectedDeviceId, selectedAgencyId } = useMapContext();
  const { devices } = useDevices();
  const { agencies } = useAgencies();
  const userAgency = useAuthStore((s) => s.user?.agency ?? null);

  // Track the last position we eased to — avoid redundant easeTo.
  const lastPos = useRef(null);

  // Resolve the tracking config for the active agency.
  const agency =
    agencies.find((a) => a.id === selectedAgencyId) || userAgency;
  const track = getTrackingConfig(agency);

  // The currently selected device (fresh from the list).
  const device =
    selectedDeviceId != null
      ? devices.find((d) => d.device_id === selectedDeviceId) || null
      : null;

  useEffect(() => {
    if (!mapInstance) return;
    if (!followMode || !device) return;
    // Static devices do not move — never follow them.
    if (device.is_static === true) return;
    if (typeof device.latitude !== 'number') return;
    if (typeof device.longitude !== 'number') return;

    // Skip if position unchanged since last ease.
    const prev = lastPos.current;
    if (
      prev &&
      prev.lat === device.latitude &&
      prev.lng === device.longitude
    ) {
      return;
    }
    lastPos.current = { lat: device.latitude, lng: device.longitude };

    // Zoom depends on whether the device is moving.
    const zoom = isDeviceMoving(device)
      ? track.zoomMoving
      : track.zoomStopped;

    mapInstance.easeTo({
      center: [device.longitude, device.latitude],
      zoom,
      duration: 1000,
    });
  }, [mapInstance, followMode, device, track.zoomMoving, track.zoomStopped]);

  // Reset position tracking when follow turns off or device changes.
  useEffect(() => {
    lastPos.current = null;
  }, [followMode, selectedDeviceId]);

  return null;
}

// Internal — terbangkan peta ke sasaran bila TypeFilter minta.
// Hidup dalam <Map> untuk useMap(). Tidak render apa-apa.
function FlyToController() {
  const { current: mapInstance } = useMap();
  const { flyToTarget } = useMapContext();
  const lastNonce = useRef(null);

  useEffect(() => {
    if (!mapInstance || !flyToTarget) return;
    // Nonce sama → permintaan sama, abaikan.
    if (flyToTarget.nonce === lastNonce.current) return;
    lastNonce.current = flyToTarget.nonce;

    mapInstance.flyTo({
      center: [flyToTarget.lng, flyToTarget.lat],
      zoom: flyToTarget.zoom,
      duration: 1000,
    });
  }, [mapInstance, flyToTarget]);

  return null;
}

export default function MapView() {
  const { center, zoom, activeTile } = useMapContext();

  // initial viewState only — MapLibre manages it after.
  const initialViewState = useMemo(
    () => ({
      longitude: center[0],
      latitude: center[1],
      zoom,
      pitch: 0,
      bearing: 0,
    }),
    [center, zoom],
  );

  const mapStyle = useMemo(() => buildMapStyle(activeTile), [activeTile]);

  if (!mapStyle) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-100">
        <p className="text-slate-500">Preparing map…</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <Map
        initialViewState={initialViewState}
        mapStyle={mapStyle}
        maxPitch={85}
        dragRotate
        pitchWithRotate
        touchZoomRotate
        attributionControl={{ compact: true }}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Device markers — selected agency */}
        <DeviceLayer />

        {/* Follow camera — eases to selected device */}
        <FollowCamera />

        {/* Fly-to — TypeFilter node tap */}
        <FlyToController />

        {/* Zoom controls — bottom right */}
        <MapControls />
      </Map>

      {/* Follow toggle — atas canvas, sejajar dengan kawalan zoom */}
      <FollowToggle />
    </div>
  );
}
