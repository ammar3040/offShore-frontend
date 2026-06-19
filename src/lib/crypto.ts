import JSEncrypt from 'jsencrypt';

async function getCryptoKey(secret: string): Promise<CryptoKey> {
  const secretBytes = new TextEncoder().encode(secret);
  const hash = await window.crypto.subtle.digest('SHA-256', secretBytes);
  return window.crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptPayload(payload: any, secret: string): Promise<string> {
  const iv = window.crypto.getRandomValues(new Uint8Array(16));
  const key = await getCryptoKey(secret);
  const dataBytes = new TextEncoder().encode(JSON.stringify(payload));
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv, tagLength: 128 },
    key,
    dataBytes
  );

  const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedBuffer), iv.length);

  return btoa(String.fromCharCode(...combined));
}

export async function decryptPayload(encryptedBase64: string, secret: string): Promise<any> {
  const rawString = atob(encryptedBase64);
  const rawBytes = new Uint8Array(rawString.length);
  for (let i = 0; i < rawString.length; i++) {
    rawBytes[i] = rawString.charCodeAt(i);
  }

  if (rawBytes.length < 16 + 16) {
    throw new Error('Encrypted payload too short');
  }

  const iv = rawBytes.slice(0, 16);
  const ciphertextAndTag = rawBytes.slice(16);

  const key = await getCryptoKey(secret);
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv, tagLength: 128 },
    key,
    ciphertextAndTag
  );

  const decryptedText = new TextDecoder().decode(decryptedBuffer);
  return JSON.parse(decryptedText);
}

export async function generateAuthHeaders(
  publicKeyPem: string,
  hmacSecret: string
): Promise<Record<string, string>> {
  const timestamp = Date.now();
  const nonce = Array.from(window.crypto.getRandomValues(new Uint8Array(8)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const payload = {
    data: {
      timestamp,
      nonce
    }
  };

  const jsEncrypt = new JSEncrypt();
  jsEncrypt.setPublicKey(publicKeyPem);
  const encryptedData = jsEncrypt.encrypt(JSON.stringify(payload));
  if (!encryptedData) {
    throw new Error('RSA Encryption failed');
  }

  const message = `CKASHRAF:${timestamp}:--PS${nonce}`;
  const keyBytes = new TextEncoder().encode(hmacSecret);
  const messageBytes = new TextEncoder().encode(message);

  const hmacKey = await window.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await window.crypto.subtle.sign(
    'HMAC',
    hmacKey,
    messageBytes
  );

  const hashHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return {
    'x-auth-token': encryptedData,
    'x-token': hashHex
  };
}
