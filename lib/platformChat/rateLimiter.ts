// In-memory, per-process rate limiter for the unauthenticated platform
// chatbot — there's no user_id to key a DB-backed limit against here like
// every other AI route uses. This is fine for a single dev/small-scale
// instance but resets on restart and doesn't share state across multiple
// server instances — a real production deployment behind a load balancer
// would need a shared store (Redis/Upstash) instead. Flagging that
// honestly rather than pretending this scales.
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 8;

const hits = new Map<string, number[]>();

export function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  timestamps.push(now);
  hits.set(ip, timestamps);
  return timestamps.length > MAX_REQUESTS;
}
