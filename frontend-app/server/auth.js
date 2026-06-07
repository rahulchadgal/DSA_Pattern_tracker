import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { query } from './db.js';
import { normalizeHandle } from './http.js';

const scryptAsync = promisify(crypto.scrypt);
const USER_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ADMIN_TOKEN_TTL_MS = 60 * 60 * 1000;
let schemaReadyPromise;

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function fromBase64url(input) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function getAuthSecret() {
  const secret = process.env.AUTH_TOKEN_SECRET || process.env.JWT_SECRET;
  if (secret) {
    return secret;
  }

  const adminKey = String(process.env.ADMIN_ACCESS_KEY || '').trim();
  if (adminKey.length >= 6 && adminKey.length <= 12) {
    return crypto.createHash('sha256').update(`dsa-admin:${adminKey}`).digest('hex');
  }

  throw new Error('Missing ADMIN_ACCESS_KEY');
}

function signPayload(payload) {
  const encoded = base64url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', getAuthSecret()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function readPayload(token) {
  const [encoded, signature] = String(token || '').split('.');
  if (!encoded || !signature) {
    throw new Error('Invalid token');
  }
  const expected = crypto.createHmac('sha256', getAuthSecret()).update(encoded).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error('Invalid token');
  }
  const payload = JSON.parse(fromBase64url(encoded));
  if (!payload.exp || Date.now() > payload.exp) {
    throw new Error('Expired token');
  }
  return payload;
}

export async function ensureAuthSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = Promise.all([
      query('ALTER TABLE user_handles ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMP'),
      query('ALTER TABLE progress_records ADD COLUMN IF NOT EXISTS solution_rich_text TEXT')
    ]).catch((error) => {
      schemaReadyPromise = undefined;
      throw error;
    });
  }
  await schemaReadyPromise;
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt:v1:${salt}:${Buffer.from(hash).toString('base64url')}`;
}

export async function verifyPassword(password, storedHash) {
  const parts = String(storedHash || '').split(':');
  if (parts.length !== 4 || parts[0] !== 'scrypt' || parts[1] !== 'v1') {
    return false;
  }
  const [, , salt, hash] = parts;
  const candidate = await scryptAsync(password, salt, 64);
  return crypto.timingSafeEqual(Buffer.from(hash, 'base64url'), Buffer.from(candidate));
}

export function createUserToken(handle) {
  return signPayload({ kind: 'user', handle, exp: Date.now() + USER_TOKEN_TTL_MS });
}

export function createAdminToken() {
  return signPayload({ kind: 'admin', exp: Date.now() + ADMIN_TOKEN_TTL_MS });
}

export function readBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}

export function requireUserHandle(req) {
  const payload = readPayload(readBearerToken(req));
  if (payload.kind !== 'user') {
    throw new Error('Unauthorized');
  }
  const handle = normalizeHandle(payload.handle);
  if (!handle) {
    throw new Error('Unauthorized');
  }
  return handle;
}

export async function requireUser(req) {
  const handle = requireUserHandle(req);
  const result = await query('SELECT id, handle, disabled_at FROM user_handles WHERE handle = $1', [handle]);
  const user = result.rows[0];
  if (!user || user.disabled_at) {
    throw new Error('Unauthorized');
  }
  return user;
}

export async function requireAdmin(req) {
  const payload = readPayload(readBearerToken(req));
  if (payload.kind !== 'admin') {
    throw new Error('Unauthorized');
  }
  return payload;
}

export function isClaimableShadowPassword(passwordHash) {
  return !String(passwordHash || '').startsWith('scrypt:v1:');
}
