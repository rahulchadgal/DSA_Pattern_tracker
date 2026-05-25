import { query } from '../../../server/db.js';
import { allowMethods, normalizeHandle, parseBody, sendError, sendJson } from '../../../server/http.js';
import { requireAdmin } from '../../../server/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    allowMethods(res, ['POST']);
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    await requireAdmin(req);
    const handle = normalizeHandle(parseBody(req).handle);
    if (!handle) {
      return sendError(res, 400, 'Handle is required');
    }
    const result = await query(
      `UPDATE user_handles
       SET disabled_at = NULL, updated_at = NOW()
       WHERE handle = $1
       RETURNING handle, disabled_at AS "disabledAt"`,
      [handle]
    );
    if (!result.rows[0]) {
      return sendError(res, 404, 'User not found');
    }
    return sendJson(res, 200, result.rows[0]);
  } catch (error) {
    return sendError(res, 401, error instanceof Error ? error.message : 'Unauthorized');
  }
}
