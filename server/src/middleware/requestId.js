import crypto from 'node:crypto';

export function requestId(req, res, next) {
  const incoming = req.headers['x-request-id'];
  req.requestId = typeof incoming === 'string' && incoming ? incoming : crypto.randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
}
