import { query } from '../../server/db.js';
import { allowMethods, sendError, sendJson } from '../../server/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    allowMethods(res, ['GET']);
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    const result = await query(
      `SELECT leetcode_id AS "leetcodeId",
              title,
              difficulty,
              main_pattern AS "mainPattern",
              sub_pattern AS "subPattern",
              link
       FROM question_catalog
       ORDER BY id ASC`
    );
    return sendJson(res, 200, result.rows);
  } catch (error) {
    return sendError(res, 500, error instanceof Error ? error.message : 'Unable to load questions');
  }
}

