import assert from "node:assert/strict";
import test from "node:test";
import { withRetry } from "./concurrency";

test("withRetry does not retry rate-limit / 429 errors", async () => {
  let attempts = 0;
  await assert.rejects(
    async () =>
      withRetry(async () => {
        attempts += 1;
        throw new Error("请求过于频繁，请稍后再试");
      }, 2, 1),
    /过于频繁/,
  );
  assert.equal(attempts, 1);
});

test("withRetry still retries 5xx-style errors", async () => {
  let attempts = 0;
  const value = await withRetry(async () => {
    attempts += 1;
    if (attempts < 2) throw new Error("HTTP 502");
    return "ok";
  }, 2, 1);
  assert.equal(value, "ok");
  assert.equal(attempts, 2);
});
