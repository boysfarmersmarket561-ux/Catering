/** In-memory sliding-window throttle. Per server instance — a basic bot brake,
 *  not a distributed limiter; acceptable for this app's traffic. */
const hits = new Map<string, number[]>();

export function allowRequest(
  key: string,
  limit = 5,
  windowMs = 60 * 60 * 1000,
  now = Date.now(),
): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}
