import { query } from '../../server/db.js';
import { sendError, sendJson } from '../../server/http.js';

function normalizeBucket(value) {
  const v = String(value || 'all').toLowerCase();
  if (v === '30d') return 2;
  if (v === '3m') return 4;
  if (v === '6m') return 8;
  return 1;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed');
  }

  const company = typeof req.query.company === 'string' ? req.query.company.trim() : '';
  const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
  const bucketBit = normalizeBucket(req.query.bucket);

  try {
    let sql = `SELECT
                 q.id AS "questionId",
                 q.leetcode_id AS "leetcodeId",
                 q.title,
                 q.difficulty,
                 q.link,
                 m.company_name AS "companyName",
                 m.bucket_mask AS "bucketMask"
               FROM question_company_map m
               JOIN question_catalog q ON q.id = m.question_id
               WHERE 1=1`;
    const params = [];

    if (company) {
      params.push(company);
      sql += ` AND m.company_name = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND lower(m.company_name) LIKE $${params.length}`;
    }
    if (bucketBit !== 1) {
      params.push(bucketBit);
      sql += ` AND (m.bucket_mask & $${params.length}) <> 0`;
    }

    sql += ' ORDER BY m.company_name ASC, q.leetcode_id ASC';

    const result = await query(sql, params);
    return sendJson(res, 200, result.rows);
  } catch (error) {
    return sendError(res, 500, error instanceof Error ? error.message : 'Unable to load company questions');
  }
}

