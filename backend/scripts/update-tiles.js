// scripts/update-tiles.js
// ----------------------------------------------------------------
// Kemas kini jadual `tiles` supaya selari reka bentuk frontend baru:
//   - Roadmap  → OpenFreeMap Liberty (style JSON vektor — 3D buildings)
//   - Satelit  → Esri World Imagery  (raster XYZ — gambar udara)
//   - Terrain  → OpenFreeMap Liberty (style JSON vektor — relief 3D
//                dihidupkan di frontend)
//
// Sebab perlu skrip ini:
//   Data legacy bagi tile raster Google + OSM. Tile raster TIDAK
//   boleh buat bangunan 3D, dan URL Google langgar terma Google.
//   Skrip ini gantikan dengan sumber TANPA-KEY yang sah dan percuma.
//
// Nota teknikal:
//   - `tiles.name` BUKAN @unique dalam skema → tak boleh guna upsert.
//     Skrip cari ikut `name` (findFirst) → update atau create.
//   - Baris lama `OSRM` (peta jalan OSM kedua, bertindih dengan
//     Roadmap) DIPADAM — digantikan konsep `Terrain`.
//   - Pengesanan jenis di frontend: URL ada `{z}` → raster XYZ;
//     tiada `{z}` → style JSON MapLibre.
//
// Guna:
//   node scripts/update-tiles.js --dry-run   # tunjuk je, tiada tulis
//   node scripts/update-tiles.js             # laksana sebenar
// ----------------------------------------------------------------

import prisma from '../lib/prisma.js';

const DRY_RUN = process.argv.includes('--dry-run');

// ---- Sasaran data tiles selepas kemas kini --------------------
// theme: 'light' | 'dark' — frontend guna untuk warna UI atas peta.
const TARGET_TILES = [
  {
    name: 'Roadmap',
    theme: 'light',
    // Style JSON vektor — tiada {z}/{x}/{y} → frontend kesan sebagai style.
    url: 'https://tiles.openfreemap.org/styles/liberty',
    icon: 'map',
  },
  {
    name: 'Satelit',
    theme: 'dark',
    // Raster XYZ Esri — PERHATIAN corak {z}/{y}/{x} (baris dahulu, lajur kemudian).
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    icon: 'satellite',
  },
  {
    name: 'Terrain',
    theme: 'light',
    // Style vektor sama seperti Roadmap; "rasa terrain" datang dari
    // relief 3D (DEM) yang dihidupkan di frontend, bukan style berbeza.
    url: 'https://tiles.openfreemap.org/styles/liberty',
    icon: 'mountain',
  },
];

// Baris lama yang perlu dibuang (digantikan oleh Terrain).
const TILES_TO_REMOVE = ['OSRM'];

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  Kemas kini jadual tiles');
  console.log(DRY_RUN ? '  MODE: DRY RUN (tiada tulis)' : '  MODE: LIVE');
  console.log('═══════════════════════════════════════════════\n');

  // ---- Tunjuk keadaan semasa ----------------------------------
  const before = await prisma.tiles.findMany({ orderBy: { id: 'asc' } });
  console.log(`[tiles] Keadaan semasa — ${before.length} baris:`);
  for (const t of before) {
    console.log(`  #${t.id}  ${t.name.padEnd(10)} theme=${t.theme.padEnd(6)} ${t.url}`);
  }
  console.log('');

  // ---- Padam baris lapuk (OSRM) -------------------------------
  for (const name of TILES_TO_REMOVE) {
    const rows = await prisma.tiles.findMany({ where: { name } });
    for (const row of rows) {
      if (DRY_RUN) {
        console.log(`[tiles] (dry-run) AKAN PADAM  #${row.id} ${row.name}`);
      } else {
        await prisma.tiles.delete({ where: { id: row.id } });
        console.log(`[tiles] ✓ PADAM         #${row.id} ${row.name}`);
      }
    }
  }

  // ---- Update / Create setiap tile sasaran --------------------
  for (const tile of TARGET_TILES) {
    // name bukan unik → cari manual.
    const existing = await prisma.tiles.findFirst({ where: { name: tile.name } });

    if (existing) {
      if (DRY_RUN) {
        console.log(`[tiles] (dry-run) AKAN UPDATE #${existing.id} ${tile.name}`);
        console.log(`                  url   → ${tile.url}`);
        console.log(`                  theme → ${tile.theme}`);
      } else {
        await prisma.tiles.update({
          where: { id: existing.id },
          data: { url: tile.url, theme: tile.theme, icon: tile.icon },
        });
        console.log(`[tiles] ✓ UPDATE        #${existing.id} ${tile.name}`);
      }
    } else {
      if (DRY_RUN) {
        console.log(`[tiles] (dry-run) AKAN CREATE ${tile.name}`);
        console.log(`                  url   → ${tile.url}`);
        console.log(`                  theme → ${tile.theme}`);
      } else {
        const created = await prisma.tiles.create({
          data: {
            name: tile.name,
            url: tile.url,
            theme: tile.theme,
            icon: tile.icon,
          },
        });
        console.log(`[tiles] ✓ CREATE        #${created.id} ${tile.name}`);
      }
    }
  }

  // ---- Tunjuk keadaan akhir (hanya bila live) -----------------
  if (!DRY_RUN) {
    const after = await prisma.tiles.findMany({ orderBy: { id: 'asc' } });
    console.log(`\n[tiles] Keadaan akhir — ${after.length} baris:`);
    for (const t of after) {
      console.log(`  #${t.id}  ${t.name.padEnd(10)} theme=${t.theme.padEnd(6)} ${t.url}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log(DRY_RUN ? '  DRY RUN selesai — tiada data ditulis' : '  Kemas kini selesai');
  console.log('═══════════════════════════════════════════════\n');

  if (DRY_RUN) {
    console.log('Jalankan tanpa --dry-run untuk laksana sebenar:');
    console.log('  node scripts/update-tiles.js\n');
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('[tiles] ❌ Gagal:', e);
    await prisma.$disconnect();
    process.exit(1);
  });