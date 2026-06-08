import { query } from '../server/db.js';
import { allowMethods, parseBody, sendError, sendJson } from '../server/http.js';
import { requireUser, requireUserHandle } from '../server/auth.js';
import sanitizeHtml from 'sanitize-html';

function authStatus(message) {
  return message === 'Unauthorized' || message === 'Invalid token' || message === 'Expired token' ? 401 : 500;
}

const sanitizeSolutionHtml = (value) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  const sanitized = sanitizeHtml(value, {
    allowedTags: ['p', 'div', 'br', 'b', 'strong', 'i', 'em', 'ul', 'ol', 'li', 'pre', 'code', 'span'],
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
    enforceHtmlBoundary: true,
    parser: {
      lowerCaseAttributeNames: true,
      lowerCaseTags: true
    },
    transformTags: {
      span: 'span'
    }
  }).trim();
  return sanitized.length > 0 ? sanitized : null;
};

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const textToSolutionHtml = (value) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  return `<pre><code>${escapeHtml(value)}</code></pre>`;
};

const decodeHtmlEntities = (value) => String(value || '')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&amp;/g, '&');

const solutionHtmlToText = (value) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return '';
  }
  const codeMatch = value.match(/<pre><code>([\s\S]*?)<\/code><\/pre>/i);
  if (codeMatch) {
    return decodeHtmlEntities(codeMatch[1]);
  }
  return sanitizeHtml(value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|pre)>/gi, '\n'), {
    allowedTags: [],
    allowedAttributes: {}
  }).replace(/\n{3,}/g, '\n\n').trim();
};

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return getProgress(req, res);
  }
  if (req.method === 'POST') {
    return upsertProgress(req, res);
  }

  allowMethods(res, ['GET', 'POST']);
  return sendError(res, 405, 'Method not allowed');
}

async function getProgress(req, res) {
  try {
    const handle = requireUserHandle(req);
    const queryParams = req.query || {};
    const leetcodeId = typeof queryParams.leetcodeId === 'string' ? queryParams.leetcodeId.trim() : '';
    const includeSolution = queryParams.includeSolution === 'true';
    const metaOnly = queryParams.meta === 'true';
    if (metaOnly) {
      const user = await requireUser(req);
      const metaResult = await query(
        `SELECT
           MAX(updated_at) AS "latestUpdatedAt",
           COUNT(*)::int AS "rowCount",
           COUNT(*) FILTER (WHERE completed)::int AS "completedCount"
         FROM progress_records
         WHERE user_id = $1`,
        [user.id]
      );
      return sendJson(res, 200, {
        latestUpdatedAt: metaResult.rows[0]?.latestUpdatedAt || null,
        rowCount: metaResult.rows[0]?.rowCount || 0,
        completedCount: metaResult.rows[0]?.completedCount || 0
      });
    }

    if (leetcodeId && includeSolution) {
      const user = await requireUser(req);
      const noteResult = await query(
        `SELECT p.solution_rich_text AS "solutionRichText"
         FROM progress_records p
         JOIN question_catalog q ON q.id = p.question_id
         WHERE p.user_id = $1
           AND q.leetcode_id = $2`,
        [user.id, leetcodeId]
      );
      const solutionRichText = sanitizeSolutionHtml(noteResult.rows[0]?.solutionRichText || null);
      return sendJson(res, 200, {
        leetcodeId,
        solutionRichText,
        solutionText: solutionHtmlToText(solutionRichText || '')
      });
    }

    const result = await query(
      `WITH request_user AS (
         SELECT id
         FROM user_handles
         WHERE handle = $1
           AND disabled_at IS NULL
       ),
       progress_rows AS (
         SELECT COALESCE(
           json_agg(json_build_object(
             'leetcodeId', q.leetcode_id,
             'completed', p.completed,
             'updatedAt', p.updated_at,
             'completedAt', p.completed_at,
             'hasSolutionNote', p.solution_rich_text IS NOT NULL AND length(trim(p.solution_rich_text)) > 0
           ) ORDER BY p.updated_at DESC),
           '[]'::json
         ) AS rows
         FROM request_user u
         JOIN progress_records p ON p.user_id = u.id
         JOIN question_catalog q ON q.id = p.question_id
       )
       SELECT EXISTS(SELECT 1 FROM request_user) AS "userValid",
              (SELECT rows FROM progress_rows) AS rows`,
      [handle]
    );
    if (!result.rows[0]?.userValid) {
      return sendError(res, 401, 'Unauthorized');
    }
    const rows = result.rows[0].rows;
    return sendJson(res, 200, Array.isArray(rows) ? rows : JSON.parse(rows || '[]'));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load progress';
    return sendError(res, authStatus(message), message);
  }
}

async function upsertProgress(req, res) {
  const body = parseBody(req);
  const leetcodeId = typeof body.leetcodeId === 'string' ? body.leetcodeId.trim() : '';
  const completed = Boolean(body.completed);
  const hasSolutionText = Object.prototype.hasOwnProperty.call(body, 'solutionText');
  const solutionRichText =
    hasSolutionText
      ? textToSolutionHtml(body.solutionText)
      : typeof body.solutionRichText === 'string' && body.solutionRichText.trim().length > 0
      ? sanitizeSolutionHtml(body.solutionRichText)
      : null;
  const hasSolutionRichText = hasSolutionText || Object.prototype.hasOwnProperty.call(body, 'solutionRichText');
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const difficulty = typeof body.difficulty === 'string' ? body.difficulty.trim() : '';
  const link = typeof body.link === 'string' ? body.link.trim() : '';
  const mainPattern = typeof body.mainPattern === 'string' ? body.mainPattern.trim() : '';
  const subPattern = typeof body.subPattern === 'string' ? body.subPattern.trim() : '';
  const metadataJson = body.metadataJson == null ? null : String(body.metadataJson);

  if (!leetcodeId) {
    return sendError(res, 400, 'leetcodeId is required');
  }

  try {
    const user = await requireUser(req);
    let questionResult = await query('SELECT id, leetcode_id FROM question_catalog WHERE leetcode_id = $1', [leetcodeId]);
    if (!questionResult.rows[0]) {
      if (!title || !difficulty || !link) {
        return sendError(res, 404, 'Question not found in catalog');
      }
      questionResult = await query(
        `INSERT INTO question_catalog (
           leetcode_id, title, difficulty, main_pattern, sub_pattern, link,
           default_question, custom_imported, imported_by_handle, content_type, metadata_json,
           created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, false, true, 'system-local-progress', 'QUESTION_ONLY', $7, NOW(), NOW())
         ON CONFLICT (leetcode_id) DO UPDATE SET
           updated_at = NOW()
         RETURNING id, leetcode_id`,
        [
          leetcodeId,
          title,
          difficulty,
          mainPattern || 'Company',
          subPattern || '-',
          link,
          metadataJson
        ]
      );
    }
    const questionId = questionResult.rows[0].id;

    const result = await query(
      `INSERT INTO progress_records (user_id, question_id, completed, updated_at, completed_at, solution_rich_text)
       VALUES ($1, $2, $3, NOW(), CASE WHEN $3 THEN NOW() ELSE NULL END, $4)
       ON CONFLICT (user_id, question_id) DO UPDATE SET
         completed = EXCLUDED.completed,
         updated_at = NOW(),
         completed_at = CASE WHEN EXCLUDED.completed THEN NOW() ELSE NULL END,
         solution_rich_text = CASE WHEN $5 THEN EXCLUDED.solution_rich_text ELSE progress_records.solution_rich_text END
       RETURNING
         (SELECT leetcode_id FROM question_catalog WHERE id = progress_records.question_id) AS "leetcodeId",
         completed,
         updated_at AS "updatedAt",
         completed_at AS "completedAt",
         solution_rich_text IS NOT NULL AND length(trim(solution_rich_text)) > 0 AS "hasSolutionNote",
         CASE WHEN $5 THEN solution_rich_text ELSE NULL END AS "solutionRichText",
         CASE WHEN $5 THEN solution_rich_text ELSE NULL END AS "solutionText"`,
      [user.id, questionId, completed, solutionRichText, hasSolutionRichText]
    );
    if (result.rows[0]?.solutionText) {
      result.rows[0].solutionText = solutionHtmlToText(result.rows[0].solutionText);
    }

    return sendJson(res, 200, result.rows[0]);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save progress';
    return sendError(res, authStatus(message), message);
  }
}
