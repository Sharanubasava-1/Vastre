import test from "node:test";
import assert from "node:assert/strict";
import { normalizeStoredCart } from "../src/utils/cart.js";
test("damaged cart data cannot crash the global header or become checkout rows", () => {
  const valid = { product_id: "shirt", size: "M", quantity: 2 };
  assert.deepEqual(
    normalizeStoredCart([
      null,
      {},
      false,
      valid,
      { ...valid, quantity: 3 },
      { ...valid, size: "L", quantity: 0 },
      { ...valid, size: "XL", quantity: 11 },
      { ...valid, size: "S", quantity: 1.5 },
    ]),
    [valid],
  );
  assert.deepEqual(normalizeStoredCart({ items: [valid] }), []);
  assert.deepEqual(normalizeStoredCart([{ ...valid, unexpected: "legacy" }]), [
    valid,
  ]);
});
