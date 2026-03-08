function sanitizeObject(input) {
  if (Array.isArray(input)) return input.map(sanitizeObject);
  if (!input || typeof input !== 'object') return input;

  const out = {};
  for (const [key, value] of Object.entries(input)) {
    // Blocks common NoSQL operator key abuse
    const safeKey = key.replace(/\$/g, '').replace(/\./g, '_');
    out[safeKey] = sanitizeObject(value);
  }
  return out;
}

export function sanitizeInput(req, _res, next) {
  if (req.body && typeof req.body === 'object') req.body = sanitizeObject(req.body);
  if (req.query && typeof req.query === 'object') req.query = sanitizeObject(req.query);
  if (req.params && typeof req.params === 'object') req.params = sanitizeObject(req.params);
  next();
}
