import { tooMany } from "./errors";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): void {
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    throw tooMany(`Rate limit exceeded. Try again after ${new Date(bucket.resetAt).toISOString()}`);
  }
}

export function resetRateLimits(): void {
  buckets.clear();
}
