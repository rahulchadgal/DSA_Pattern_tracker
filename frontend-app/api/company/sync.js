import { sendError, sendJson } from '../../server/http.js';
import { syncCompanyQuestions } from '../../server/companySync.js';

function isAuthorized(req) {
  const expected = process.env.COMPANY_SYNC_SECRET;
  if (!expected) return false;
  const provided = req.headers['x-company-sync-secret'];
  return typeof provided === 'string' && provided === expected;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }
  if (!isAuthorized(req)) {
    return sendError(res, 401, 'Unauthorized');
  }

  try {
    const result = await syncCompanyQuestions();
    return sendJson(res, 200, result);
  } catch (error) {
    return sendError(res, 500, error instanceof Error ? error.message : 'Sync failed');
  }
}

