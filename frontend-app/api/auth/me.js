import { allowMethods, sendError, sendJson } from '../../server/http.js';
import { requireUser } from '../../server/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    allowMethods(res, ['GET']);
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    const user = await requireUser(req);
    return sendJson(res, 200, { handle: user.handle });
  } catch {
    return sendError(res, 401, 'Unauthorized');
  }
}
