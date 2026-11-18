import test from "node:test";
import assert from "node:assert/strict";
import {
  ownerId,
  ownerStorageKey,
  readOwner,
  persistOwner,
  mergeGuest,
  mergeCarts,
  mergeWishlists,
} from "../src/utils/ownerStorage.js";
import { EMPTY_ADDRESS } from "../src/utils/checkout.js";

function storage(seed = {}) {
  const values = new Map(
    Object.entries(seed).map(([key, value]) => [key, JSON.stringify(value)]),
  );
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
const shirt = (quantity, size = "M") => ({
  product_id: "shirt",
  size,
  quantity,
});
const address = { ...EMPTY_ADDRESS, id: "home", label: "Home" };
test("owner keys use user IDs, never email, and have a distinct guest namespace", () => {
  assert.equal(ownerId(null), "guest");
  assert.equal(ownerId({ id: 123, email: "private@example.test" }), "u123");
  assert.equal(
    ownerStorageKey("cart", ownerId({ id: 123 })),
    "vastre-cart:u123",
  );
  assert.notEqual(ownerId({ id: 123 }), ownerId({ id: 124 }));
  assert.equal(ownerId({ id: "a:b" }), "ua%3Ab");
});
test("cart merge takes max, caps at ten, keeps size/product variants, and is idempotent", () => {
  const result = mergeCarts(
    [shirt(4), shirt(1, "L")],
    [shirt(3), { product_id: "jeans", size: "M", quantity: 20 }],
  );
  assert.deepEqual(result, [
    shirt(4),
    shirt(1, "L"),
    { product_id: "jeans", size: "M", quantity: 10 },
  ]);
  assert.deepEqual(mergeCarts(result, result), result);
  assert.deepEqual(mergeCarts([shirt(2)], [shirt(8)]), [shirt(8)]);
  assert.deepEqual(mergeWishlists(["shirt", "jeans"], ["shirt", null, {}]), [
    "shirt",
    "jeans",
  ]);
});
test("legacy unscoped keys migrate to guest once and are removed", () => {
  const disk = storage({
    "vastre-cart": [shirt(5)],
    "vastre-wishlist": ["shirt"],
    "vastre-addresses": [address],
    "vastre-cart:guest": [shirt(2)],
  });
  const guest = readOwner(disk, "guest");
  assert.deepEqual(guest.cart, [shirt(5)]);
  assert.deepEqual(guest.ids, ["shirt"]);
  assert.deepEqual(guest.addresses, [address]);
  persistOwner(disk, guest);
  for (const kind of ["cart", "wishlist", "addresses"])
    assert.equal(disk.getItem(`vastre-${kind}`), null);
  assert.deepEqual(readOwner(disk, "guest"), guest);
  persistOwner(disk, readOwner(disk, "guest"));
  assert.deepEqual(readOwner(disk, "guest"), guest);
});
test("login merges only cart/wishlist, consumes guest data, and preserves each account", () => {
  const disk = storage({
    "vastre-cart:guest": [shirt(4)],
    "vastre-wishlist:guest": ["shirt"],
    "vastre-addresses:guest": [address],
    "vastre-cart:u1": [shirt(2)],
    "vastre-addresses:u1": [{ ...address, id: "owned" }],
  });
  const owned = mergeGuest(readOwner(disk, "u1"), readOwner(disk, "guest"));
  assert.deepEqual(owned.cart, [shirt(4)]);
  assert.deepEqual(owned.ids, ["shirt"]);
  assert.equal(owned.addresses[0].id, "owned");
  persistOwner(disk, owned);
  assert.deepEqual(readOwner(disk, "guest"), {
    owner: "guest",
    cart: [],
    ids: [],
    addresses: [],
  });
  assert.deepEqual(readOwner(disk, "u2"), {
    owner: "u2",
    cart: [],
    ids: [],
    addresses: [],
  });
  assert.deepEqual(readOwner(disk, "u1"), owned);
});
test("old account-scoped addresses migrate only to their original owner", () => {
  const disk = storage({ "vastre-addresses:7": [address] });
  assert.deepEqual(readOwner(disk, "u8").addresses, []);
  const owned = readOwner(disk, "u7");
  assert.deepEqual(owned.addresses, [address]);
  persistOwner(disk, owned);
  assert.equal(disk.getItem("vastre-addresses:7"), null);
  assert.deepEqual(readOwner(disk, "u7").addresses, [address]);
});
test("damaged cart still drops bad rows but retains unavailable products for removal", () => {
  const disk = storage({
    "vastre-cart": [
      null,
      shirt(0),
      shirt(11),
      shirt(2),
      shirt(3),
      { product_id: "gone", size: "M", quantity: 1 },
    ],
  });
  assert.deepEqual(readOwner(disk, "guest").cart, [
    shirt(2),
    { product_id: "gone", size: "M", quantity: 1 },
  ]);
  disk.setItem("vastre-wishlist:guest", "broken-json");
  assert.deepEqual(readOwner(disk, "guest").ids, []);
});
test("unavailable storage stays usable and failed writes do not remove recoverable data", () => {
  const disk = {
    getItem: () => {
      throw Error("blocked");
    },
    setItem: () => {
      throw Error("blocked");
    },
    removeItem: () => assert.fail("Must not remove on failed writes"),
  };
  const guest = readOwner(disk, "guest");
  assert.deepEqual(guest.cart, []);
  assert.doesNotThrow(() => persistOwner(disk, guest));
});
