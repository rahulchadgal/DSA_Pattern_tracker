import crypto from 'node:crypto';
import { query } from '../server/db.js';
import { allowMethods, normalizeHandle, parseBody, sendError, sendJson } from '../server/http.js';
import { createAdminToken, hashPassword, requireAdmin } from '../server/auth.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return handleGet(req, res);
  }
  if (req.method === 'POST') {
    return handlePost(req, res);
  }

  allowMethods(res, ['GET', 'POST']);
  return sendError(res, 405, 'Method not allowed');
}

async function handleGet(req, res) {
  const action = String(req.query.action || '').toLowerCase();
  if (action !== 'users') {
    return sendError(res, 404, 'Unknown admin action');
  }

  try {
    await requireAdmin(req);
    const result = await query(
      `SELECT u.handle,
              u.full_name AS "fullName",
              u.disabled_at AS "disabledAt",
              u.created_at AS "createdAt",
              COUNT(p.id)::INT AS "progressCount",
              COUNT(CASE WHEN p.completed THEN 1 END)::INT AS "completedCount"
       FROM user_handles u
       LEFT JOIN progress_records p ON p.user_id = u.id
       GROUP BY u.id
       ORDER BY u.handle ASC`
    );
    return sendJson(res, 200, result.rows);
  } catch (error) {
    return sendError(res, 401, error instanceof Error ? error.message : 'Unauthorized');
  }
}

async function handlePost(req, res) {
  const body = parseBody(req);
  const action = String(body.action || '').toLowerCase();

  if (action === 'login') {
    return login(body, res);
  }
  if (action === 'reset-password') {
    return resetPassword(req, body, res);
  }
  if (action === 'disable') {
    return setUserDisabled(req, body, res, true);
  }
  if (action === 'enable') {
    return setUserDisabled(req, body, res, false);
  }

  return sendError(res, 404, 'Unknown admin action');
}

function login(body, res) {
  const expected = process.env.ADMIN_ACCESS_KEY || '';
  const provided = String(body.adminKey || '');
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

async function resetPassword(req, body, res) {
  try {
    await requireAdmin(req);
    const handle = normalizeHandle(body.handle);
    const password = typeof body.password === 'string' ? body.password : '';
    if (!handle || password.length < 8 || password.length > 120) {
      return sendError(res, 400, 'Valid handle and 8-120 character password are required');
    }
    const result = await query(
      `UPDATE user_handles
       SET password_hash = $2, disabled_at = NULL, updated_at = NOW()
       WHERE handle = $1
       RETURNING handle`,
      [handle, await hashPassword(password)]
    );
    if (!result.rows[0]) {
      return sendError(res, 404, 'User not found');
    }
    return sendJson(res, 200, { handle: result.rows[0].handle });
  } catch (error) {
    return sendError(res, 401, error instanceof Error ? error.message : 'Unauthorized');
  }
}

async function setUserDisabled(req, body, res, disabled) {
  try {
    await requireAdmin(req);
    const handle = normalizeHandle(body.handle);
    if (!handle) {
      return sendError(res, 400, 'Handle is required');
    }

    const result = await query(
      `UPDATE user_handles
       SET disabled_at = ${disabled ? 'COALESCE(disabled_at, NOW())' : 'NULL'}, updated_at = NOW()
       WHERE handle = $1
       RETURNING handle, disabled_at AS "disabledAt"`,
      [handle]
    );
    if (!result.rows[0]) {
      return sendError(res, 404, 'User not found');
    }
    return sendJson(res, 200, result.rows[0]);
  } catch (error) {
    return sendError(res, 401, error instanceof Error ? error.message : 'Unauthorized');
  }
}
