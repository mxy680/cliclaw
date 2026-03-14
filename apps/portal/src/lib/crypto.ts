import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12;  // 96 bits (recommended for GCM)
const TAG_LENGTH = 16; // 128 bits

function getEncryptionKey(): Buffer | null {
  const keyHex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!keyHex) {
    return null;
  }
  const keyBuf = Buffer.from(keyHex, "hex");
  if (keyBuf.length !== KEY_LENGTH) {
    console.warn(
      `[crypto] TOKEN_ENCRYPTION_KEY must be ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH} bytes). Encryption disabled.`
    );
    return null;
  }
  return keyBuf;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a colon-delimited base64 string: `iv:authTag:ciphertext`
 * Falls back to returning plaintext if TOKEN_ENCRYPTION_KEY is not configured.
 */
export function encryptTokens(plaintext: string): string {
  const key = getEncryptionKey();
  if (!key) {
    if (!process.env.TOKEN_ENCRYPTION_KEY) {
      console.warn("[crypto] TOKEN_ENCRYPTION_KEY not set — storing tokens unencrypted");
    }
    return plaintext;
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Decrypt a value produced by `encryptTokens`.
 * If decryption fails (e.g. the value is legacy plaintext), returns the
 * original string unchanged so old tokens remain readable.
 */
export function decryptTokens(value: string): string {
  const key = getEncryptionKey();
  if (!key) {
    return value;
  }

  // Detect whether the value looks like our encrypted format
  const parts = value.split(":");
  if (parts.length !== 3) {
    // Not encrypted — legacy plaintext token, return as-is
    return value;
  }

  try {
    const [ivB64, authTagB64, ciphertextB64] = parts;
    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(authTagB64, "base64");
    const ciphertext = Buffer.from(ciphertextB64, "base64");

    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch {
    // Decryption failed — assume legacy plaintext
    console.warn("[crypto] decryptTokens: decryption failed, treating value as plaintext");
    return value;
  }
}

/**
 * Generate a random 32-byte hex key suitable for TOKEN_ENCRYPTION_KEY.
 * Run once during setup: `node -e "require('./crypto').generateEncryptionKey()"`
 */
export function generateEncryptionKey(): string {
  const key = randomBytes(KEY_LENGTH).toString("hex");
  console.log(`TOKEN_ENCRYPTION_KEY=${key}`);
  return key;
}
