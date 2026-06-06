import { query } from '../../server/db.js';
import { allowMethods, parseBody, sendError, sendJson } from '../../server/http.js';
import { requireUser } from '../../server/auth.js';

function validateText(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }
  return value.trim();
}

function authStatus(message) {
  return message === 'Unauthorized' || message === 'Invalid token' ? 401 : 500;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return listQuestions(req, res);
  }
  if (req.method === 'POST') {
    return upsertQuestion(req, res);
  }

  allowMethods(res, ['GET', 'POST']);
  return sendError(res, 405, 'Method not allowed');
}

async function listQuestions(req, res) {
  const customOnly = String(req.query.customOnly || '').toLowerCase() === 'true';

  try {
    const user = customOnly ? await requireUser(req) : null;
    let sql = `SELECT leetcode_id AS "leetcodeId",
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
      sql += ' WHERE custom_imported = true';
      params.push(user.handle);
      sql += ` AND imported_by_handle = $${params.length}`;
    }

    sql += ' ORDER BY id ASC';

    const result = await query(sql, params);
    return sendJson(res, 200, result.rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load questions';
    return sendError(res, authStatus(message), message);
  }
}

async function upsertQuestion(req, res) {
  const body = parseBody(req);

  try {
    const user = await requireUser(req);
    const leetcodeId = validateText(body.leetcodeId, 'leetcodeId');
    const title = validateText(body.title, 'title');
    const difficulty = validateText(body.difficulty, 'difficulty');
    const mainPattern = validateText(body.mainPattern, 'mainPattern');
    const subPattern = validateText(body.subPattern, 'subPattern');
    const link = validateText(body.link, 'link');
    const defaultQuestion = Boolean(body.defaultQuestion);
    const customImported = Boolean(body.customImported);
    const importedByHandle = user.handle;
    const contentType =
      typeof body.contentType === 'string' && body.contentType.trim().length > 0
        ? body.contentType.trim()
        : 'QUESTION_ONLY';
    const metadataJson = body.metadataJson == null ? null : String(body.metadataJson);

    const result = await query(
      `INSERT INTO question_catalog (
         leetcode_id, title, difficulty, main_pattern, sub_pattern, link,
         default_question, custom_imported, imported_by_handle, content_type, metadata_json,
         created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
       ON CONFLICT (leetcode_id) DO UPDATE SET
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
         id,
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
         created_at AS "createdAt",
         updated_at AS "updatedAt"`,
      [
        leetcodeId,
        title,
        difficulty,
        mainPattern,
        subPattern,
        link,
        defaultQuestion,
        customImported,
        importedByHandle,
        contentType,
        metadataJson
      ]
    );

    return sendJson(res, 200, result.rows[0]);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to upsert question';
    const status = message.endsWith('is required') ? 400 : authStatus(message);
    return sendError(res, status, message);
  }
}
