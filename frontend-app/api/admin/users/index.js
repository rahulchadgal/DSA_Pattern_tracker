import { query } from '../../../server/db.js';
import { allowMethods, sendError, sendJson } from '../../../server/http.js';
import { requireAdmin } from '../../../server/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    allowMethods(res, ['GET']);
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    await requireAdmin(req);
    const result = await query(
      `SELECT u.handle,
              u.full_name AS "fullName",
              u.disabled_at AS "disabledAt",
              u.created_at AS "createdAt",
              COUNT(p.id)::INT AS "progressCount",
              COUNT(CASE WHEN p.completed THEN 1 END)::INT AS "completedCount"
       FROM user_handles u
       LEFT JOIN progress_records p ON p.user_id = u.id
       GROUP BY u.id
       ORDER BY u.handle ASC`
    );
    return sendJson(res, 200, result.rows);
  } catch (error) {
    return sendError(res, 401, error instanceof Error ? error.message : 'Unauthorized');
  }
}
