const SENSITIVE_KEY_PATTERN = /(password|secret|token|authorization|cookie|api[_-]?key|private[_-]?key|otp|hash)/i;

const shouldDropKey = (key) => {
  const normalized = key.toLowerCase().replace(/[-_]/g, '');
  if (normalized === 'accesstoken' || normalized === 'sandboxotp') {
    return false;
  }
  return (
    SENSITIVE_KEY_PATTERN.test(key)
    || key.startsWith('$')
  );
};

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

    const serialized = serialize(nestedValue, seen);
    if (serialized !== undefined) {
      output[key] = serialized;
    }
  }

  return output;
};
