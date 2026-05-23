// Ikon Lucide untuk device_type.icon (DB) — import named sahaja, jangan import *.

import {
  MapPin,
  Network,
  Car,
  Radio,
  Fuel,
  CloudSun,
  CloudRain,
  RadioTower,
  Smartphone,
} from 'lucide-react';

/** @type {Record<string, import('lucide-react').LucideIcon>} */
const BY_PASCAL = {
  MapPin,
  Network,
  Car,
  Radio,
  Fuel,
  CloudSun,
  CloudRain,
  RadioTower,
  Smartphone,
};

/**
 * @param {string | null | undefined} iconName
 * @returns {import('lucide-react').LucideIcon}
 */
export function resolveDeviceTypeIcon(iconName) {
  if (!iconName) return MapPin;
  const pascal = iconName
    .split(/[-_\s]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  return BY_PASCAL[pascal] || MapPin;
}
