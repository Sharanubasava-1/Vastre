import test from "node:test";
import assert from "node:assert/strict";
import {
  exchangeGoogle,
  popupGoogle,
  googleMessage,
} from "../src/auth/googleFlow.js";

function fixture() {
  const calls = [];
  const credential = {
    user: {
      emailVerified: true,
      getIdToken: async (fresh) => {
        calls.push(["token", fresh]);
        return "public-test-token";
      },
    },
  };
  const sdk = {
    auth: {},
    provider: {},
    signOut: async () => {
      calls.push("signOut");
    },
    signInWithPopup: async () => credential,
    signInWithRedirect: async () => {
      calls.push("redirect");
    },
  };
  const exchange = async (token) => {
    assert.equal(token, "public-test-token");
    calls.push("session");
    return { id: 1 };
  };
  return { calls, credential, sdk, exchange };
}
test("Google session exchange signs Firebase out before returning the app user", async () => {
  const { calls, sdk, exchange } = fixture();
  assert.deepEqual(await popupGoogle(sdk, exchange), { id: 1 });
  assert.deepEqual(calls, [["token", true], "session", "signOut"]);
});
test("Google failures still sign Firebase out, and unverified emails never reach the API", async () => {
  const { calls, sdk, credential } = fixture();
  credential.user.emailVerified = false;
  await assert.rejects(
    exchangeGoogle(sdk, credential, () => assert.fail("Must not exchange")),
    { code: "auth/unverified-email" },
  );
  assert.deepEqual(calls, ["signOut"]);
  credential.user.emailVerified = true;
  await assert.rejects(
    exchangeGoogle(sdk, credential, async () => {
      throw new Error("API unavailable");
    }),
  );
  assert.equal(calls.at(-1), "signOut");
});
test("blocked popup persists only the return intent and falls back to redirect", async () => {
  const { calls, sdk, exchange } = fixture();
  sdk.signInWithPopup = async () => {
    throw { code: "auth/popup-blocked" };
  };
  assert.equal(
    await popupGoogle(sdk, exchange, async () => calls.push("intent")),
    null,
  );
  assert.deepEqual(calls, ["intent", "redirect"]);
});
test("cancel is silent; provider errors are friendly and never echo raw messages", () => {
  assert.equal(googleMessage({ code: "auth/popup-closed-by-user" }), "");
  for (const error of [
    { code: "auth/network-request-failed" },
    { code: "auth/user-disabled" },
    { status: 429 },
    { code: "auth/unverified-email" },
    { code: "auth/unauthorized-domain" },
    {},
  ]) {
    assert.ok(googleMessage({ ...error, message: "secret-provider-message" }));
    assert.ok(
      !googleMessage({ ...error, message: "secret-provider-message" }).includes(
        "secret-provider-message",
      ),
    );
  }
  assert.match(
    googleMessage({ code: "auth/unauthorized-domain" }, "unexpected.test"),
    /unexpected.test.*localhost:5173/,
  );
});
