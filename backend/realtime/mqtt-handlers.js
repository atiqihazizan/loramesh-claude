// realtime/mqtt-handlers.js
// Proses mesej MQTT ikut topic. Semua data tracking → tracking-pipeline.

import prisma from '../lib/prisma.js';
import { env } from '../config/env.js';
import { DATA_SOURCE, MQTT_TOPICS } from '../config/constants.js';
import { processTracking, processTrackingBatch } from './tracking-pipeline.js';

// =====================================================================
// TOPIC PARSING
// =====================================================================

/**
 * Extract device_id dari topic.
 *   LoRa/tracking/{device_id}/bundle  → device_id
 *   LoRa/Node/Data/{node_id}          → node_id
 */
function extractDeviceIdFromTopic(topic) {
  const parts = topic.split('/');
  // LoRa/tracking/{id}/bundle
  if (parts[0] === 'LoRa' && parts[1] === 'tracking') {
    return parts[2] || null;
  }
  // LoRa/Node/Data/{id}
  if (parts[0] === 'LoRa' && parts[1] === 'Node' && parts[2] === 'Data') {
    return parts[3] || null;
  }
  return null;
}

function getTopicKind(topic) {
  const parts = topic.split('/');
  if (parts[0] === 'LoRa' && parts[1] === 'tracking') {
    return parts[3] || null; // bundle | status | backfill
  }
  if (parts[0] === 'LoRa' && parts[1] === 'Node' && parts[2] === 'Data') {
    return 'gateway';
  }
  return null;
}

// =====================================================================
// JSON PARSE (selamat)
// =====================================================================

function safeParse(buffer) {
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch {
    return null;
  }
}

// =====================================================================
// LOG (optional — simpan mesej mentah ke log_mqtt)
// =====================================================================

async function logIncoming(topic, payload, deviceId, agencyId = null) {
  if (!env.MQTT.LOG_INCOMING_DB) return;
  try {
    await prisma.log_mqtt.create({
      data: {
        topic,
        message: payload,
        node_id: deviceId || null,
        agency_id: agencyId,
      },
    });
  } catch (e) {
    // Jangan halang pipeline kalau log gagal
    if (env.MQTT.VERBOSE_LOG) console.warn('[mqtt] log_mqtt gagal:', e.message);
  }
}

// =====================================================================
// MAIN HANDLER
// =====================================================================

/**
 * Dipanggil oleh mqtt-client.js untuk setiap mesej masuk.
 *
 * @param {string} topic
 * @param {Buffer} payloadBuffer
 * @param {object} client - MQTT client (untuk hantar ACK)
 */
export async function handleMqttMessage(topic, payloadBuffer, client) {
  const kind = getTopicKind(topic);
  const deviceId = extractDeviceIdFromTopic(topic);

  if (env.MQTT.VERBOSE_LOG) {
    console.log(`[mqtt] ◀ ${topic} (kind=${kind}, device=${deviceId})`);
  }

  const payload = safeParse(payloadBuffer);
  if (!payload) {
    console.warn(`[mqtt] ⚠️ Payload bukan JSON sah: ${topic}`);
    return;
  }

  // Log mentah (fire and forget)
  logIncoming(topic, payload, deviceId);

  // --- Route ikut kind ---
  switch (kind) {
    // ========================================
    // MOBILE BUNDLE — data tracking biasa dari Flutter
    // ========================================
    case 'bundle': {
      const result = await processTracking(payload, DATA_SOURCE.MQTT);

      // Hantar ACK balik ke Flutter
      if (client && deviceId) {
        const ackTopic = MQTT_TOPICS.mobileAck(deviceId);
        const ackPayload = JSON.stringify({
          ok: result.ok,
          device_id: result.device_id || deviceId,
          ts: Date.now(),
          ...(result.ok ? {} : { reason: result.reason }),
        });
        client.publish(ackTopic, ackPayload, { qos: 1 });
      }
      break;
    }

    // ========================================
    // MOBILE STATUS — heartbeat / status_live update
    // ========================================
    case 'status': {
      // Status pun lalu pipeline (normalize akan handle status_live)
      await processTracking(payload, DATA_SOURCE.MQTT);
      break;
    }

    // ========================================
    // MOBILE BACKFILL — data offline buffered, biasanya array
    // ========================================
    case 'backfill': {
      const items = Array.isArray(payload) ? payload : payload.items || [payload];
      const result = await processTrackingBatch(items, DATA_SOURCE.MQTT);
      console.log(
        `[mqtt] Backfill ${deviceId}: ${result.ok}/${result.total} ok`
      );

      // ACK backfill
      if (client && deviceId) {
        const ackTopic = MQTT_TOPICS.mobileAck(deviceId);
        client.publish(
          ackTopic,
          JSON.stringify({
            ok: true,
            type: 'backfill',
            received: result.total,
            saved: result.ok,
            ts: Date.now(),
          }),
          { qos: 1 }
        );
      }
      break;
    }

    // ========================================
    // GATEWAY — data sensor dari LoRa Node-Red
    // ========================================
    case 'gateway': {
      await processTracking(payload, DATA_SOURCE.MQTT);
      break;
    }

    default:
      if (env.MQTT.VERBOSE_LOG) {
        console.warn(`[mqtt] Topic tak dikenali: ${topic}`);
      }
  }
}
