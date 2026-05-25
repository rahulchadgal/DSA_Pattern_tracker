import { query } from '../../server/db.js';
import { allowMethods, normalizeHandle, parseBody, sendError, sendJson } from '../../server/http.js';
import { createUserToken, ensureAuthSchema, verifyPassword } from '../../server/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    allowMethods(res, ['POST']);
    return sendError(res, 405, 'Method not allowed');
  }

  const body = parseBody(req);
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
