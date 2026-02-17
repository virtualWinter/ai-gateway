/**
 * AES-256-GCM encryption for provider credentials at rest.
 *
 * Format: base64(iv + tag + ciphertext)
 * - iv:  12 bytes
 * - tag: 16 bytes
 * - ciphertext: variable
 */

import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
    const hex = process.env.ENCRYPTION_KEY;
    if (!hex) {
        throw new Error("ENCRYPTION_KEY environment variable is missing");
    }
    if (hex.length !== 64) {
        throw new Error(
            `ENCRYPTION_KEY must be exactly 64 hex characters (found ${hex.length})`
        );
    }
    const key = Buffer.from(hex, "hex");
    if (key.length !== 32) {
        throw new Error(
            "ENCRYPTION_KEY is not a valid 64-character hex string"
        );
    }
    return key;
}

/**
 * Encrypt a plaintext string.
 * Returns a base64-encoded string containing iv + auth tag + ciphertext.
 */
export function encrypt(plaintext: string): string {
    const key = getKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    // Pack: iv(12) + tag(16) + ciphertext(N)
    const packed = Buffer.concat([iv, tag, encrypted]);
    return packed.toString("base64");
}

/**
 * Decrypt a base64-encoded encrypted string.
 * Expects format from encrypt(): base64(iv + tag + ciphertext).
 */
export function decrypt(encoded: string): string {
    const key = getKey();
    const packed = Buffer.from(encoded, "base64");

    if (packed.length < IV_LENGTH + TAG_LENGTH) {
        throw new Error("Invalid encrypted data: too short");
    }

    const iv = packed.subarray(0, IV_LENGTH);
    const tag = packed.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = packed.subarray(IV_LENGTH + TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
    ]);

    return decrypted.toString("utf8");
}
