# URL Device Focus — MapPage

**Tarikh:** 2026-06-16 00:15 (UTC+8)

## Tujuan
Baca URL parameter `?device=XXX` pada halaman peta dan auto-focus (pilih + terbang) ke device tersebut seperti fungsi klik pada senarai device.

## Fail Diubah

### `frontend/src/pages/MapPage.jsx`
- Tambah import: `useEffect`, `useRef` (react), `useSearchParams` (react-router-dom), `useDevices`
- Tambah `useEffect` — baca `?device=XXX` dari URL, cari device dalam senarai, panggil `setSelectedDeviceId` + `flyTo`
- `useRef(didFocus)` — auto-focus hanya sekali sahaja, tidak berulang semasa socket update

## Aliran
```
URL: /?device=ABC123
  → cari device dalam senarai
  → jumpa → setSelectedDeviceId + flyTo(lng, lat, 19)
  → panel detail terbuka + peta zoom ke device
  → tidak jumpa → skip (tiada action)
```

## Fail Backup
`backup/2026-06-16/MapPage copy.jsx1.bak`
