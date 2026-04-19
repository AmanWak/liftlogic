const RATE_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;
const buckets = new Map<string, number[]>();

export function aiRateLimit(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_WINDOW_MS;
  const hits = (buckets.get(ip) ?? []).filter((t) => t > cutoff);

  if (hits.length >= MAX_REQUESTS_PER_WINDOW) {
    buckets.set(ip, hits);
    return false;
  }

  hits.push(now);
  buckets.set(ip, hits);

  if (buckets.size > 1000) {
    for (const [key, values] of buckets) {
      if (values.every((t) => t <= cutoff)) buckets.delete(key);
    }
  }

  return true;
}