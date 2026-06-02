import crypto from 'node:crypto';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const requestId = (req, res, next) => {
  const incoming = req.get('x-request-id');
  const isValid = incoming && incoming.length <= 36 && UUID_PATTERN.test(incoming);
  req.id = isValid ? incoming : crypto.randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
};
