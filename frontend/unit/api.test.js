import test from "node:test";
import assert from "node:assert/strict";
import api from "../src/api/client.js";

test("API writes include CSRF header and credentials, including DELETE", async () => {
  const original = global.fetch,
    calls = [];
  global.fetch = async (...args) => {
    calls.push(args);
    return { ok: true, json: async () => ({ ok: true }) };
  };
  try {
    await api("/auth/me");
    await api("/auth/login", {
      email: "fixture@example.test",
      password: "public-fixture-password",
    });
    await api("/auth/sessions/public-id", undefined, { method: "DELETE" });
    assert.equal(calls[0][1].credentials, "include");
    assert.equal(calls[0][1].body, undefined);
    for (const call of calls.slice(1))
      assert.equal(call[1].headers["X-Requested-With"], "vastre");
    assert.equal(calls[1][1].method, "POST");
    assert.equal(calls[2][1].method, "DELETE");
    assert.equal(calls[2][1].body, undefined);
  } finally {
    global.fetch = original;
  }
});

test("protected errors broadcast status only; credential failures and anonymous bootstrap stay inline", async () => {
  const originalFetch = global.fetch,
    originalWindow = global.window,
    originalEvent = global.CustomEvent;
  const events = [];
  global.window = { dispatchEvent: (event) => events.push(event.detail) };
  global.CustomEvent = class {
    constructor(type, options) {
      this.type = type;
      this.detail = options.detail;
    }
  };
  global.fetch = async () => ({
    ok: false,
    status: 401,
    json: async () => ({ detail: "Incorrect email or password." }),
  });
  try {
    for (const path of [
      "/auth/login",
      "/auth/google",
      "/auth/me",
      "/auth/change-password",
    ])
      await assert.rejects(api(path), { status: 401 });
    assert.equal(events.length, 0);
    await assert.rejects(api("/orders"), { status: 401 });
    await assert.rejects(api("/auth/me", undefined, { authError: "session" }));
    assert.deepEqual(events, [{ status: 401 }, { status: 401 }]);
  } finally {
    global.fetch = originalFetch;
    global.window = originalWindow;
    global.CustomEvent = originalEvent;
  }
});
