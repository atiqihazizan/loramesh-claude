// scripts/migrate-from-legacy.js
// Migrate data dari DB lama (loraDB) ke DB baru (lora_claude).
// Migrate: agency, level, users, user_agency, devices, device_agency,
//          device_type, master_sensor, sites, tiles, config.
// TIDAK migrate: playback data (start kosong), logs.
//
// Guna: node scripts/migrate-from-legacy.js
//   --dry-run  : tunjuk je, jangan tulis

import 'dotenv/config';
import mysql from 'mysql2/promise';
import prisma from '../lib/prisma.js';

const DRY_RUN = process.argv.includes('--dry-run');
const LEGACY_URL = process.env.LEGACY_DATABASE_URL;

if (!LEGACY_URL) {
  console.error('❌ LEGACY_DATABASE_URL tiada dalam .env');
  process.exit(1);
}

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  Migrate dari Legacy DB');
  console.log(DRY_RUN ? '  MODE: DRY RUN (tiada tulis)' : '  MODE: LIVE');
  console.log('═══════════════════════════════════════════════\n');

  const legacy = await mysql.createConnection(LEGACY_URL);
  console.log('[migrate] ✓ Sambung ke legacy DB\n');

  // ----- LEVEL (pastikan wujud — biasanya seed dah buat) -----
  const [levels] = await legacy.query('SELECT * FROM level');
  console.log(`[migrate] Levels: ${levels.length}`);
  const levelIdMap = {};
  for (const l of levels) {
    if (DRY_RUN) continue;
    const created = await prisma.level.upsert({
      where: { code: l.code },
      update: { name: l.name },
      create: {
        code: l.code,
        name: l.name,
        rank: l.code === 'SUPERADMIN' ? 100
            : l.code === 'ADMIN_AGENCY' ? 50
            : l.code === 'USER_AGENCY' ? 10 : 1,
      },
    });
    levelIdMap[l.id] = created.id;
  }

  // ----- AGENCY -----
  const [agencies] = await legacy.query('SELECT * FROM agency');
  console.log(`[migrate] Agencies: ${agencies.length}`);
  const agencyIdMap = {}; // old id → new id
  for (const a of agencies) {
    if (DRY_RUN) { console.log(`  - ${a.code} (${a.name})`); continue; }
    const created = await prisma.agency.upsert({
      where: { code: a.code },
      update: { name: a.name, agency_token: a.agency_token, status: !!a.status },
      create: {
        name: a.name,
        code: a.code,
        agency_token: a.agency_token,
        status: !!a.status,
        // Default map settings (KL) — boleh admin ubah kemudian
        default_map_center: '3.1390,101.6869',
        default_map_zoom: 13,
        default_tile_provider: 'osm',
        tracking_zoom_moving: 17,
        tracking_zoom_stopped: 15,
        tracking_stop_radius_m: 10,
      },
    });
    agencyIdMap[a.id] = created.id;
  }

  // ----- DEVICE TYPE -----
  const [types] = await legacy.query('SELECT * FROM device_type');
  console.log(`[migrate] Device types: ${types.length}`);
  const typeIdMap = {};
  for (const t of types) {
    if (DRY_RUN) continue;
    const existing = await prisma.device_type.findUnique({ where: { code: t.code } });
    let created;
    if (existing) {
      created = existing;
    } else {
      created = await prisma.device_type.create({
        data: { name: t.name, code: t.code, icon: t.icon, color_code: t.color_code },
      });
    }
    typeIdMap[t.id] = created.id;
  }
  // Pastikan GW + MG wujud (legacy mungkin takda)
  if (!DRY_RUN) {
    for (const extra of [
      { name: 'Gateway', code: 'GW', icon: 'RadioTower', color_code: '#795548' },
      { name: 'Mobile Tracker', code: 'MG', icon: 'Smartphone', color_code: '#4CAF50' },
    ]) {
      const ex = await prisma.device_type.findUnique({ where: { code: extra.code } });
      if (!ex) await prisma.device_type.create({ data: extra });
    }
  }

  // ----- MASTER SENSOR -----
  const [sensors] = await legacy.query('SELECT * FROM master_sensor');
  console.log(`[migrate] Master sensors: ${sensors.length}`);
  for (const s of sensors) {
    if (DRY_RUN) continue;
    const existing = await prisma.master_sensor.findFirst({ where: { name: s.name } });
    if (!existing) {
      await prisma.master_sensor.create({
        data: {
          name: s.name,
          short_name: s.short_name,
          description: s.description,
          min_value: s.min_value,
          max_value: s.max_value,
          units: typeof s.units === 'string' ? JSON.parse(s.units) : s.units,
          unit: s.unit,
        },
      });
    }
  }

  // ----- USERS -----
  const [users] = await legacy.query('SELECT * FROM users');
  console.log(`[migrate] Users: ${users.length}`);
  const userIdMap = {};
  // Map device_type lama (iOS/Android/Web/GPS Tracker) → baru (Web/Mobile/Tablet/Desktop)
  const mapDeviceType = (dt) => {
    if (dt === 'iOS' || dt === 'Android') return 'Mobile';
    if (dt === 'GPS Tracker') return 'Desktop';
    return 'Web';
  };
  for (const u of users) {
    if (DRY_RUN) { console.log(`  - ${u.username}`); continue; }
    const levelId = levelIdMap[u.level_id]
      || (await prisma.level.findUnique({ where: { code: 'USER_AGENCY' } }))?.id;

    const created = await prisma.users.upsert({
      where: { username: u.username },
      update: {},
      create: {
        username: u.username,
        password: u.password,             // KEKAL hash lama
        email: u.email || null,
        name: u.name || null,
        phone_number: u.phone_number || null,
        level_id: levelId,
        device_type: mapDeviceType(u.device_type),
        status: 'offline',
        password_changed_at: u.created_at || new Date(),
        must_change_password: false,       // user lama login dengan pwd sedia ada
      },
    });
    userIdMap[u.id] = created.id;
  }

  // ----- USER_AGENCY -----
  const [userAgencies] = await legacy.query('SELECT * FROM user_agency');
  console.log(`[migrate] User-agency links: ${userAgencies.length}`);
  for (const ua of userAgencies) {
    if (DRY_RUN) continue;
    const newUserId = userIdMap[ua.user_id];
    const newAgencyId = agencyIdMap[ua.agency_id];
    if (!newUserId || !newAgencyId) continue;
    await prisma.user_agency.upsert({
      where: { user_id_agency_id: { user_id: newUserId, agency_id: newAgencyId } },
      update: {},
      create: { user_id: newUserId, agency_id: newAgencyId },
    });
  }

  // ----- DEVICES -----
  const [devices] = await legacy.query('SELECT * FROM devices');
  console.log(`[migrate] Devices: ${devices.length}`);
  const deviceIdMap = {};
  for (const d of devices) {
    if (DRY_RUN) { console.log(`  - ${d.deviceid} (${d.name})`); continue; }
    const created = await prisma.devices.upsert({
      where: { device_id: d.deviceid },
      update: {},
      create: {
        device_id: d.deviceid,                       // rename: deviceid → device_id
        device_mac: d.device_mac || null,
        name: d.name,
        type_id: typeIdMap[d.type] || null,          // rename: type → type_id
        data_type: d.data_type || null,
        status: d.status || 'offline',
        latitude: d.latitude,
        longitude: d.longitude,
        is_static: !!d.is_static,
        logging_enabled: !!d.need_log,               // rename: need_log → logging_enabled
        // curr_agency dibuang — guna device_agency
      },
    });
    deviceIdMap[d.id] = created.id;
  }

  // ----- DEVICE_AGENCY -----
  const [deviceAgencies] = await legacy.query('SELECT * FROM device_agency');
  console.log(`[migrate] Device-agency links: ${deviceAgencies.length}`);
  for (const da of deviceAgencies) {
    if (DRY_RUN) continue;
    const newDeviceId = deviceIdMap[da.device_id];
    const newAgencyId = agencyIdMap[da.agency_id];
    if (!newDeviceId || !newAgencyId) continue;
    await prisma.device_agency.upsert({
      where: { device_id_agency_id: { device_id: newDeviceId, agency_id: newAgencyId } },
      update: { active: !!da.active },
      create: {
        device_id: newDeviceId,
        agency_id: newAgencyId,
        name: da.name || null,
        active: !!da.active,
        deactivated_at: da.deactivated_at || null,
      },
    });
  }

  // ----- SITES -----
  const [sites] = await legacy.query('SELECT * FROM sites');
  console.log(`[migrate] Sites: ${sites.length}`);
  // Backfill agency_id: site lama takda agency_id. Guna agency pertama.
  const firstAgency = DRY_RUN ? null : await prisma.agency.findFirst({ orderBy: { id: 'asc' } });
  for (const s of sites) {
    if (DRY_RUN) continue;
    if (!firstAgency) continue;
    await prisma.sites.create({
      data: {
        agency_id: firstAgency.id,    // semua site lama → agency pertama
        status: !!s.status,
        zoom: s.zoom || 13,
        name: s.name,
        path: s.path || null,
        latlng: s.latlng || null,
        tile_url: s.tile_url || undefined,
        slug: s.slug || null,
        publish: !!s.publish,
        created_by: 0,
        updated_by: 0,
      },
    });
  }

  // ----- TILES -----
  const [tiles] = await legacy.query('SELECT * FROM tiles');
  console.log(`[migrate] Tiles: ${tiles.length}`);
  for (const t of tiles) {
    if (DRY_RUN) continue;
    const existing = await prisma.tiles.findFirst({ where: { name: t.name } });
    if (!existing) {
      await prisma.tiles.create({
        data: { name: t.name, icon: t.icon, url: t.url, theme: t.theme || 'light' },
      });
    }
  }

  // ----- CONFIG -----
  const [configs] = await legacy.query('SELECT * FROM config');
  if (configs.length > 0 && !DRY_RUN) {
    const c = configs[0];
    const existing = await prisma.config.findFirst();
    if (!existing) {
      await prisma.config.create({
        data: { name: c.name || '', latlng: c.latlng, zoom: c.zoom || 13 },
      });
    }
  }
  console.log(`[migrate] Config: ${configs.length}`);

  await legacy.end();

  console.log('\n═══════════════════════════════════════════════');
  console.log(DRY_RUN ? '  DRY RUN selesai — tiada data ditulis' : '  Migration selesai');
  console.log('═══════════════════════════════════════════════\n');

  if (!DRY_RUN) {
    console.log('User lama login guna password sedia ada mereka.');
    console.log('Playback bermula kosong — device sebenar akan isi.');
  }
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => {
    console.error('[migrate] ❌ Gagal:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
