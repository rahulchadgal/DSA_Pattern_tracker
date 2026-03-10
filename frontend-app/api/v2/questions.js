const { query } = require('../../server/db');
const { sendJson, sendError, readBody, parseBoolean } = require('../../server/http');

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const customOnly = parseBoolean(req.query.customOnly, false);
      const importedByHandle = String(req.query.importedByHandle || '').trim().toLowerCase();

      let sql = `SELECT
                   leetcode_id AS "leetcodeId",
                   title,
                   difficulty,
                   main_pattern AS "mainPattern",
                   sub_pattern AS "subPattern",
                   link,
                   default_question AS "defaultQuestion",
                   custom_imported AS "customImported",
                   imported_by_handle AS "importedByHandle",
                   content_type AS "contentType",
                   metadata_json AS "metadataJson",
                   updated_at AS "updatedAt"
                 FROM question_catalog`;
      const params = [];

      if (customOnly) {
        sql += ' WHERE custom_imported = TRUE';
        if (importedByHandle) {
          params.push(importedByHandle);
          sql += ` AND imported_by_handle = $${params.length}`;
        }
      }

      sql += ' ORDER BY updated_at DESC, leetcode_id';
      const { rows } = await query(sql, params);
      return sendJson(res, 200, rows);
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const required = ['leetcodeId', 'title', 'difficulty', 'mainPattern', 'subPattern', 'link'];
      for (const key of required) {
        if (!body[key] || String(body[key]).trim().length === 0) {
          return sendError(res, 400, `${key} is required`);
        }
      }

      const payload = {
        leetcodeId: String(body.leetcodeId).trim(),
        title: String(body.title).trim(),
        difficulty: String(body.difficulty).trim(),
        mainPattern: String(body.mainPattern).trim(),
        subPattern: String(body.subPattern).trim(),
        link: String(body.link).trim(),
        defaultQuestion: parseBoolean(body.defaultQuestion, false),
        customImported: parseBoolean(body.customImported, true),
        importedByHandle: body.importedByHandle ? String(body.importedByHandle).trim().toLowerCase() : null,
        contentType: body.contentType ? String(body.contentType).trim() : 'QUESTION_ONLY',
        metadataJson: body.metadataJson ? String(body.metadataJson) : null
      };

      const { rows } = await query(
        `INSERT INTO question_catalog (
           leetcode_id, title, difficulty, main_pattern, sub_pattern, link,
           default_question, custom_imported, imported_by_handle, content_type, metadata_json, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
         ON CONFLICT (leetcode_id)
         DO UPDATE SET
           title = EXCLUDED.title,
           difficulty = EXCLUDED.difficulty,
           main_pattern = EXCLUDED.main_pattern,
           sub_pattern = EXCLUDED.sub_pattern,
           link = EXCLUDED.link,
           default_question = EXCLUDED.default_question,
           custom_imported = EXCLUDED.custom_imported,
           imported_by_handle = EXCLUDED.imported_by_handle,
           content_type = EXCLUDED.content_type,
           metadata_json = EXCLUDED.metadata_json,
           updated_at = NOW()
         RETURNING
           leetcode_id AS "leetcodeId",
           title,
           difficulty,
           main_pattern AS "mainPattern",
           sub_pattern AS "subPattern",
           link,
           default_question AS "defaultQuestion",
           custom_imported AS "customImported",
           imported_by_handle AS "importedByHandle",
           content_type AS "contentType",
           metadata_json AS "metadataJson",
           updated_at AS "updatedAt"`,
        [
          payload.leetcodeId,
          payload.title,
          payload.difficulty,
          payload.mainPattern,
          payload.subPattern,
          payload.link,
          payload.defaultQuestion,
          payload.customImported,
          payload.importedByHandle,
          payload.contentType,
          payload.metadataJson
        ]
      );

      return sendJson(res, 200, rows[0]);
    }

    return sendError(res, 405, 'Method not allowed');
  } catch (error) {
    return sendError(res, 500, 'Questions API failed', error.message);
  }
};
