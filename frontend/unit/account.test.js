import test from "node:test";
import assert from "node:assert/strict";
import {
  safeReturnTo,
  validateAuth,
  passwordStrength,
} from "../src/utils/auth.js";
import { orderItems, orderDate } from "../src/utils/orders.js";
test("login return destination preserves internal query/hash and rejects external or looping URLs", () => {
  assert.equal(
    safeReturnTo("/cart?step=address#delivery-address"),
    "/cart?step=address#delivery-address",
  );
  assert.equal(safeReturnTo("/account?tab=orders"), "/account?tab=orders");
  for (const path of [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/login",
    "/admin/login?next=x",
    "/shop\n//evil.example",
  ])
    assert.equal(safeReturnTo(path), "/account");
  assert.equal(safeReturnTo(null, "/admin"), "/admin");
});
test("auth validation matches name, email and backend password bounds without imposing strength rules", () => {
  assert.deepEqual(
    validateAuth({ email: "person@example.com", password: "password123" }),
    {},
  );
  assert.equal(
    Object.keys(
      validateAuth({ name: " ", email: "bad", password: "short" }, true),
    ).length,
    3,
  );
  assert.match(
    validateAuth({ email: "person@example.com", password: "a".repeat(129) })
      .password,
    /128/,
  );
  assert.equal(passwordStrength("short").score, 0);
  assert.deepEqual(
    validateAuth({ email: "person@example.com", password: "oldpass8" }),
    {},
  );
  assert.match(
    validateAuth(
      { name: "Name", email: "person@example.com", password: "oldpass8" },
      true,
    ).password,
    /10/,
  );
  assert.equal(passwordStrength("Very-long-Password!23").score, 4);
});
test("order cards read the backend details JSON and omit unavailable or invalid dates", () => {
  const items = [{ product_id: "shirt", size: "M", quantity: 2 }];
  assert.deepEqual(orderItems({ details: JSON.stringify({ items }) }), items);
  assert.deepEqual(orderItems({ payload: JSON.stringify({ items }) }), items);
  assert.deepEqual(orderItems({ items }), items);
  assert.deepEqual(orderItems({ details: "bad json" }), []);
  assert.equal(orderDate({}), null);
  assert.equal(orderDate({ created_at: "invalid" }), null);
  assert.equal(orderDate({ created_at: 1792195200 }), "17 Oct 2026");
});
