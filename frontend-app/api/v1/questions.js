const { query } = require('../../server/db');
const { sendJson, sendError } = require('../../server/http');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    const { rows } = await query(
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
    return sendJson(res, 200, rows);
  } catch (error) {
    return sendError(res, 500, 'Failed to load questions', error.message);
  }
};
