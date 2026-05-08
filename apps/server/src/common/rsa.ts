import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { privateDecrypt, constants } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEYS_DIR = resolve(__dirname, '../../keys');

export const rsaPublicKey = readFileSync(resolve(KEYS_DIR, 'public.pem'), 'utf-8');
const rsaPrivateKey = readFileSync(resolve(KEYS_DIR, 'private.pem'), 'utf-8');

/**
 * Decrypt a base64-encoded RSA-OAEP ciphertext using the server's private key.
 */
export function rsaDecrypt(encryptedBase64: string): string {
  const buffer = Buffer.from(encryptedBase64, 'base64');
  const decrypted = privateDecrypt(
    { key: rsaPrivateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    buffer,
  );
  return decrypted.toString('utf-8');
}
