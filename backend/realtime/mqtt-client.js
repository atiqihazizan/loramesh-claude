// realtime/mqtt-client.js
// MQTT client — connect ke broker, subscribe topics, route mesej ke handler.

import mqtt from 'mqtt';
import { env } from '../config/env.js';
import { MQTT_TOPICS } from '../config/constants.js';
import { handleMqttMessage } from './mqtt-handlers.js';

let client = null;
let connected = false;

/**
 * Connect ke MQTT broker dan subscribe topics.
 * Kalau MQTT_ENABLED=false, skip (return tanpa error).
 */
export function initMqttClient() {
  if (!env.MQTT.ENABLED) {
    console.log('[mqtt] MQTT_ENABLED=false — MQTT dilangkau');
    return null;
  }

  const { PROTOCOL, HOST, PORT, BASEPATH, USERNAME, PASSWORD } = env.MQTT;
  const url = `${PROTOCOL}://${HOST}:${PORT}/${BASEPATH}`;

  console.log(`[mqtt] Connecting ke ${url} ...`);

  client = mqtt.connect(url, {
    username: USERNAME || undefined,
    password: PASSWORD || undefined,
    reconnectPeriod: 5000,
    connectTimeout: 30000,
    clean: true,
    clientId: `lora-backend-${Math.random().toString(16).slice(2, 10)}`,
  });

  // --- Connect ---
  client.on('connect', () => {
    connected = true;
    console.log('[mqtt] ✓ Connected to broker');

    const subs = [
      { topic: MQTT_TOPICS.MOBILE_BUNDLE,   qos: env.MQTT.MOBILE_SUBSCRIBE_QOS },
      { topic: MQTT_TOPICS.MOBILE_STATUS,   qos: env.MQTT.MOBILE_SUBSCRIBE_QOS },
      { topic: MQTT_TOPICS.MOBILE_BACKFILL, qos: env.MQTT.MOBILE_SUBSCRIBE_QOS },
      { topic: MQTT_TOPICS.GATEWAY_DATA,    qos: env.MQTT.SUBSCRIBE_QOS },
    ];

    for (const s of subs) {
      client.subscribe(s.topic, { qos: s.qos }, (err) => {
        if (err) {
          console.error(`[mqtt] ✗ Subscribe gagal: ${s.topic}`, err.message);
        } else {
          console.log(`[mqtt]   subscribed: ${s.topic} (qos ${s.qos})`);
        }
      });
    }
  });

  // --- Message ---
  client.on('message', (topic, payloadBuffer) => {
    // Jangan await — fire and forget, handler urus sendiri
    handleMqttMessage(topic, payloadBuffer, client).catch((err) => {
      console.error(`[mqtt] Handler error (${topic}):`, err.message);
    });
  });

  // --- Error / reconnect ---
  client.on('error', (err) => {
    console.error('[mqtt] ✗ Error:', err.message);
  });

  client.on('reconnect', () => {
    console.log('[mqtt] ↻ Reconnecting...');
  });

  client.on('offline', () => {
    connected = false;
    console.warn('[mqtt] ⚠️ Offline');
  });

  client.on('close', () => {
    connected = false;
  });

  return client;
}

export function getMqttClient() {
  return client;
}

export function isMqttConnected() {
  return connected;
}

export function disconnectMqtt() {
  return new Promise((resolve) => {
    if (!client) return resolve();
    client.end(false, {}, () => {
      console.log('[mqtt] ✓ Disconnected');
      resolve();
    });
  });
}
