import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

export type RateLimitBucket = "analyze" | "embed" | "amazon_audit";

const RATE_LIMIT_MESSAGE = "请求过于频繁，请稍后再试";

const BUCKET_LIMITS: Record<RateLimitBucket, { requests: number; window: `${number} m` }> = {
  analyze: { requests: 30, window: "10 m" },
  embed: { requests: 40, window: "10 m" },
  amazon_audit: { requests: 10, window: "10 m" },
};

let warnedMissingEnv = false;
const limiters = new Map<RateLimitBucket, Ratelimit>();

function readEnv(key: string): string {
  return (process.env[key] ?? "").trim();
}

export function isRateLimitConfigured(): boolean {
  return Boolean(readEnv("UPSTASH_REDIS_REST_URL") && readEnv("UPSTASH_REDIS_REST_TOKEN"));
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

function getLimiter(bucket: RateLimitBucket): Ratelimit | null {
  if (!isRateLimitConfigured()) {
    if (!warnedMissingEnv) {
      warnedMissingEnv = true;
      console.warn("[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN unset; rate limiting skipped");
    }
    return null;
  }

  const existing = limiters.get(bucket);
  if (existing) return existing;

  const { requests, window } = BUCKET_LIMITS[bucket];
  const limiter = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(requests, window),
    prefix: `rl:${bucket}`,
  });
  limiters.set(bucket, limiter);
  return limiter;
}

export function rateLimitedResponse(retryAfterSeconds: number): NextResponse {
  const retryAfter = Math.max(1, Math.ceil(retryAfterSeconds));
  return NextResponse.json(
    { ok: false, error: RATE_LIMIT_MESSAGE, error_type: "rate_limited" },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfter) },
    },
  );
}

/** Returns a 429 response when over quota; null when allowed or rate limit is disabled. */
export async function enforceRateLimit(
  request: Request,
  bucket: RateLimitBucket,
): Promise<NextResponse | null> {
  const limiter = getLimiter(bucket);
  if (!limiter) return null;

  try {
    const ip = getClientIp(request);
    const result = await limiter.limit(ip);
    if (result.success) return null;

    const retryAfterSeconds = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
    return rateLimitedResponse(retryAfterSeconds);
  } catch (error) {
    console.warn(
      "[rate-limit] Upstash check failed; allowing request:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
