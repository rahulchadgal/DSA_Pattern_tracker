import { sendError, sendJson } from '../../../server/http.js';
import { getCompanySyncStatus } from '../../../server/companySync.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    const status = await getCompanySyncStatus();
    return sendJson(res, 200, status);
  } catch (error) {
    return sendError(res, 500, error instanceof Error ? error.message : 'Unable to fetch sync status');
  }
}

