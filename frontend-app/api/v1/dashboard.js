const { query, parseDbRuntimeInfo, resolveOrCreateUser } = require('../../server/db');
const { sendJson, sendError } = require('../../server/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    const mode = String(req.query.mode || 'SERVER').trim().toUpperCase();
    const handle = String(req.query.handle || '').trim().toLowerCase();
    const dbInfo = parseDbRuntimeInfo();

    const questionsResult = await query(
      `SELECT
         leetcode_id AS "leetcodeId",
         title,
         difficulty,
         main_pattern AS "mainPattern",
         sub_pattern AS "subPattern",
         link
       FROM question_catalog
       ORDER BY main_pattern, sub_pattern, leetcode_id`
    );

    let progressRows = [];
    let customRows = [];

    if (handle) {
      const user = await resolveOrCreateUser(handle);
      const progressResult = await query(
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
      progressRows = progressResult.rows;

      const customResult = await query(
        `SELECT
           leetcode_id AS "leetcodeId",
           title,
           difficulty,
           main_pattern AS "mainPattern",
           sub_pattern AS "subPattern",
           link,
           metadata_json AS "metadataJson"
         FROM question_catalog
         WHERE custom_imported = TRUE AND imported_by_handle = $1
         ORDER BY updated_at DESC`,
        [handle]
      );
      customRows = customResult.rows;
    }

    return sendJson(res, 200, {
      mode,
      handle: handle || null,
      database: dbInfo,
      questions: questionsResult.rows,
      progress: progressRows,
      customQuestions: customRows
    });
  } catch (error) {
    return sendError(res, 500, 'Dashboard API failed', error.message);
  }
};
