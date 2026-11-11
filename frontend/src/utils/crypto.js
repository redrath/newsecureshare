/*
 * Browser-side cryptography for SecureShare E2EE.
 *
 * The server must only receive ciphertext, public keys, and RSA-wrapped
 * file keys. Never send an unwrapped AES key or a plaintext private key
 * to the API.
 */

const PBKDF2_ITERATIONS = 310000;
const RSA_MODULUS_LENGTH = 3072;
const AES_KEY_LENGTH = 256;
const AES_GCM_IV_LENGTH = 12;

let unlockedPrivateKey = null;

const webCrypto = () => {
  if (!window.crypto?.subtle) {
    throw new Error("Web Crypto is unavailable. Use HTTPS or localhost.");
  }
  return window.crypto;
};

const toBase64 = (bytes) => {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < array.length; i += chunkSize) {
    binary += String.fromCharCode(...array.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

const fromBase64 = (value) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const bytesToPem = (label, bytes) => {
  const base64 = toBase64(bytes);
  const lines = base64.match(/.{1,64}/g) || [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`;
};

const pemToBytes = (pem, label) => {
  const body = pem
    .replace(`-----BEGIN ${label}-----`, "")
    .replace(`-----END ${label}-----`, "")
    .replace(/\s/g, "");
  return fromBase64(body);
};

export async function generateKeyPair() {
  const crypto = webCrypto();
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: RSA_MODULUS_LENGTH,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  const publicDer = await crypto.subtle.exportKey("spki", pair.publicKey);
  const privateDer = await crypto.subtle.exportKey("pkcs8", pair.privateKey);

  return {
    publicKeyPem: bytesToPem("PUBLIC KEY", publicDer),
    privateKeyPkcs8: new Uint8Array(privateDer),
  };
}

async function derivePrivateKeyWrappingKey(password, salt, iterations = PBKDF2_ITERATIONS) {
  if (!password || password.length < 8) {
    throw new Error("A password of at least 8 characters is required.");
  }
  const crypto = webCrypto();
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function protectPrivateKey(privateKeyPkcs8, password) {
  const crypto = webCrypto();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_LENGTH));
  const wrappingKey = await derivePrivateKeyWrappingKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    wrappingKey,
    privateKeyPkcs8
  );

  return {
    version: 1,
    kdf: "PBKDF2-SHA-256",
    iterations: PBKDF2_ITERATIONS,
    cipher: "AES-256-GCM",
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(ciphertext),
  };
}

export async function unlockPrivateKey(protectedBundle, password) {
  if (!protectedBundle || protectedBundle.version !== 1) {
    throw new Error("Unsupported or missing encrypted private-key bundle.");
  }
  const crypto = webCrypto();
  const salt = fromBase64(protectedBundle.salt);
  const iv = fromBase64(protectedBundle.iv);
  const wrappingKey = await derivePrivateKeyWrappingKey(
    password,
    salt,
    protectedBundle.iterations
  );

  let pkcs8;
  try {
    pkcs8 = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      wrappingKey,
      fromBase64(protectedBundle.ciphertext)
    );
  } catch {
    throw new Error("Unable to unlock private key. Check your password.");
  }

  return crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"]
  );
}

export function setUnlockedPrivateKey(privateKey) {
  unlockedPrivateKey = privateKey || null;
}

export function getUnlockedPrivateKey() {
  if (!unlockedPrivateKey) {
    throw new Error("Your encryption key is locked. Please unlock it first.");
  }
  return unlockedPrivateKey;
}

export function clearUnlockedPrivateKey() {
  unlockedPrivateKey = null;
}

export async function importPublicKey(publicKeyPem) {
  return webCrypto().subtle.importKey(
    "spki",
    pemToBytes(publicKeyPem, "PUBLIC KEY"),
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

export async function generateFileKey() {
  return webCrypto().subtle.generateKey(
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function wrapFileKey(fileKey, recipientPublicKeyPem) {
  const crypto = webCrypto();
  const recipientPublicKey = await importPublicKey(recipientPublicKeyPem);
  const rawKey = await crypto.subtle.exportKey("raw", fileKey);
  const wrapped = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    recipientPublicKey,
    rawKey
  );
  return toBase64(wrapped);
}

export async function unwrapFileKey(encryptedKeyBase64, privateKey = getUnlockedPrivateKey()) {
  const crypto = webCrypto();
  const rawKey = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    fromBase64(encryptedKeyBase64)
  );
  return crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "AES-GCM" },
    false,
    ["decrypt", "encrypt"]
  );
}

export async function encryptFileForRecipients(file, recipients) {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new Error("At least one recipient public key is required.");
  }
  const crypto = webCrypto();
  const fileKey = await generateFileKey();
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_LENGTH));
  const plaintext = await file.arrayBuffer();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    fileKey,
    plaintext
  );
  const envelopes = await Promise.all(recipients.map(async ({ email, publicKeyPem }) => ({
    email,
    encryptedKey: await wrapFileKey(fileKey, publicKeyPem),
  })));

  return {
    ciphertext: toBase64(ciphertext),
    iv: toBase64(iv),
    envelopes,
    algorithm: "AES-256-GCM",
    keyWrap: "RSA-OAEP-3072-SHA256",
    version: 1,
    contentType: file.type || "application/pdf",
    originalSize: file.size,
  };
}

export async function encryptFileForRecipient(file, recipientPublicKeyPem) {
  const result = await encryptFileForRecipients(file, [
    { email: "recipient", publicKeyPem: recipientPublicKeyPem },
  ]);
  return {
    ...result,
    encryptedKey: result.envelopes[0].encryptedKey,
    envelopes: undefined,
  };
}

export async function decryptFilePayload(payload, privateKey = getUnlockedPrivateKey()) {
  const crypto = webCrypto();
  const fileKey = await unwrapFileKey(payload.encryptedKey, privateKey);
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(payload.iv) },
      fileKey,
      fromBase64(payload.ciphertext)
    );
    return new Blob([plaintext], { type: payload.contentType || "application/pdf" });
  } catch {
    throw new Error("File authentication failed. The file may be corrupted or tampered with.");
  }
}

export async function publicKeyFingerprint(publicKeyPem) {
  const digest = await webCrypto().subtle.digest(
    "SHA-256",
    pemToBytes(publicKeyPem, "PUBLIC KEY")
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join(":");
}
