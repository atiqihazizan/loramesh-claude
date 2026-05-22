// src/map/OrbitDragHandler.jsx
// ----------------------------------------------------------------
// Pengendali seret ORBIT untuk Mod 3D.
//
// Bila Mod 3D on, pan dimatikan (dragPan={!is3D} di MapView).
// Komponen ini gantikan seret kiri dengan ORBIT:
//   - seret kiri/kanan  → ubah bearing (putar, membungkus 360°)
//   - seret atas/bawah  → ubah pitch  (0–85°; atas = condong lebih)
//
// MapLibre dragRotate terbina hanya pada butang kanan — jadi kita
// kendalikan butang kiri & sentuh secara manual di sini.
//
// Diletak sebagai child <Map>. Tiada apa dirender (null).
// ----------------------------------------------------------------

import { useEffect } from 'react';
import { useMap } from 'react-map-gl/maplibre';
import { useMapContext } from './MapContext.jsx';

// Kepekaan — darjah perubahan per piksel seret.
const BEARING_SENSITIVITY = 0.35; // putar
const PITCH_SENSITIVITY = 0.4; // condong
const MIN_PITCH = 0;
const MAX_PITCH = 85;

export default function OrbitDragHandler() {
  const { current: mapInstance } = useMap();
  const { is3D } = useMapContext();

  useEffect(() => {
    if (!mapInstance || !is3D) return;

    const map = mapInstance.getMap ? mapInstance.getMap() : mapInstance;
    const canvas = map.getCanvas();

    // Keadaan seret semasa.
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    // --- Mula seret ---------------------------------------------
    const onPointerDown = (e) => {
      // Butang kiri sahaja (e.button 0). Sentuh: button -1 / 0.
      if (e.button !== undefined && e.button > 0) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.style.cursor = 'grabbing';
    };

    // --- Gerak seret → orbit ------------------------------------
    const onPointerMove = (e) => {
      if (!dragging) return;

      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      // Bearing — seret kanan putar ikut jam. Membungkus 360° sendiri.
      const nextBearing = map.getBearing() + dx * BEARING_SENSITIVITY;

      // Pitch — seret ATAS (dy negatif) → condong LEBIH.
      let nextPitch = map.getPitch() - dy * PITCH_SENSITIVITY;
      nextPitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, nextPitch));

      // Terus tetapkan — tiada animasi, ikut gerakan tangan.
      map.setBearing(nextBearing);
      map.setPitch(nextPitch);
    };

    // --- Tamat seret --------------------------------------------
    const onPointerUp = () => {
      dragging = false;
      canvas.style.cursor = '';
    };

    // Guna pointer events — liputi tetikus + sentuh + pen.
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      canvas.style.cursor = '';
    };
  }, [mapInstance, is3D]);

  return null;
}