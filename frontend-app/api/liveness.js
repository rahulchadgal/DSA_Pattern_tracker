import { query } from '../server/db.js';
import { allowMethods, sendError, sendJson } from '../server/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    allowMethods(res, ['GET']);
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    await query('SELECT 1');
    return sendJson(res, 200, { status: 'UP' });
  } catch (error) {
    return sendError(res, 500, error instanceof Error ? error.message : 'Database unavailable');
  }
}

