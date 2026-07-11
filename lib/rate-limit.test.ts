import assert from "node:assert/strict";
import test from "node:test";
import {
  enforceRateLimit,
  getClientIp,
  isRateLimitConfigured,
  rateLimitedResponse,
} from "./rate-limit";

test("getClientIp prefers first x-forwarded-for hop", () => {
  const request = new Request("https://example.com/api/analyze", {
    headers: {
      "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      "x-real-ip": "198.51.100.1",
    },
  });
  assert.equal(getClientIp(request), "203.0.113.10");
});

test("getClientIp falls back to x-real-ip then unknown", () => {
  assert.equal(
    getClientIp(new Request("https://example.com", { headers: { "x-real-ip": "198.51.100.2" } })),
    "198.51.100.2",
  );
  assert.equal(getClientIp(new Request("https://example.com")), "unknown");
});

test("rateLimitedResponse returns 429 with Retry-After and Chinese message", () => {
  const response = rateLimitedResponse(12.4);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "13");
});

test("enforceRateLimit allows all requests when Upstash env is unset", async () => {
  const previousUrl = process.env.UPSTASH_REDIS_REST_URL;
  const previousToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;

  try {
    assert.equal(isRateLimitConfigured(), false);
    const limited = await enforceRateLimit(
      new Request("https://example.com/api/analyze", {
        headers: { "x-forwarded-for": "203.0.113.99" },
      }),
      "analyze",
    );
    assert.equal(limited, null);
  } finally {
    if (previousUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = previousUrl;
    if (previousToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = previousToken;
  }
});

test("rateLimitedResponse JSON body uses rate_limited error_type", async () => {
  const body = await rateLimitedResponse(5).json() as {
    ok: boolean;
    error: string;
    error_type: string;
  };
  assert.equal(body.ok, false);
  assert.equal(body.error_type, "rate_limited");
  assert.match(body.error, /过于频繁/);
});
