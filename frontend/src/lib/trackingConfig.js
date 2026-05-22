// src/lib/trackingConfig.js
// ----------------------------------------------------------------
// Tracking config for follow camera.
//
// Each agency carries tracking fields:
//   tracking_zoom_moving   — zoom when the device is moving
//   tracking_zoom_stopped  — zoom when the device is stopped
//   tracking_stop_radius_m — metres of movement to count as "moving"
//
// Defaults match the backend agency schema defaults.
// ----------------------------------------------------------------

export const TRACKING_DEFAULTS = {
  zoomMoving: 17,
  zoomStopped: 15,
  stopRadiusM: 10,
};

/**
 * Pull tracking config from an agency object (from /api/agencies
 * or user.agency). Falls back to defaults for any missing field.
 *
 * @param {object|null|undefined} agency
 * @returns {{zoomMoving:number, zoomStopped:number, stopRadiusM:number}}
 */
export function getTrackingConfig(agency) {
  if (!agency) return { ...TRACKING_DEFAULTS };
  return {
    zoomMoving:
      typeof agency.tracking_zoom_moving === 'number'
        ? agency.tracking_zoom_moving
        : TRACKING_DEFAULTS.zoomMoving,
    zoomStopped:
      typeof agency.tracking_zoom_stopped === 'number'
        ? agency.tracking_zoom_stopped
        : TRACKING_DEFAULTS.zoomStopped,
    stopRadiusM:
      typeof agency.tracking_stop_radius_m === 'number'
        ? agency.tracking_stop_radius_m
        : TRACKING_DEFAULTS.stopRadiusM,
  };
}

/**
 * Decide if a device counts as "moving" from its telemetry.
 * Moving if speed > 0 (simple, reliable signal from device:update).
 *
 * @param {object} device
 * @returns {boolean}
 */
export function isDeviceMoving(device) {
  return typeof device?.speed === 'number' && device.speed > 0;
}
