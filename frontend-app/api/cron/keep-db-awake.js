import { query } from '../../server/db.js';
import { allowMethods, sendError, sendJson } from '../../server/http.js';

function isAuthorized(req) {
  const secret = String(process.env.CRON_SECRET || '').trim();
  if (!secret) {
    return true;
  }

  const header = req.headers.authorization || req.headers.Authorization || '';
  return String(header) === `Bearer ${secret}`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    allowMethods(res, ['GET']);
    return sendError(res, 405, 'Method not allowed');
  }

  if (!isAuthorized(req)) {
    return sendError(res, 401, 'Unauthorized');
  }

  try {
    await query('SELECT 1');
    return sendJson(res, 200, { status: 'ok', checkedAt: new Date().toISOString() });
  } catch (error) {
    return sendError(res, 500, error instanceof Error ? error.message : 'Database keepalive failed');
  }
}
