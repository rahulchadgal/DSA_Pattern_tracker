import crypto from 'node:crypto';
import { allowMethods, parseBody, sendError, sendJson } from '../../server/http.js';
import { createAdminToken } from '../../server/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    allowMethods(res, ['POST']);
    return sendError(res, 405, 'Method not allowed');
  }

  const expected = process.env.ADMIN_ACCESS_KEY || '';
  const provided = String(parseBody(req).adminKey || '');
  if (!expected) {
    return sendError(res, 500, 'Admin access is not configured');
  }
  const valid =
    provided.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (!valid) {
    return sendError(res, 401, 'Invalid admin key');
  }

  return sendJson(res, 200, { token: createAdminToken() });
}
