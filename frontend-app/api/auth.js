import { query } from '../server/db.js';
import { allowMethods, normalizeHandle, parseBody, sendError, sendJson } from '../server/http.js';
import {
  createUserToken,
  ensureAuthSchema,
  hashPassword,
  isClaimableShadowPassword,
  requireUser,
  verifyPassword
} from '../server/auth.js';

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10);
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return handleGet(req, res);
  }
  if (req.method === 'POST') {
    return handlePost(req, res);
  }

  allowMethods(res, ['GET', 'POST']);
  return sendError(res, 405, 'Method not allowed');
}

async function handleGet(req, res) {
  const action = String(req.query.action || '').toLowerCase();
  if (action !== 'me') {
    return sendError(res, 404, 'Unknown auth action');
  }

  try {
    const user = await requireUser(req);
    return sendJson(res, 200, { handle: user.handle });
  } catch {
    return sendError(res, 401, 'Unauthorized');
  }
}

async function handlePost(req, res) {
  const body = parseBody(req);
  const action = String(body.action || '').toLowerCase();

  if (action === 'register') {
    return register(body, res);
  }
  if (action === 'login') {
    return login(body, res);
  }

  return sendError(res, 404, 'Unknown auth action');
}

async function register(body, res) {
  const handle = normalizeHandle(body.username || body.handle);
  const password = typeof body.password === 'string' ? body.password : '';
  if (!handle || handle.length < 3 || handle.length > 64) {
    return sendError(res, 400, 'Username must be 3-64 characters');
  }
  if (password.length < 8 || password.length > 120) {
    return sendError(res, 400, 'Password must be 8-120 characters');
  }

  try {
    await ensureAuthSchema();
    const passwordHash = await hashPassword(password);
    const existing = await query('SELECT id, password_hash FROM user_handles WHERE handle = $1', [handle]);
    if (existing.rows[0] && !isClaimableShadowPassword(existing.rows[0].password_hash)) {
      return sendError(res, 409, 'Username already exists');
    }

    if (existing.rows[0]) {
      await query(
        `UPDATE user_handles
         SET password_hash = $2, disabled_at = NULL, updated_at = NOW()
         WHERE handle = $1`,
        [handle, passwordHash]
      );
    } else {
      const emailLocalPart = handle.replace(/[^a-z0-9._-]/g, '-') || `user-${randomSuffix()}`;
      await query(
        `INSERT INTO user_handles (handle, email, full_name, password_hash, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [handle, `${emailLocalPart}@local.dsa`, handle, passwordHash]
      );
    }

    return sendJson(res, 200, { token: createUserToken(handle), handle });
  } catch (error) {
    return sendError(res, 500, error instanceof Error ? error.message : 'Unable to register');
  }
}

async function login(body, res) {
  const handle = normalizeHandle(body.username || body.handle);
  const password = typeof body.password === 'string' ? body.password : '';
  if (!handle || !password) {
    return sendError(res, 400, 'Username and password are required');
  }

  try {
    await ensureAuthSchema();
    const result = await query('SELECT handle, password_hash, disabled_at FROM user_handles WHERE handle = $1', [handle]);
    const user = result.rows[0];
    const valid = user && !user.disabled_at && await verifyPassword(password, user.password_hash);
    if (!valid) {
      return sendError(res, 401, 'Invalid credentials');
    }
    return sendJson(res, 200, { token: createUserToken(user.handle), handle: user.handle });
  } catch (error) {
    return sendError(res, 500, error instanceof Error ? error.message : 'Unable to login');
  }
}
