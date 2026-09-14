/**
 * Message Encryption Module for Code4Ever Messaging
 * Native Web Crypto (SubtleCrypto), AES-GCM 256-bit.
 *
 * ⚠️ KNOWN LIMITATION — READ BEFORE RELYING ON THIS FOR PRIVACY ⚠️
 * This is transport/at-rest encryption, NOT end-to-end encryption in the cryptographic
 * sense. The AES key is derived deterministically from the conversation id plus a constant
 * that ships inside the (open source, publicly readable) client bundle — see
 * `deriveChannelCryptoKey` below. Anyone who can READ a message row can therefore also
 * derive its key and decrypt it.
 *
 * What actually protects direct messages today is the database layer: the `messages` table
 * has a Row Level Security policy that only lets conversation participants select a row
 * (see `supabase_schema.sql` → `messages_select_participants`). Before that policy existed,
 * the anon key alone was enough to dump and decrypt every conversation on the platform.
 *
 * Real E2EE requires per-user key pairs and a key agreement step (e.g. ECDH P-256 public
 * keys published on the profile, private key kept in the browser, conversation key =
 * HKDF(ECDH(my private, their public))). That is a breaking change for existing message
 * history and for multi-device sign-in, so it is deliberately left as a follow-up rather
 * than silently changed here. Until then, do not advertise these messages as E2EE.
 */

const E2EE_STORAGE_PREFIX = 'c4e_e2ee_device_key_';
const MASTER_KEY_STORAGE = 'c4e_e2ee_master_token_v1';

// Generate or retrieve persistent device master token
export function getOrCreateDeviceMasterToken(): string {
  try {
    let token = localStorage.getItem(MASTER_KEY_STORAGE);
    if (!token) {
      const randomBytes = new Uint8Array(32);
      if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
        window.crypto.getRandomValues(randomBytes);
      } else {
        for (let i = 0; i < 32; i++) randomBytes[i] = Math.floor(Math.random() * 256);
      }
      token = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(MASTER_KEY_STORAGE, token);
    }
    return token;
  } catch {
    return 'c4e_default_device_token_v1';
  }
}

// Derives a deterministic 256-bit AES-GCM key from the conversation id.
// NOTE: deterministic and derived from public inputs — see the limitation notice at the top
// of this file. Access control for messages is enforced by Row Level Security, not by this key.
async function deriveChannelCryptoKey(channelOrGroupId: string): Promise<CryptoKey> {
  const normalizedChannel = (channelOrGroupId || 'general').trim().toLowerCase();
  const rawKeyMaterial = `c4e_e2ee_v2_channel:${normalizedChannel}:c4e_sec_salt_aes256_hash`;

  const enc = new TextEncoder();
  const keyMaterialBytes = enc.encode(rawKeyMaterial);

  // Hash to 256 bits (SHA-256)
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', keyMaterialBytes);

  return window.crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

// Helper: Uint8Array to Base64
function bufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return window.btoa(binary);
}

// Helper: Base64 to Uint8Array
function base64ToBuffer(base64: string): Uint8Array {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encrypts any text, media url, file or JSON data in < 1 millisecond.
 * Returns a formatted payload: `e2ee:<iv_base64>:<cipher_base64>`
 */
export async function encryptE2EEMessage(
  plainText: string,
  channelOrGroupId: string
): Promise<{ encrypted: string; durationMs: number }> {
  const startTime = performance.now();

  try {
    if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
      // Fallback if WebCrypto is disabled
      return { encrypted: plainText, durationMs: 0 };
    }

    const key = await deriveChannelCryptoKey(channelOrGroupId);
    const iv = new Uint8Array(12);
    window.crypto.getRandomValues(iv);

    const enc = new TextEncoder();
    const encodedData = enc.encode(plainText);

    const ciphertextBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      encodedData
    );

    const ivB64 = bufferToBase64(iv);
    const cipherB64 = bufferToBase64(new Uint8Array(ciphertextBuffer));
    const encrypted = `e2ee:${ivB64}:${cipherB64}`;

    const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
    return { encrypted, durationMs };
  } catch (err) {
    console.warn('E2EE encryption fallback:', err);
    return { encrypted: plainText, durationMs: 0 };
  }
}

/**
 * Decrypts an E2EE payload formatted as `e2ee:<iv_base64>:<cipher_base64>`
 * If text is not encrypted (plain text), returns it immediately.
 */
export async function decryptE2EEMessage(
  cipherText: string,
  channelOrGroupId: string
): Promise<string> {
  if (!cipherText || !cipherText.startsWith('e2ee:')) {
    return cipherText || '';
  }

  try {
    if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
      return cipherText;
    }

    const parts = cipherText.split(':');
    if (parts.length < 3) return cipherText;

    const ivB64 = parts[1];
    const cipherB64 = parts[2];

    const iv = base64ToBuffer(ivB64);
    const ciphertext = base64ToBuffer(cipherB64);

    const key = await deriveChannelCryptoKey(channelOrGroupId);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      ciphertext
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch (err) {
    // If decryption fails (e.g. key mismatch or plain string), return safe preview
    return '[Şifreli Mesaj - Cihaz Anahtarı Doğrulanamadı]';
  }
}

/**
 * Encrypts an attachment or media file
 */
export async function encryptE2EEMedia(
  dataUrl: string,
  channelOrGroupId: string
): Promise<{ encrypted: string; durationMs: number }> {
  return encryptE2EEMessage(dataUrl, channelOrGroupId);
}

/**
 * Decrypts an attachment or media file
 */
export async function decryptE2EEMedia(
  encryptedDataUrl: string,
  channelOrGroupId: string
): Promise<string> {
  return decryptE2EEMessage(encryptedDataUrl, channelOrGroupId);
}
