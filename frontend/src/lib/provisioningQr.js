// Legacy APK QR only (client-side) — same AES-256-CBC as lora2u_nodejs admin generate-provisioning-link.
// Register tetap: POST /api/devices-user/register dengan agency_token (backend v3).

const DEFAULT_KEY = 'default-32-char-encryption-key!!';

function provisioningKeyBytes() {
  const raw =
    import.meta.env.VITE_PROVISION_ENCRYPTION_KEY?.trim() || DEFAULT_KEY;
  const padded = raw.padEnd(32, '0').substring(0, 32);
  return new TextEncoder().encode(padded);
}

function randomHex(byteLength) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

async function encryptProvisioningPayload(payloadObject) {
  const keyBytes = provisioningKeyBytes();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-CBC' },
    false,
    ['encrypt'],
  );
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const plaintext = new TextEncoder().encode(JSON.stringify(payloadObject));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv },
    cryptoKey,
    plaintext,
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return bufferToHex(combined.buffer);
}

/**
 * @param {{ agencyId: number, expiresAt: string|Date, agencyToken?: string }} params
 * @returns {Promise<string>} modbusgo://provision?payload=…
 */
export async function buildLegacyProvisioningDeepLink({
  agencyId,
  expiresAt,
  agencyToken,
}) {
  if (!agencyId || !expiresAt) {
    throw new Error('agencyId and expiresAt are required');
  }
  const expiresIso = new Date(expiresAt).toISOString();
  const nonce =
    agencyToken != null && agencyToken !== ''
      ? await stableNonce(agencyId, agencyToken)
      : randomHex(16);

  const payload = {
    agency_id: agencyId,
    nonce,
    expires_at: expiresIso,
  };
  const encryptedHex = await encryptProvisioningPayload(payload);
  return `modbusgo://provision?payload=${encryptedHex}`;
}

/** Nonce stabil per token — QR tidak berubah setiap re-render (IV masih rawak sekali bina). */
async function stableNonce(agencyId, agencyToken) {
  const data = new TextEncoder().encode(`${agencyId}:${agencyToken}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return bufferToHex(hash).slice(0, 32);
}

/** Cache deep link per sesi token supaya IV/nonce tidak berubah setiap render. */
const deepLinkCache = new Map();

export async function getCachedLegacyDeepLink(params) {
  const key = `${params.agencyId}:${params.agencyToken}:${params.expiresAt}`;
  if (deepLinkCache.has(key)) return deepLinkCache.get(key);
  const link = await buildLegacyProvisioningDeepLink(params);
  deepLinkCache.set(key, link);
  return link;
}

export function clearLegacyDeepLinkCache() {
  deepLinkCache.clear();
}
