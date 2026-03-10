const { query, resolveOrCreateUser } = require('../server/db');
const { sendJson, sendError, readBody, parseBoolean } = require('../server/http');

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const handle = String(req.query.handle || '').trim().toLowerCase();
      if (!handle) {
        return sendError(res, 400, 'handle is required');
      }

      const user = await resolveOrCreateUser(handle);
      const { rows } = await query(
        `SELECT
           q.leetcode_id AS "leetcodeId",
           p.completed,
           p.updated_at AS "updatedAt",
           p.completed_at AS "completedAt"
         FROM progress_records p
         JOIN question_catalog q ON q.id = p.question_id
         WHERE p.user_id = $1
         ORDER BY q.leetcode_id`,
        [user.id]
      );
      return sendJson(res, 200, rows);
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const handle = String(body.handle || '').trim().toLowerCase();
      const leetcodeId = String(body.leetcodeId || '').trim();
      const completed = parseBoolean(body.completed, false);

      if (!handle || !leetcodeId) {
        return sendError(res, 400, 'handle and leetcodeId are required');
      }

      const user = await resolveOrCreateUser(handle);
      const question = await query(`SELECT id, leetcode_id FROM question_catalog WHERE leetcode_id = $1`, [leetcodeId]);
      if (question.rows.length === 0) {
        return sendError(res, 404, 'Question not found in catalog');
      }

      const questionId = question.rows[0].id;
      const { rows } = await query(
        `INSERT INTO progress_records (user_id, question_id, completed, updated_at, completed_at)
         VALUES ($1, $2, $3, NOW(), CASE WHEN $3 THEN NOW() ELSE NULL END)
         ON CONFLICT (user_id, question_id)
         DO UPDATE SET
           completed = EXCLUDED.completed,
           updated_at = NOW(),
           completed_at = CASE WHEN EXCLUDED.completed THEN NOW() ELSE NULL END
         RETURNING updated_at AS "updatedAt", completed_at AS "completedAt", completed`,
        [user.id, questionId, completed]
      );

      return sendJson(res, 200, {
        leetcodeId,
        completed: rows[0].completed,
        updatedAt: rows[0].updatedAt,
        completedAt: rows[0].completedAt
      });
    }

    return sendError(res, 405, 'Method not allowed');
  } catch (error) {
    return sendError(res, 500, 'Progress API failed', error.message);
  }
};
