import crypto from 'node:crypto';
import { isPublicAuthRequired, requirePublicAuthSecret } from './access-policy';

const ENCRYPTED_PREFIX = 'enc:v1:';

function deriveEncryptionKey(): Buffer {
  const secret =
    isPublicAuthRequired()
      ? requirePublicAuthSecret()
      : process.env.AUTH_SECRET ||
        process.env.JWT_SECRET ||
        'finmind-local-development-secret-key-do-not-use-in-prod';
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

/**
 * Cifra segredos (ex: chaves de API de provedores de IA) com AES-256-GCM antes de persistir no banco.
 */
export function encryptSecret(plain: string | null | undefined): string {
  const trimmed = (plain || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith(ENCRYPTED_PREFIX)) return trimmed;

  const key = deriveEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(trimmed, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decifra segredos salvos com AES-256-GCM. Mantém retrocompatibilidade transparente
 * com chaves legadas em texto plano já gravadas no SQLite local.
 */
export function decryptSecret(stored: string | null | undefined): string {
  const raw = (stored || '').trim();
  if (!raw) return '';
  if (!raw.startsWith(ENCRYPTED_PREFIX)) return raw;

  const parts = raw.slice(ENCRYPTED_PREFIX.length).split(':');
  if (parts.length !== 3) return '';

  try {
    const [ivHex, tagHex, dataHex] = parts;
    const key = deriveEncryptionKey();
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivHex, 'hex')
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return '';
  }
}
