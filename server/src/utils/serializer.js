const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'refreshToken',
  'refreshTokenHash',
  'token',
  'secret',
  'apiKey',
  'privateKey',
]);

const shouldDropKey = (key) => (
  SENSITIVE_KEYS.has(key)
  || key.startsWith('$')
);

export const serialize = (value, seen = new WeakSet()) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value
      .map((item) => serialize(item, seen))
      .filter((item) => item !== undefined);
  }

  if (value instanceof Map) {
    return serialize(Object.fromEntries(value.entries()), seen);
  }

  if (seen.has(value)) return undefined;
  seen.add(value);

  const output = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (shouldDropKey(key)) continue;

    const outputKey = key === '_id' ? 'id' : key;
    const serialized = serialize(nestedValue, seen);
    if (serialized !== undefined) {
      output[outputKey] = serialized;
    }
  }

  return output;
};
