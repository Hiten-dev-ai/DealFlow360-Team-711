export function createRateLimiter({ max = 8, windowMs = 5 * 60 * 1000 } = {}) {
  const buckets = new Map();

  return (key) => {
    const now = Date.now();
    const current = buckets.get(key);
    if (!current || now - current.startedAt >= windowMs) {
      buckets.set(key, { startedAt: now, count: 1 });
      return false;
    }
    current.count += 1;
    return current.count > max;
  };
}
