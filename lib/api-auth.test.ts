import assert from "node:assert/strict";
import test from "node:test";
import { requireRecordsApiSecret } from "./api-auth";

test("records API is disabled without secret", async () => {
  const prev = process.env.RECORDS_API_SECRET;
  try {
    delete process.env.RECORDS_API_SECRET;
    const denied = requireRecordsApiSecret(new Request("http://localhost/api/records"));
    assert.ok(denied);
    assert.equal(denied.status, 503);
  } finally {
    if (prev === undefined) delete process.env.RECORDS_API_SECRET;
    else process.env.RECORDS_API_SECRET = prev;
  }
});

test("records API accepts matching bearer token", async () => {
  const prev = process.env.RECORDS_API_SECRET;
  try {
    process.env.RECORDS_API_SECRET = "test-secret";
    const denied = requireRecordsApiSecret(
      new Request("http://localhost/api/records", {
        headers: { Authorization: "Bearer test-secret" },
      }),
    );
    assert.equal(denied, null);

    const unauthorized = requireRecordsApiSecret(
      new Request("http://localhost/api/records", {
        headers: { Authorization: "Bearer wrong" },
      }),
    );
    assert.ok(unauthorized);
    assert.equal(unauthorized.status, 401);
  } finally {
    if (prev === undefined) delete process.env.RECORDS_API_SECRET;
    else process.env.RECORDS_API_SECRET = prev;
  }
});
