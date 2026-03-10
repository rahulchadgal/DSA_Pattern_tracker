export function normalizeHandle(handle) {
  if (typeof handle !== 'string') return null;
  const trimmed = handle.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

export function allowMethods(res, methods) {
  res.setHeader('Allow', methods.join(', '));
}

export function sendJson(res, statusCode, payload) {
  res.status(statusCode).json(payload);
}

export function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

export function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

