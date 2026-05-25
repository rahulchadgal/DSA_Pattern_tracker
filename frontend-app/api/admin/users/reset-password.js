import { query } from '../../../server/db.js';
import { allowMethods, normalizeHandle, parseBody, sendError, sendJson } from '../../../server/http.js';
import { hashPassword, requireAdmin } from '../../../server/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    allowMethods(res, ['POST']);
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    await requireAdmin(req);
    const body = parseBody(req);
    const handle = normalizeHandle(body.handle);
    const password = typeof body.password === 'string' ? body.password : '';
    if (!handle || password.length < 8 || password.length > 120) {
      return sendError(res, 400, 'Valid handle and 8-120 character password are required');
    }
    const result = await query(
      `UPDATE user_handles
       SET password_hash = $2, disabled_at = NULL, updated_at = NOW()
       WHERE handle = $1
       RETURNING handle`,
      [handle, await hashPassword(password)]
    );
    if (!result.rows[0]) {
      return sendError(res, 404, 'User not found');
    }
    return sendJson(res, 200, { handle: result.rows[0].handle });
  } catch (error) {
    return sendError(res, 401, error instanceof Error ? error.message : 'Unauthorized');
  }
}
