/** In-memory sliding-window throttle. Per server instance — a basic bot brake,
 *  not a distributed limiter; acceptable for this app's traffic. */
const hits = new Map<string, number[]>();

/** Keys are caller-supplied (IP-derived), so the map would otherwise grow for the
 *  life of the process. Sweep fully-expired keys once it gets large. */
const SWEEP_THRESHOLD = 1000;

function sweepExpired(windowMs: number, now: number): void {
  for (const [k, times] of hits) {
    if (times.every((t) => now - t >= windowMs)) hits.delete(k);
  }
}

export function allowRequest(
  key: string,
  limit = 5,
  windowMs = 60 * 60 * 1000,
  now = Date.now(),
): boolean {
  if (hits.size >= SWEEP_THRESHOLD) sweepExpired(windowMs, now);
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}
