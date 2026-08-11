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
  LifeBuoy,
  Anchor,
  Waves,
  Fish,
  Sailboat,
  Flag,
  FlagTriangleRight,
  Droplets,
  GlassWater,
  FlaskConical,
  TestTubes,
  Wind,
  CloudDrizzle,
  Thermometer,
  Snowflake,
  Sprout,
  Leaf,
  Gauge,
  Zap,
  Battery,
  Compass,
  Signal,
  Satellite,
  Scale,
  Microscope,
  Dock,
} from 'lucide-react';

/** @type {Record<string, import('lucide-react').LucideIcon>} */
const BY_PASCAL = {
  // Existing
  MapPin,
  Network,
  Car,
  Radio,
  Fuel,
  CloudSun,
  CloudRain,
  RadioTower,
  Smartphone,
  // Marin / Buoy
  LifeBuoy,
  Anchor,
  Waves,
  Fish,
  Sailboat,
  Flag,
  FlagTriangleRight,
  Dock,
  // Kualiti Air
  Droplets,
  GlassWater,
  FlaskConical,
  TestTubes,
  // Cuaca / Udara
  Wind,
  CloudDrizzle,
  Thermometer,
  Snowflake,
  // Pertanian / Tanah
  Sprout,
  Leaf,
  // Tekanan / Paras / Kuasa
  Gauge,
  Zap,
  Battery,
  // Navigasi / Telemetri
  Compass,
  Signal,
  Satellite,
  // Timbang / Analisis
  Scale,
  Microscope,
};

export const DEVICE_TYPE_ICONS = Object.keys(BY_PASCAL);

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